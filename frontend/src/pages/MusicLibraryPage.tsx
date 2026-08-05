import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Song, Genre, Artist, Album, PaginationData } from '../types/music';
import { fetchSongs, fetchGenres, fetchArtists, fetchAlbums } from '../services/songService';
import { MusicFilters } from '../components/MusicFilters';
import { MusicGrid } from '../components/MusicGrid';
import { Pagination } from '../components/Pagination';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { usePlayerStore } from '../store/usePlayerStore';

export const MusicLibraryPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const playSong = usePlayerStore((state) => state.playSong);

  const [genres, setGenres] = useState<Genre[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);

  const [songs, setSongs] = useState<Song[]>([]);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const searchQuery = searchParams.get('q') || '';
  const selectedGenreId = searchParams.get('genre') || '';
  const selectedArtistId = searchParams.get('artist') || '';
  const selectedAlbumId = searchParams.get('album') || '';
  const sortBy = searchParams.get('sort') || 'playCount';
  const sortOrder = (searchParams.get('order') as 'asc' | 'desc') || 'desc';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '15', 10);

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
    playSong(song, songs);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Breadcrumbs Navigation */}
      <Breadcrumbs items={[{ label: 'Music Library' }]} />

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
    </div>
  );
};
