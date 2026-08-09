import React, { useEffect, useState, useRef } from 'react';
import type { Artist, Genre } from '../types/music';
import { usePreferenceStore } from '../store/usePreferenceStore';
import { fetchArtists, fetchGenres } from '../services/songService';
import { Breadcrumbs } from '../components/Breadcrumbs';

export const PreferencesPage: React.FC = () => {
  const {
    favoriteArtists,
    favoriteGenres,
    loading,
    error,
    fetchPreferences,
    addArtist,
    removeArtist,
    addGenre,
    removeGenre,
    isFavoriteArtist,
    isFavoriteGenre,
  } = usePreferenceStore();

  // Search state for artists
  const [artistSearch, setArtistSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Artist[]>([]);
  const [searching, setSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Available system genres
  const [allGenres, setAllGenres] = useState<Genre[]>([]);
  const [loadingGenres, setLoadingGenres] = useState(false);

  const searchRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchPreferences();

    const loadAllGenres = async () => {
      setLoadingGenres(true);
      const res = await fetchGenres();
      if (res.genres) {
        setAllGenres(res.genres);
      }
      setLoadingGenres(false);
    };

    loadAllGenres();
  }, [fetchPreferences]);

  // Debounced artist search
  useEffect(() => {
    const trimmed = artistSearch.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const handler = setTimeout(async () => {
      const res = await fetchArtists();
      if (res.artists) {
        const filtered = res.artists.filter((a) =>
          a.name.toLowerCase().includes(trimmed.toLowerCase())
        );
        setSearchResults(filtered);
      }
      setSearching(false);
    }, 300);

    return () => clearTimeout(handler);
  }, [artistSearch]);

  // Dismiss artist search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectArtist = async (artist: Artist) => {
    await addArtist(artist);
    setArtistSearch('');
    setIsDropdownOpen(false);
  };

  const handleToggleGenre = async (genre: Genre) => {
    if (isFavoriteGenre(genre._id)) {
      await removeGenre(genre._id);
    } else {
      await addGenre(genre);
    }
  };

  const fallbackAvatar =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23818cf8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="background:%231e293b;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';

  return (
    <div className="space-y-8 pb-16">
      {/* Breadcrumbs Navigation */}
      <Breadcrumbs items={[{ label: 'Music Preferences' }]} />

      {/* Header Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 border border-indigo-500/20 p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-end gap-6">
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-800 flex items-center justify-center shadow-xl shadow-indigo-600/30 shrink-0 border border-indigo-400/30">
            <span className="text-4xl sm:text-5xl">⚡</span>
          </div>

          <div className="flex-1 text-center sm:text-left space-y-2">
            <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wider rounded-full border border-indigo-500/30">
              Personalization
            </span>
            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">Music Preferences</h1>
            <p className="text-slate-300 text-sm sm:text-base max-w-2xl">
              Curate your favorite performers and acoustic genres to personalize your AI music discovery experience.
            </p>
          </div>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-6 animate-pulse">
          <div className="h-40 bg-slate-800/60 rounded-3xl" />
          <div className="h-40 bg-slate-800/60 rounded-3xl" />
        </div>
      )}

      {/* Error Retry Banner */}
      {error && !loading && (
        <div className="p-6 bg-slate-800/60 border border-rose-500/30 rounded-2xl text-center max-w-lg mx-auto space-y-3">
          <p className="text-rose-400 font-medium text-sm">{error}</p>
          <button
            onClick={fetchPreferences}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md"
          >
            Retry Loading Preferences
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-10">
          {/* SECTION 1: Favorite Artists */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <span>🎤</span>
                  <span>Favorite Artists</span>
                  <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {favoriteArtists.length}
                  </span>
                </h2>
                <p className="text-slate-400 text-xs mt-1">
                  Search and add performers to your top creator list.
                </p>
              </div>

              {/* Artist Search Bar */}
              <div ref={searchRef} className="relative w-full sm:w-72">
                <input
                  type="text"
                  value={artistSearch}
                  onChange={(e) => setArtistSearch(e.target.value)}
                  onFocus={() => setIsDropdownOpen(true)}
                  placeholder="Search artist to add..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
                <svg className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>

                {/* Artist Search Results Dropdown */}
                {isDropdownOpen && artistSearch.trim() && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2 max-h-56 overflow-y-auto space-y-1">
                    {searching ? (
                      <div className="p-3 text-center text-xs text-indigo-400">Searching...</div>
                    ) : searchResults.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-400">No artists found</div>
                    ) : (
                      searchResults.map((artist) => {
                        const isFav = isFavoriteArtist(artist._id);
                        return (
                          <div
                            key={artist._id}
                            onClick={() => handleSelectArtist(artist)}
                            className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-800 cursor-pointer text-xs transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img
                                src={artist.profileImage || artist.avatar || fallbackAvatar}
                                alt={artist.name}
                                className="w-7 h-7 rounded-full object-cover shrink-0 border border-slate-700"
                              />
                              <span className="text-slate-200 truncate font-semibold">{artist.name}</span>
                            </div>

                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isFav ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/20 text-indigo-300'}`}>
                              {isFav ? 'Added ✓' : '+ Add'}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Favorite Artists Display Grid */}
            {favoriteArtists.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 max-w-sm mx-auto space-y-2">
                <div className="w-12 h-12 rounded-full bg-slate-800 text-indigo-400 flex items-center justify-center mx-auto">
                  🎤
                </div>
                <p className="font-medium text-slate-300">No Favorite Artists Selected</p>
                <p className="text-[11px] text-slate-500">
                  Use the search bar above to select your favorite music creators.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {favoriteArtists.map((artist) => (
                  <div
                    key={artist._id}
                    className="group relative bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-2xl p-4 flex flex-col items-center text-center space-y-3 transition-all duration-200"
                  >
                    <div className="relative w-16 h-16 rounded-full overflow-hidden bg-slate-900 border border-slate-700 shadow-md">
                      <img
                        src={artist.profileImage || artist.avatar || fallbackAvatar}
                        alt={artist.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="min-w-0 w-full">
                      <p className="text-xs font-bold text-slate-100 truncate group-hover:text-indigo-300">
                        {artist.name}
                      </p>
                    </div>

                    {/* Remove Action Button */}
                    <button
                      onClick={() => removeArtist(artist._id)}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-900 hover:bg-rose-600 text-slate-400 hover:text-white border border-slate-700 flex items-center justify-center text-xs font-bold transition-colors shadow-md"
                      title="Remove from Favorites"
                      aria-label="Remove from Favorites"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* SECTION 2: Favorite Genres */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <span>🎨</span>
                <span>Favorite Genres</span>
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {favoriteGenres.length}
                </span>
              </h2>
              <p className="text-slate-400 text-xs mt-1">
                Select your preferred musical styles to enhance recommendations.
              </p>
            </div>

            {/* Selected Favorite Genres Pills */}
            {favoriteGenres.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Your Selected Genres
                </span>
                <div className="flex flex-wrap gap-2.5">
                  {favoriteGenres.map((genre) => (
                    <div
                      key={genre._id}
                      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-600 text-white border border-indigo-400/40 text-xs font-bold shadow-md animate-in fade-in"
                    >
                      <span>{genre.name}</span>
                      <button
                        onClick={() => removeGenre(genre._id)}
                        className="hover:text-rose-200 text-indigo-200 transition-colors ml-0.5 font-bold"
                        title="Remove genre"
                        aria-label="Remove genre"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Available System Genres Selectable List */}
            <div className="space-y-3 pt-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                All Available Genres (Click to Add / Remove)
              </span>

              {loadingGenres ? (
                <div className="flex gap-2 animate-pulse">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-8 w-24 bg-slate-800 rounded-full" />
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2.5">
                  {allGenres.map((genre) => {
                    const selected = isFavoriteGenre(genre._id);
                    return (
                      <button
                        key={genre._id}
                        onClick={() => handleToggleGenre(genre)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 ${
                          selected
                            ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200 font-bold'
                            : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 text-slate-300 hover:text-white'
                        }`}
                      >
                        {selected ? '✓ ' : '+ '}
                        {genre.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
