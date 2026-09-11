import { supabase } from '../config/supabase.js';
import { isValidObjectId } from '../utils/validators.js';
import { fetchMusicDnaRawInputs } from './musicDnaDataFetchService.js';
import {
  MusicDNAExtractionService,
  ExtractionRawInputs,
  ExtractionOptions,
} from './musicDnaExtractionService.js';
import { MusicDNAProfilingService } from './musicDnaProfilingService.js';
import {
  MusicDNABehaviorProfilingService,
  BehaviorProfilingRawInputs,
} from './musicDnaBehaviorProfilingService.js';
import {
  UnifiedMusicDNA,
  UnifiedRefreshResult,
  MusicDNAProfileAttributes,
  MusicDNATendencyDimensions,
} from '../schemas/musicDnaSchema.js';

export interface UnifiedProfilingOptions extends ExtractionOptions {
  forceRefresh?: boolean;
  minInteractionsThreshold?: number;
  maxCacheAgeMinutes?: number;
}

export class UnifiedMusicDNAService {
  /**
   * Pure in-memory generator combining all Music DNA sub-services into one
   * cohesive UnifiedMusicDNA profile without requiring direct database queries.
   */
  static generateUnifiedProfileFromData(
    inputs: BehaviorProfilingRawInputs,
    options: UnifiedProfilingOptions = {}
  ): UnifiedMusicDNA {
    const { userId } = inputs;
    const now = options.referenceDate || new Date();
    const history = inputs.history || [];

    // 1. Extract Baseline Attributes (Listening Patterns & Baseline Dimensions)
    const baselineDNA = MusicDNAExtractionService.extractFromRawData(inputs, options);

    // 2. Generate Detailed Taste Profile (Top/Emerging Genres & Artists, Moods, Diversities)
    const detailedTaste = MusicDNAProfilingService.generateDetailedProfileFromData(inputs, options);

    // 3. Generate Listening Behavior Profile (9 Behavioral Metrics & Archetype)
    const listeningBehavior = MusicDNABehaviorProfilingService.profileListeningBehaviorFromData(inputs, options);

    // 4. Harmonize Core Tendency Dimensions
    // Synthesize tendencies between extraction, detailed diversities, and behavior metrics
    const tendencies: MusicDNATendencyDimensions = {
      discoveryTendency: listeningBehavior.isDataSufficient
        ? listeningBehavior.discoveryTendency
        : baselineDNA.tendencies.discoveryTendency,
      familiarityPreference: listeningBehavior.isDataSufficient
        ? listeningBehavior.familiarityPreference
        : baselineDNA.tendencies.familiarityPreference,
      diversityPreference: listeningBehavior.isDataSufficient
        ? listeningBehavior.diversityPreference
        : baselineDNA.tendencies.diversityPreference,
      explorationPreference: listeningBehavior.isDataSufficient
        ? listeningBehavior.explorationTendency
        : baselineDNA.tendencies.explorationPreference,
    };

    // 5. Confidence Score (weighted harmonization)
    const confidenceScore =
      history.length === 0
        ? baselineDNA.confidenceScore
        : Number(
            (
              0.4 * baselineDNA.confidenceScore +
              0.3 * detailedTaste.confidenceScore +
              0.3 * listeningBehavior.confidenceScore
            ).toFixed(4)
          );

    return {
      userId,
      dnaVersion: baselineDNA.dnaVersion || '1.0.0',
      genreProfile: {
        topGenres: detailedTaste.topGenres,
        emergingGenres: detailedTaste.emergingGenres,
        diversity: detailedTaste.genreDiversity,
      },
      artistProfile: {
        strongestArtists: detailedTaste.strongestArtists,
        emergingArtists: detailedTaste.emergingArtists,
        diversity: detailedTaste.artistDiversity,
      },
      moodProfile: {
        preferredMoods: detailedTaste.preferredMoods,
      },
      listeningBehavior,
      temporalPreferences: baselineDNA.temporalTaste,
      tendencies,
      listeningPatterns: baselineDNA.listeningPatterns,
      confidenceScore,
      lastRefreshedAt: now,
      interactionsCountAtLastRefresh: history.length,
      metadata: {
        generatedAt: now.toISOString(),
        archetype: listeningBehavior.listenerArchetype,
        isDataSufficient: listeningBehavior.isDataSufficient,
        totalPlaysAnalyzed: history.length,
        ...baselineDNA.metadata,
      },
    };
  }

