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

  let songs = (songsRes.data || []).map(mapSongRow);
  let artists = (artistsRes.data || []).map((a) => mapArtistRow(a));
  let albums = (albumsRes.data || []).map(mapAlbumRow);
  let total = songs.length + artists.length + albums.length;

  // On-demand search expansion:
  // If local results are sparse and the query is specific (>= 3 chars),
  // attempt on-demand English artist/track discovery through iTunes to grow the catalog organically.
  // We strictly do NOT call external APIs when sufficient local results already exist.
  if (songs.length < 2 && artists.length === 0 && trimmedQuery.length >= 3) {
    try {
      const { ITunesProvider } = await import('../ingestion/providers/itunesProvider.js');
      const { CatalogIngestionService } = await import('../ingestion/services/catalogIngestionService.js');
      const { isEnglishArtist } = await import('../ingestion/filters/englishFilter.js');

      const itunes = new ITunesProvider(100);
      const artistMatch = await itunes.searchArtist(trimmedQuery);

      if (artistMatch && isEnglishArtist(artistMatch.name)) {
        const ingestionService = new CatalogIngestionService(100);
        await ingestionService.initializeGenres();
        const genreKey = (artistMatch.primaryGenre || 'pop').toLowerCase();

        // Ingest artist's catalog into Supabase (non-destructive append/upsert)
        const ingestRes = await ingestionService.ingestArtistCatalog(artistMatch.name, genreKey);

        if (ingestRes.songsAdded > 0) {
          // Re-query newly populated records
          const [newSongsRes, newArtistsRes, newAlbumsRes] = await Promise.all([
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

          songs = (newSongsRes.data || []).map(mapSongRow);
          artists = (newArtistsRes.data || []).map((a) => mapArtistRow(a));
          albums = (newAlbumsRes.data || []).map(mapAlbumRow);
          total = songs.length + artists.length + albums.length;
        }
      }
    } catch (e) {
      // Safe fallback: on-demand discovery failure never breaks the user's search
    }
  }

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
