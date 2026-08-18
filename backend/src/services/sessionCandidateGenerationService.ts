import { Types } from 'mongoose';
import { ISong, Song } from '../models/Song.js';
import { IListeningSession } from '../models/ListeningSession.js';
import { ListeningSessionService } from './listeningSessionService.js';
import { SessionProfileService, TemporarySessionProfile } from './sessionProfileService.js';
import { ContentRecommendationService } from './recommendationService.js';

export interface SessionCandidateResult {
  song: ISong;
  sessionRelevanceScore: number;
  contentSimilarityScore: number;
  sessionProfileAffinity: number;
  seedSongId?: string;
  source: 'session_content_similarity' | 'session_profile_affinity';
}

export class SessionCandidateGenerationService {
  /**
   * Calculates candidate affinity score (0.0 to 1.0) against temporary session profile.
   */
  private static calculateProfileAffinity(
    candidateSong: any,
    sessionProfile: TemporarySessionProfile
  ): number {
    if (!candidateSong || !sessionProfile) return 0.5;

    // 1. Genre Match Score (35% Weight)
    let genreScore = 0.3;
    const songGenre =
      typeof candidateSong.genre === 'object' && candidateSong.genre && 'name' in candidateSong.genre
        ? String(candidateSong.genre.name)
        : String(candidateSong.genre || '');

    const matchingGenreItem = sessionProfile.dominantGenres.find(
      (g) => g.genre.toLowerCase() === songGenre.toLowerCase()
    );
    if (matchingGenreItem) {
      genreScore = 0.5 + matchingGenreItem.score * 0.5;
    }

    // 2. Artist Match Score (25% Weight)
    let artistScore = 0.3;
    const songArtistId =
      typeof candidateSong.artist === 'object' && candidateSong.artist && '_id' in candidateSong.artist
        ? String(candidateSong.artist._id)
        : String(candidateSong.artist || '');

    const matchingArtistItem = sessionProfile.dominantArtists.find((a) => a.artistId === songArtistId);
    if (matchingArtistItem) {
      artistScore = 0.6 + matchingArtistItem.score * 0.4;
    }

    // 3. Audio Features Alignment (Energy & Tempo) (25% Weight)
    let audioScore = 0.5;
    if (candidateSong.audioFeatures) {
      const energyDiff = Math.abs((candidateSong.audioFeatures.energy || 0.5) - sessionProfile.averageEnergy);
      const energyScore = 1.0 - Math.min(1, energyDiff);
      audioScore = energyScore;
    }

    // 4. Mood Alignment (15% Weight)
    let moodScore = 0.4;
    const songMood = String(candidateSong.mood || 'Chill');
    if (sessionProfile.moodDistribution && sessionProfile.moodDistribution[songMood]) {
      moodScore = 0.5 + sessionProfile.moodDistribution[songMood] * 0.5;
    }

    const affinity = genreScore * 0.35 + artistScore * 0.25 + audioScore * 0.25 + moodScore * 0.15;
    return Number(Math.max(0.0, Math.min(1.0, affinity)).toFixed(4));
  }

  /**
   * Generates ranked session-based candidate songs.
   * - Uses recently played session tracks as primary seed signals.
   * - Fuses content similarity with temporary session profile alignment.
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
  }): Promise<SessionCandidateResult[]> {
    const { userId, limit = 10, excludePlayed = true, maxPerArtist = 2 } = params;

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
      const topGenre = sessionProfile.dominantGenres[0].genre;
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

    // 3. Score Fusion (Content Similarity + Temporary Session Profile Affinity)
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

      const contentScore = item.contentScore;
      const profileAffinity = this.calculateProfileAffinity(songDoc, sessionProfile);

      // Weighted session relevance score (50% content similarity, 50% session profile affinity)
      const sessionRelevanceScore = Number(
        (contentScore * 0.5 + profileAffinity * 0.5).toFixed(4)
      );

      candidates.push({
        song: songDoc as ISong,
        sessionRelevanceScore,
        contentSimilarityScore: contentScore,
        sessionProfileAffinity: profileAffinity,
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
