import { Types } from 'mongoose';
import { ISong, Song } from '../models/Song.js';
import { IListeningSession } from '../models/ListeningSession.js';
import { ListeningSessionService } from './listeningSessionService.js';
import {
  SessionTasteProfile,
  SessionTasteProfileService,
} from './sessionTasteProfileService.js';
import { RecommendationContextAttributes } from '../schemas/recommendationContextSchema.js';
import {
  CandidateGenerationService,
  HybridCandidate,
} from './candidateGenerationService.js';
import {
  HybridRankingPipeline,
  HybridRankedResult,
} from './hybridRankingPipeline.js';
import { ColdStartRecommendationService } from './coldStartRecommendationService.js';

export interface AutoplayCandidateResult {
  song: any;
  autoplayScore: number;
  sessionRelevanceScore: number;
  hybridScore?: number;
  artistId: string;
  genre: string;
  reason: string;
  sources?: string[];
}

export interface SmartAutoplayTrackItem {
  song: any;
  autoplayScore: number;
  hybridScore: number;
  sessionScore?: number;
  contextScore?: number;
  reason: string;
  sources: string[];
}

export interface AdaptiveQueueTrackItem {
  song: any;
  queuePosition: number;
  queueScore: number;
  hybridScore: number;
  sessionScore?: number;
  contextScore?: number;
  tier: 'familiarity' | 'discovery' | 'balanced';
  reason: string;
  sources: string[];
}

export interface AutoplayDiagnostics {
  isDebugEnabled: boolean;
  sessionEventsCount: number;
  evaluatedCandidatesCount: number;
  filteredSkippedCount: number;
  filteredQueueCount: number;
  penalizedPlayedCount: number;
  diversityFilteredCount: number;
  selectedCount: number;
  lastPlayedArtistSuppressed: boolean;
  activeContext?: string;
  activeSessionId?: string;
}

export interface SmartAutoplayResult {
  tracks: SmartAutoplayTrackItem[];
  candidates: AutoplayCandidateResult[]; // Backwards compatibility with existing callers
  totalGenerated: number;
  currentTrackId?: string;
  sessionActive: boolean;
  contextApplied?: string;
  diagnostics?: AutoplayDiagnostics;
}

export interface AdaptiveQueueResult {
  queue: AdaptiveQueueTrackItem[];
  tracks: SmartAutoplayTrackItem[];
  candidates: AutoplayCandidateResult[];
  totalQueued: number;
  queueSize: number;
  currentTrackId?: string;
  sessionActive: boolean;
  contextPreserved?: string;
  balanceDistribution: {
    familiarityCount: number;
    discoveryCount: number;
    dominantGenres: string[];
    uniqueArtistsCount: number;
  };
  diagnostics?: AutoplayDiagnostics;
}

export interface GenerateAutoplayParams {
  userId: string;
  currentTrackId?: string;
  seedSongId?: string;
  limit?: number;
  queueSize?: number;
  context?: RecommendationContextAttributes | string | null;
  sessionDoc?: IListeningSession | null;
  sessionProfile?: SessionTasteProfile | null;
  currentQueueSongIds?: string[];
  lastPlayedArtistId?: string;
  diversityFactor?: number;
  noveltyFactor?: number;
  isDebugMode?: boolean;
}

export interface GenerateAdaptiveQueueParams extends GenerateAutoplayParams {
  targetFamiliarityRatio?: number; // default: 0.60
  targetDiscoveryRatio?: number;   // default: 0.40
}

