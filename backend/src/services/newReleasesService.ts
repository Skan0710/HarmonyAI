import { supabase } from '../config/supabase.js';
import { mapSongRow } from './songService.js';
import { mapAlbumRow } from './albumService.js';

export interface NewReleasesResult {
  songs: any[];
  albums: any[];
  pagination: {
    page: number;
    limit: number;
    totalSongs: number;
    totalAlbums: number;
  };
}

export class NewReleasesService {
  /**
   * Fetches recently released songs and albums sorted by releaseYear and createdAt descending.
   */
  static async getNewReleases(page = 1, limit = 10): Promise<NewReleasesResult> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, Math.min(50, limit));
    const skip = (safePage - 1) * safeLimit;

    const [songsRes, totalSongsRes, albumsRes, totalAlbumsRes] = await Promise.all([
      supabase
        .from('songs')
        .select('*, artists!songs_artist_id_fkey(*), albums!songs_album_id_fkey(*), genres!songs_genre_id_fkey(*)')
        .order('release_year', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .range(skip, skip + safeLimit - 1),

      supabase.from('songs').select('*', { count: 'exact', head: true }),

      supabase
        .from('albums')
        .select('*, artists!albums_artist_id_fkey(*), genres!albums_genre_id_fkey(*)')
        .order('release_year', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .range(skip, skip + safeLimit - 1),

      supabase.from('albums').select('*', { count: 'exact', head: true }),
    ]);

    const songs = (songsRes.data || []).map(mapSongRow);
    const albums = (albumsRes.data || []).map(mapAlbumRow);

    return {
      songs,
      albums,
      pagination: {
        page: safePage,
        limit: safeLimit,
        totalSongs: totalSongsRes.count || songs.length,
        totalAlbums: totalAlbumsRes.count || albums.length,
      },
    };
  }
}
