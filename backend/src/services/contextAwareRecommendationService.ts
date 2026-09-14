import { isValidObjectId } from '../utils/validators.js';
import { ContextDetectionService } from './contextDetectionService.js';
import { ContextPreference } from '../schemas/contextPreferenceSchema.js';
import { ColdStartDetectionService } from './coldStartDetectionService.js';
import { ColdStartRecommendationService } from './coldStartRecommendationService.js';
import { CandidateGenerationService } from './candidateGenerationService.js';
import { ContextAwareRankingPipeline, ContextRankedResult } from './contextAwareRankingPipeline.js';
import { supabase } from '../config/supabase.js';
import { mapSongRow } from './songService.js';
import { UserService } from './userService.js';
import { MoodFilteringService } from './moodFilteringService.js';
import { DEFAULT_CONTEXT_MAPPINGS } from './contextPreferenceMappingService.js';

export interface ContextualRecommendationResult {
  strategyUsed: 'CONTEXTUAL_HYBRID_PERSONALIZED' | 'COLD_START';
  userClassification: 'NEW' | 'LIMITED_DATA' | 'ACTIVE' | 'WELL_ESTABLISHED';
  detectedContext: ContextPreference;
  count: number;
  data: ContextRankedResult[];
}

export class ContextAwareRecommendationService {
  /**
   * Generates context-aware recommendations:
   * - Automatically detects time-of-day category from server time.
   * - Accepts optional explicit context parameters (mood, activity, energyLevel, preferredDurationMinutes).
   * - Uses cold-start strategy for NEW/LIMITED_DATA or unauthenticated users.
   * - Uses personalized hybrid candidates + ContextAwareRankingPipeline for ACTIVE/WELL_ESTABLISHED users.
   * - Handles missing context parameters gracefully.
   */
  static async getContextualRecommendations(params: {
    userId?: string;
    mood?: string;
    activity?: string;
    energyLevel?: number;
    durationMinutes?: number;
    limit?: number;
  }): Promise<ContextualRecommendationResult> {
    const { userId, mood, activity, energyLevel, durationMinutes, limit = 10 } = params;

    // 1. Detect Context (automatically determines time-of-day, merges optional parameters)
    const detectedContext = ContextDetectionService.detectCurrentContext({
      explicitContext: {
        mood: mood as any,
        activity: activity as any,
        energyLevel,
        preferredDurationMinutes: durationMinutes,
      },
    });

    // 2. Unauthenticated / Anonymous User -> Cold Start
    if (!userId || !isValidObjectId(userId)) {
      const coldStartRes = await ColdStartRecommendationService.getColdStartRecommendations({
        userId: 'anonymous',
        limit,
      });
      const formattedData: ContextRankedResult[] = coldStartRes.songs.map((songDoc, idx) => ({
        song: songDoc,
        contextScore: Number((0.9 - idx * 0.05).toFixed(4)),
        componentScores: {
          contentScore: 0,
          collaborativeScore: 0,
          userTasteAffinityScore: 0.5,
          popularityScore: 0.8,
          recencyScore: 0.8,
          moodScore: 0.5,
          activityScore: 0.5,
        },
        sources: coldStartRes.candidateSources || ['cold_start'],
      }));

      return {
        strategyUsed: 'COLD_START',
        userClassification: 'NEW',
        detectedContext,
        count: formattedData.length,
        data: formattedData,
      };
    }

    try {
      // 3. Authenticated User State Classification Detection
      const coldStartInfo = await ColdStartDetectionService.detectUserColdStartStatus(userId);
      const userClassification = coldStartInfo.classification;

      if (coldStartInfo.isColdStart) {
        const coldStartRes = await ColdStartRecommendationService.getColdStartRecommendations({ userId, limit });
        const formattedData: ContextRankedResult[] = coldStartRes.songs.map((songDoc, idx) => ({
          song: songDoc,
          contextScore: Number((0.95 - idx * 0.05).toFixed(4)),
          componentScores: {
            contentScore: 0,
            collaborativeScore: 0,
            userTasteAffinityScore: 0.5,
            popularityScore: 0.8,
            recencyScore: 0.8,
            moodScore: 0.5,
            activityScore: 0.5,
          },
          sources: coldStartRes.candidateSources || ['cold_start'],
        }));

        return {
          strategyUsed: 'COLD_START',
          userClassification,
          detectedContext,
          count: formattedData.length,
          data: formattedData,
        };
      }

      // 4. Personalized Context-Aware Hybrid Pipeline Execution for ACTIVE/WELL_ESTABLISHED Users
      const candidates = await CandidateGenerationService.generateHybridCandidates({
        userId,
        candidateLimit: 50,
      });

      if (candidates.length === 0) {
        const fallbackRes = await ColdStartRecommendationService.getColdStartRecommendations({ userId, limit });
        const formattedFallback: ContextRankedResult[] = fallbackRes.songs.map((songDoc, idx) => ({
          song: songDoc,
          contextScore: Number((0.8 - idx * 0.05).toFixed(4)),
          componentScores: {
            contentScore: 0,
            collaborativeScore: 0,
            userTasteAffinityScore: 0.3,
            popularityScore: 0.5,
            recencyScore: 0.5,
            moodScore: 0.5,
            activityScore: 0.5,
          },
          sources: ['catalog_fallback'],
        }));

        return {
          strategyUsed: 'COLD_START',
          userClassification,
          detectedContext,
          count: formattedFallback.length,
          data: formattedFallback,
        };
      }

      const rankedResults = ContextAwareRankingPipeline.rankCandidatesWithContext(
        candidates,
        detectedContext,
        limit
      );

      return {
        strategyUsed: 'CONTEXTUAL_HYBRID_PERSONALIZED',
        userClassification,
        detectedContext,
        count: rankedResults.length,
        data: rankedResults,
      };
    } catch (error: any) {
      console.warn(`[ContextAwareRecommendationService Warning]: Pipeline execution failed gracefully: ${error.message}`);
      // Fallback safely to cold start
      const coldStartRes = await ColdStartRecommendationService.getColdStartRecommendations({
        userId: userId || 'anonymous',
        limit,
      });
      const fallbackData: ContextRankedResult[] = coldStartRes.songs.map((songDoc, idx) => ({
        song: songDoc,
        contextScore: Number((0.7 - idx * 0.05).toFixed(4)),
        componentScores: {
          contentScore: 0,
          collaborativeScore: 0,
          userTasteAffinityScore: 0.3,
          popularityScore: 0.5,
          recencyScore: 0.5,
          moodScore: 0.5,
          activityScore: 0.5,
        },
        sources: ['failsafe_fallback'],
      }));

      return {
        strategyUsed: 'COLD_START',
        userClassification: 'NEW',
        detectedContext,
        count: fallbackData.length,
        data: fallbackData,
      };
    }
  }