  /**
   * Fetches user data, generates the Unified Music DNA profile, and persists
   * the synchronized state into the user's MusicDNA document in MongoDB.
   */
  static async generateProfile(
    userId: string,
    options: UnifiedProfilingOptions = {}
  ): Promise<UnifiedMusicDNA> {
    if (!isValidObjectId(userId)) {
      throw new Error('Invalid user ID');
    }

    const rawInputs = await this.fetchUserData(userId, options.referenceDate);
    const unified = this.generateUnifiedProfileFromData(rawInputs, options);

    // Synchronize to the music_dna row in Supabase
    await this.persistToMusicDNA(userId, unified);

    return unified;
  }

  /**
   * Retrieves existing Unified Music DNA profile if available and fresh;
   * otherwise generates and persists a new one.
   */
  static async getOrGenerateProfile(
    userId: string,
    options: UnifiedProfilingOptions = {}
  ): Promise<UnifiedMusicDNA> {
    const { data: existingRow } = await supabase
      .from('music_dna')
      .select('metadata')
      .eq('user_id', userId)
      .maybeSingle();
    const cachedSnapshot = (existingRow?.metadata as any)?.unifiedProfileSnapshot as UnifiedMusicDNA | undefined;

    const now = options.referenceDate ? new Date(options.referenceDate).getTime() : Date.now();
    const maxAgeMs = (options.maxCacheAgeMinutes || 60) * 60 * 1000;

    if (
      cachedSnapshot &&
      !options.forceRefresh &&
      cachedSnapshot.lastRefreshedAt &&
      now - new Date(cachedSnapshot.lastRefreshedAt).getTime() < maxAgeMs
    ) {
      return cachedSnapshot;
    }

    return await this.generateProfile(userId, options);
  }

  /**
   * Updates an existing user's Music DNA profile with custom tendencies or metadata,
   * keeping the document synchronized and avoiding unnecessary full recalculations.
   */
  static async updateProfile(
    userId: string,
    updates: Partial<MusicDNAProfileAttributes>
  ): Promise<UnifiedMusicDNA> {
    if (!isValidObjectId(userId)) {
      throw new Error('Invalid user ID');
    }

    const { data: existingRow } = await supabase
      .from('music_dna')
      .select('tendencies, listening_patterns, metadata')
      .eq('user_id', userId)
      .maybeSingle();

    const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
    if (updates.tendencies) {
      updatePayload.tendencies = { ...(existingRow?.tendencies as any), ...updates.tendencies };
    }
    if (updates.listeningPatterns) {
      updatePayload.listening_patterns = { ...(existingRow?.listening_patterns as any), ...updates.listeningPatterns };
    }
    if (updates.metadata) {
      updatePayload.metadata = { ...(existingRow?.metadata as any), ...updates.metadata };
    }

    await (supabase.from('music_dna') as any).upsert(
      { user_id: userId, ...updatePayload },
      { onConflict: 'user_id' }
    );

    // Refresh the unified snapshot
    return await this.generateProfile(userId, { forceRefresh: true });
  }

