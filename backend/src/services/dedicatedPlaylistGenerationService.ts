import { Types } from 'mongoose';
import { Song, ISong } from '../models/Song.js';
import { CandidateGenerationService } from './candidateGenerationService.js';
import { SemanticSearchService } from './semanticSearchService.js';
import { RecommendationPostRankingPipeline } from './recommendationPostRankingPipeline.js';

export interface AIPlaylistGenerationInput {
  userId?: string;
  mood?: string;
  activity?: string; // context or activity (e.g. Study, Workout, Commute)
  targetDurationMinutes?: number; // target duration in minutes
  targetSongCount?: number; // specific number of tracks (optional)
  preferredGenres?: string[];
  preferredArtists?: string[];
  noveltyPreference?: number; // 0.0 (familiar) to 1.0 (novel discoveries)
  diversityPreference?: number; // 0.0 (tight focus) to 1.0 (eclectic mix)
  searchPrompt?: string;
}

export interface GeneratedPlaylistTrack {
  song: ISong;
  score: number;
  matchScore: number;
  noveltyScore?: number;
  genre: string;
  artist: string;
  durationSeconds: number;
  durationFormatted: string;
}

export interface DedicatedAIPlaylistResult {
  title: string;
  description: string;
  preferences: AIPlaylistGenerationInput;
  tracks: GeneratedPlaylistTrack[];
  totalDurationSeconds: number;
  totalDurationFormatted: string;
  trackCount: number;
  candidateCountEvaluated: number;
  generatedAt: Date;
}

