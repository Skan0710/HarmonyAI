import { supabase } from '../config/supabase.js';

export class UserService {
  static async getUserById(userId: string): Promise<any | null> {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, clerk_id, name, email, profile_picture, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle();

    if (error || !user) return null;

    // Fetch favorite artists
    const { data: favArtists } = await supabase
      .from('user_favorite_artists')
      .select('artists(id, name, profile_image, avatar, verified)')
      .eq('user_id', userId);

    // Fetch favorite genres
    const { data: favGenres } = await supabase
      .from('user_favorite_genres')
      .select('genres(id, name, slug, cover_image, description)')
      .eq('user_id', userId);

    return {
      _id: user.id,
      id: user.id,
      name: user.name,
      email: user.email,
      profilePicture: user.profile_picture,
      favoriteArtists: (favArtists || []).map((a: any) => ({
        _id: a.artists?.id,
        id: a.artists?.id,
        name: a.artists?.name,
        profileImage: a.artists?.profile_image,
        avatar: a.artists?.avatar,
        verified: a.artists?.verified,
      })).filter(Boolean),
      favoriteGenres: (favGenres || []).map((g: any) => ({
        _id: g.genres?.id,
        id: g.genres?.id,
        name: g.genres?.name,
        slug: g.genres?.slug,
        coverImage: g.genres?.cover_image,
        description: g.genres?.description,
      })).filter(Boolean),
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }

  static async updateProfile(
    userId: string,
    data: { name?: string; profilePicture?: string }
  ): Promise<any | null> {
    const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.profilePicture !== undefined) updatePayload.profile_picture = data.profilePicture;

    const { data: updated, error } = await (supabase.from('users') as any)
      .update(updatePayload as any)
      .eq('id', userId)
      .select('id, name, email, profile_picture, created_at, updated_at')
      .maybeSingle();

    if (error || !updated) return null;

    return {
      _id: updated.id,
      id: updated.id,
      name: updated.name,
      email: updated.email,
      profilePicture: updated.profile_picture,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    };
  }

  static async getLikedSongs(userId: string): Promise<any[]> {
    const { data: liked, error } = await supabase
      .from('user_liked_songs')
      .select('songs(*, artists(*), albums(*), genres(*))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error || !liked) return [];

    return liked.map((l: any) => {
      const s = l.songs;
      if (!s) return null;
      return {
        _id: s.id,
        id: s.id,
        title: s.title,
        artist: s.artists ? {
          _id: s.artists.id,
          id: s.artists.id,
          name: s.artists.name,
          avatar: s.artists.avatar || s.artists.profile_image,
          verified: s.artists.verified,
        } : s.artist_id,
        album: s.albums ? {
          _id: s.albums.id,
          id: s.albums.id,
          title: s.albums.title,
          coverImage: s.albums.cover_image,
          releaseYear: s.albums.release_year,
        } : s.album_id,
        genre: s.genres ? {
          _id: s.genres.id,
          id: s.genres.id,
          name: s.genres.name,
          slug: s.genres.slug,
        } : s.genre_id,
        duration: s.duration,
        coverImage: s.cover_image,
        audioUrl: s.audio_url,
        releaseYear: s.release_year,
        playCount: s.play_count,
        audioFeatures: s.audio_features,
        mood: s.mood,
        tags: s.tags,
      };
    }).filter(Boolean);
  }

  static async likeSong(userId: string, songId: string): Promise<string[]> {
    const { error } = await supabase
      .from('user_liked_songs')
      .upsert({ user_id: userId, song_id: songId });

    if (error) throw new Error(`Failed to like song: ${error.message}`);

    const { data: allLiked } = await supabase
      .from('user_liked_songs')
      .select('song_id')
      .eq('user_id', userId);

    return (allLiked || []).map((l) => l.song_id);
  }

  static async unlikeSong(userId: string, songId: string): Promise<string[]> {
    await supabase
      .from('user_liked_songs')
      .delete()
      .match({ user_id: userId, song_id: songId });

    const { data: allLiked } = await supabase
      .from('user_liked_songs')
      .select('song_id')
      .eq('user_id', userId);

    return (allLiked || []).map((l) => l.song_id);
  }

  static async addFavoriteArtist(userId: string, artistId: string): Promise<any[]> {
    await supabase
      .from('user_favorite_artists')
      .upsert({ user_id: userId, artist_id: artistId });

    const user = await this.getUserById(userId);
    return user?.favoriteArtists || [];
  }

  static async removeFavoriteArtist(userId: string, artistId: string): Promise<any[]> {
    await supabase
      .from('user_favorite_artists')
      .delete()
      .match({ user_id: userId, artist_id: artistId });

    const user = await this.getUserById(userId);
    return user?.favoriteArtists || [];
  }

  static async addFavoriteGenre(userId: string, genreId: string): Promise<any[]> {
    await supabase
      .from('user_favorite_genres')
      .upsert({ user_id: userId, genre_id: genreId });

    const user = await this.getUserById(userId);
    return user?.favoriteGenres || [];
  }

  static async removeFavoriteGenre(userId: string, genreId: string): Promise<any[]> {
    await supabase
      .from('user_favorite_genres')
      .delete()
      .match({ user_id: userId, genre_id: genreId });

    const user = await this.getUserById(userId);
    return user?.favoriteGenres || [];
  }

  static async getUserPreferences(userId: string): Promise<any> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    return {
      favoriteArtists: user.favoriteArtists || [],
      favoriteGenres: user.favoriteGenres || [],
    };
  }
}
