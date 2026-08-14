import { Types } from 'mongoose';
import { User } from '../models/User.js';
import { ListeningHistory } from '../models/ListeningHistory.js';
import { getRecencyConfig } from '../config/recommendationConfig.js';

export interface GenreAffinity {
  genreId: string;
  name?: string;
  affinityScore: number; // Normalized score (0-1)
}

export interface ArtistAffinity {
  artistId: string;
  name?: string;
  affinityScore: number; // Normalized score (0-1)
}

export interface SingleTimeframeProfile {
  timeframeDays: number;
  genres: GenreAffinity[];
  artists: ArtistAffinity[];
  preferredLanguages: string[];
  preferredMoods: string[];
}

export interface UserTasteProfile {
  userId: string;
  shortTermProfile: SingleTimeframeProfile;
  longTermProfile: SingleTimeframeProfile;
  combinedGenres: GenreAffinity[];
  combinedArtists: ArtistAffinity[];
  preferredLanguages: string[];
  preferredMoods: string[];
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

    const decayedRatio = Math.pow(0.5, ageInDays / Math.max(1, halfLife));
    const finalWeight = baseWeight * decayedRatio;

    return Math.max(config.minWeightFloor * baseWeight, finalWeight);
  }

  /**
   * Analyzes user likes and listening history to calculate separate short-term and long-term
   * genre and artist affinity scores, combining them into a structured UserTasteProfile response.
   * 
   * @param userId Target user ObjectId string
   * @param options Configurable shortTermDays (default 14) and longTermDays (default 180)
   */
  static async generateTasteProfile(
    userId: string,
    options: { shortTermDays?: number; longTermDays?: number; halfLifeDays?: number } = {}
  ): Promise<UserTasteProfile> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }

    const config = getRecencyConfig();
    const shortTermDays = options.shortTermDays || 14;
    const longTermDays = options.longTermDays || 180;
    const halfLifeDays = options.halfLifeDays || config.halfLifeDays || 30;

    const userObjectId = new Types.ObjectId(userId);
    const now = new Date();
    const shortTermCutoff = new Date(now.getTime() - shortTermDays * 24 * 60 * 60 * 1000);
    const longTermCutoff = new Date(now.getTime() - longTermDays * 24 * 60 * 60 * 1000);

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
    const historyRecords = await ListeningHistory.find({
      user: userObjectId,
      playedAt: { $gte: longTermCutoff },
    })
      .populate({
        path: 'song',
        populate: [
          { path: 'genre', select: 'name slug' },
          { path: 'artist', select: 'name' },
        ],
      })
      .sort({ playedAt: -1 })
      .lean();

    // Intermediate accumulation maps: ID -> { shortTerm: number, longTerm: number, name?: string }
    const genreRawScores = new Map<string, { shortTerm: number; longTerm: number; name?: string }>();
    const artistRawScores = new Map<string, { shortTerm: number; longTerm: number; name?: string }>();

    const shortTermLang = new Map<string, number>();
    const longTermLang = new Map<string, number>();
    const shortTermMood = new Map<string, number>();
    const longTermMood = new Map<string, number>();

    const getOrCreateGenre = (id: string, name?: string) => {
      if (!genreRawScores.has(id)) {
        genreRawScores.set(id, { shortTerm: 0, longTerm: 0, name });
      }
      return genreRawScores.get(id)!;
    };

    const getOrCreateArtist = (id: string, name?: string) => {
      if (!artistRawScores.has(id)) {
        artistRawScores.set(id, { shortTerm: 0, longTerm: 0, name });
      }
      return artistRawScores.get(id)!;
    };

    // Seed explicit user preferences (Favorite Genres & Artists)
    for (const fg of (userDoc.favoriteGenres as any[]) || []) {
      if (!fg) continue;
      const gId = fg._id ? fg._id.toString() : fg.toString();
      const gAcc = getOrCreateGenre(gId, fg.name);
      gAcc.longTerm += 10;
      gAcc.shortTerm += 10;
    }

    for (const fa of (userDoc.favoriteArtists as any[]) || []) {
      if (!fa) continue;
      const aId = fa._id ? fa._id.toString() : fa.toString();
      const aAcc = getOrCreateArtist(aId, fa.name);
      aAcc.longTerm += 10;
      aAcc.shortTerm += 10;
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
        gAcc.shortTerm += likedWeight;
      }

      if (song.artist) {
        const aId = typeof song.artist === 'object' ? song.artist._id.toString() : song.artist.toString();
        const aName = typeof song.artist === 'object' ? song.artist.name : undefined;
        const aAcc = getOrCreateArtist(aId, aName);
        aAcc.longTerm += likedWeight;
        aAcc.shortTerm += likedWeight;
      }

      if (song.language) {
        shortTermLang.set(song.language, (shortTermLang.get(song.language) || 0) + 1);
        longTermLang.set(song.language, (longTermLang.get(song.language) || 0) + 1);
      }
      if (song.mood) {
        shortTermMood.set(song.mood, (shortTermMood.get(song.mood) || 0) + 1);
        longTermMood.set(song.mood, (longTermMood.get(song.mood) || 0) + 1);
      }
    }

    // Process Listening History Records with Short-Term vs Long-Term Recency Decay
    for (const rec of historyRecords) {
      if (!rec.song || typeof rec.song !== 'object') continue;
      const song = rec.song as any;
      const playedAt = rec.playedAt || now;
      const isShortTerm = new Date(playedAt) >= shortTermCutoff;

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
        if (isShortTerm) {
          gAcc.shortTerm += baseWeight * 1.5; // Un-decayed / boosted short-term weight
        }
      }

      // Artist Accumulation
      if (song.artist) {
        const aId = typeof song.artist === 'object' ? song.artist._id.toString() : song.artist.toString();
        const aName = typeof song.artist === 'object' ? song.artist.name : undefined;
        const aAcc = getOrCreateArtist(aId, aName);

        aAcc.longTerm += decayedWeight;
        if (isShortTerm) {
          aAcc.shortTerm += baseWeight * 1.5;
        }
      }

      if (song.language) {
        longTermLang.set(song.language, (longTermLang.get(song.language) || 0) + 1);
        if (isShortTerm) {
          shortTermLang.set(song.language, (shortTermLang.get(song.language) || 0) + 1);
        }
      }

      if (song.mood) {
        longTermMood.set(song.mood, (longTermMood.get(song.mood) || 0) + 1);
        if (isShortTerm) {
          shortTermMood.set(song.mood, (shortTermMood.get(song.mood) || 0) + 1);
        }
      }
    }

    // 3. Normalize Short-Term and Long-Term Profiles
    const normalizeScale = (raw: number, maxVal: number) => {
      if (maxVal <= 0) return 0;
      return Number(Math.max(0, Math.min(1, raw / maxVal)).toFixed(4));
    };

    const maxGenreShort = Math.max(...Array.from(genreRawScores.values()).map((v) => v.shortTerm), 1);
    const maxGenreLong = Math.max(...Array.from(genreRawScores.values()).map((v) => v.longTerm), 1);

    const shortTermGenres: GenreAffinity[] = [];
    const longTermGenres: GenreAffinity[] = [];
    const combinedGenres: GenreAffinity[] = [];

    for (const [gId, val] of genreRawScores.entries()) {
      const stNorm = normalizeScale(val.shortTerm, maxGenreShort);
      const ltNorm = normalizeScale(val.longTerm, maxGenreLong);
      const combinedNorm = Number((0.6 * stNorm + 0.4 * ltNorm).toFixed(4));

      if (stNorm > 0) {
        shortTermGenres.push({ genreId: gId, name: val.name, affinityScore: stNorm });
      }
      if (ltNorm > 0) {
        longTermGenres.push({ genreId: gId, name: val.name, affinityScore: ltNorm });
      }
      combinedGenres.push({ genreId: gId, name: val.name, affinityScore: combinedNorm });
    }

    shortTermGenres.sort((a, b) => b.affinityScore - a.affinityScore);
    longTermGenres.sort((a, b) => b.affinityScore - a.affinityScore);
    combinedGenres.sort((a, b) => b.affinityScore - a.affinityScore);

    const maxArtistShort = Math.max(...Array.from(artistRawScores.values()).map((v) => v.shortTerm), 1);
    const maxArtistLong = Math.max(...Array.from(artistRawScores.values()).map((v) => v.longTerm), 1);

    const shortTermArtists: ArtistAffinity[] = [];
    const longTermArtists: ArtistAffinity[] = [];
    const combinedArtists: ArtistAffinity[] = [];

    for (const [aId, val] of artistRawScores.entries()) {
      const stNorm = normalizeScale(val.shortTerm, maxArtistShort);
      const ltNorm = normalizeScale(val.longTerm, maxArtistLong);
      const combinedNorm = Number((0.6 * stNorm + 0.4 * ltNorm).toFixed(4));

      if (stNorm > 0) {
        shortTermArtists.push({ artistId: aId, name: val.name, affinityScore: stNorm });
      }
      if (ltNorm > 0) {
        longTermArtists.push({ artistId: aId, name: val.name, affinityScore: ltNorm });
      }
      combinedArtists.push({ artistId: aId, name: val.name, affinityScore: combinedNorm });
    }

    shortTermArtists.sort((a, b) => b.affinityScore - a.affinityScore);
    longTermArtists.sort((a, b) => b.affinityScore - a.affinityScore);
    combinedArtists.sort((a, b) => b.affinityScore - a.affinityScore);

    const topShortTermLanguages = Array.from(shortTermLang.entries())
      .sort((a, b) => b[1] - a[1])
      .map((e) => e[0]);

    const topLongTermLanguages = Array.from(longTermLang.entries())
      .sort((a, b) => b[1] - a[1])
      .map((e) => e[0]);

    const topShortTermMoods = Array.from(shortTermMood.entries())
      .sort((a, b) => b[1] - a[1])
      .map((e) => e[0]);

    const topLongTermMoods = Array.from(longTermMood.entries())
      .sort((a, b) => b[1] - a[1])
      .map((e) => e[0]);

    return {
      userId,
      shortTermProfile: {
        timeframeDays: shortTermDays,
        genres: shortTermGenres,
        artists: shortTermArtists,
        preferredLanguages: topShortTermLanguages,
        preferredMoods: topShortTermMoods,
      },
      longTermProfile: {
        timeframeDays: longTermDays,
        genres: longTermGenres,
        artists: longTermArtists,
        preferredLanguages: topLongTermLanguages,
        preferredMoods: topLongTermMoods,
      },
      combinedGenres,
      combinedArtists,
      preferredLanguages: topLongTermLanguages,
      preferredMoods: topLongTermMoods,
      updatedAt: now,
    };
  }
}
