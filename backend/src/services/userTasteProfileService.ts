import { Types } from 'mongoose';
import { User } from '../models/User.js';
import { ListeningHistory } from '../models/ListeningHistory.js';
import { getRecencyConfig } from '../config/recommendationConfig.js';

export interface GenreAffinity {
  genreId: string;
  name?: string;
  affinityScore: number; // Combined normalized score (0-1)
  recentAffinityScore: number; // Normalized recent 30-day score (0-1)
  longTermAffinityScore: number; // Normalized long-term score (0-1)
}

export interface ArtistAffinity {
  artistId: string;
  name?: string;
  affinityScore: number; // Combined normalized score (0-1)
  recentAffinityScore: number; // Normalized recent 30-day score (0-1)
  longTermAffinityScore: number; // Normalized long-term score (0-1)
}

export interface UserTasteProfile {
  userId: string;
  genres: GenreAffinity[];
  artists: ArtistAffinity[];
  preferredLanguages: string[];
  preferredMoods: string[];
  recentBehaviorWindowDays: number;
  updatedAt: Date;
}

export class UserTasteProfileService {
  /**
   * Calculates exponential recency decay weight based on interaction age and half-life.
   * W(t) = baseWeight * (0.5 ^ (ageInDays / halfLifeDays))
   */
  static calculateRecencyWeight(
    interactionTimestamp: Date,
    baseWeight: number,
    halfLifeDaysOverride?: number
  ): number {
    const config = getRecencyConfig();
    const halfLife = halfLifeDaysOverride || config.halfLifeDays || 30;

    const ageInMs = Math.max(0, Date.now() - new Date(interactionTimestamp).getTime());
    const ageInDays = ageInMs / (1000 * 60 * 60 * 24);

    // Exponential half-life decay formula
    const decayedRatio = Math.pow(0.5, ageInDays / Math.max(1, halfLife));
    const finalWeight = baseWeight * decayedRatio;

    return Math.max(config.minWeightFloor * baseWeight, finalWeight);
  }

