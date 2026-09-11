import { supabase } from '../config/supabase.js';
import { isValidObjectId } from '../utils/validators.js';
import type {
  IMusicDNASnapshot,
  ISnapshotTasteItem,
  ISnapshotMoodItem,
  ISnapshotListeningBehavior,
} from '../types/domainModels.js';
import { UnifiedMusicDNAService } from './unifiedMusicDnaService.js';
import { UnifiedMusicDNA } from '../schemas/musicDnaSchema.js';

export interface CreateSnapshotOptions {
  triggerReason?: string;
  timestamp?: Date;
  forceGenerate?: boolean;
  metadata?: Record<string, any>;
}

export interface GetSnapshotsOptions {
  limit?: number;
  startDate?: Date;
  endDate?: Date;
  sortAsc?: boolean;
}

export interface SnapshotPairResult {
  latest: IMusicDNASnapshot | null;
  previous: IMusicDNASnapshot | null;
  hasSufficientHistory: boolean;
}

export class MusicDNASnapshotService {
  /**
   * Pure mapper converting a UnifiedMusicDNA profile into snapshot payload attributes.
   */
  static buildSnapshotDataFromUnifiedDNA(
    dna: UnifiedMusicDNA,
    options: CreateSnapshotOptions = {}
  ) {
    const timestamp = options.timestamp || new Date();
    const triggerReason = options.triggerReason || 'interaction_update';

    const topGenres: ISnapshotTasteItem[] = (dna.genreProfile?.topGenres || []).map((g) => ({
      name: g.name,
      affinityScore: Math.min(1.0, Math.max(0.0, Number(g.score) || 0)),
      playCount: g.playCount ?? 0,
      momentumDelta: g.momentumDelta ?? 0,
    }));

    const topArtists: ISnapshotTasteItem[] = (dna.artistProfile?.strongestArtists || []).map((a) => ({
      name: a.name,
      affinityScore: Math.min(1.0, Math.max(0.0, Number(a.score) || 0)),
      playCount: a.playCount ?? 0,
      momentumDelta: a.momentumDelta ?? 0,
    }));

    const preferredMoods: ISnapshotMoodItem[] = (dna.moodProfile?.preferredMoods || []).map((m) => ({
      mood: m.name,
      affinityScore: Math.min(1.0, Math.max(0.0, Number(m.score) || 0)),
      playCount: m.playCount ?? 0,
    }));

    const lb = dna.listeningBehavior;
    const listeningBehavior: ISnapshotListeningBehavior = {
      repeatListeningTendency: lb?.repeatListeningTendency ?? 0.5,
      discoveryTendency: lb?.discoveryTendency ?? 0.5,
      skipTendency: lb?.skipTendency ?? 0.5,
      familiarityPreference: lb?.familiarityPreference ?? 0.5,
      explorationTendency: lb?.explorationTendency ?? 0.5,
      diversityPreference: lb?.diversityPreference ?? 0.5,
      sessionListeningIntensity: lb?.sessionListeningIntensity ?? 0.5,
      preferenceStability: lb?.preferenceStability ?? 0.5,
      preferenceChangeRate: lb?.preferenceChangeRate ?? 0.5,
      listenerArchetype: lb?.listenerArchetype || 'Balanced Listener',
      isDataSufficient: lb?.isDataSufficient ?? false,
    };

    return {
      userId: dna.userId,
      snapshotVersion: dna.dnaVersion || '1.0.0',
      timestamp,
      triggerReason,
      topGenres,
      topArtists,
      preferredMoods,
      listeningBehavior,
      tendencies: {
        discoveryTendency: dna.tendencies?.discoveryTendency ?? 0.5,
        familiarityPreference: dna.tendencies?.familiarityPreference ?? 0.5,
        diversityPreference: dna.tendencies?.diversityPreference ?? 0.5,
        explorationPreference: dna.tendencies?.explorationPreference ?? 0.5,
      },
      confidenceScore: Math.min(1.0, Math.max(0.0, dna.confidenceScore ?? 0.1)),
      interactionsCount: dna.interactionsCountAtLastRefresh ?? 0,
      genreDiversity: dna.genreProfile?.diversity?.score ?? 0.5,
      artistDiversity: dna.artistProfile?.diversity?.score ?? 0.5,
      metadata: {
        ...dna.metadata,
        ...options.metadata,
      },
    };
  }

