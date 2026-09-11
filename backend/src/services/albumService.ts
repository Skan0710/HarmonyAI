import { supabase } from '../config/supabase.js';

export interface CreateAlbumInput {
  title: string;
  artist: string;
  featuredArtists?: string[];
  genre?: string;
  coverImage?: string;
  releaseYear?: number;
  releaseDate?: Date;
  albumType?: string;
  totalTracks?: number;
  tags?: string[];
}

export interface UpdateAlbumInput {
  title?: string;
  artist?: string;
  featuredArtists?: string[];
  genre?: string;
  coverImage?: string;
  releaseYear?: number;
  releaseDate?: Date;
  albumType?: string;
  totalTracks?: number;
  tags?: string[];
}

export interface GetAlbumsFilter {
  search?: string;
  artistId?: string;
  genreId?: string;
  albumType?: string;
  releaseYear?: number;
  page?: number;
  limit?: number;
}

export function mapAlbumRow(row: any) {
  if (!row) return null;
  const artistObj = row.artists || row['artists!albums_artist_id_fkey'] || null;
  const genreObj = row.genres || row['genres!albums_genre_id_fkey'] || null;

  return {
    _id: row.id,
    id: row.id,
    title: row.title,
    artist: artistObj ? {
      _id: artistObj.id,
      id: artistObj.id,
      name: artistObj.name,
      profileImage: artistObj.profile_image,
      avatar: artistObj.avatar,
      verified: artistObj.verified,
    } : row.artist_id,
    genre: genreObj ? {
      _id: genreObj.id,
      id: genreObj.id,
      name: genreObj.name,
      slug: genreObj.slug,
    } : row.genre_id,
    coverImage: row.cover_image || '',
    releaseYear: row.release_year,
    releaseDate: row.release_date,
    albumType: row.album_type || 'album',
    totalTracks: row.total_tracks || 1,
    tags: row.tags || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class AlbumService {
  static async createAlbum(data: CreateAlbumInput): Promise<any> {
    const { data: album, error } = await supabase
      .from('albums')
      .insert({
        title: data.title,
        artist_id: data.artist,
        genre_id: data.genre || null,
        cover_image: data.coverImage || '',
        release_year: data.releaseYear || null,
        release_date: data.releaseDate ? new Date(data.releaseDate).toISOString() : null,
        album_type: data.albumType || 'album',
        total_tracks: data.totalTracks || 1,
        tags: data.tags || [],
      })
      .select('*, artists!albums_artist_id_fkey(*), genres!albums_genre_id_fkey(*)')
      .single();

    if (error) throw new Error(`Failed to create album: ${error.message}`);
    return mapAlbumRow(album);
  }

  static async getAllAlbums(filter: GetAlbumsFilter = {}): Promise<{ albums: any[]; total: number }> {
    const { search, artistId, genreId, albumType, releaseYear, page = 1, limit = 20 } = filter;

    let q = supabase
      .from('albums')
      .select('*, artists!albums_artist_id_fkey(*), genres!albums_genre_id_fkey(*)', { count: 'exact' });

    if (search) {
      q = q.ilike('title', `%${search}%`);
    }
    if (artistId) {
      q = q.eq('artist_id', artistId);
    }
    if (genreId) {
      q = q.eq('genre_id', genreId);
    }
    if (albumType) {
      q = q.eq('album_type', albumType);
    }
    if (releaseYear) {
      q = q.eq('release_year', releaseYear);
    }

    const validPage = Math.max(1, page);
    const validLimit = Math.max(1, Math.min(100, limit));
    const offset = (validPage - 1) * validLimit;

    q = q.order('created_at', { ascending: false }).range(offset, offset + validLimit - 1);

    const { data: albums, count, error } = await q;
    if (error) throw new Error(`Failed to fetch albums: ${error.message}`);

    return {
      albums: (albums || []).map(mapAlbumRow),
      total: count || 0,
    };
  }

  static async getAlbumById(albumId: string): Promise<any | null> {
    const { data: album, error } = await supabase
      .from('albums')
      .select('*, artists!albums_artist_id_fkey(*), genres!albums_genre_id_fkey(*)')
      .eq('id', albumId)
      .maybeSingle();

    if (error || !album) return null;
    return mapAlbumRow(album);
  }

  static async updateAlbum(albumId: string, data: UpdateAlbumInput): Promise<any | null> {
    const updatePayload: Record<string, any> = {};
    if (data.title !== undefined) updatePayload.title = data.title;
    if (data.artist !== undefined) updatePayload.artist_id = data.artist;
    if (data.genre !== undefined) updatePayload.genre_id = data.genre;
    if (data.coverImage !== undefined) updatePayload.cover_image = data.coverImage;
    if (data.releaseYear !== undefined) updatePayload.release_year = data.releaseYear;
    if (data.releaseDate !== undefined) updatePayload.release_date = new Date(data.releaseDate).toISOString();
    if (data.albumType !== undefined) updatePayload.album_type = data.albumType;
    if (data.totalTracks !== undefined) updatePayload.total_tracks = data.totalTracks;
    if (data.tags !== undefined) updatePayload.tags = data.tags;
    updatePayload.updated_at = new Date().toISOString();

    const { data: updated, error } = await (supabase.from('albums') as any)
      .update(updatePayload as any)
      .eq('id', albumId)
      .select('*, artists!albums_artist_id_fkey(*), genres!albums_genre_id_fkey(*)')
      .maybeSingle();

    if (error || !updated) return null;
    return mapAlbumRow(updated);
  }

  static async deleteAlbum(albumId: string): Promise<any | null> {
    const existing = await this.getAlbumById(albumId);
    if (!existing) return null;

    const { error } = await supabase.from('albums').delete().eq('id', albumId);
    if (error) throw new Error(`Failed to delete album: ${error.message}`);
    return existing;
  }
}
