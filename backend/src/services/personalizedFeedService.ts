import { Types } from 'mongoose';
import { User } from '../models/User.js';
import { Song } from '../models/Song.js';
import { Artist } from '../models/Artist.js';
import { ListeningProfileService } from './listeningProfileService.js';
import { TrendingService } from './trendingService.js';

export interface PersonalizedFeedResult {
  basedOnTaste: any[];
  favoriteGenreTracks: any[];
  suggestedArtists: any[];
}

export class PersonalizedFeedService {
  /**
   * Generates a personalized Home feed based on user preferences, history, and liked songs
   * using deterministic preference-based filtering.
   */
  static async getPersonalizedFeed(userId: string): Promise<PersonalizedFeedResult> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }

    const userObjectId = new Types.ObjectId(userId);

    // 1. Fetch User Document with preferences
    const user = await User.findById(userObjectId)
      .select('favoriteArtists favoriteGenres likedSongs')
      .lean();

    if (!user) {
      throw new Error('User account not found');
    }

    // 2. Fetch User Listening Profile Analytics
    const profile = await ListeningProfileService.getUserListeningProfile(userId);

    const favArtistIds = (user.favoriteArtists || []).map((id) => id.toString());
    const favGenreIds = (user.favoriteGenres || []).map((id) => id.toString());
    const likedSongIds = (user.likedSongs || []).map((id) => id.toString());

    // Include top genres from history if explicit favorite genres are few
    const profileGenreIds = profile.topGenres.map((g) => g.genre._id);
    const combinedGenreIds = Array.from(new Set([...favGenreIds, ...profileGenreIds]));

    // Include top artists from history if explicit favorite artists are few
    const profileArtistIds = profile.topArtists.map((a) => a.artist._id);
    const combinedArtistIds = Array.from(new Set([...favArtistIds, ...profileArtistIds]));

    // -------------------------------------------------------------
    // SECTION 1: "Based on Your Taste" (Songs matching fav genres/artists)
    // -------------------------------------------------------------
    let basedOnTaste: any[] = [];
    const filterConditions: any[] = [];

    if (combinedGenreIds.length > 0) {
      filterConditions.push({ genre: { $in: combinedGenreIds } });
    }
    if (combinedArtistIds.length > 0) {
      filterConditions.push({ artist: { $in: combinedArtistIds } });
    }

    if (filterConditions.length > 0) {
      basedOnTaste = await Song.find({ $or: filterConditions })
        .populate('artist', 'name profileImage avatar verified')
        .populate('album', 'title coverImage releaseYear')
        .populate('genre', 'name slug')
        .sort({ playCount: -1, createdAt: -1 })
        .limit(10)
        .lean();
    }

    // Cold-start fallback if no preferences or matching songs found
    if (basedOnTaste.length === 0) {
      basedOnTaste = await TrendingService.getTrendingSongs(10);
    }

    // -------------------------------------------------------------
    // SECTION 2: "Your Favorite Genres" (Tracks in top/fav genres)
    // -------------------------------------------------------------
    let favoriteGenreTracks: any[] = [];
    if (combinedGenreIds.length > 0) {
      favoriteGenreTracks = await Song.find({ genre: { $in: combinedGenreIds } })
        .populate('artist', 'name profileImage avatar verified')
        .populate('album', 'title coverImage releaseYear')
        .populate('genre', 'name slug')
        .sort({ releaseYear: -1, playCount: -1 })
        .limit(10)
        .lean();
    }

    // Fallback if no genre tracks found
    if (favoriteGenreTracks.length === 0) {
      favoriteGenreTracks = await Song.find({})
        .populate('artist', 'name profileImage avatar verified')
        .populate('album', 'title coverImage releaseYear')
        .populate('genre', 'name slug')
        .sort({ playCount: -1 })
        .limit(10)
        .lean();
    }

    // -------------------------------------------------------------
    // SECTION 3: "Artists You May Like" (Suggested artists matching fav genres)
    // -------------------------------------------------------------
    let suggestedArtists: any[] = [];

    // Find artists who perform in user's favorite/top genres, excluding already favorited artists
    if (combinedGenreIds.length > 0) {
      const matchingSongs = await Song.find({ genre: { $in: combinedGenreIds } })
        .select('artist')
        .lean();

      const candidateArtistIds = Array.from(
        new Set(
          matchingSongs
            .map((s) => s.artist?.toString())
            .filter((id) => id && !favArtistIds.includes(id))
        )
      );

      if (candidateArtistIds.length > 0) {
        suggestedArtists = await Artist.find({ _id: { $in: candidateArtistIds } })
          .select('name bio profileImage avatar verified monthlyListeners')
          .sort({ monthlyListeners: -1 })
          .limit(10)
          .lean();
      }
    }

    // Fallback to top artists if no genre-specific suggestions found
    if (suggestedArtists.length === 0) {
      suggestedArtists = await Artist.find({ _id: { $nin: favArtistIds } })
        .select('name bio profileImage avatar verified monthlyListeners')
        .sort({ monthlyListeners: -1, createdAt: -1 })
        .limit(10)
        .lean();
    }

    return {
      basedOnTaste,
      favoriteGenreTracks,
      suggestedArtists,
    };
  }
}
