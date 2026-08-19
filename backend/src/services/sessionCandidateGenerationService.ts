import { Types } from 'mongoose';
import { ISong, Song } from '../models/Song.js';
import { IListeningSession } from '../models/ListeningSession.js';
import { ListeningSessionService } from './listeningSessionService.js';
import { SessionProfileService, TemporarySessionProfile } from './sessionProfileService.js';
import { ContentRecommendationService } from './recommendationService.js';
import { AdaptiveSessionScoringService } from './adaptiveSessionScoringService.js';
import { AdaptiveSessionScoringWeights } from '../config/recommendationConfig.js';

export interface SessionCandidateResult {
  song: ISong;
  sessionRelevanceScore: number;
  contentSimilarityScore: number;
  sessionProfileAffinity: number;
  interactionFeedbackScore?: number;
  positiveFeedbackBoost?: number;
  negativeFeedbackPenalty?: number;
  seedSongId?: string;
  source: 'session_content_similarity' | 'session_profile_affinity';
}

export class SessionCandidateGenerationService {
  /**
   * Generates ranked session-based candidate songs using adaptive session recommendation scoring.
   * - Uses recently played session tracks as primary seed signals.
   * - Boosts scores for songs similar to recently liked/replayed tracks.
   * - Reduces scores for songs similar to recently skipped tracks.
   * - Considers genre, artist, mood, energy, and tempo preferences.
   * - Gives higher weight to recent interactions with configurable weights.
   * - Excludes tracks already played in current session.
   * - Enforces artist diversity (max 2 songs per artist).
   * - Does not modify existing hybrid recommendation engine.
   */
  static async generateSessionCandidates(params: {
    userId: string;
    sessionDoc?: IListeningSession;
    limit?: number;
    excludePlayed?: boolean;
    maxPerArtist?: number;
    customWeights?: Partial<AdaptiveSessionScoringWeights>;
  }): Promise<SessionCandidateResult[]> {
    const { userId, limit = 10, excludePlayed = true, maxPerArtist = 2, customWeights } = params;

    let session = params.sessionDoc;
    if (!session) {
      session = (await ListeningSessionService.getActiveSession(userId)) || undefined;
    }

    if (!session || !session.songsPlayed || session.songsPlayed.length === 0) {
      return [];
    }

    const sessionProfile = await SessionProfileService.calculateSessionProfileFromSession(session);
    if (!sessionProfile) {
      return [];
    }

    const playedSongIdsSet = new Set<string>(
      session.songsPlayed.map((sp) => sp.song.toString())
    );

    // Get 3 most recently played songs as primary seed signals
    const recentPlayedSongs = session.songsPlayed.slice(-3).reverse();

    const candidateMap = new Map<string, { song: any; contentScore: number; seedId?: string }>();

    // 1. Content Similarity Candidates from Recent Seed Tracks
    for (let i = 0; i < recentPlayedSongs.length; i++) {
      const seedSongId = recentPlayedSongs[i].song.toString();
      const seedWeight = Math.pow(0.85, i); // Recency decay for seeds (1.0, 0.85, 0.72)

      try {
        const similarRecs = await ContentRecommendationService.getRecommendationsForSong(
          seedSongId,
          15
        );

        similarRecs.forEach((rec) => {
          const recId = rec._id.toString();
          if (excludePlayed && playedSongIdsSet.has(recId)) return;

          const weightedContentScore = Number(
            ((rec.similarityScore || 0.6) * seedWeight).toFixed(4)
          );

          const existing = candidateMap.get(recId);
          if (!existing || weightedContentScore > existing.contentScore) {
            candidateMap.set(recId, {
              song: rec,
              contentScore: weightedContentScore,
              seedId: seedSongId,
            });
          }
        });
      } catch (err) {
        // Continue safely if single seed fails
      }
    }

    // 2. Supplementary Session Profile Matching Catalog Songs if candidates are sparse
    if (candidateMap.size < limit * 2 && sessionProfile.dominantGenres.length > 0) {
      const genreMatches = await Song.find({
        _id: { $nin: Array.from(playedSongIdsSet) },
      })
        .limit(20)
        .populate('artist', 'name')
        .populate('genre', 'name')
        .lean();

      genreMatches.forEach((song) => {
        const sId = song._id.toString();
        if (!candidateMap.has(sId)) {
          candidateMap.set(sId, {
            song,
            contentScore: 0.4,
          });
        }
      });
    }

    // Build map of event songs for interaction feedback scoring
    const sessionEvents = session.sessionEvents || [];
    const eventSongIds = sessionEvents.map((ev) => ev.song);
    const eventSongs = await Song.find({ _id: { $in: eventSongIds } })
      .populate('artist', 'name')
      .populate('genre', 'name')
      .lean();

    const eventSongMap = new Map<string, any>();
    eventSongs.forEach((s) => eventSongMap.set(s._id.toString(), s));

    // 3. Adaptive Score Fusion
    const candidates: SessionCandidateResult[] = [];
    const artistCounts = new Map<string, number>();

    for (const [sId, item] of candidateMap.entries()) {
      const songDoc = item.song;
      const artistId =
        typeof songDoc.artist === 'object' && songDoc.artist && '_id' in songDoc.artist
          ? String(songDoc.artist._id)
          : String(songDoc.artist || 'unknown');

      // Artist Diversity Limit
      const currentArtistCount = artistCounts.get(artistId) || 0;
      if (currentArtistCount >= maxPerArtist) {
        continue;
      }

      const scoreBreakdown = AdaptiveSessionScoringService.computeAdaptiveScore({
        candidateSong: songDoc,
        contentSimilarityScore: item.contentScore,
        sessionProfile,
        sessionEvents,
        songMap: eventSongMap,
        customWeights,
      });

      candidates.push({
        song: songDoc as ISong,
        sessionRelevanceScore: scoreBreakdown.adaptiveScore,
        contentSimilarityScore: scoreBreakdown.contentSimilarityScore,
        sessionProfileAffinity: scoreBreakdown.sessionProfileAffinity,
        interactionFeedbackScore: scoreBreakdown.interactionFeedbackScore,
        positiveFeedbackBoost: scoreBreakdown.positiveFeedbackBoost,
        negativeFeedbackPenalty: scoreBreakdown.negativeFeedbackPenalty,
        seedSongId: item.seedId,
        source: item.seedId ? 'session_content_similarity' : 'session_profile_affinity',
      });

      artistCounts.set(artistId, currentArtistCount + 1);
    }

    // Rank candidates descending by sessionRelevanceScore
    candidates.sort((a, b) => b.sessionRelevanceScore - a.sessionRelevanceScore);

    return candidates.slice(0, Math.max(1, limit));
  }
}
