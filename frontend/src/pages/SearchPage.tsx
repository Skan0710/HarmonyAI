import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { searchGlobal } from '../services/searchService';
import type { GroupedSearchResults } from '../services/searchService';
import { MusicGrid } from '../components/MusicGrid';
import { ArtistCard } from '../components/ArtistCard';
import { AlbumCard } from '../components/AlbumCard';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { SearchSuggestionsDropdown } from '../components/SearchSuggestionsDropdown';
import { usePlayerStore } from '../store/usePlayerStore';
import { useRecentSearchesStore } from '../store/useRecentSearchesStore';

export const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const playSong = usePlayerStore((state) => state.playSong);
  const addSearch = useRecentSearchesStore((state) => state.addSearch);

  const initialQuery = searchParams.get('q') || '';
  const [queryInput, setQueryInput] = useState<string>(initialQuery);
  const [results, setResults] = useState<GroupedSearchResults | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Sync internal state if URL param changes
  useEffect(() => {
    setQueryInput(searchParams.get('q') || '');
  }, [searchParams]);

  const executeSearch = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setResults({ songs: [], artists: [], albums: [], total: 0 });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { results: data, error: err } = await searchGlobal(trimmed, 12);

    if (err) {
      setError(err);
      setResults(null);
    } else {
      setResults(data);
      if (trimmed.length >= 2) {
        addSearch(trimmed);
      }
    }

    setLoading(false);
  }, [addSearch]);

  // Debounced search trigger when typing
  useEffect(() => {
    const handler = setTimeout(() => {
      const currentQuery = searchParams.get('q') || '';
      if (queryInput !== currentQuery) {
        if (queryInput.trim()) {
          setSearchParams({ q: queryInput }, { replace: true });
        } else {
          setSearchParams({}, { replace: true });
        }
      }
      executeSearch(queryInput);
    }, 350);

    return () => clearTimeout(handler);
  }, [queryInput, searchParams, setSearchParams, executeSearch]);

  // Click outside listener to hide dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClear = () => {
    setQueryInput('');
    setSearchParams({}, { replace: true });
    setResults({ songs: [], artists: [], albums: [], total: 0 });
  };

  const handleSelectRecent = (term: string) => {
    setQueryInput(term);
    setSearchParams({ q: term }, { replace: true });
    executeSearch(term);
  };

  const handleSongPlay = (song: any) => {
    if (results?.songs) {
      playSong(song, results.songs);
    } else {
      playSong(song);
    }
  };

  const hasQuery = Boolean(queryInput.trim());
  const hasResults = results && results.total > 0;

  return (
    <div className="space-y-8 pb-16">
      {/* Breadcrumbs Navigation */}
      <Breadcrumbs items={[{ label: 'Search' }]} />

      {/* Header & Search Bar with Suggestions */}
      <div ref={containerRef} className="max-w-3xl space-y-4 relative">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-100 tracking-tight">Explore & Search</h1>
          <p className="text-slate-400 text-sm mt-1">
            Search across songs, artists, and albums in the HarmonyAI library.
          </p>
        </div>

        {/* Search Input Bar */}
        <div className="relative flex items-center">
          <div className="absolute left-4 text-indigo-400 pointer-events-none">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <input
            type="text"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            onFocus={() => setIsFocused(true)}
            placeholder="Search by song title, artist name, or album..."
            className="w-full pl-12 pr-10 py-3.5 bg-slate-900/90 border border-slate-700/80 focus:border-indigo-500 rounded-2xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm sm:text-base shadow-xl transition-all"
            autoFocus
          />

          {queryInput && (
            <button
              onClick={handleClear}
              className="absolute right-3.5 p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="Clear Search"
            >
              ✕
            </button>
          )}

          {/* Live Search Suggestions & Recent Searches Dropdown */}
          {isFocused && (
            <SearchSuggestionsDropdown
              query={queryInput}
              suggestions={results}
              loading={loading}
              onSelectSearch={handleSelectRecent}
              onClose={() => setIsFocused(false)}
            />
          )}
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && !results && (
        <div className="space-y-8 animate-pulse">
          <div className="space-y-3">
            <div className="h-6 bg-slate-800 rounded w-48" />
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-44 bg-slate-800/60 rounded-xl" />
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div className="h-6 bg-slate-800 rounded w-48" />
            <div className="flex gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="w-40 h-48 bg-slate-800/60 rounded-2xl" />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && !loading && (
        <div className="p-6 bg-slate-800/60 border border-rose-500/30 rounded-2xl text-center max-w-lg mx-auto">
          <p className="text-rose-400 font-medium text-sm">{error}</p>
        </div>
      )}

      {/* Empty Search Prompt (No query typed) */}
      {!hasQuery && !loading && (
        <div className="py-16 text-center max-w-md mx-auto space-y-4">
          <div className="w-20 h-20 rounded-full bg-slate-800/80 border border-slate-700/60 text-indigo-400 flex items-center justify-center mx-auto shadow-lg">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-slate-200">Start Searching</h3>
          <p className="text-slate-400 text-sm">
            Type anything above to search songs, artists, and albums instantly.
          </p>
        </div>
      )}

      {/* No Results Found */}
      {hasQuery && !hasResults && !loading && !error && (
        <div className="py-16 text-center max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-500 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-200">No matches found for "{queryInput}"</h3>
          <p className="text-slate-400 text-xs">
            Check spelling or try searching for another song, artist, or album title.
          </p>
        </div>
      )}

      {/* Grouped Results Display */}
      {hasQuery && hasResults && results && (
        <div className="space-y-10">
          {/* 1. Grouped Songs */}
          {results.songs.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <span className="text-indigo-400">🎵</span> Songs ({results.songs.length})
                </h2>
              </div>
              <MusicGrid
                songs={results.songs}
                onPlaySong={handleSongPlay}
              />
            </section>
          )}

          {/* 2. Grouped Artists */}
          {results.artists.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <span className="text-indigo-400">🎤</span> Artists ({results.artists.length})
                </h2>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-700">
                {results.artists.map((artist) => (
                  <ArtistCard key={artist._id} artist={artist} />
                ))}
              </div>
            </section>
          )}

          {/* 3. Grouped Albums */}
          {results.albums.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <span className="text-indigo-400">💿</span> Albums ({results.albums.length})
                </h2>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-700">
                {results.albums.map((album) => (
                  <AlbumCard key={album._id} album={album} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};
