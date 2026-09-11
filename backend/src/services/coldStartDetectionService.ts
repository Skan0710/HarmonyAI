import { supabase } from '../config/supabase.js';
import { isValidObjectId } from '../utils/validators.js';

export type UserClassificationType = 'NEW' | 'LIMITED_DATA' | 'ACTIVE' | 'WELL_ESTABLISHED';

export interface ColdStartThresholds {
  minPlaysForActive: number;          // default: 10
  minLikesForActive: number;          // default: 3
  minArtistsForActive: number;        // default: 3
  minGenresForActive: number;         // default: 2

  minPlaysForEstablished: number;     // default: 30
  minLikesForEstablished: number;     // default: 10
  minArtistsForEstablished: number;   // default: 8
  minGenresForEstablished: number;    // default: 4
}

export const DEFAULT_COLD_START_THRESHOLDS: ColdStartThresholds = {
  minPlaysForActive: 10,
  minLikesForActive: 3,
  minArtistsForActive: 3,
  minGenresForActive: 2,

  minPlaysForEstablished: 30,
  minLikesForEstablished: 10,
  minArtistsForEstablished: 8,
  minGenresForEstablished: 4,
};

export interface UserActivityStatistics {
  totalPlays: number;
  completedPlays: number;
  totalLikes: number;
  distinctArtistsCount: number;
  distinctGenresCount: number;
  explicitFavoriteGenresCount: number;
  explicitFavoriteArtistsCount: number;
}

export interface ColdStartStatusResult {
  userId: string;
  classification: UserClassificationType;
  isColdStart: boolean;
  statistics: UserActivityStatistics;
  recommendationReadinessScore: number; // Normalized 0.0 to 1.0
  thresholds: ColdStartThresholds;
}

export class ColdStartDetectionService {
  /**
   * Analyzes user interaction data (plays, likes, distinct artists, distinct genres) to determine
   * whether a user has enough data for personalized recommendations, classifying them as
   * NEW, LIMITED_DATA, ACTIVE, or WELL_ESTABLISHED.
   */
  static async detectUserColdStartStatus(
    userId: string,
    customThresholds?: Partial<ColdStartThresholds>
  ): Promise<ColdStartStatusResult> {
    if (!isValidObjectId(userId)) {
      throw new Error('Invalid user ID');
    }

    const thresholds: ColdStartThresholds = {
      ...DEFAULT_COLD_START_THRESHOLDS,
      ...customThresholds,
    };

    // 0. Verify user exists
    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (!userRow) {
      throw new Error('User not found');
    }

    // 1. Fetch liked songs (genre/artist), explicit favorite genres & artists
    const [likedSongsRes, favoriteGenresRes, favoriteArtistsRes, historyRes] = await Promise.all([
      supabase
        .from('user_liked_songs')
        .select('songs(genre_id, artist_id)')
        .eq('user_id', userId),
      supabase
        .from('user_favorite_genres')
        .select('genre_id')
        .eq('user_id', userId),
      supabase
        .from('user_favorite_artists')
        .select('artist_id')
        .eq('user_id', userId),
      // 2. Fetch User Listening History
      supabase
        .from('listening_history')
        .select('completed, skipped, songs(genre_id, artist_id)')
        .eq('user_id', userId),
    ]);

    const likedSongs = ((likedSongsRes.data || []) as any[]).map((row) => row.songs).filter(Boolean);
    const favoriteGenres = ((favoriteGenresRes.data || []) as any[]).map((row) => row.genre_id).filter(Boolean);
    const favoriteArtists = ((favoriteArtistsRes.data || []) as any[]).map((row) => row.artist_id).filter(Boolean);
    const historyDocs = (historyRes.data || []) as any[];

    // Accumulate distinct genres and distinct artists
    const distinctArtists = new Set<string>();
    const distinctGenres = new Set<string>();

    for (const fa of favoriteArtists) {
      if (fa) distinctArtists.add(fa.toString());
    }
    for (const fg of favoriteGenres) {
      if (fg) distinctGenres.add(fg.toString());
    }

    for (const song of likedSongs) {
      if (!song) continue;
      if (song.artist_id) distinctArtists.add(song.artist_id.toString());
      if (song.genre_id) distinctGenres.add(song.genre_id.toString());
    }

    let completedCount = 0;
    for (const rec of historyDocs) {
      if (rec.completed) completedCount++;
      const song = rec.songs;
      if (song && typeof song === 'object') {
        if (song.artist_id) distinctArtists.add(song.artist_id.toString());
        if (song.genre_id) distinctGenres.add(song.genre_id.toString());
      }
    }

    const statistics: UserActivityStatistics = {
      totalPlays: historyDocs.length,
      completedPlays: completedCount,
      totalLikes: likedSongs.length,
      distinctArtistsCount: distinctArtists.size,
      distinctGenresCount: distinctGenres.size,
      explicitFavoriteGenresCount: favoriteGenres.length,
      explicitFavoriteArtistsCount: favoriteArtists.length,
    };

    // 3. Classify User State based on Configurable Thresholds
    let classification: UserClassificationType = 'NEW';

    const meetsEstablished =
      statistics.totalPlays >= thresholds.minPlaysForEstablished &&
      statistics.totalLikes >= thresholds.minLikesForEstablished &&
      statistics.distinctArtistsCount >= thresholds.minArtistsForEstablished &&
      statistics.distinctGenresCount >= thresholds.minGenresForEstablished;

    const meetsActive =
      statistics.totalPlays >= thresholds.minPlaysForActive &&
      statistics.totalLikes >= thresholds.minLikesForActive &&
      statistics.distinctArtistsCount >= thresholds.minArtistsForActive &&
      statistics.distinctGenresCount >= thresholds.minGenresForActive;

    if (meetsEstablished) {
      classification = 'WELL_ESTABLISHED';
    } else if (meetsActive) {
      classification = 'ACTIVE';
    } else if (statistics.totalPlays > 2 || statistics.totalLikes > 1 || statistics.distinctArtistsCount > 1) {
      classification = 'LIMITED_DATA';
    } else {
      classification = 'NEW';
    }

    const isColdStart = classification === 'NEW' || classification === 'LIMITED_DATA';

    // Calculate Recommendation Readiness Score (0.0 to 1.0)
    const playProgress = Math.min(1, statistics.totalPlays / thresholds.minPlaysForActive);
    const likeProgress = Math.min(1, statistics.totalLikes / thresholds.minLikesForActive);
    const artistProgress = Math.min(1, statistics.distinctArtistsCount / thresholds.minArtistsForActive);
    const genreProgress = Math.min(1, statistics.distinctGenresCount / thresholds.minGenresForActive);

    const readinessScore = Number(
      ((playProgress + likeProgress + artistProgress + genreProgress) / 4).toFixed(4)
    );

    return {
      userId,
      classification,
      isColdStart,
      statistics,
      recommendationReadinessScore: Math.max(0, Math.min(1, readinessScore)),
      thresholds,
    };
  }
}
