import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { searchGlobal, searchSemanticApi } from '../services/searchService';
import type { GroupedSearchResults } from '../services/searchService';
import type { Song } from '../types/music';
import { MusicGrid } from '../components/MusicGrid';
import { ArtistCard } from '../components/ArtistCard';
import { AlbumCard } from '../components/AlbumCard';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { SearchSuggestionsDropdown } from '../components/SearchSuggestionsDropdown';
import { TrendingSearches } from '../components/TrendingSearches';
import { SearchSkeletonLoader } from '../components/SearchSkeletonLoader';
import { usePlayerStore } from '../store/usePlayerStore';
import { useRecentSearchesStore } from '../store/useRecentSearchesStore';

export type SearchModeType = 'keyword' | 'semantic';

export const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const playSong = usePlayerStore((state) => state.playSong);
  const addSearch = useRecentSearchesStore((state) => state.addSearch);

  const initialQuery = searchParams.get('q') || '';
  const initialMode = (searchParams.get('mode') as SearchModeType) || 'keyword';

  const [searchMode, setSearchMode] = useState<SearchModeType>(initialMode);
  const [queryInput, setQueryInput] = useState<string>(initialQuery);
  const [keywordResults, setKeywordResults] = useState<GroupedSearchResults | null>(null);
  const [semanticSongs, setSemanticSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Sync internal state if URL param changes
  useEffect(() => {
    setQueryInput(searchParams.get('q') || '');
    const mode = searchParams.get('mode') as SearchModeType;
    if (mode && (mode === 'keyword' || mode === 'semantic')) {
      setSearchMode(mode);
    }
  }, [searchParams]);

  const executeSearch = useCallback(async (searchQuery: string, mode: SearchModeType) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setKeywordResults({ songs: [], artists: [], albums: [], total: 0 });
      setSemanticSongs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    if (mode === 'keyword') {
      const { results: data, error: err } = await searchGlobal(trimmed, 12);
      if (err) {
        setError(err);
        setKeywordResults(null);
      } else {
        setKeywordResults(data);
        if (trimmed.length >= 2) addSearch(trimmed);
      }
    } else {
      // Semantic AI Search Mode
      const { songs, error: err } = await searchSemanticApi(trimmed, 12);
      if (err) {
        setError(err);
        setSemanticSongs([]);
      } else {
        setSemanticSongs(songs);
        if (trimmed.length >= 2) addSearch(trimmed);
      }
    }

    setLoading(false);
  }, [addSearch]);

  // Debounced search trigger when typing or switching modes
  useEffect(() => {
    const handler = setTimeout(() => {
      const currentQuery = searchParams.get('q') || '';
      const currentMode = searchParams.get('mode') || 'keyword';

      if (queryInput !== currentQuery || searchMode !== currentMode) {
        if (queryInput.trim()) {
          setSearchParams({ q: queryInput, mode: searchMode }, { replace: true });
        } else {
          setSearchParams({}, { replace: true });
        }
      }
      executeSearch(queryInput, searchMode);
    }, 350);

    return () => clearTimeout(handler);
  }, [queryInput, searchMode, searchParams, setSearchParams, executeSearch]);

  // Click outside listener to hide suggestions dropdown
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
    setKeywordResults({ songs: [], artists: [], albums: [], total: 0 });
    setSemanticSongs([]);
  };

  const handleSelectSearchTerm = (term: string) => {
    setQueryInput(term);
    setSearchParams({ q: term, mode: searchMode }, { replace: true });
    executeSearch(term, searchMode);
  };

  const handleModeToggle = (newMode: SearchModeType) => {
    setSearchMode(newMode);
    if (queryInput.trim()) {
      setSearchParams({ q: queryInput, mode: newMode }, { replace: true });
      executeSearch(queryInput, newMode);
    }
  };

  const handleSongPlay = (song: any) => {
    const songList = searchMode === 'semantic' ? semanticSongs : keywordResults?.songs;
    if (songList && songList.length > 0) {
      playSong(song, songList);
    } else {
      playSong(song);
    }
  };

  const hasQuery = Boolean(queryInput.trim());
  const hasKeywordResults = keywordResults && keywordResults.total > 0;
  const hasSemanticResults = semanticSongs && semanticSongs.length > 0;
  const hasResults = searchMode === 'semantic' ? hasSemanticResults : hasKeywordResults;

  return (
    <div className="space-y-8 pb-16">
      {/* Breadcrumbs Navigation */}
      <Breadcrumbs items={[{ label: 'Search' }]} />

      {/* Header & Search Controls */}
      <div ref={containerRef} className="max-w-3xl space-y-5 relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-100 tracking-tight">Explore & Search</h1>
            <p className="text-slate-400 text-sm mt-1">
              Search across songs, artists, and albums or use natural language AI search.
            </p>
          </div>

          {/* Search Mode Toggle (Keyword vs Semantic AI) */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 border border-slate-700/80 rounded-2xl shrink-0 self-start sm:self-center shadow-lg backdrop-blur-md">
            <button
              onClick={() => handleModeToggle('keyword')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                searchMode === 'keyword'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>🔍 Keyword</span>
            </button>
            <button
              onClick={() => handleModeToggle('semantic')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                searchMode === 'semantic'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>✨ Semantic AI</span>
            </button>
          </div>
        </div>

        {/* Semantic Search Active Indicator Banner */}
        {searchMode === 'semantic' && (
          <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-medium animate-in fade-in duration-200 shadow-sm">
            <span className="flex items-center gap-2">
              <span className="text-sm">✨</span>
              <span><strong>Semantic AI Search Active:</strong> Enter natural-language descriptions of moods, genres, or audio vibes.</span>
            </span>
          </div>
        )}

        {/* Search Input Bar */}
        <div className="relative flex items-center">
          <div className="absolute left-4 text-indigo-400 pointer-events-none">
            {searchMode === 'semantic' ? (
              <span className="text-base">✨</span>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </div>

          <input
            type="text"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            onFocus={() => setIsFocused(true)}
            placeholder={
              searchMode === 'semantic'
                ? "Try 'upbeat synthwave for night driving' or 'mellow acoustic guitar'..."
                : "Search by song title, artist name, or album..."
            }
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

          {/* Live Search Suggestions Dropdown (Keyword mode) */}
          {isFocused && searchMode === 'keyword' && (
            <SearchSuggestionsDropdown
              query={queryInput}
              suggestions={keywordResults}
              loading={loading}
              onSelectSearch={handleSelectSearchTerm}
              onClose={() => setIsFocused(false)}
            />
          )}
        </div>
      </div>

      {/* 1. Trending Searches Section (Displayed when no query is typed) */}
      {!hasQuery && !loading && (
        <div className="space-y-8">
          <TrendingSearches onSelectTrending={handleSelectSearchTerm} />

          <div className="py-12 text-center max-w-md mx-auto space-y-3">
            <div className="w-16 h-16 rounded-full bg-slate-800/80 border border-slate-700/60 text-indigo-400 flex items-center justify-center mx-auto shadow-lg">
              {searchMode === 'semantic' ? (
                <span className="text-2xl">✨</span>
              ) : (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
            </div>
            <h3 className="text-lg font-bold text-slate-200">
              {searchMode === 'semantic' ? 'Semantic AI Discovery' : 'Start Discovering'}
            </h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              {searchMode === 'semantic'
                ? 'Type natural-language intent queries like "upbeat pop with energetic bass" to find matched tracks.'
                : 'Type anything in the search bar or select a trending topic above to explore.'}
            </p>
          </div>
        </div>
      )}

      {/* 2. Loading Skeleton Loader */}
      {loading && !hasResults && <SearchSkeletonLoader />}

      {/* 3. Error State */}
      {error && !loading && (
        <div className="p-6 bg-slate-800/60 border border-rose-500/30 rounded-2xl text-center max-w-lg mx-auto">
          <p className="text-rose-400 font-medium text-sm">⚠️ {error}</p>
        </div>
      )}

      {/* 4. No Results Found */}
      {hasQuery && !hasResults && !loading && !error && (
        <div className="py-16 text-center max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-500 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-200">No semantic matches found for "{queryInput}"</h3>
          <p className="text-slate-400 text-xs">
            Try switching to Keyword Search mode or refining your description.
          </p>
        </div>
      )}

      {/* 5. Semantic AI Search Results */}
      {hasQuery && searchMode === 'semantic' && hasSemanticResults && (
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <span className="text-indigo-400">✨</span> Semantic Matched Songs ({semanticSongs.length})
            </h2>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Matches your search intent
            </span>
          </div>

          <MusicGrid
            songs={semanticSongs}
            onPlaySong={handleSongPlay}
          />
        </section>
      )}

      {/* 6. Keyword Grouped Results Display */}
      {hasQuery && searchMode === 'keyword' && hasKeywordResults && keywordResults && (
        <div className="space-y-10">
          {/* Songs */}
          {keywordResults.songs.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <span className="text-indigo-400">🎵</span> Songs ({keywordResults.songs.length})
                </h2>
              </div>
              <MusicGrid
                songs={keywordResults.songs}
                onPlaySong={handleSongPlay}
              />
            </section>
          )}

          {/* Artists */}
          {keywordResults.artists.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <span className="text-indigo-400">🎤</span> Artists ({keywordResults.artists.length})
                </h2>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-700">
                {keywordResults.artists.map((artist) => (
                  <ArtistCard key={artist._id} artist={artist} />
                ))}
              </div>
            </section>
          )}

          {/* Albums */}
          {keywordResults.albums.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <span className="text-indigo-400">💿</span> Albums ({keywordResults.albums.length})
                </h2>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-700">
                {keywordResults.albums.map((album) => (
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