  /**
   * Maps a `music_dna_snapshots` row back into the old Mongoose-shaped
   * `IMusicDNASnapshot` interface that downstream consumers (change
   * detection, taste evolution timeline, stability transformation, etc.)
   * still expect.
   *
   * The Postgres table only has `genres` / `artists` / `moods` / `tendencies`
   * / `listening_patterns` (jsonb) + `snapshot_date` / `created_at` columns —
   * there's no dedicated column for `snapshotVersion`, `triggerReason`,
   * `confidenceScore`, `interactionsCount`, `genreDiversity`,
   * `artistDiversity`, or free-form `metadata` the way the old Mongoose
   * schema had. Those scalar extras are folded into the `tendencies` jsonb
   * blob on write (see `captureCurrentSnapshot`) and unpacked back out here;
   * `listening_patterns` is reused to hold the 9-metric listening-behavior
   * profile since the snapshot table has no separate column for it.
   */
  private static mapSnapshotRow(row: any): IMusicDNASnapshot {
    const t = row.tendencies || {};
    const createdAt = row.created_at ? new Date(row.created_at) : new Date();

    const mapped = {
      _id: row.id,
      userId: row.user_id,
      snapshotVersion: t.snapshotVersion || '1.0.0',
      timestamp: row.snapshot_date ? new Date(row.snapshot_date) : createdAt,
      triggerReason: t.triggerReason || 'interaction_update',
      topGenres: (row.genres || []) as ISnapshotTasteItem[],
      topArtists: (row.artists || []) as ISnapshotTasteItem[],
      preferredMoods: (row.moods || []) as ISnapshotMoodItem[],
      listeningBehavior: (row.listening_patterns || {}) as ISnapshotListeningBehavior,
      tendencies: {
        discoveryTendency: t.discoveryTendency ?? 0.5,
        familiarityPreference: t.familiarityPreference ?? 0.5,
        diversityPreference: t.diversityPreference ?? 0.5,
        explorationPreference: t.explorationPreference ?? 0.5,
      },
      confidenceScore: t.confidenceScore ?? 0.1,
      interactionsCount: t.interactionsCount ?? 0,
      genreDiversity: t.genreDiversity ?? 0.5,
      artistDiversity: t.artistDiversity ?? 0.5,
      metadata: t.metadata || {},
      createdAt,
      updatedAt: createdAt,
    };

    return mapped as unknown as IMusicDNASnapshot;
  }

  /**
   * Captures the current Music DNA for a user and creates a new immutable historical snapshot.
   * Never overwrites existing snapshots.
   */
  static async captureCurrentSnapshot(
    userId: string,
    options: CreateSnapshotOptions = {}
  ): Promise<IMusicDNASnapshot> {
    if (!isValidObjectId(userId)) {
      throw new Error(`Invalid userId provided for snapshot: ${userId}`);
    }

    // 1. Fetch current or refreshed profile
    const currentDNA = await UnifiedMusicDNAService.getOrGenerateProfile(userId, {
      forceRefresh: options.forceGenerate,
    });

    // 2. Build snapshot payload (pure mapper)
    const snapshotPayload = this.buildSnapshotDataFromUnifiedDNA(currentDNA, options);

    // 3. Insert as a new snapshot row (strictly append-only / immutable —
    // no unique constraint on user_id, unlike `music_dna`).
    const { data: inserted, error } = await (supabase.from('music_dna_snapshots') as any)
      .insert({
        user_id: String(snapshotPayload.userId),
        snapshot_date: snapshotPayload.timestamp.toISOString(),
        genres: snapshotPayload.topGenres as any,
        artists: snapshotPayload.topArtists as any,
        moods: snapshotPayload.preferredMoods as any,
        listening_patterns: snapshotPayload.listeningBehavior as any,
        tendencies: {
          ...snapshotPayload.tendencies,
          confidenceScore: snapshotPayload.confidenceScore,
          interactionsCount: snapshotPayload.interactionsCount,
          genreDiversity: snapshotPayload.genreDiversity,
          artistDiversity: snapshotPayload.artistDiversity,
          snapshotVersion: snapshotPayload.snapshotVersion,
          triggerReason: snapshotPayload.triggerReason,
          metadata: snapshotPayload.metadata,
        } as any,
      })
      .select()
      .single();

    if (error || !inserted) {
      throw new Error(`Failed to capture Music DNA snapshot: ${error?.message || 'unknown error'}`);
    }

    return this.mapSnapshotRow(inserted);
  }

