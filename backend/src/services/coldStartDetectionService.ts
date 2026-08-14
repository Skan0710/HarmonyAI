import { Types } from 'mongoose';
import { User } from '../models/User.js';
import { ListeningHistory } from '../models/ListeningHistory.js';

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
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }

    const thresholds: ColdStartThresholds = {
      ...DEFAULT_COLD_START_THRESHOLDS,
      ...customThresholds,
    };

    const userObjId = new Types.ObjectId(userId);

    // 1. Fetch User Document (Liked songs, explicit favorite genres & artists)
    const userDoc = await User.findById(userObjId)
      .populate({
        path: 'likedSongs',
        select: 'genre artist',
      })
      .select('likedSongs favoriteGenres favoriteArtists')
      .lean();

    if (!userDoc) {
      throw new Error('User not found');
    }

    const likedSongs = (userDoc.likedSongs as any[]) || [];
    const favoriteGenres = userDoc.favoriteGenres || [];
    const favoriteArtists = userDoc.favoriteArtists || [];

    // 2. Fetch User Listening History
    const historyDocs = await ListeningHistory.find({ user: userObjId })
      .populate({
        path: 'song',
        select: 'genre artist',
      })
      .select('song completed skipped')
      .lean();

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
      if (song.artist) {
        distinctArtists.add(typeof song.artist === 'object' ? song.artist._id.toString() : song.artist.toString());
      }
      if (song.genre) {
        distinctGenres.add(typeof song.genre === 'object' ? song.genre._id.toString() : song.genre.toString());
      }
    }

    let completedCount = 0;
    for (const rec of historyDocs) {
      if (rec.completed) completedCount++;
      if (rec.song && typeof rec.song === 'object') {
        const song = rec.song as any;
        if (song.artist) {
          distinctArtists.add(typeof song.artist === 'object' ? song.artist._id.toString() : song.artist.toString());
        }
        if (song.genre) {
          distinctGenres.add(typeof song.genre === 'object' ? song.genre._id.toString() : song.genre.toString());
        }
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
