import { Types } from 'mongoose';
import { ISong } from '../models/Song.js';
import { IListeningSession } from '../models/ListeningSession.js';
import { ListeningSessionService } from './listeningSessionService.js';
import { SessionCandidateGenerationService } from './sessionCandidateGenerationService.js';
import { ColdStartRecommendationService } from './coldStartRecommendationService.js';

export interface AutoplayCandidateResult {
  song: ISong;
  autoplayScore: number;
  sessionRelevanceScore: number;
  artistId: string;
  genre: string;
  reason: string;
}

export class SmartAutoplayService {
  /**
   * Generates smart autoplay candidate songs for continuous playback:
   * - Uses the adaptive session recommendation system for candidate generation.
   * - Ranks candidates using session relevance.
   * - Avoids songs recently skipped during the current session.
   * - Avoids excessive repetition of songs already played in current session.
   * - Applies diversity filtering to prevent consecutive songs from the same artist.
   * - Keeps the user's manual queue untouched by excluding existing queued track IDs.
   * - Returns a configurable number of autoplay candidates.
   */
  static async generateAutoplayCandidates(params: {
    userId: string;
    sessionDoc?: IListeningSession;
    limit?: number;
    currentQueueSongIds?: string[];
    lastPlayedArtistId?: string;
  }): Promise<AutoplayCandidateResult[]> {
    const {
      userId,
      limit = 5,
      currentQueueSongIds = [],
      lastPlayedArtistId,
    } = params;

    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID provided for autoplay candidate generation');
    }

    let session = params.sessionDoc;
    if (!session) {
      session = (await ListeningSessionService.getActiveSession(userId)) || undefined;
    }

    const queueSongIdsSet = new Set<string>(currentQueueSongIds.map((id) => id.toString()));
    const skippedSongIdsSet = new Set<string>();
    const playedSongIdsSet = new Set<string>();

    if (session) {
      if (session.sessionEvents) {
        session.sessionEvents.forEach((ev) => {
          if (ev.action === 'skip') {
            skippedSongIdsSet.add(ev.song.toString());
          }
        });
      }
      if (session.songsPlayed) {
        session.songsPlayed.forEach((sp) => {
          playedSongIdsSet.add(sp.song.toString());
        });
      }
    }

    // 1. Generate Candidates via Adaptive Session Recommendation System
    let rawCandidates = await SessionCandidateGenerationService.generateSessionCandidates({
      userId,
      sessionDoc: session,
      limit: Math.max(15, limit * 3),
      excludePlayed: false, // Handle nuanced filtering here
      maxPerArtist: 3,
    });

    // Fallback to cold start / catalog if no session candidates
    if (rawCandidates.length === 0) {
      const fallbackRes = await ColdStartRecommendationService.getColdStartRecommendations({
        userId,
        limit: Math.max(15, limit * 3),
      });

      rawCandidates = fallbackRes.songs.map((songDoc, idx) => ({
        song: songDoc,
        sessionRelevanceScore: Number((0.85 - idx * 0.04).toFixed(4)),
        contentSimilarityScore: 0.5,
        sessionProfileAffinity: 0.5,
        source: 'session_profile_affinity' as const,
      }));
    }

    // 2. Filter Out Skipped Songs & Songs Currently in Manual Queue
    const eligiblePool = rawCandidates.filter((cand) => {
      const songId = cand.song._id.toString();

      // Rule A: Avoid songs recently skipped during current session
      if (skippedSongIdsSet.has(songId)) {
        return false;
      }

      // Rule B: Avoid songs currently in manual queue (keeps queue untouched)
      if (queueSongIdsSet.has(songId)) {
        return false;
      }

      return true;
    });

    // 3. Score Penalization for Songs Already Played in Session (avoid repetition)
    const scoredPool = eligiblePool.map((cand) => {
      const songId = cand.song._id.toString();
      let score = cand.sessionRelevanceScore;

      // Penalize recently played songs (reduce score by 40% if already played)
      if (playedSongIdsSet.has(songId)) {
        score = Number((score * 0.6).toFixed(4));
      }

      return {
        ...cand,
        autoplayScore: score,
      };
    });

    // Sort descending by autoplayScore
    scoredPool.sort((a, b) => b.autoplayScore - a.autoplayScore);

    // 4. Diversity Filtering: Prevent consecutive songs from the same artist
    const selectedAutoplay: AutoplayCandidateResult[] = [];
    let previousArtistId = lastPlayedArtistId || '';
    const artistUsageCount = new Map<string, number>();

    for (const cand of scoredPool) {
      if (selectedAutoplay.length >= limit) break;

      const songDoc = cand.song;
      const artistId =
        typeof songDoc.artist === 'object' && songDoc.artist && '_id' in songDoc.artist
          ? String(songDoc.artist._id)
          : String(songDoc.artist || 'unknown');

      const genreName =
        typeof songDoc.genre === 'object' && songDoc.genre && 'name' in songDoc.genre
          ? String(songDoc.genre.name)
          : String(songDoc.genre || 'Various');

      // Prevent consecutive songs from the same artist
      if (artistId === previousArtistId && scoredPool.length > limit) {
        continue;
      }

      // Cap total songs per artist in the autoplay selection (max 2)
      const currentCount = artistUsageCount.get(artistId) || 0;
      if (currentCount >= 2 && scoredPool.length > limit) {
        continue;
      }

      selectedAutoplay.push({
        song: songDoc,
        autoplayScore: cand.autoplayScore,
        sessionRelevanceScore: cand.sessionRelevanceScore,
        artistId,
        genre: genreName,
        reason:
          cand.source === 'session_content_similarity'
            ? 'Matches current session vibe & recent tracks'
            : 'Aligns with your active session preferences',
      });

      previousArtistId = artistId;
      artistUsageCount.set(artistId, currentCount + 1);
    }

    // If diversity constraints were too strict and returned fewer than requested limit, fill from remaining
    if (selectedAutoplay.length < limit) {
      for (const cand of scoredPool) {
        if (selectedAutoplay.length >= limit) break;

        const songId = cand.song._id.toString();
        const alreadySelected = selectedAutoplay.some((s) => s.song._id.toString() === songId);

        if (!alreadySelected) {
          const songDoc = cand.song;
          const artistId =
            typeof songDoc.artist === 'object' && songDoc.artist && '_id' in songDoc.artist
              ? String(songDoc.artist._id)
              : String(songDoc.artist || 'unknown');

          const genreName =
            typeof songDoc.genre === 'object' && songDoc.genre && 'name' in songDoc.genre
              ? String(songDoc.genre.name)
              : String(songDoc.genre || 'Various');

          selectedAutoplay.push({
            song: songDoc,
            autoplayScore: cand.autoplayScore,
            sessionRelevanceScore: cand.sessionRelevanceScore,
            artistId,
            genre: genreName,
            reason: 'Autoplay track selected based on active session session',
          });
        }
      }
    }

    return selectedAutoplay.slice(0, limit);
  }
}