  /**
   * Retrieves snapshots for a user with optional date filtering and sorting.
   */
  static async getSnapshots(
    userId: string,
    options: GetSnapshotsOptions = {}
  ): Promise<IMusicDNASnapshot[]> {
    if (!isValidObjectId(userId)) {
      throw new Error(`Invalid userId provided: ${userId}`);
    }

    let q = supabase.from('music_dna_snapshots').select('*').eq('user_id', userId);

    if (options.startDate) {
      q = q.gte('snapshot_date', options.startDate.toISOString());
    }
    if (options.endDate) {
      q = q.lte('snapshot_date', options.endDate.toISOString());
    }

    q = q.order('snapshot_date', { ascending: Boolean(options.sortAsc) });

    if (options.limit && options.limit > 0) {
      q = q.limit(options.limit);
    }

    const { data, error } = await q;
    if (error) {
      throw new Error(`Failed to fetch Music DNA snapshots: ${error.message}`);
    }

    return (data || []).map((row) => this.mapSnapshotRow(row));
  }

  /**
   * Returns the most recent snapshot for a user.
   */
  static async getLatestSnapshot(userId: string): Promise<IMusicDNASnapshot | null> {
    if (!isValidObjectId(userId)) {
      return null;
    }

    const { data, error } = await supabase
      .from('music_dna_snapshots')
      .select('*')
      .eq('user_id', userId)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapSnapshotRow(data);
  }

  /**
   * Retrieves the two most recent snapshots (latest and previous) for change detection comparison.
   */
  static async getSnapshotPair(userId: string): Promise<SnapshotPairResult> {
    if (!isValidObjectId(userId)) {
      return { latest: null, previous: null, hasSufficientHistory: false };
    }

    const { data, error } = await supabase
      .from('music_dna_snapshots')
      .select('*')
      .eq('user_id', userId)
      .order('snapshot_date', { ascending: false })
      .limit(2);

    const snapshots = error ? [] : (data || []).map((row) => this.mapSnapshotRow(row));

    const latest = snapshots.length > 0 ? snapshots[0] : null;
    const previous = snapshots.length > 1 ? snapshots[1] : null;

    return {
      latest,
      previous,
      hasSufficientHistory: snapshots.length >= 2,
    };
  }

  /**
   * Validates snapshot data bounds and required structures.
   */
  static validateSnapshotData(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!data) {
      return { isValid: false, errors: ['Snapshot data is required'] };
    }
    if (!data.userId) {
      errors.push('userId is required');
    }
    if (data.confidenceScore !== undefined && (data.confidenceScore < 0.0 || data.confidenceScore > 1.0)) {
      errors.push('confidenceScore must be between 0.0 and 1.0');
    }
    if (data.tendencies) {
      for (const key of ['discoveryTendency', 'familiarityPreference', 'diversityPreference', 'explorationPreference']) {
        const val = data.tendencies[key];
        if (val !== undefined && (val < 0.0 || val > 1.0)) {
          errors.push(`tendency ${key} must be between 0.0 and 1.0`);
        }
      }
    }
    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