export class SmartAutoplayService {
  /**
   * Generates an adaptive queue of upcoming tracks for continuous playback:
   * 1. Uses the existing hybrid recommendation engine (HybridRankingPipeline + CandidateGenerationService).
   * 2. Multidimensional balance:
   *    - Familiarity (tracks aligned with user's core taste and established favorites)
   *    - Discovery (fresh tracks matching acoustic vibe but novel in genre/artist)
   *    - Diversity (artist and genre variety; no back-to-back same artist, max 2 per artist)
   *    - Session Relevance (aligned with active listening situation, mood, energy, tempo)
   * 3. Repetition & Skip Prevention:
   *    - Zero duplicate tracks in the returned queue.
   *    - Hard exclusion of currently playing track and recent session plays (last 5-8 tracks).
   *    - Hard exclusion of tracks repeatedly or directly skipped in the active session.
   *    - Preservation of manual queue tracks.
   * 4. Configurable queue size (default 5, up to 30).
   * 5. Preserves user's active listening context.
   * 6. Strictly temporary/ephemeral: never permanently mutates user preferences.
   */
  static async generateAdaptiveQueue(
    params: GenerateAdaptiveQueueParams
  ): Promise<AdaptiveQueueResult> {
    const {
      userId,
      currentTrackId,
      seedSongId,
      limit,
      queueSize: requestedQueueSize,
      context,
      currentQueueSongIds = [],
      lastPlayedArtistId,
      targetFamiliarityRatio = 0.60,
      targetDiscoveryRatio = 0.40,
      isDebugMode = false,
    } = params;

    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID provided for adaptive queue generation');
    }

    const desiredSize = Math.max(1, Math.min(30, requestedQueueSize || limit || 5));

    // 1. Resolve Active Session, Current Track, and Session Profile
    let session = params.sessionDoc;
    if (!session) {
      session = (await ListeningSessionService.getActiveSession(userId)) || undefined;
    }

    const effectiveCurrentTrackId =
      currentTrackId ||
      seedSongId ||
      (session?.currentTrack ? session.currentTrack.toString() : undefined) ||
      (session?.currentSong ? session.currentSong.toString() : undefined);

    let sessionProfile = params.sessionProfile;
    if (!sessionProfile && session) {
      sessionProfile = (await SessionTasteProfileService.generateSessionTasteProfile(session)) || undefined;
    }

    // Preserve the user's current listening context
    const effectiveContext =
      context ||
      (session?.sessionContext
        ? (session.sessionContext as RecommendationContextAttributes)
        : session?.contextSnapshot
        ? (session.contextSnapshot as any)
        : null);

    const contextName = typeof effectiveContext === 'string'
      ? effectiveContext
      : effectiveContext?.situation || (effectiveContext?.mood ? `${effectiveContext.mood} mood` : undefined);

    // 2. Identify played, skipped, and queued song IDs for repetition & skip suppression
    const queueSongIdsSet = new Set<string>(currentQueueSongIds.map((id) => id.toString()));
    const skippedSongIdsSet = new Set<string>();
    const playedSongIdsSet = new Set<string>();
    const recentPlaysList: string[] = [];

    let sessionEventsCount = 0;
    if (session) {
      if (session.sessionEvents) {
        sessionEventsCount = session.sessionEvents.length;
        session.sessionEvents.forEach((ev) => {
          if (ev.action === 'skip' && ev.song) {
            skippedSongIdsSet.add(ev.song.toString());
          }
        });
      }
      if (session.tracksSkipped) {
        session.tracksSkipped.forEach((sk) => {
          if (sk.song) skippedSongIdsSet.add(sk.song.toString());
        });
      }
      const plays = session.tracksPlayed || session.songsPlayed || [];
      plays.forEach((sp) => {
        if (sp.song) {
          const sId = sp.song.toString();
          playedSongIdsSet.add(sId);
          recentPlaysList.push(sId);
        }
      });
    }

    // Exclude currently playing track from repeating
    if (effectiveCurrentTrackId) {
      playedSongIdsSet.add(effectiveCurrentTrackId);
    }

    // 3. Generate candidate tracks using the existing recommendation engine
    let candidates: HybridCandidate[] = await CandidateGenerationService.generateHybridCandidates({
      userId,
      seedSongId: effectiveCurrentTrackId,
      candidateLimit: Math.max(40, desiredSize * 8),
    });

    // Cold-start fallback if candidate generation yields empty pool
    if (candidates.length === 0) {
      const fallbackRes = await ColdStartRecommendationService.getColdStartRecommendations({
        userId,
        limit: Math.max(25, desiredSize * 5),
      });

      candidates = fallbackRes.songs.map((songDoc) => ({
        songId: songDoc._id.toString(),
        contentScore: 0.5,
        collaborativeScore: 0.5,
        userTasteAffinityScore: 0.5,
        popularitySignal: songDoc.playCount || 500,
        recencySignal: 0.8,
        sources: ['cold_start_autoplay'],
        songDoc,
      }));
    }

