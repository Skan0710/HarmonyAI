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

export interface GenerateAutoplayParams {
  userId: string;
  currentTrackId?: string;
  seedSongId?: string;
  limit?: number;
  context?: RecommendationContextAttributes | string | null;
  sessionDoc?: IListeningSession | null;
  sessionProfile?: SessionTasteProfile | null;
  currentQueueSongIds?: string[];
  lastPlayedArtistId?: string;
  diversityFactor?: number;
  noveltyFactor?: number;
  isDebugMode?: boolean;
}

export class SmartAutoplayService {
  /**
   * Generates the next songs for continuous autoplay during an active listening session:
   * 1. Uses the existing recommendation engine (HybridRecommendationService / HybridRankingPipeline).
   * 2. Integrates:
   *    - Current track (as seed)
   *    - User's long-term preferences (UserTasteProfile affinity)
   *    - Current listening session profile (SessionTasteProfileService)
   *    - Active listening context (study, workout, focus, etc.)
   *    - Recently played tracks (hard repetition prevention)
   *    - Skipped tracks (penalized & filtered)
   *    - Completed & replayed tracks (amplified)
   *    - Artist & genre diversity constraints
   *    - Novelty & exploration balance
   * 3. Completely separate from the frontend player logic.
   * 4. Returns ranked list with configurable count.
   */
  static async generateAutoplayCandidates(
    params: GenerateAutoplayParams
  ): Promise<SmartAutoplayResult> {
    const {
      userId,
      currentTrackId,
      seedSongId,
      limit = 5,
      context,
      currentQueueSongIds = [],
      lastPlayedArtistId,
      diversityFactor = 0.20,
      noveltyFactor = 0.15,
      isDebugMode = false,
    } = params;

    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID provided for smart autoplay generation');
    }

    // 1. Resolve Active Session & Session Profile
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

    // Resolve context from parameter or active session
    const effectiveContext =
      context ||
      (session?.sessionContext
        ? (session.sessionContext as RecommendationContextAttributes)
        : session?.contextSnapshot
        ? (session.contextSnapshot as any)
        : null);

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

    // Exclude the currently playing track from immediate repeat
    if (effectiveCurrentTrackId) {
      playedSongIdsSet.add(effectiveCurrentTrackId);
    }

    // 3. Generate candidate tracks using CandidateGenerationService
    let candidates: HybridCandidate[] = await CandidateGenerationService.generateHybridCandidates({
      userId,
      seedSongId: effectiveCurrentTrackId,
      candidateLimit: Math.max(30, limit * 6),
    });

