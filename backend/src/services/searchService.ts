import { supabase } from '../config/supabase.js';
import { mapSongRow } from './songService.js';
import { mapArtistRow } from './artistService.js';
import { mapAlbumRow } from './albumService.js';
import { escapePostgrestFilterValue } from '../utils/postgrestFilter.js';

export interface GroupedSearchResults {
  songs: any[];
  artists: any[];
  albums: any[];
  total: number;
}

export const searchCatalog = async (
  query: string,
  limit: number = 10
): Promise<GroupedSearchResults> => {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return {
      songs: [],
      artists: [],
      albums: [],
      total: 0,
    };
  }

  const safeLimit = Math.max(1, Math.min(50, limit));
  const pattern = escapePostgrestFilterValue(`%${trimmedQuery}%`);

  const [songsRes, artistsRes, albumsRes] = await Promise.all([
    supabase
      .from('songs')
      .select('*, artists!songs_artist_id_fkey(*), albums!songs_album_id_fkey(*), genres!songs_genre_id_fkey(*)')
      .eq('is_published', true)
      .or(`title.ilike.${pattern},language.ilike.${pattern}`)
      .limit(safeLimit),

    supabase
      .from('artists')
      .select('*')
      .or(`name.ilike.${pattern},bio.ilike.${pattern}`)
      .limit(safeLimit),

    supabase
      .from('albums')
      .select('*, artists!albums_artist_id_fkey(*), genres!albums_genre_id_fkey(*)')
      .or(`title.ilike.${pattern}`)
      .limit(safeLimit),
  ]);

  const songs = (songsRes.data || []).map(mapSongRow);
  const artists = (artistsRes.data || []).map((a) => mapArtistRow(a));
  const albums = (albumsRes.data || []).map(mapAlbumRow);
  const total = songs.length + artists.length + albums.length;

  return {
    songs,
    artists,
    albums,
    total,
  };
};

export const searchCatalogSemantic = async (
  vectorQuery: number[],
  limit: number = 10
): Promise<GroupedSearchResults> => {
  return {
    songs: [],
    artists: [],
    albums: [],
    total: 0,
  };
};