    // 4. Rank candidates using HybridRankingPipeline (Long-Term Taste + Session Profile + Context)
    const rankedResults: HybridRankedResult[] = HybridRankingPipeline.rankCandidates(
      candidates,
      candidates.length,
      undefined,
      effectiveContext,
      undefined,
      sessionProfile,
      undefined,
      session
    );

    let filteredSkippedCount = 0;
    let filteredQueueCount = 0;
    let penalizedPlayedCount = 0;
    let diversityFilteredCount = 0;
    let lastPlayedArtistSuppressed = false;

    // 5. Filter exclusions: avoid recently played (last 6 tracks), skipped tracks, manual queue
    const immediateRecentPlays = new Set(recentPlaysList.slice(-6));

    interface ScoredQueueCandidate {
      item: HybridRankedResult;
      songId: string;
      adjustedAutoplayScore: number;
      isFamiliar: boolean;
      isDiscovery: boolean;
      artistId: string;
      genreName: string;
    }

    const eligiblePool: ScoredQueueCandidate[] = [];

    for (const res of rankedResults) {
      const songId = res.song._id ? res.song._id.toString() : '';
      if (!songId) continue;

      // Rule A: Avoid tracks skipped in active session
      if (skippedSongIdsSet.has(songId)) {
        filteredSkippedCount++;
        continue;
      }

      // Rule B: Avoid tracks already in manual queue
      if (queueSongIdsSet.has(songId)) {
        filteredQueueCount++;
        continue;
      }

      // Rule C: Prevent current track & immediately recent plays from repeating
      if (immediateRecentPlays.has(songId) || songId === effectiveCurrentTrackId) {
        penalizedPlayedCount++;
        continue;
      }

      let adjustedScore = res.hybridScore;

      // Heavily dampen songs played earlier in session
      if (playedSongIdsSet.has(songId)) {
        penalizedPlayedCount++;
        adjustedScore = Number((adjustedScore * 0.40).toFixed(4));
      }

      const songDoc = res.song;
      const artistId =
        typeof songDoc.artist === 'object' && songDoc.artist && '_id' in songDoc.artist
          ? String(songDoc.artist._id)
          : String(songDoc.artist || 'unknown');

      const genreName =
        typeof songDoc.genre === 'object' && songDoc.genre && 'name' in songDoc.genre
          ? String(songDoc.genre.name)
          : String(songDoc.genre || 'Various');

      const tasteAffinity = res.componentScores.userTasteAffinityScore || 0;
      const isFamiliar = tasteAffinity >= 0.65 || res.sources.includes('taste_profile');
      const isDiscovery =
        (res.componentScores.noveltyScore !== undefined && res.componentScores.noveltyScore > 0.40) ||
        (!isFamiliar && (res.componentScores.contextScore || 0) >= 0.60);

      eligiblePool.push({
        item: res,
        songId,
        adjustedAutoplayScore: adjustedScore,
        isFamiliar,
        isDiscovery,
        artistId,
        genreName,
      });
    }

    // Sort descending by score
    eligiblePool.sort((a, b) => b.adjustedAutoplayScore - a.adjustedAutoplayScore);

    // 6. Adaptive Queue Assembly: Balance Familiarity, Discovery, and Diversity
    const queue: AdaptiveQueueTrackItem[] = [];
    const tracks: SmartAutoplayTrackItem[] = [];
    const candidatesOut: AutoplayCandidateResult[] = [];

    const chosenSongIds = new Set<string>(); // Strict duplicate prevention
    const artistUsageMap = new Map<string, number>();
    let previousArtistId = lastPlayedArtistId || '';
    let previousGenre = '';
    let consecutiveGenreCount = 0;

    let familiarityCount = 0;
    let discoveryCount = 0;

