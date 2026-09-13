import { supabase } from '../config/supabase.js';
import { mapSongRow } from './songService.js';

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
    const { data: likedRows, error: likedErr } = await supabase
      .from('user_liked_songs')
      .select('song_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (likedErr || !likedRows || likedRows.length === 0) return [];
    const songIds = likedRows.map((r: any) => r.song_id);

    const { data: songs, error: songsErr } = await supabase
      .from('songs')
      .select('*, artists!songs_artist_id_fkey(*), albums!songs_album_id_fkey(*), genres!songs_genre_id_fkey(*)')
      .in('id', songIds);

    if (songsErr || !songs) return [];

    const songMap = new Map(songs.map((s: any) => [s.id, mapSongRow(s)]));
    return songIds.map((id: string) => songMap.get(id)).filter(Boolean);
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