  /**
   * Smart Refresh: Evaluates whether meaningful new interactions have occurred
   * since the last refresh. Avoids recalculating unnecessarily when possible.
   */
  static async refreshAfterInteraction(
    userId: string,
    options: UnifiedProfilingOptions = {}
  ): Promise<UnifiedRefreshResult> {
    if (!isValidObjectId(userId)) {
      throw new Error('Invalid user ID');
    }

    const minThreshold = options.minInteractionsThreshold || 3;
    const maxAgeMs = (options.maxCacheAgeMinutes || 60) * 60 * 1000;
    const now = options.referenceDate ? new Date(options.referenceDate).getTime() : Date.now();

    const { data: existingRow } = await supabase
      .from('music_dna')
      .select('metadata')
      .eq('user_id', userId)
      .maybeSingle();
    const cachedSnapshot = (existingRow?.metadata as any)?.unifiedProfileSnapshot as UnifiedMusicDNA | undefined;

    // Fetch current total plays count
    const { count: currentPlaysCount } = await supabase
      .from('listening_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (cachedSnapshot && !options.forceRefresh) {
      const lastCount = cachedSnapshot.interactionsCountAtLastRefresh ?? 0;
      const newInteractionsCount = Math.max(0, (currentPlaysCount || 0) - lastCount);
      const lastRefreshTime = cachedSnapshot.lastRefreshedAt
        ? new Date(cachedSnapshot.lastRefreshedAt).getTime()
        : 0;
      const isCacheFresh = now - lastRefreshTime < maxAgeMs;

      // Avoid recalculating if new interactions are below threshold and cache is fresh
      if (newInteractionsCount < minThreshold && isCacheFresh) {
        return {
          profile: cachedSnapshot,
          refreshed: false,
          reason: `Recalculation skipped: only ${newInteractionsCount} new interaction(s) since last refresh (threshold: ${minThreshold}).`,
        };
      }
    }

    // Meaningful new activity or cache expired -> Trigger refresh
    const newProfile = await this.generateProfile(userId, options);
    return {
      profile: newProfile,
      refreshed: true,
      reason: options.forceRefresh
        ? 'Profile force-refreshed by request.'
        : cachedSnapshot
        ? 'Refreshed after meaningful new interactions or cache expiry.'
        : 'Initial profile generated.',
    };
  }

  // --------------------------------------------------------------------------
  // INTERNAL HELPERS
  // --------------------------------------------------------------------------

  private static async fetchUserData(
    userId: string,
    referenceDate?: Date
  ): Promise<BehaviorProfilingRawInputs> {
    const raw = await fetchMusicDnaRawInputs(userId, { referenceDate });
    return raw as unknown as BehaviorProfilingRawInputs;
  }

  private static async persistToMusicDNA(
    userId: string,
    unified: UnifiedMusicDNA
  ): Promise<void> {
    // Map top genres and artists into the shape the music_dna jsonb columns expect
    const genres = unified.genreProfile.topGenres.map((g) => ({
      genre: g.id,
      name: g.name,
      affinityScore: g.score,
      playCount: g.playCount,
      lastInteractionAt: new Date().toISOString(),
    }));

    const artists = unified.artistProfile.strongestArtists.map((a) => ({
      artist: a.id,
      name: a.name,
      affinityScore: a.score,
      playCount: a.playCount,
      lastInteractionAt: new Date().toISOString(),
    }));

    const moods = unified.moodProfile.preferredMoods.map((m) => ({
      mood: m.name,
      affinityScore: m.score,
      playCount: m.playCount,
      lastInteractionAt: new Date().toISOString(),
    }));

    const { data: existingRow } = await supabase
      .from('music_dna')
      .select('metadata')
      .eq('user_id', userId)
      .maybeSingle();

    const versionNumber = Number.parseInt(String(unified.dnaVersion).split('.')[0], 10) || 1;
    const nowIso = new Date().toISOString();

    const { error } = await (supabase.from('music_dna') as any).upsert(
      {
        user_id: userId,
        genres: genres as any,
        artists: artists as any,
        moods: moods as any,
        listening_patterns: unified.listeningPatterns as any,
        tendencies: unified.tendencies as any,
        temporal_taste: unified.temporalPreferences as any,
        version: versionNumber,
        last_calculated_at: nowIso,
        updated_at: nowIso,
        metadata: {
          ...(existingRow?.metadata as any),
          unifiedProfileSnapshot: unified,
          lastRefreshedAt: unified.lastRefreshedAt,
          interactionsCountAtLastRefresh: unified.interactionsCountAtLastRefresh,
        } as any,
      },
      { onConflict: 'user_id' }
    );

    if (error) {
      throw new Error(`Failed to persist Music DNA profile: ${error.message}`);
    }
  }
}

export default UnifiedMusicDNAService;