    // Helper to evaluate diversity fit for a candidate
    const isDiversitySafe = (cand: ScoredQueueCandidate): boolean => {
      // Prevent consecutive same artist when pool is large enough
      if (cand.artistId === previousArtistId && eligiblePool.length > desiredSize) {
        return false;
      }
      // Cap total tracks per artist in generated queue (max 2)
      const currentArtistUsage = artistUsageMap.get(cand.artistId) || 0;
      if (currentArtistUsage >= 2 && eligiblePool.length > desiredSize) {
        return false;
      }
      // Prevent excessive consecutive same genre (max 2 consecutive unless pool is tight)
      if (
        cand.genreName.toLowerCase() === previousGenre.toLowerCase() &&
        consecutiveGenreCount >= 2 &&
        eligiblePool.length > desiredSize
      ) {
        return false;
      }
      return true;
    };

    // Helper to add candidate to queue
    const addCandidateToQueue = (cand: ScoredQueueCandidate, tier: 'familiarity' | 'discovery' | 'balanced') => {
      chosenSongIds.add(cand.songId);
      const pos = queue.length + 1;

      // Update diversity trackers
      const currentUsage = artistUsageMap.get(cand.artistId) || 0;
      artistUsageMap.set(cand.artistId, currentUsage + 1);
      previousArtistId = cand.artistId;

      if (cand.genreName.toLowerCase() === previousGenre.toLowerCase()) {
        consecutiveGenreCount++;
      } else {
        previousGenre = cand.genreName;
        consecutiveGenreCount = 1;
      }

      if (tier === 'familiarity') familiarityCount++;
      if (tier === 'discovery') discoveryCount++;

      // Construct descriptive contextual reason
      let reason = 'Selected to match your active listening flow';
      if (tier === 'familiarity') {
        reason = contextName
          ? `Familiar favorite matching your ${contextName} session`
          : 'Familiar track tuned to your core taste';
      } else if (tier === 'discovery') {
        reason = contextName
          ? `Fresh discovery aligned with your ${contextName} targets`
          : 'Discovery track expanding your listening horizon';
      } else if (sessionProfile && sessionProfile.preferredGenres.length > 0) {
        const topGenre = sessionProfile.preferredGenres[0].genre;
        reason = `Flowing track matching your active session's ${topGenre} vibe`;
      }

      const queueItem: AdaptiveQueueTrackItem = {
        song: cand.item.song,
        queuePosition: pos,
        queueScore: cand.adjustedAutoplayScore,
        hybridScore: cand.item.hybridScore,
        sessionScore: cand.item.componentScores.sessionScore,
        contextScore: cand.item.componentScores.contextScore,
        tier,
        reason,
        sources: cand.item.sources,
      };

      const trackItem: SmartAutoplayTrackItem = {
        song: cand.item.song,
        autoplayScore: cand.adjustedAutoplayScore,
        hybridScore: cand.item.hybridScore,
        sessionScore: cand.item.componentScores.sessionScore,
        contextScore: cand.item.componentScores.contextScore,
        reason,
        sources: cand.item.sources,
      };

      const legacyCandidate: AutoplayCandidateResult = {
        song: cand.item.song,
        autoplayScore: cand.adjustedAutoplayScore,
        sessionRelevanceScore: cand.item.componentScores.sessionScore || cand.item.hybridScore,
        hybridScore: cand.item.hybridScore,
        artistId: cand.artistId,
        genre: cand.genreName,
        reason,
        sources: cand.item.sources,
      };

      queue.push(queueItem);
      tracks.push(trackItem);
      candidatesOut.push(legacyCandidate);
    };

    // Separate candidate pools
    const familiarityCandidates = eligiblePool.filter((c) => c.isFamiliar);
    const discoveryCandidates = eligiblePool.filter((c) => c.isDiscovery && !c.isFamiliar);

    // Target counts for balanced interleaving
    const targetFamiliarCount = Math.round(desiredSize * targetFamiliarityRatio);

