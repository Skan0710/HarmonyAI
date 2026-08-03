import React, { useEffect, useState, useCallback } from 'react';
import type { Song, Genre, PaginationData } from '../types/music';
import { fetchSongs, fetchGenres } from '../services/songService';
import { MusicGrid } from '../components/MusicGrid';

export const MusicLibraryPage: React.FC = () => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedGenreId, setSelectedGenreId] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [page, setPage] = useState<number>(1);
  const [pagination, setPagination] = useState<PaginationData | null>(null);

  const [currentPlayingSong, setCurrentPlayingSong] = useState<Song | null>(null);

  useEffect(() => {
    const loadGenres = async () => {
      const res = await fetchGenres();
      if (!res.error && res.genres) {
        setGenres(res.genres);
      }
    };
    loadGenres();
  }, []);

  const loadSongs = useCallback(async () => {
    setLoading(true);
    setError(null);

    const res = await fetchSongs({
      search: searchQuery || undefined,
      genreId: selectedGenreId || undefined,
      sortBy,
      sortOrder: sortBy === 'title' ? 'asc' : 'desc',
      page,
      limit: 15,
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
  }, [searchQuery, selectedGenreId, sortBy, page]);

  useEffect(() => {
    loadSongs();
  }, [loadSongs]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1);
  };

  const handleGenreSelect = (genreId: string) => {
    setSelectedGenreId(genreId === selectedGenreId ? '' : genreId);
    setPage(1);
  };

  const handlePlaySong = (song: Song) => {
    if (currentPlayingSong?._id === song._id) {
      setCurrentPlayingSong(null);
    } else {
      setCurrentPlayingSong(song);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-100 tracking-tight">Music Library</h1>
          <p className="text-slate-400 text-sm mt-1">
            Explore tracks across genres, artists, and albums powered by HarmonyAI.
          </p>
        </div>

        <div className="relative w-full md:w-80">
          <svg
            className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search songs, artists..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setPage(1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => handleGenreSelect('')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              selectedGenreId === ''
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700/60'
            }`}
          >
            All Genres
          </button>
          {genres.map((g) => (
            <button
              key={g._id}
              onClick={() => handleGenreSelect(g._id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                selectedGenreId === g._id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700/60'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-400 font-medium">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setPage(1);
            }}
            className="bg-slate-800 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="createdAt">Latest Added</option>
            <option value="playCount">Most Popular</option>
            <option value="title">Song Title (A-Z)</option>
            <option value="releaseYear">Release Year</option>
          </select>
        </div>
      </div>

      <MusicGrid
        songs={songs}
        loading={loading}
        error={error}
        onRetry={loadSongs}
        onPlaySong={handlePlaySong}
        currentSongId={currentPlayingSong?._id}
        emptyMessage={
          searchQuery || selectedGenreId
            ? 'No songs match your filter criteria. Try clearing filters.'
            : 'No songs available in the library.'
        }
      />

      {!loading && !error && pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between pt-6 border-t border-slate-800">
          <p className="text-xs text-slate-400">
            Showing Page <span className="font-semibold text-slate-200">{pagination.page}</span> of{' '}
            <span className="font-semibold text-slate-200">{pagination.pages}</span> ({pagination.total} songs)
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 rounded-lg text-xs font-medium transition-colors border border-slate-700/60"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
              disabled={page >= pagination.pages}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 rounded-lg text-xs font-medium transition-colors border border-slate-700/60"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {currentPlayingSong && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-2xl bg-slate-900/90 border border-indigo-500/40 backdrop-blur-xl rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-4 animate-in slide-in-from-bottom duration-300">
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