export class DedicatedPlaylistGenerationService {
  /**
   * Generates a curated playlist using the existing HarmonyAI recommendation engine,
   * factoring in user mood, activity, preferred genres/artists, target duration,
   * novelty preference, and diversity preference.
   */
  static async generatePlaylist(
    input: AIPlaylistGenerationInput
  ): Promise<DedicatedAIPlaylistResult> {
    const {
      userId,
      mood,
      activity,
      targetDurationMinutes,
      targetSongCount,
      preferredGenres = [],
      preferredArtists = [],
      noveltyPreference = 0.5,
      diversityPreference = 0.5,
      searchPrompt,
    } = input;

    // 1. Calculate Target Count
    let desiredCount = 12;
    if (typeof targetSongCount === 'number' && targetSongCount > 0) {
      desiredCount = Math.min(50, Math.max(1, targetSongCount));
    } else if (typeof targetDurationMinutes === 'number' && targetDurationMinutes > 0) {
      // Average song length is approx 210 seconds (3.5 minutes)
      desiredCount = Math.min(50, Math.max(1, Math.ceil((targetDurationMinutes * 60) / 210)));
    }

    const candidatePoolLimit = Math.max(40, desiredCount * 4);
    const candidateMap = new Map<string, { song: ISong; baseScore: number; sources: Set<string> }>();

    // 2. Candidate Sourcing: Hybrid Recommendation Engine (if authenticated)
    if (userId && Types.ObjectId.isValid(userId)) {
      try {
        const hybridCandidates = await CandidateGenerationService.generateHybridCandidates({
          userId,
          candidateLimit: candidatePoolLimit,
        });

        for (const cand of hybridCandidates) {
          if (cand.songDoc) {
            const combinedScore =
              (cand.contentScore + cand.collaborativeScore + cand.userTasteAffinityScore) / 3 || 0.7;
            candidateMap.set(cand.songId, {
              song: cand.songDoc as ISong,
              baseScore: combinedScore,
              sources: new Set(cand.sources),
            });
          }
        }
      } catch (err: any) {
        console.warn(`[DedicatedPlaylistGeneration] Hybrid candidate sourcing failed: ${err.message}`);
      }
    }

    // 3. Candidate Sourcing: Semantic Search based on mood, activity, genres, and artists
    const queryParts = [
      searchPrompt || '',
      mood ? `${mood} mood` : '',
      activity ? `${activity} activity` : '',
      ...preferredGenres,
      ...preferredArtists,
    ].filter(Boolean);

    const semanticQuery = queryParts.join(' ').trim();

    if (semanticQuery) {
      try {
        const semanticResults = await SemanticSearchService.searchSongsBySemanticQuery(
          semanticQuery,
          candidatePoolLimit
        );

        for (const res of semanticResults) {
          const songId = res.song._id ? String(res.song._id) : '';
          if (!songId) continue;

          const existing = candidateMap.get(songId);
          if (existing) {
            existing.sources.add('semantic_search');
            existing.baseScore = Math.max(existing.baseScore, res.similarityScore || 0.5);
          } else {
            candidateMap.set(songId, {
              song: res.song,
              baseScore: res.similarityScore || 0.6,
              sources: new Set(['semantic_search']),
            });
          }
        }
      } catch (err: any) {
        console.warn(`[DedicatedPlaylistGeneration] Semantic search sourcing failed: ${err.message}`);
      }
    }

    // 4. Candidate Sourcing: Catalog DB Query Fallback
    try {
      const dbQuery: any = { isPublished: true };
      const orConditions: any[] = [];

      if (preferredGenres.length > 0) {
        orConditions.push({ 'genre.name': { $in: preferredGenres.map((g) => new RegExp(g, 'i')) } });
      }
      if (mood) {
        orConditions.push({ mood: new RegExp(mood, 'i') });
      }

      if (orConditions.length > 0) {
        dbQuery.$or = orConditions;
      }

      const catalogSongs = await Song.find(dbQuery)
        .populate('artist', 'name profileImage avatar')
        .populate('album', 'title coverImage releaseYear')
        .populate('genre', 'name slug')
        .limit(candidatePoolLimit)
        .lean();

      for (const s of catalogSongs) {
        const sId = s._id ? String(s._id) : '';
        if (!sId) continue;

        const existing = candidateMap.get(sId);
        if (existing) {
          existing.sources.add('catalog_match');
        } else {
          candidateMap.set(sId, {
            song: s as ISong,
            baseScore: 0.5,
            sources: new Set(['catalog_match']),
          });
        }
      }
    } catch (err: any) {
      console.warn(`[DedicatedPlaylistGeneration] Catalog query fallback failed: ${err.message}`);
    }

    // 5. Transform to Candidate Array for Post-Ranking Pipeline
    const initialCandidates = Array.from(candidateMap.values()).map((item) => ({
      song: item.song,
      originalScore: item.baseScore,
      candidateScore: item.baseScore,
      sources: Array.from(item.sources),
    }));

    // 6. Post-Ranking Pipeline Execution (Diversity, Novelty, Repetition)
    let rankedResults: any[] = [];
    if (initialCandidates.length > 0) {
      try {
        rankedResults = await RecommendationPostRankingPipeline.executePostRanking({
          items: initialCandidates,
          userId,
          targetLimit: desiredCount,
          requestedGenres: preferredGenres,
          scoreExtractor: (item) => item.originalScore,
          songExtractor: (item) => item.song,
          sourcesExtractor: (item) => item.sources,
          customNoveltyWeights: {
            noveltyWeight: 0.15 * noveltyPreference,
            minRelevanceThreshold: 0.35,
          },
          customGenreWeights: {
            defaultMaxGenreConcentration: Math.max(0.2, 0.6 - 0.4 * diversityPreference),
            diversityPenaltyWeight: 0.15 * diversityPreference,
          },
        });
      } catch (err: any) {
        console.warn(`[DedicatedPlaylistGeneration] Post-ranking pipeline failed: ${err.message}`);
        rankedResults = initialCandidates.map((c) => ({
          song: c.song,
          originalScore: c.originalScore,
          finalScore: c.candidateScore,
          componentBreakdown: {
            originalScore: c.originalScore,
            userPreferenceScore: 0.5,
            noveltyScore: 0.5,
            repetitionPenalty: 0,
          },
          item: c,
        }));
      }
    }

    // 7. Track Selection & Duration Constraint Fulfillment
    const selectedTracks: GeneratedPlaylistTrack[] = [];
    let currentDurationSeconds = 0;
    const targetSeconds =
      typeof targetDurationMinutes === 'number' && targetDurationMinutes > 0
        ? targetDurationMinutes * 60
        : Infinity;

    for (const res of rankedResults) {
      if (selectedTracks.length >= desiredCount) break;

      const song = res.song;
      if (!song || !song._id) continue;

      const duration = typeof song.duration === 'number' && song.duration > 0 ? song.duration : 210;

      // Stop if target duration met and minimum 3 songs collected
      if (currentDurationSeconds + duration > targetSeconds && selectedTracks.length >= 3) {
        break;
      }

      const artistName =
        typeof song.artist === 'object' && song.artist && 'name' in song.artist
          ? String(song.artist.name)
          : String(song.artist || 'Unknown Artist');

      const genreName =
        typeof song.genre === 'object' && song.genre && 'name' in song.genre
          ? String(song.genre.name)
          : String(song.genre || 'Music');

      const mins = Math.floor(duration / 60);
      const secs = duration % 60;
      const durationFormatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

      selectedTracks.push({
        song,
        score: Number((res.finalScore || res.originalScore || 0.7).toFixed(4)),
        matchScore: Number((res.originalScore || 0.7).toFixed(4)),
        noveltyScore: res.componentBreakdown?.noveltyScore,
        genre: genreName,
        artist: artistName,
        durationSeconds: duration,
        durationFormatted,
      });

      currentDurationSeconds += duration;
    }

    // 8. Generate Playlist Title & Description
    const totalMins = Math.floor(currentDurationSeconds / 60);
    const totalSecs = currentDurationSeconds % 60;
    const totalDurationFormatted = `${totalMins}m ${totalSecs}s`;

    const titleParts = [mood, activity, preferredGenres[0]].filter(Boolean);
    const title =
      titleParts.length > 0
        ? `${titleParts.join(' ')} Mix`
        : searchPrompt
        ? `${searchPrompt.slice(0, 25)} Mix`
        : 'AI Curated Playlist';

    const description = `AI curated ${selectedTracks.length}-track mix for ${
      activity || mood || 'your listening session'
    } (${totalDurationFormatted}).`;

    return {
      title,
      description,
      preferences: input,
      tracks: selectedTracks,
      totalDurationSeconds: currentDurationSeconds,
      totalDurationFormatted,
      trackCount: selectedTracks.length,
      candidateCountEvaluated: candidateMap.size,
      generatedAt: new Date(),
    };
  }
}
