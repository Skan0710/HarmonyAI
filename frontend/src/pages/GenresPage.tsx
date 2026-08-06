import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Genre, Song } from '../types/music';
import { fetchGenres, fetchSongs } from '../services/songService';
import { MusicGrid } from '../components/MusicGrid';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { usePlayerStore } from '../store/usePlayerStore';

export const GenresPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const playSong = usePlayerStore((state) => state.playSong);

  const selectedGenreId = searchParams.get('genre') || '';

  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);

  const [loadingGenres, setLoadingGenres] = useState<boolean>(true);
  const [loadingSongs, setLoadingSongs] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load all available genres
  useEffect(() => {
    const loadGenres = async () => {
      setLoadingGenres(true);
      setError(null);

      const res = await fetchGenres();

      if (res.error) {
        setError(res.error);
      } else if (res.genres) {
        setGenres(res.genres);
      }

      setLoadingGenres(false);
    };

    loadGenres();
  }, []);

  // Fetch songs for selected genre
  const loadGenreSongs = useCallback(async (genreId: string) => {
    setLoadingSongs(true);
    setError(null);

    const res = await fetchSongs({ genreId, limit: 50 });

    if (res.error) {
      setError(res.error);
    } else if (res.songs) {
      setSongs(res.songs);
    }

    setLoadingSongs(false);
  }, []);

  // Sync selected genre state with URL parameter
  useEffect(() => {
    if (selectedGenreId && genres.length > 0) {
      const found = genres.find((g) => g._id === selectedGenreId || g.slug === selectedGenreId);
      if (found) {
        setSelectedGenre(found);
        loadGenreSongs(found._id);
      } else {
        setSelectedGenre(null);
        setSongs([]);
      }
    } else {
      setSelectedGenre(null);
      setSongs([]);
    }
  }, [selectedGenreId, genres, loadGenreSongs]);

  const handleSelectGenre = (genre: Genre) => {
    setSearchParams({ genre: genre._id });
  };

  const handleClearGenre = () => {
    setSearchParams({});
  };

  const handlePlaySong = (song: Song) => {
    playSong(song, songs);
  };

  const genreGradients = [
    'from-indigo-600 to-purple-600',
    'from-rose-600 to-amber-600',
    'from-emerald-600 to-teal-600',
    'from-cyan-600 to-blue-600',
    'from-fuchsia-600 to-pink-600',
    'from-violet-600 to-indigo-800',
    'from-orange-600 to-red-600',
    'from-lime-600 to-emerald-800',
  ];

  return (
    <div className="space-y-8 pb-16">
      {/* Breadcrumbs Navigation */}
      <Breadcrumbs
        items={
          selectedGenre
            ? [{ label: 'Genres', path: '/genres' }, { label: selectedGenre.name }]
            : [{ label: 'Genres' }]
        }
      />

      {/* Page Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight flex items-center gap-3">
            <span className="p-2 bg-indigo-600/20 text-indigo-400 rounded-2xl border border-indigo-500/30 text-2xl">
              🎨
            </span>
            <span>{selectedGenre ? selectedGenre.name : 'Browse Genres'}</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {selectedGenre
              ? selectedGenre.description || `Explore top tracks in the ${selectedGenre.name} category.`
              : 'Explore diverse music categories, acoustic vectors, and curated genre collections.'}
          </p>
        </div>

        {selectedGenre && (
          <button
            onClick={handleClearGenre}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-2 self-start sm:self-center"
          >
            ← View All Genres
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-6 bg-slate-800/60 border border-rose-500/30 rounded-2xl text-center max-w-lg mx-auto">
          <p className="text-rose-400 font-medium text-sm">{error}</p>
        </div>
      )}

      {/* 1. All Genres Grid (Displayed when no genre selected) */}
      {!selectedGenre && (
        <section className="space-y-4">
          {loadingGenres ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-36 bg-slate-800/60 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {genres.map((genre, idx) => {
                const gradient = genreGradients[idx % genreGradients.length];

                return (
                  <div
                    key={genre._id}
                    onClick={() => handleSelectGenre(genre)}
                    className={`group relative cursor-pointer overflow-hidden rounded-2xl p-5 bg-gradient-to-br ${gradient} border border-white/10 shadow-xl transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-indigo-500/20 flex flex-col justify-between min-h-[140px]`}
                  >
                    {/* Background Pattern graphic */}
                    <div className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-white/10 backdrop-blur-xs group-hover:scale-125 transition-transform duration-500 pointer-events-none" />

                    {/* Top Stats Badge */}
                    <div className="flex items-center justify-between z-10">
                      <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-black/30 backdrop-blur-md text-white rounded-full border border-white/20">
                        {genre.songCount !== undefined ? `${genre.songCount} ${genre.songCount === 1 ? 'Song' : 'Songs'}` : 'Genre'}
                      </span>

                      <div className="w-8 h-8 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white text-xs font-bold">→</span>
                      </div>
                    </div>

                    {/* Genre Title */}
                    <div className="z-10 mt-4">
                      <h3 className="font-extrabold text-white text-lg leading-tight group-hover:scale-105 transition-transform origin-left">
                        {genre.name}
                      </h3>
                      {genre.description && (
                        <p className="text-xs text-white/80 line-clamp-1 mt-0.5">{genre.description}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* 2. Selected Genre Songs Listing (Displayed when a genre is clicked) */}
      {selectedGenre && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <span>Tracks in {selectedGenre.name}</span>
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {songs.length} {songs.length === 1 ? 'song' : 'songs'}
              </span>
            </h2>
          </div>

          {/* Uses reusable MusicGrid and SongCard components */}
          <MusicGrid
            songs={songs}
            loading={loadingSongs}
            onPlaySong={handlePlaySong}
            emptyMessage={`No songs found in the ${selectedGenre.name} category.`}
          />
        </section>
      )}
    </div>
  );
};
