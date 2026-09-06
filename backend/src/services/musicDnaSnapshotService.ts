import { Types } from 'mongoose';
import {
  MusicDNASnapshot,
  IMusicDNASnapshot,
  ISnapshotTasteItem,
  ISnapshotMoodItem,
  ISnapshotListeningBehavior,
} from '../models/MusicDNASnapshot.js';
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
      userId: new Types.ObjectId(dna.userId),
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
   * Captures the current Music DNA for a user and creates a new immutable historical snapshot.
   * Never overwrites existing snapshots.
   */
  static async captureCurrentSnapshot(
    userId: string,
    options: CreateSnapshotOptions = {}
  ): Promise<IMusicDNASnapshot> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error(`Invalid userId provided for snapshot: ${userId}`);
    }

    // 1. Fetch current or refreshed profile
    const currentDNA = await UnifiedMusicDNAService.getOrGenerateProfile(userId, {
      forceRefresh: options.forceGenerate,
    });

    // 2. Build snapshot document payload
    const snapshotPayload = this.buildSnapshotDataFromUnifiedDNA(currentDNA, options);

    // 3. Save as a new snapshot (strictly append-only / immutable)
    const snapshot = new MusicDNASnapshot(snapshotPayload);
    return await snapshot.save();
  }

  /**
   * Retrieves snapshots for a user with optional date filtering and sorting.
   */
  static async getSnapshots(
    userId: string,
    options: GetSnapshotsOptions = {}
  ): Promise<IMusicDNASnapshot[]> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error(`Invalid userId provided: ${userId}`);
    }

    const uid = new Types.ObjectId(userId);
    const query: any = { userId: uid };

    if (options.startDate || options.endDate) {
      query.timestamp = {};
      if (options.startDate) query.timestamp.$gte = options.startDate;
      if (options.endDate) query.timestamp.$lte = options.endDate;
    }

    const sortDirection = options.sortAsc ? 1 : -1;
    const dbQuery = MusicDNASnapshot.find(query).sort({ timestamp: sortDirection });

    if (options.limit && options.limit > 0) {
      dbQuery.limit(options.limit);
    }

    return await dbQuery.exec();
  }

  /**
   * Returns the most recent snapshot for a user.
   */
  static async getLatestSnapshot(userId: string): Promise<IMusicDNASnapshot | null> {
    if (!Types.ObjectId.isValid(userId)) {
      return null;
    }
    return await MusicDNASnapshot.findLatestByUserId(userId);
  }

  /**
   * Retrieves the two most recent snapshots (latest and previous) for change detection comparison.
   */
  static async getSnapshotPair(userId: string): Promise<SnapshotPairResult> {
    if (!Types.ObjectId.isValid(userId)) {
      return { latest: null, previous: null, hasSufficientHistory: false };
    }

    const snapshots = await MusicDNASnapshot.find({ userId: new Types.ObjectId(userId) })
      .sort({ timestamp: -1 })
      .limit(2)
      .exec();

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