    // Cold-start fallback if candidate generation yields empty pool
    if (candidates.length === 0) {
      const fallbackRes = await ColdStartRecommendationService.getColdStartRecommendations({
        userId,
        limit: Math.max(20, limit * 4),
      });

      candidates = fallbackRes.songs.map((songDoc, idx) => ({
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

    // 5. Post-Processing: Skip Avoidance, Queue Avoidance, Immediate Repeat Suppression
    const immediateRecentPlays = new Set(recentPlaysList.slice(-5)); // Last 5 played songs

    const eligibleCandidates: Array<{
      item: HybridRankedResult;
      adjustedAutoplayScore: number;
    }> = [];

    for (const res of rankedResults) {
      const songId = res.song._id ? res.song._id.toString() : '';
      if (!songId) continue;

      // Rule A: Avoid songs skipped in active session
      if (skippedSongIdsSet.has(songId)) {
        filteredSkippedCount++;
        continue;
      }

      // Rule B: Avoid songs already in manual queue
      if (queueSongIdsSet.has(songId)) {
        filteredQueueCount++;
        continue;
      }

      // Rule C: Prevent immediately recent tracks from repeating (last 5 songs)
      if (immediateRecentPlays.has(songId) || songId === effectiveCurrentTrackId) {
        penalizedPlayedCount++;
        continue;
      }

      let adjustedScore = res.hybridScore;

      // Penalize songs played earlier in session
      if (playedSongIdsSet.has(songId)) {
        penalizedPlayedCount++;
        adjustedScore = Number((adjustedScore * 0.45).toFixed(4));
      }

      eligibleCandidates.push({
        item: res,
        adjustedAutoplayScore: adjustedScore,
      });
    }

    // Sort descending by adjusted autoplay score
    eligibleCandidates.sort((a, b) => b.adjustedAutoplayScore - a.adjustedAutoplayScore);

    // 6. Diversity & Artist Balance: Prevent back-to-back same artist
    const selectedTracks: SmartAutoplayTrackItem[] = [];
    const selectedCandidates: AutoplayCandidateResult[] = [];
    let previousArtistId = lastPlayedArtistId || '';
    const artistCountMap = new Map<string, number>();

    for (const cand of eligibleCandidates) {
      if (selectedTracks.length >= limit) break;

      const songDoc = cand.item.song;
      const artistId =
        typeof songDoc.artist === 'object' && songDoc.artist && '_id' in songDoc.artist
          ? String(songDoc.artist._id)
          : String(songDoc.artist || 'unknown');

      const genreName =
        typeof songDoc.genre === 'object' && songDoc.genre && 'name' in songDoc.genre
          ? String(songDoc.genre.name)
          : String(songDoc.genre || 'Various');

      // Prevent consecutive same artist when ample candidates exist
      if (artistId === previousArtistId && eligibleCandidates.length > limit) {
        diversityFilteredCount++;
        if (artistId === lastPlayedArtistId) {
          lastPlayedArtistSuppressed = true;
        }
        continue;
      }

      // Cap max tracks from same artist in immediate autoplay queue (max 2)
      const currentArtistCount = artistCountMap.get(artistId) || 0;
      if (currentArtistCount >= 2 && eligibleCandidates.length > limit) {
        diversityFilteredCount++;
        continue;
      }

      // Format clear explanation reason
      let reason = 'Selected based on your current listening vibe';
      if (sessionProfile && sessionProfile.preferredGenres.length > 0) {
        const topGenre = sessionProfile.preferredGenres[0].genre;
        reason = `Matches your active session flow and ${topGenre} tracks`;
      } else if (effectiveContext) {
        const ctxStr = typeof effectiveContext === 'string' ? effectiveContext : effectiveContext.situation || 'session';
        reason = `Tuned for your ${ctxStr} listening context`;
      } else if (cand.item.sources.includes('taste_profile')) {
        reason = 'Personalized match based on your taste profile';
      }

      const trackItem: SmartAutoplayTrackItem = {
        song: songDoc,
        autoplayScore: cand.adjustedAutoplayScore,
        hybridScore: cand.item.hybridScore,
        sessionScore: cand.item.componentScores.sessionScore,
        contextScore: cand.item.componentScores.contextScore,
        reason,
        sources: cand.item.sources,
      };

      const legacyCandidate: AutoplayCandidateResult = {
        song: songDoc,
        autoplayScore: cand.adjustedAutoplayScore,
        sessionRelevanceScore: cand.item.componentScores.sessionScore || cand.item.hybridScore,
        hybridScore: cand.item.hybridScore,
        artistId,
        genre: genreName,
        reason,
        sources: cand.item.sources,
      };

      selectedTracks.push(trackItem);
      selectedCandidates.push(legacyCandidate);

      previousArtistId = artistId;
      artistCountMap.set(artistId, currentArtistCount + 1);
    }

    // Backfill if diversity was overly strict and returned fewer than limit
    if (selectedTracks.length < limit) {
      for (const cand of eligibleCandidates) {
        if (selectedTracks.length >= limit) break;

        const songId = cand.item.song._id ? cand.item.song._id.toString() : '';
        const alreadyChosen = selectedTracks.some((t) => t.song._id?.toString() === songId);
        if (alreadyChosen) continue;

        const songDoc = cand.item.song;
        const artistId =
          typeof songDoc.artist === 'object' && songDoc.artist && '_id' in songDoc.artist
            ? String(songDoc.artist._id)
            : String(songDoc.artist || 'unknown');
        const genreName =
          typeof songDoc.genre === 'object' && songDoc.genre && 'name' in songDoc.genre
            ? String(songDoc.genre.name)
            : String(songDoc.genre || 'Various');

        const trackItem: SmartAutoplayTrackItem = {
          song: songDoc,
          autoplayScore: cand.adjustedAutoplayScore,
          hybridScore: cand.item.hybridScore,
          sessionScore: cand.item.componentScores.sessionScore,
          contextScore: cand.item.componentScores.contextScore,
          reason: 'Recommended next track for continuous autoplay',
          sources: cand.item.sources,
        };

        const legacyCandidate: AutoplayCandidateResult = {
          song: songDoc,
          autoplayScore: cand.adjustedAutoplayScore,
          sessionRelevanceScore: cand.item.componentScores.sessionScore || cand.item.hybridScore,
          hybridScore: cand.item.hybridScore,
          artistId,
          genre: genreName,
          reason: 'Recommended next track for continuous autoplay',
          sources: cand.item.sources,
        };

        selectedTracks.push(trackItem);
        selectedCandidates.push(legacyCandidate);
      }
    }

    const finalTracks = selectedTracks.slice(0, limit);
    const finalCandidates = selectedCandidates.slice(0, limit);

    const isDebugEnabled = isDebugMode && process.env.NODE_ENV !== 'production';

    return {
      tracks: finalTracks,
      candidates: finalCandidates,
      totalGenerated: finalTracks.length,
      currentTrackId: effectiveCurrentTrackId,
      sessionActive: Boolean(session && session.status === 'active'),
      contextApplied: typeof effectiveContext === 'string' ? effectiveContext : effectiveContext?.situation,
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
              selectedCount: finalTracks.length,
              lastPlayedArtistSuppressed,
              activeContext: typeof effectiveContext === 'string' ? effectiveContext : effectiveContext?.situation,
              activeSessionId: session?._id ? session._id.toString() : undefined,
            },
          }
        : {}),
    };
  }
}

export default SmartAutoplayService;