    // Primary Pass: Interleaved queue building maintaining target balance and diversity
    for (let slot = 0; slot < desiredSize; slot++) {
      if (queue.length >= desiredSize) break;

      // Determine slot target: prioritize familiarity or discovery based on pacing
      const shouldPickDiscovery =
        (slot + 1) % 3 === 0 && discoveryCandidates.length > 0 && discoveryCount < (desiredSize - targetFamiliarCount);

      let chosen: ScoredQueueCandidate | undefined = undefined;
      let chosenTier: 'familiarity' | 'discovery' | 'balanced' = 'balanced';

      if (shouldPickDiscovery) {
        chosen = discoveryCandidates.find((c) => !chosenSongIds.has(c.songId) && isDiversitySafe(c));
        if (chosen) chosenTier = 'discovery';
      }

      if (!chosen && familiarityCandidates.length > 0 && familiarityCount < targetFamiliarCount) {
        chosen = familiarityCandidates.find((c) => !chosenSongIds.has(c.songId) && isDiversitySafe(c));
        if (chosen) chosenTier = 'familiarity';
      }

      // General fallback from overall eligible pool with diversity checks
      if (!chosen) {
        chosen = eligiblePool.find((c) => !chosenSongIds.has(c.songId) && isDiversitySafe(c));
        if (chosen) {
          chosenTier = chosen.isFamiliar ? 'familiarity' : chosen.isDiscovery ? 'discovery' : 'balanced';
        }
      }

      if (chosen) {
        addCandidateToQueue(chosen, chosenTier);
      } else {
        diversityFilteredCount++;
      }
    }

    // Secondary Backfill Pass: If diversity was too strict, relax constraints while preserving zero duplicates
    if (queue.length < desiredSize) {
      for (const cand of eligiblePool) {
        if (queue.length >= desiredSize) break;
        if (chosenSongIds.has(cand.songId)) continue; // Never duplicate tracks in queue

        const tier = cand.isFamiliar ? 'familiarity' : cand.isDiscovery ? 'discovery' : 'balanced';
        addCandidateToQueue(cand, tier);
      }
    }

    // Extract dominant genres and unique artists for distribution metadata
    const dominantGenresList = Array.from(
      new Set(queue.map((q) => (q.song.genre?.name || q.song.genre || '').toString()).filter(Boolean))
    );
    const uniqueArtistsCount = new Set(
      queue.map((q) => (q.song.artist?._id || q.song.artist || '').toString()).filter(Boolean)
    ).size;

    const isDebugEnabled = isDebugMode && process.env.NODE_ENV !== 'production';

    return {
      queue,
      tracks,
      candidates: candidatesOut,
      totalQueued: queue.length,
      queueSize: desiredSize,
      currentTrackId: effectiveCurrentTrackId,
      sessionActive: Boolean(session && session.status === 'active'),
      contextPreserved: contextName,
      balanceDistribution: {
        familiarityCount,
        discoveryCount,
        dominantGenres: dominantGenresList,
        uniqueArtistsCount,
      },
      ...(isDebugEnabled
        ? {
            diagnostics: {
              isDebugEnabled: true,
              sessionEventsCount,
              evaluatedCandidatesCount: rankedResults.length,
              filteredSkippedCount,
              filteredQueueCount,
              penalizedPlayedCount,
              diversityFilteredCount,
              selectedCount: queue.length,
              lastPlayedArtistSuppressed,
              activeContext: contextName,
              activeSessionId: session?._id ? session._id.toString() : undefined,
            },
          }
        : {}),
    };
  }

  /**
   * Generates smart autoplay candidates (aliases generateAdaptiveQueue for unified logic).
   */
  static async generateAutoplayCandidates(
    params: GenerateAutoplayParams
  ): Promise<SmartAutoplayResult> {
    const adaptiveResult = await this.generateAdaptiveQueue(params);
    return {
      tracks: adaptiveResult.tracks,
      candidates: adaptiveResult.candidates,
      totalGenerated: adaptiveResult.totalQueued,
      currentTrackId: adaptiveResult.currentTrackId,
      sessionActive: adaptiveResult.sessionActive,
      contextApplied: adaptiveResult.contextPreserved,
      diagnostics: adaptiveResult.diagnostics,
    };
  }
}

export default SmartAutoplayService;
