import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Song, Genre, Artist, Album, PaginationData } from '../types/music';
import { fetchSongs, fetchGenres, fetchArtists, fetchAlbums } from '../services/songService';
import { MusicFilters } from '../components/MusicFilters';
import { MusicGrid } from '../components/MusicGrid';
import { Pagination } from '../components/Pagination';

export const MusicLibraryPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // State for metadata lists
  const [genres, setGenres] = useState<Genre[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);

  // State for fetched songs and pagination
  const [songs, setSongs] = useState<Song[]>([]);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Audio Preview Player
  const [currentPlayingSong, setCurrentPlayingSong] = useState<Song | null>(null);

  // Extract initial values from URL search parameters (Preserves filters across navigation & reloads)
  const searchQuery = searchParams.get('q') || '';
  const selectedGenreId = searchParams.get('genre') || '';
  const selectedArtistId = searchParams.get('artist') || '';
  const selectedAlbumId = searchParams.get('album') || '';
  const sortBy = searchParams.get('sort') || 'playCount';
  const sortOrder = (searchParams.get('order') as 'asc' | 'desc') || 'desc';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '15', 10);

  // Helper to update URL search params preserving existing values
  const updateUrlParams = (newParams: Record<string, string | number | undefined | null>) => {
    const nextParams = new URLSearchParams(searchParams);

    Object.entries(newParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '' && value !== 1 && value !== '15' && value !== 'playCount' && value !== 'desc') {
        nextParams.set(key, String(value));
      } else {
        nextParams.delete(key);
      }
    });

    setSearchParams(nextParams, { replace: true });
  };

  // Fetch filter metadata (Genres, Artists, Albums) on mount
  useEffect(() => {
    const loadFilterData = async () => {
      const [genresRes, artistsRes, albumsRes] = await Promise.all([
        fetchGenres(),
        fetchArtists(),
        fetchAlbums(),
      ]);

      if (genresRes.genres) setGenres(genresRes.genres);
      if (artistsRes.artists) setArtists(artistsRes.artists);
      if (albumsRes.albums) setAlbums(albumsRes.albums);
    };

    loadFilterData();
  }, []);

  // Fetch songs when filter params change
  const loadSongs = useCallback(async () => {
    setLoading(true);
    setError(null);

    const res = await fetchSongs({
      search: searchQuery || undefined,
      genreId: selectedGenreId || undefined,
      artistId: selectedArtistId || undefined,
      albumId: selectedAlbumId || undefined,
      sortBy,
      sortOrder,
      page,
      limit,
    });

    if (res.error) {
      setError(res.error);
    } else {
      setSongs(res.songs);
      if (res.pagination) {
        setPagination(res.pagination);
      }
    }

    setLoading(false);
  }, [searchQuery, selectedGenreId, selectedArtistId, selectedAlbumId, sortBy, sortOrder, page, limit]);

  useEffect(() => {
    loadSongs();
  }, [loadSongs]);

  // Handlers
  const handleSearchChange = (query: string) => {
    updateUrlParams({ q: query, page: 1 });
  };

  const handleGenreChange = (genreId: string) => {
    updateUrlParams({ genre: genreId, page: 1 });
  };

  const handleArtistChange = (artistId: string) => {
    updateUrlParams({ artist: artistId, page: 1 });
  };

  const handleAlbumChange = (albumId: string) => {
    updateUrlParams({ album: albumId, page: 1 });
  };

  const handleSortByChange = (newSortBy: string) => {
    updateUrlParams({ sort: newSortBy, page: 1 });
  };

  const handleSortOrderToggle = () => {
    updateUrlParams({ order: sortOrder === 'asc' ? 'desc' : 'asc', page: 1 });
  };

  const handlePageChange = (newPage: number) => {
    updateUrlParams({ page: newPage });
  };

  const handleLimitChange = (newLimit: number) => {
    updateUrlParams({ limit: newLimit, page: 1 });
  };

  const handleClearFilters = () => {
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const hasActiveFilters = Boolean(
    searchQuery || selectedGenreId || selectedArtistId || selectedAlbumId || sortBy !== 'playCount' || sortOrder !== 'desc'
  );

  const handlePlaySong = (song: Song) => {
    if (currentPlayingSong?._id === song._id) {
      setCurrentPlayingSong(null);
    } else {
      setCurrentPlayingSong(song);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-100 tracking-tight">Music Library</h1>
          <p className="text-slate-400 text-sm mt-1">
            Browse and discover tracks across artists, albums, and genres with HarmonyAI.
          </p>
        </div>
      </div>

      {/* Reusable Filters Bar */}
      <MusicFilters
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        selectedGenreId={selectedGenreId}
        onGenreChange={handleGenreChange}
        selectedArtistId={selectedArtistId}
        onArtistChange={handleArtistChange}
        selectedAlbumId={selectedAlbumId}
        onAlbumChange={handleAlbumChange}
        sortBy={sortBy}
        onSortByChange={handleSortByChange}
        sortOrder={sortOrder}
        onSortOrderToggle={handleSortOrderToggle}
        genres={genres}
        artists={artists}
        albums={albums}
        onClearFilters={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Main Music Grid Component */}
      <MusicGrid
        songs={songs}
        loading={loading}
        error={error}
        onRetry={loadSongs}
        onPlaySong={handlePlaySong}
        currentSongId={currentPlayingSong?._id}
        emptyMessage={
          hasActiveFilters
            ? 'No songs match your selected filter criteria. Try resetting filters.'
            : 'No songs available in the music library.'
        }
      />

      {/* Reusable Pagination Component */}
      {!loading && !error && pagination && (
        <Pagination
          pagination={pagination}
          onPageChange={handlePageChange}
          limit={limit}
          onLimitChange={handleLimitChange}
        />
      )}

      {/* Audio Player Preview Bar */}
      {currentPlayingSong && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-2xl bg-slate-900/95 border border-indigo-500/40 backdrop-blur-xl rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-4 animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-800 shrink-0">
              <img
                src={currentPlayingSong.coverImage || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100'}
                alt={currentPlayingSong.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-slate-100 truncate">{currentPlayingSong.title}</h4>
              <p className="text-xs text-indigo-400 truncate">
                {typeof currentPlayingSong.artist === 'object' && 'name' in currentPlayingSong.artist
                  ? currentPlayingSong.artist.name
                  : String(currentPlayingSong.artist)}
              </p>
            </div>
          </div>

          <audio
            src={currentPlayingSong.audioUrl}
            controls
            autoPlay
            className="h-9 max-w-xs accent-indigo-500"
          />

          <button
            onClick={() => setCurrentPlayingSong(null)}
            className="text-slate-400 hover:text-slate-200 p-1 text-sm font-bold"
            aria-label="Close Player"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
