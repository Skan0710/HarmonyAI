import { Types } from 'mongoose';
import { Song, ISong } from '../models/Song.js';
import { User } from '../models/User.js';
import { ListeningHistory } from '../models/ListeningHistory.js';
import { ColdStartDetectionService } from './coldStartDetectionService.js';

export interface ColdStartRecommendationParams {
  userId: string;
  limit?: number;
  excludeSongIds?: string[];
}

export interface ColdStartRecommendationResult {
  songs: ISong[];
  strategy: 'COLD_START';
  classification: string;
  candidateSources: string[];
}

export class ColdStartRecommendationService {
  /**
   * Generates high-quality recommendations for NEW and LIMITED_DATA users by pooling popular,
   * trending, and new-release songs while prioritizing explicitly selected favorite genres/artists
   * and enforcing artist/genre diversity.
   */
  static async getColdStartRecommendations(
    params: ColdStartRecommendationParams
  ): Promise<ColdStartRecommendationResult> {
    const { userId, limit = 10, excludeSongIds = [] } = params;

    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }

    const userObjId = new Types.ObjectId(userId);

    // 1. Detect Cold Start Classification Status
    const coldStartInfo = await ColdStartDetectionService.detectUserColdStartStatus(userId);
    const classification = coldStartInfo.classification;

    // 2. Fetch User Explicit Favorites, Liked Songs, and History
    const userDoc = await User.findById(userObjId)
      .populate('favoriteGenres', '_id name')
      .populate('favoriteArtists', '_id name')
      .populate('likedSongs', '_id')
      .lean();

    const favoriteGenreIds = new Set<string>(
      ((userDoc?.favoriteGenres as any[]) || []).map((g) => (g._id ? g._id.toString() : g.toString()))
    );

    const favoriteArtistIds = new Set<string>(
      ((userDoc?.favoriteArtists as any[]) || []).map((a) => (a._id ? a._id.toString() : a.toString()))
    );

    const userLikedSongIds = new Set<string>(
      ((userDoc?.likedSongs as any[]) || []).map((s) => (s._id ? s._id.toString() : s.toString()))
    );

    const historyDocs = await ListeningHistory.find({ user: userObjId })
      .select('song')
      .lean();

    const historySongIds = new Set<string>(historyDocs.map((h) => h.song.toString()));

    // Exclude songs the user has played, liked, or explicitly passed
    const fullExcludeSet = new Set<string>([
      ...userLikedSongIds,
      ...historySongIds,
      ...excludeSongIds,
    ]);

    // 3. Pool Candidates across 3 Primary Channels:
    // Channel A: Explicit Favorite Genre & Artist Matches
    let favoriteCandidates: ISong[] = [];
    if (favoriteGenreIds.size > 0 || favoriteArtistIds.size > 0) {
      const validGenreObjectIds = Array.from(favoriteGenreIds)
        .filter((id) => Types.ObjectId.isValid(id))
        .map((id) => new Types.ObjectId(id));
      const validArtistObjectIds = Array.from(favoriteArtistIds)
        .filter((id) => Types.ObjectId.isValid(id))
        .map((id) => new Types.ObjectId(id));

      const orConditions: any[] = [];
      if (validGenreObjectIds.length > 0) {
        orConditions.push({ genre: { $in: validGenreObjectIds } });
      }
      if (validArtistObjectIds.length > 0) {
        orConditions.push({ artist: { $in: validArtistObjectIds } });
      }

      if (orConditions.length > 0) {
        favoriteCandidates = await Song.find({
          isPublished: true,
          $or: orConditions,
        })
          .populate('artist', 'name avatar')
          .populate('genre', 'name slug')
          .sort({ playCount: -1 })
          .limit(30)
          .lean();
      }
    }

    // Channel B: Popular / Trending Tracks
    const popularCandidates = await Song.find({ isPublished: true })
      .populate('artist', 'name avatar')
      .populate('genre', 'name slug')
      .sort({ playCount: -1 })
      .limit(30)
      .lean();

    // Channel C: New Release Tracks
    const newReleaseCandidates = await Song.find({ isPublished: true })
      .populate('artist', 'name avatar')
      .populate('genre', 'name slug')
      .sort({ releaseYear: -1, createdAt: -1 })
      .limit(30)
      .lean();

    // 4. Score and Rank Candidate Songs
    const candidateMap = new Map<string, { song: ISong; score: number; sources: Set<string> }>();

    const addOrUpdateCandidate = (songDoc: any, baseScore: number, sourceTag: string) => {
      const sId = songDoc._id.toString();
      if (fullExcludeSet.has(sId)) return;

      if (!candidateMap.has(sId)) {
        candidateMap.set(sId, {
          song: songDoc,
          score: baseScore,
          sources: new Set([sourceTag]),
        });
      } else {
        const item = candidateMap.get(sId)!;
        item.score += baseScore * 0.5; // Boost multi-channel matches
        item.sources.add(sourceTag);
      }
    };

    for (const song of favoriteCandidates) {
      let favBonus = 0.5;
      const gId = typeof song.genre === 'object' && song.genre?._id ? song.genre._id.toString() : String(song.genre);
      const aId = typeof song.artist === 'object' && song.artist?._id ? song.artist._id.toString() : String(song.artist);

      if (favoriteGenreIds.has(gId)) favBonus += 0.3;
      if (favoriteArtistIds.has(aId)) favBonus += 0.4;

      addOrUpdateCandidate(song, favBonus, 'favorite_match');
    }

    for (const song of popularCandidates) {
      addOrUpdateCandidate(song, 0.4, 'popular_trending');
    }

    for (const song of newReleaseCandidates) {
      addOrUpdateCandidate(song, 0.35, 'new_releases');
    }

    const scoredCandidates = Array.from(candidateMap.values()).sort((a, b) => b.score - a.score);

    // 5. Enforce Diversity Across Artists and Genres
    const finalSelectedSongs: ISong[] = [];
    const artistCounts = new Map<string, number>();
    const genreCounts = new Map<string, number>();

    const maxPerArtist = 2;
    const maxPerGenre = 3;

    for (const item of scoredCandidates) {
      if (finalSelectedSongs.length >= limit) break;

      const song = item.song;
      const aId = typeof song.artist === 'object' && song.artist?._id ? song.artist._id.toString() : String(song.artist);
      const gId = typeof song.genre === 'object' && song.genre?._id ? song.genre._id.toString() : String(song.genre);

      const currentArtistCount = artistCounts.get(aId) || 0;
      const currentGenreCount = genreCounts.get(gId) || 0;

      if (currentArtistCount < maxPerArtist && currentGenreCount < maxPerGenre) {
        finalSelectedSongs.push(song);
        artistCounts.set(aId, currentArtistCount + 1);
        genreCounts.set(gId, currentGenreCount + 1);
      }
    }

    // Fallback if diversity cap was too strict for small catalogs
    if (finalSelectedSongs.length < limit) {
      for (const item of scoredCandidates) {
        if (finalSelectedSongs.length >= limit) break;
        if (!finalSelectedSongs.some((s) => s._id.toString() === item.song._id.toString())) {
          finalSelectedSongs.push(item.song);
        }
      }
    }

    const allSources = Array.from(
      new Set(scoredCandidates.flatMap((item) => Array.from(item.sources)))
    );

    return {
      songs: finalSelectedSongs,
      strategy: 'COLD_START',
      classification,
      candidateSources: allSources,
    };
  }
}