  /**
   * Analyzes user likes and listening history to calculate normalized genre and artist affinity scores,
   * applying exponential recency decay weighting consistently to recent vs long-term listening behavior.
   * 
   * @param userId Target user ObjectId string
   * @param options Configurable parameters (recentDays, halfLifeDays)
   */
  static async generateTasteProfile(
    userId: string,
    options: { recentDays?: number; halfLifeDays?: number } = {}
  ): Promise<UserTasteProfile> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }

    const config = getRecencyConfig();
    const recentDays = options.recentDays || config.halfLifeDays || 30;
    const halfLifeDays = options.halfLifeDays || config.halfLifeDays || 30;

    const userObjectId = new Types.ObjectId(userId);
    const now = new Date();
    const recentCutoff = new Date(now.getTime() - recentDays * 24 * 60 * 60 * 1000);

    // 1. Fetch User Document with populated liked songs & preferences
    const userDoc = await User.findById(userObjectId)
      .populate({
        path: 'likedSongs',
        populate: [
          { path: 'genre', select: 'name slug' },
          { path: 'artist', select: 'name' },
        ],
      })
      .populate('favoriteGenres', 'name slug')
      .populate('favoriteArtists', 'name')
      .lean();

    if (!userDoc) {
      throw new Error('User not found');
    }

    // 2. Fetch User Listening History
    const historyRecords = await ListeningHistory.find({ user: userObjectId })
      .populate({
        path: 'song',
        populate: [
          { path: 'genre', select: 'name slug' },
          { path: 'artist', select: 'name' },
        ],
      })
      .sort({ playedAt: -1 })
      .lean();

    // Intermediate accumulation maps: ID -> { recent: number, longTerm: number, name?: string }
    const genreRawScores = new Map<string, { recent: number; longTerm: number; name?: string }>();
    const artistRawScores = new Map<string, { recent: number; longTerm: number; name?: string }>();
    const languageCounts = new Map<string, number>();
    const moodCounts = new Map<string, number>();

    const getOrCreateGenre = (id: string, name?: string) => {
      if (!genreRawScores.has(id)) {
        genreRawScores.set(id, { recent: 0, longTerm: 0, name });
      }
      return genreRawScores.get(id)!;
    };

    const getOrCreateArtist = (id: string, name?: string) => {
      if (!artistRawScores.has(id)) {
        artistRawScores.set(id, { recent: 0, longTerm: 0, name });
      }
      return artistRawScores.get(id)!;
    };

    // Seed explicit user preferences (Favorite Genres & Artists)
    for (const fg of (userDoc.favoriteGenres as any[]) || []) {
      if (!fg) continue;
      const gId = fg._id ? fg._id.toString() : fg.toString();
      const gAcc = getOrCreateGenre(gId, fg.name);
      gAcc.longTerm += 10;
      gAcc.recent += 10;
    }

    for (const fa of (userDoc.favoriteArtists as any[]) || []) {
      if (!fa) continue;
      const aId = fa._id ? fa._id.toString() : fa.toString();
      const aAcc = getOrCreateArtist(aId, fa.name);
      aAcc.longTerm += 10;
      aAcc.recent += 10;
    }

    // Process Liked Songs (Base weight +5 per liked track)
    for (const song of (userDoc.likedSongs as any[]) || []) {
      if (!song) continue;

      const likedWeight = 5;

      if (song.genre) {
        const gId = typeof song.genre === 'object' ? song.genre._id.toString() : song.genre.toString();
        const gName = typeof song.genre === 'object' ? song.genre.name : undefined;
        const gAcc = getOrCreateGenre(gId, gName);
        gAcc.longTerm += likedWeight;
        gAcc.recent += likedWeight;
      }

      if (song.artist) {
        const aId = typeof song.artist === 'object' ? song.artist._id.toString() : song.artist.toString();
        const aName = typeof song.artist === 'object' ? song.artist.name : undefined;
        const aAcc = getOrCreateArtist(aId, aName);
        aAcc.longTerm += likedWeight;
        aAcc.recent += likedWeight;
      }

      if (song.language) {
        languageCounts.set(song.language, (languageCounts.get(song.language) || 0) + 1);
      }
      if (song.mood) {
        moodCounts.set(song.mood, (moodCounts.get(song.mood) || 0) + 1);
      }
    }

    // Process Listening History Records with Exponential Recency Decay Weighting
    for (const rec of historyRecords) {
      if (!rec.song || typeof rec.song !== 'object') continue;
      const song = rec.song as any;
      const playedAt = rec.playedAt || now;
      const isRecent = new Date(playedAt) >= recentCutoff;

      let baseWeight = 4; // Default completed play weight
      if (rec.skipped) baseWeight = -2;
      else if (rec.completed === false) baseWeight = 2;

      // Apply exponential recency decay weighting
      const decayedWeight = this.calculateRecencyWeight(playedAt, baseWeight, halfLifeDays);

      // Genre Accumulation
      if (song.genre) {
        const gId = typeof song.genre === 'object' ? song.genre._id.toString() : song.genre.toString();
        const gName = typeof song.genre === 'object' ? song.genre.name : undefined;
        const gAcc = getOrCreateGenre(gId, gName);

        gAcc.longTerm += decayedWeight;
        if (isRecent) {
          gAcc.recent += decayedWeight;
        }
      }

      // Artist Accumulation
      if (song.artist) {
        const aId = typeof song.artist === 'object' ? song.artist._id.toString() : song.artist.toString();
        const aName = typeof song.artist === 'object' ? song.artist.name : undefined;
        const aAcc = getOrCreateArtist(aId, aName);

        aAcc.longTerm += decayedWeight;
        if (isRecent) {
          aAcc.recent += decayedWeight;
        }
      }

      if (song.language) {
        languageCounts.set(song.language, (languageCounts.get(song.language) || 0) + 1);
      }
      if (song.mood) {
        moodCounts.set(song.mood, (moodCounts.get(song.mood) || 0) + 1);
      }
    }

    // 3. Normalize Affinity Scores to [0.0, 1.0] Range
    const normalizeScale = (raw: number, maxVal: number) => {
      if (maxVal <= 0) return 0;
      return Number(Math.max(0, Math.min(1, raw / maxVal)).toFixed(4));
    };

    // Genre Normalization
    const maxGenreLong = Math.max(...Array.from(genreRawScores.values()).map((v) => v.longTerm), 1);
    const maxGenreRecent = Math.max(...Array.from(genreRawScores.values()).map((v) => v.recent), 1);

    const genres: GenreAffinity[] = Array.from(genreRawScores.entries()).map(([genreId, val]) => {
      const longTermNorm = normalizeScale(val.longTerm, maxGenreLong);
      const recentNorm = normalizeScale(val.recent, maxGenreRecent);
      // Fused affinity score: 60% recent behavior + 40% long-term foundation
      const combined = Number((0.6 * recentNorm + 0.4 * longTermNorm).toFixed(4));

      return {
        genreId,
        name: val.name,
        affinityScore: Math.max(0, Math.min(1, combined)),
        recentAffinityScore: recentNorm,
        longTermAffinityScore: longTermNorm,
      };
    });

    genres.sort((a, b) => b.affinityScore - a.affinityScore);

    // Artist Normalization
    const maxArtistLong = Math.max(...Array.from(artistRawScores.values()).map((v) => v.longTerm), 1);
    const maxArtistRecent = Math.max(...Array.from(artistRawScores.values()).map((v) => v.recent), 1);

    const artists: ArtistAffinity[] = Array.from(artistRawScores.entries()).map(([artistId, val]) => {
      const longTermNorm = normalizeScale(val.longTerm, maxArtistLong);
      const recentNorm = normalizeScale(val.recent, maxArtistRecent);
      const combined = Number((0.6 * recentNorm + 0.4 * longTermNorm).toFixed(4));

      return {
        artistId,
        name: val.name,
        affinityScore: Math.max(0, Math.min(1, combined)),
        recentAffinityScore: recentNorm,
        longTermAffinityScore: longTermNorm,
      };
    });

    artists.sort((a, b) => b.affinityScore - a.affinityScore);

    const preferredLanguages = Array.from(languageCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map((entry) => entry[0]);

    const preferredMoods = Array.from(moodCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map((entry) => entry[0]);

    return {
      userId,
      genres,
      artists,
      preferredLanguages,
      preferredMoods,
      recentBehaviorWindowDays: recentDays,
      updatedAt: now,
    };
  }
}
