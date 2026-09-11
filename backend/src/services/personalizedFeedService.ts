import { supabase } from '../config/supabase.js';
import { isValidObjectId } from '../utils/validators.js';
import { mapSongRow } from './songService.js';
import { ListeningProfileService } from './listeningProfileService.js';
import { TrendingService } from './trendingService.js';

export interface PersonalizedFeedResult {
  basedOnTaste: any[];
  favoriteGenreTracks: any[];
  suggestedArtists: any[];
}

const SONG_JOIN_SELECT =
  '*, artists!songs_artist_id_fkey(*), albums!songs_album_id_fkey(*), genres!songs_genre_id_fkey(*)';

function mapArtistBrief(row: any) {
  return {
    _id: row.id,
    id: row.id,
    name: row.name,
    bio: row.bio || '',
    profileImage: row.profile_image || '',
    avatar: row.avatar || row.profile_image || '',
    verified: Boolean(row.verified),
    monthlyListeners: row.monthly_listeners || 0,
  };
}

export class PersonalizedFeedService {
  /**
   * Generates a personalized Home feed based on user preferences, history, and liked songs
   * using deterministic preference-based filtering.
   */
  static async getPersonalizedFeed(userId: string): Promise<PersonalizedFeedResult> {
    if (!isValidObjectId(userId)) {
      throw new Error('Invalid user ID');
    }

    // 1. Verify the user account exists
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (userError) {
      throw new Error(`Failed to fetch user: ${userError.message}`);
    }
    if (!userRow) {
      throw new Error('User account not found');
    }

    // Fetch explicit preferences from the favorite-artists / favorite-genres junction tables
    const [{ data: favArtistRows, error: favArtistError }, { data: favGenreRows, error: favGenreError }] =
      await Promise.all([
        supabase.from('user_favorite_artists').select('artist_id').eq('user_id', userId),
        supabase.from('user_favorite_genres').select('genre_id').eq('user_id', userId),
      ]);

    if (favArtistError) {
      throw new Error(`Failed to fetch favorite artists: ${favArtistError.message}`);
    }
    if (favGenreError) {
      throw new Error(`Failed to fetch favorite genres: ${favGenreError.message}`);
    }

    // 2. Fetch User Listening Profile Analytics
    const profile = await ListeningProfileService.getUserListeningProfile(userId);

    const favArtistIds = (favArtistRows || []).map((r) => r.artist_id).filter(Boolean) as string[];
    const favGenreIds = (favGenreRows || []).map((r) => r.genre_id).filter(Boolean) as string[];

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
    const orParts: string[] = [];

    if (combinedGenreIds.length > 0) {
      orParts.push(`genre_id.in.(${combinedGenreIds.join(',')})`);
    }
    if (combinedArtistIds.length > 0) {
      orParts.push(`artist_id.in.(${combinedArtistIds.join(',')})`);
    }

    if (orParts.length > 0) {
      const { data: tasteSongs, error: tasteError } = await supabase
        .from('songs')
        .select(SONG_JOIN_SELECT)
        .or(orParts.join(','))
        .order('play_count', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(10);

      if (tasteError) {
        throw new Error(`Failed to fetch taste-based songs: ${tasteError.message}`);
      }

      basedOnTaste = (tasteSongs || []).map(mapSongRow);
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
      const { data: genreSongs, error: genreError } = await supabase
        .from('songs')
        .select(SONG_JOIN_SELECT)
        .in('genre_id', combinedGenreIds)
        .order('release_year', { ascending: false })
        .order('play_count', { ascending: false })
        .limit(10);

      if (genreError) {
        throw new Error(`Failed to fetch favorite genre tracks: ${genreError.message}`);
      }

      favoriteGenreTracks = (genreSongs || []).map(mapSongRow);
    }

    // Fallback if no genre tracks found
    if (favoriteGenreTracks.length === 0) {
      const { data: catalogSongs, error: catalogError } = await supabase
        .from('songs')
        .select(SONG_JOIN_SELECT)
        .order('play_count', { ascending: false })
        .limit(10);

      if (catalogError) {
        throw new Error(`Failed to fetch catalog fallback songs: ${catalogError.message}`);
      }

      favoriteGenreTracks = (catalogSongs || []).map(mapSongRow);
    }

    // -------------------------------------------------------------
    // SECTION 3: "Artists You May Like" (Suggested artists matching fav genres)
    // -------------------------------------------------------------
    let suggestedArtists: any[] = [];

    // Find artists who perform in user's favorite/top genres, excluding already favorited artists
    if (combinedGenreIds.length > 0) {
      const { data: matchingSongs, error: matchError } = await supabase
        .from('songs')
        .select('artist_id')
        .in('genre_id', combinedGenreIds);

      if (matchError) {
        throw new Error(`Failed to fetch candidate artist songs: ${matchError.message}`);
      }

      const candidateArtistIds = Array.from(
        new Set(
          (matchingSongs || [])
            .map((s) => s.artist_id as string | null)
            .filter((id): id is string => Boolean(id) && !favArtistIds.includes(id as string))
        )
      );

      if (candidateArtistIds.length > 0) {
        const { data: artists, error: artistsError } = await supabase
          .from('artists')
          .select('id, name, bio, profile_image, avatar, verified, monthly_listeners')
          .in('id', candidateArtistIds)
          .order('monthly_listeners', { ascending: false })
          .limit(10);

        if (artistsError) {
          throw new Error(`Failed to fetch suggested artists: ${artistsError.message}`);
        }

        suggestedArtists = (artists || []).map(mapArtistBrief);
      }
    }

    // Fallback to top artists if no genre-specific suggestions found
    if (suggestedArtists.length === 0) {
      let fallbackQuery = supabase
        .from('artists')
        .select('id, name, bio, profile_image, avatar, verified, monthly_listeners, created_at');

      if (favArtistIds.length > 0) {
        fallbackQuery = fallbackQuery.not('id', 'in', `(${favArtistIds.join(',')})`);
      }

      const { data: fallbackArtists, error: fallbackError } = await fallbackQuery
        .order('monthly_listeners', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(10);

      if (fallbackError) {
        throw new Error(`Failed to fetch fallback suggested artists: ${fallbackError.message}`);
      }

      suggestedArtists = (fallbackArtists || []).map(mapArtistBrief);
    }

    return {
      basedOnTaste,
      favoriteGenreTracks,
      suggestedArtists,
    };
  }
}