  /**
   * High-precision, context-and-preference-aware recommendation engine:
   * 1. Evaluates listening situation & mood targets (energy, tempo, genre affinities).
   * 2. Incorporates the user's personal preferences (favorite artists, favorite genres, liked songs).
   * 3. Selects and scores candidates according to acoustic compatibility, mood valence, and taste affinity.
   * 4. Ensures different situations and moods surface distinct, tailored song recommendations.
   */
  static async getContextAwareRecommendations(params: {
    userId: string;
    situation?: string;
    mood?: string;
    desiredEnergy?: number;
    desiredTempo?: number;
    preferredGenres?: string[];
    discoveryLevel?: number;
    limit?: number;
  }): Promise<{
    strategyUsed: string;
    userClassification: string;
    count: number;
    data: any[];
    context: any;
  }> {
    const {
      userId,
      situation = 'general_listening',
      mood = 'Happy',
      desiredEnergy,
      desiredTempo,
      preferredGenres = [],
      discoveryLevel = 50,
      limit = 12,
    } = params;

    // 1. Fetch User Preferences (favorite artists, favorite genres, liked songs)
    const userFavoriteArtistIds = new Set<string>();
    const userFavoriteGenreNames = new Set<string>();
    const userLikedSongIds = new Set<string>();
    let userClassification: 'NEW' | 'LIMITED_DATA' | 'ACTIVE' | 'WELL_ESTABLISHED' = 'ACTIVE';

    if (userId && isValidObjectId(userId)) {
      try {
        const [preferences, likedRows, coldStartInfo] = await Promise.all([
          UserService.getUserPreferences(userId).catch(() => ({ favoriteArtists: [], favoriteGenres: [] })),
          Promise.resolve(supabase.from('user_liked_songs').select('song_id').eq('user_id', userId)).catch(() => ({ data: [] })),
          ColdStartDetectionService.detectUserColdStartStatus(userId).catch(() => ({ classification: 'ACTIVE' as const })),
        ]);

        if (preferences?.favoriteArtists) {
          preferences.favoriteArtists.forEach((a: any) => {
            const id = a._id || a.id;
            if (id) userFavoriteArtistIds.add(String(id));
          });
        }
        if (preferences?.favoriteGenres) {
          preferences.favoriteGenres.forEach((g: any) => {
            const name = (g.name || g.slug || '').toLowerCase();
            if (name) userFavoriteGenreNames.add(name);
          });
        }
        if (likedRows?.data) {
          likedRows.data.forEach((r: any) => {
            if (r.song_id) userLikedSongIds.add(String(r.song_id));
          });
        }
        if (coldStartInfo?.classification) {
          userClassification = coldStartInfo.classification;
        }
      } catch (err) {
        console.warn('[ContextAwareRecommendationService] Preference load warning:', err);
      }
    }

    // 2. Resolve Context & Acoustic Targets
    const situationKey = situation.toLowerCase().replace(/[\s-]+/g, '_');
    const situationDef = DEFAULT_CONTEXT_MAPPINGS[situationKey] || DEFAULT_CONTEXT_MAPPINGS['general_listening'];

    const moodClean = mood.toLowerCase().trim();
    const moodTarget = MoodFilteringService.normalizeMoodKey(moodClean);

    const targetEnergy = typeof desiredEnergy === 'number' && !isNaN(desiredEnergy)
      ? desiredEnergy
      : (moodTarget?.targetEnergy ?? situationDef?.targetEnergy ?? 0.6);

    const targetTempo = typeof desiredTempo === 'number' && !isNaN(desiredTempo)
      ? desiredTempo
      : (moodTarget?.targetBpm ?? situationDef?.targetTempo ?? 115);

    const targetMoodName = mood || situationDef?.targetMood || 'Calm';

    // Target genres combining situation defaults, mood matching genres, and user overrides
    const contextGenrePool = new Set<string>();
    if (situationDef?.recommendedGenres) {
      situationDef.recommendedGenres.forEach((g: string) => contextGenrePool.add(g.toLowerCase()));
    }
    if (moodTarget?.matchingGenres) {
      moodTarget.matchingGenres.forEach((g: string) => contextGenrePool.add(g.toLowerCase()));
    }
    if (Array.isArray(preferredGenres) && preferredGenres.length > 0) {
      preferredGenres.forEach((g: string) => contextGenrePool.add(g.toLowerCase()));
    }
    // Also consider user favorite genres
    userFavoriteGenreNames.forEach((g) => contextGenrePool.add(g));

    // 3. Query Database Candidates
    const { data: allGenres } = await supabase.from('genres').select('id, name, slug');
    const matchingGenreIds: string[] = [];
    if (allGenres) {
      for (const g of allGenres) {
        const nameLower = (g.name || '').toLowerCase();
        const slugLower = (g.slug || '').toLowerCase();
        for (const targetG of contextGenrePool) {
          if (nameLower.includes(targetG) || targetG.includes(nameLower) || slugLower.includes(targetG)) {
            matchingGenreIds.push(g.id);
            break;
          }
        }
      }
    }

    const candidateMap = new Map<string, any>();
    const queries: Promise<any>[] = [];

    // Query a: Genre matching songs
    if (matchingGenreIds.length > 0) {
      queries.push(
        Promise.resolve(
          supabase
            .from('songs')
            .select('*, artists!songs_artist_id_fkey(*), albums!songs_album_id_fkey(*), genres!songs_genre_id_fkey(*)')
            .eq('is_published', true)
            .in('genre_id', matchingGenreIds.slice(0, 10))
            .order('play_count', { ascending: false })
            .limit(80)
        )
      );
    }

    // Query b: User favorite artists
    if (userFavoriteArtistIds.size > 0) {
      queries.push(
        Promise.resolve(
          supabase
            .from('songs')
            .select('*, artists!songs_artist_id_fkey(*), albums!songs_album_id_fkey(*), genres!songs_genre_id_fkey(*)')
            .eq('is_published', true)
            .in('artist_id', Array.from(userFavoriteArtistIds).slice(0, 10))
            .limit(50)
        )
      );
    }

    // Query c: Popular & catalog pool
    queries.push(
      Promise.resolve(
        supabase
          .from('songs')
          .select('*, artists!songs_artist_id_fkey(*), albums!songs_album_id_fkey(*), genres!songs_genre_id_fkey(*)')
          .eq('is_published', true)
          .order('play_count', { ascending: false })
          .limit(100)
      )
    );

    // Query d: Fresh catalog release pool
    queries.push(
      Promise.resolve(
        supabase
          .from('songs')
          .select('*, artists!songs_artist_id_fkey(*), albums!songs_album_id_fkey(*), genres!songs_genre_id_fkey(*)')
          .eq('is_published', true)
          .order('created_at', { ascending: false })
          .limit(60)
      )
    );

    const queryResults = await Promise.all(queries);
    for (const res of queryResults) {
      if (res.data) {
        for (const row of res.data) {
          if (row.id && !candidateMap.has(row.id)) {
            candidateMap.set(row.id, mapSongRow(row));
          }
        }
      }
    }

    const candidateSongs = Array.from(candidateMap.values());

    // 4. Score Each Candidate for this exact Situation + Mood + Preferences combination
    const hashSeed = (situationKey + '_' + moodClean).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

    const scored = candidateSongs.map((song) => {
      const audioFeatures = song.audioFeatures || {};
      const songEnergy = typeof audioFeatures.energy === 'number' ? audioFeatures.energy : 0.5;
      const songBpm = typeof audioFeatures.bpm === 'number' ? audioFeatures.bpm : 110;
      const songGenreName = (song.genre?.name || song.genre?.slug || '').toLowerCase();
      const songArtistId = song.artist?._id || song.artist?.id || String(song.artist);
      const songArtistName = song.artist?.name || 'Artist';

      // 1. Energy Fit (0 to 1): Penalize heavily if acoustic energy is mismatched
      const energyDiff = Math.abs(songEnergy - targetEnergy);
      const energyScore = Math.max(0, 1 - energyDiff * 2.0);

      // 2. Tempo Fit (0 to 1)
      const tempoDiff = Math.abs(songBpm - targetTempo);
      const tempoScore = Math.max(0, 1 - tempoDiff / 65);

      // 3. Mood Compatibility (0 to 1)
      const moodScore = MoodFilteringService.calculateMoodCompatibilityScore(song, targetMoodName);

      // 4. Genre Compatibility (0 to 1)
      let genreScore = 0.2;
      for (const cg of contextGenrePool) {
        if (songGenreName.includes(cg) || cg.includes(songGenreName)) {
          genreScore = 1.0;
          break;
        }
      }
      if (genreScore < 1.0 && userFavoriteGenreNames.has(songGenreName)) {
        genreScore = 0.85;
      }

      // 5. User Preference Affinity (0 to 1)
      let preferenceBoost = 0;
      const isFavArtist = userFavoriteArtistIds.has(songArtistId);
      const isFavGenre = userFavoriteGenreNames.has(songGenreName);
      const isLiked = userLikedSongIds.has(song._id || song.id);

      if (isFavArtist) preferenceBoost += 0.35;
      if (isFavGenre) preferenceBoost += 0.25;
      if (isLiked) preferenceBoost += 0.15;

      // 6. Discovery / Exploration pseudo-random jitter
      const songNumericHash = (song._id || song.id || '').split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0);
      const jitterFactor = ((songNumericHash * 17 + hashSeed) % 100) / 100;
      const discoveryBonus = jitterFactor * (discoveryLevel / 100) * 0.20;

      // Popularity signal (0 to 1)
      const popSignal = Math.min(1, (song.playCount || 0) / 50) * 0.1;

      // Final composite score
      const finalScore = Number(
        (
          energyScore * 0.32 +
          tempoScore * 0.18 +
          moodScore * 0.25 +
          genreScore * 0.20 +
          preferenceBoost * 0.30 +
          popSignal +
          discoveryBonus
        ).toFixed(4)
      );

      // Build specific dynamic explanation
      let primaryExplanation = `Curated for your ${targetMoodName} ${situation.replace('_', ' ')} mix`;
      if (isFavArtist) {
        primaryExplanation = `From your favorite artist ${songArtistName}, tuned for ${situation.replace('_', ' ')}`;
      } else if (isFavGenre && energyScore > 0.7) {
        primaryExplanation = `Your favorite ${song.genre?.name || 'music'} genre, matched to ${targetMoodName} energy`;
      } else if (moodScore > 0.85) {
        primaryExplanation = `Perfect ${targetMoodName} mood alignment (${Math.round(songEnergy * 100)}% energy)`;
      } else if (energyScore > 0.85 && tempoScore > 0.75) {
        primaryExplanation = `Optimal ${situation.replace('_', ' ')} rhythm (${songBpm} BPM, ${Math.round(songEnergy * 100)}% energy)`;
      }

      return {
        song,
        hybridScore: finalScore,
        recommendationScore: finalScore,
        primaryExplanation,
        topReasons: [
          {
            type: isFavArtist ? 'USER_FAVORITE_ARTIST' : 'CONTEXT_FIT',
            message: primaryExplanation,
            importanceScore: finalScore,
          },
        ],
        componentScores: {
          contentScore: Number(energyScore.toFixed(3)),
          collaborativeScore: Number(genreScore.toFixed(3)),
          userTasteAffinityScore: Number(Math.min(1, preferenceBoost).toFixed(3)),
          popularityScore: Number(popSignal.toFixed(3)),
          recencyScore: 0.5,
          contextScore: Number(moodScore.toFixed(3)),
        },
        sources: [isFavArtist ? 'user_preference' : 'context_acoustic_engine'],
      };
    });

    // 5. Diversity Re-ranking: Limit to max 2 songs per artist
    scored.sort((a, b) => b.recommendationScore - a.recommendationScore);

    const artistCountMap = new Map<string, number>();
    const selected: typeof scored = [];
    const leftover: typeof scored = [];

    for (const item of scored) {
      const artId = item.song.artist?._id || item.song.artist?.id || String(item.song.artist);
      const count = artistCountMap.get(artId) || 0;
      if (count < 2) {
        artistCountMap.set(artId, count + 1);
        selected.push(item);
      } else {
        leftover.push(item);
      }
      if (selected.length >= limit) break;
    }

    if (selected.length < limit) {
      for (const item of leftover) {
        selected.push(item);
        if (selected.length >= limit) break;
      }
    }

    return {
      strategyUsed: 'CONTEXTUAL_HYBRID_PERSONALIZED',
      userClassification,
      count: selected.length,
      data: selected,
      context: {
        situation,
        mood: targetMoodName,
        desiredEnergy: targetEnergy,
        desiredTempo: targetTempo,
        preferredGenres: Array.from(contextGenrePool),
        discoveryLevel,
      },
    };
  }
}
