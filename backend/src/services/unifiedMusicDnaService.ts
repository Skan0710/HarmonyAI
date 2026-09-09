import { Types } from 'mongoose';
import { User } from '../models/User.js';
import { ListeningHistory } from '../models/ListeningHistory.js';
import { ListeningSession } from '../models/ListeningSession.js';
import { RecommendationInteraction } from '../models/RecommendationInteraction.js';
import { MusicDNA, IMusicDNA } from '../models/MusicDNA.js';
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
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }

    const rawInputs = await this.fetchUserData(userId, options.referenceDate);
    const unified = this.generateUnifiedProfileFromData(rawInputs, options);

    // Synchronize to MusicDNA Mongoose Document
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
    const existingDoc = await MusicDNA.findByUserId(userId);
    const cachedSnapshot = existingDoc?.metadata?.unifiedProfileSnapshot as UnifiedMusicDNA | undefined;

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
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }

    const doc = await MusicDNA.getOrCreateProfile(userId);

    if (updates.tendencies) {
      doc.tendencies = {
        ...doc.tendencies,
        ...updates.tendencies,
      } as any;
    }
    if (updates.listeningPatterns) {
      doc.listeningPatterns = {
        ...doc.listeningPatterns,
        ...updates.listeningPatterns,
      } as any;
    }
    if (updates.confidenceScore !== undefined) {
      doc.confidenceScore = updates.confidenceScore;
    }
    if (updates.metadata) {
      doc.metadata = {
        ...doc.metadata,
        ...updates.metadata,
      };
    }

    await doc.save();

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
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }

    const minThreshold = options.minInteractionsThreshold || 3;
    const maxAgeMs = (options.maxCacheAgeMinutes || 60) * 60 * 1000;
    const now = options.referenceDate ? new Date(options.referenceDate).getTime() : Date.now();

    const existingDoc = await MusicDNA.findByUserId(userId);
    const cachedSnapshot = existingDoc?.metadata?.unifiedProfileSnapshot as UnifiedMusicDNA | undefined;

    // Fetch current total plays count
    const currentPlaysCount = await ListeningHistory.countDocuments({
      user: new Types.ObjectId(userId),
    });

    if (cachedSnapshot && !options.forceRefresh) {
      const lastCount = cachedSnapshot.interactionsCountAtLastRefresh ?? 0;
      const newInteractionsCount = Math.max(0, currentPlaysCount - lastCount);
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
    const userObjectId = new Types.ObjectId(userId);

    const [userDoc, historyDocs, sessionDocs, feedbackDocs] = await Promise.all([
      User.findById(userObjectId)
        .populate({
          path: 'likedSongs',
          populate: [
            { path: 'genre', select: 'name' },
            { path: 'artist', select: 'name' },
          ],
        })
        .populate('favoriteGenres', 'name')
        .populate('favoriteArtists', 'name')
        .lean(),
      ListeningHistory.find({ user: userObjectId })
        .populate({
          path: 'song',
          select: 'title genre artist mood duration audioFeatures',
          populate: [
            { path: 'genre', select: 'name' },
            { path: 'artist', select: 'name' },
          ],
        })
        .sort({ playedAt: -1 })
        .lean(),
      ListeningSession.find({ user: userObjectId })
        .sort({ startTime: -1 })
        .limit(50)
        .lean(),
      RecommendationInteraction.find({ user: userObjectId })
        .sort({ timestamp: -1 })
        .limit(100)
        .lean(),
    ]);

    return {
      userId,
      user: userDoc as any,
      history: historyDocs as any,
      sessions: sessionDocs as any,
      feedback: feedbackDocs as any,
      referenceDate,
    };
  }

  private static async persistToMusicDNA(
    userId: string,
    unified: UnifiedMusicDNA
  ): Promise<IMusicDNA> {
    const userObjectId = new Types.ObjectId(userId);
    let doc = await MusicDNA.findByUserId(userObjectId);

    // Map top genres and artists into schema subdocuments
    const genres = unified.genreProfile.topGenres.map((g) => ({
      genre: g.id,
      name: g.name,
      affinityScore: g.score,
      playCount: g.playCount,
      lastInteractionAt: new Date(),
    }));

    const artists = unified.artistProfile.strongestArtists.map((a) => ({
      artist: a.id,
      name: a.name,
      affinityScore: a.score,
      playCount: a.playCount,
      lastInteractionAt: new Date(),
    }));

    const moods = unified.moodProfile.preferredMoods.map((m) => ({
      mood: m.name,
      affinityScore: m.score,
      playCount: m.playCount,
      lastInteractionAt: new Date(),
    }));

    if (doc) {
      doc.genres = genres as any;
      doc.artists = artists as any;
      doc.moods = moods as any;
      doc.listeningPatterns = unified.listeningPatterns as any;
      doc.tendencies = unified.tendencies as any;
      doc.temporalTaste = unified.temporalPreferences as any;
      doc.confidenceScore = unified.confidenceScore;
      doc.metadata = {
        ...doc.metadata,
        unifiedProfileSnapshot: unified,
        lastRefreshedAt: unified.lastRefreshedAt,
        interactionsCountAtLastRefresh: unified.interactionsCountAtLastRefresh,
      };
      return await doc.save();
    }

    doc = new MusicDNA({
      userId: userObjectId,
      dnaVersion: unified.dnaVersion,
      genres,
      artists,
      moods,
      listeningPatterns: unified.listeningPatterns,
      tendencies: unified.tendencies,
      temporalTaste: unified.temporalPreferences,
      confidenceScore: unified.confidenceScore,
      metadata: {
        unifiedProfileSnapshot: unified,
        lastRefreshedAt: unified.lastRefreshedAt,
        interactionsCountAtLastRefresh: unified.interactionsCountAtLastRefresh,
      },
    });

    return await doc.save();
  }
}

export default UnifiedMusicDNAService;
