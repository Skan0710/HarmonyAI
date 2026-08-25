import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  searchUnifiedDiscovery,
  getSearchSuggestions,
} from '../services/searchService';
import type {
  UnifiedDiscoveryResponse,
  NormalizedSongItem,
  NormalizedArtistItem,
  NormalizedAlbumItem,
  SearchSuggestionItem,
} from '../services/searchService';
import type { Song, Artist, Album } from '../types/music';
import { MusicGrid } from '../components/MusicGrid';
import { ArtistCard } from '../components/ArtistCard';
import { AlbumCard } from '../components/AlbumCard';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { SearchSkeletonLoader } from '../components/SearchSkeletonLoader';
import { TrendingSearches } from '../components/TrendingSearches';
import { usePlayerStore } from '../store/usePlayerStore';
import { useRecentSearchesStore } from '../store/useRecentSearchesStore';

type DiscoveryMode = 'all' | 'keyword' | 'semantic' | 'recommendations' | 'hybrid';

const VIBE_QUICK_SEARCHES = [
  { label: 'Synthwave Night Drive', icon: '🌆' },
  { label: 'Lo-Fi Chill Study', icon: '☕' },
  { label: 'Late Night R&B', icon: '🌙' },
  { label: 'High Energy Workout', icon: '⚡' },
  { label: 'Acoustic Morning Coffee', icon: '☀️' },
  { label: 'Deep Focus Ambient', icon: '🧘' },
];

export const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const playSong = usePlayerStore((state) => state.playSong);
  const addSearch = useRecentSearchesStore((state) => state.addSearch);

  const initialQuery = searchParams.get('q') || '';
  const initialMode = (searchParams.get('mode') as DiscoveryMode) || 'all';

  const [queryInput, setQueryInput] = useState<string>(initialQuery);
  const [activeMode, setActiveMode] = useState<DiscoveryMode>(initialMode);
  const [discoveryData, setDiscoveryData] = useState<UnifiedDiscoveryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [liveSuggestions, setLiveSuggestions] = useState<SearchSuggestionItem[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Sync state if URL search parameters change
  useEffect(() => {
    const q = searchParams.get('q') || '';
    const mode = (searchParams.get('mode') as DiscoveryMode) || 'all';
    setQueryInput(q);
    setActiveMode(mode);
  }, [searchParams]);

  // Execute unified discovery request
  const executeDiscovery = useCallback(
    async (searchQuery: string, searchMode: DiscoveryMode) => {
      setLoading(true);
      setError(null);

      const trimmed = searchQuery.trim();

      const { discovery, error: err } = await searchUnifiedDiscovery({
        query: trimmed,
        mode: searchMode,
        limit: 12,
      });

      if (err) {
        setError(err);
        setDiscoveryData(null);
      } else {
        setDiscoveryData(discovery);
        if (trimmed.length >= 2) {
          addSearch(trimmed);
        }
      }

      setLoading(false);
    },
    [addSearch]
  );

  // Debounced search trigger for main discovery results
  useEffect(() => {
    const handler = setTimeout(() => {
      const currentQuery = searchParams.get('q') || '';
      const currentMode = (searchParams.get('mode') as DiscoveryMode) || 'all';

      if (queryInput !== currentQuery || activeMode !== currentMode) {
        const params: Record<string, string> = {};
        if (queryInput.trim()) params.q = queryInput.trim();
        if (activeMode !== 'all') params.mode = activeMode;
        setSearchParams(params, { replace: true });
      }

      executeDiscovery(queryInput, activeMode);
    }, 350);

    return () => clearTimeout(handler);
  }, [queryInput, activeMode, searchParams, setSearchParams, executeDiscovery]);

  // Fetch lightweight autocomplete suggestions while typing
  useEffect(() => {
    const trimmed = queryInput.trim();
    if (!trimmed || !isFocused) {
      setLiveSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }

    setSuggestionsLoading(true);
    const suggestionHandler = setTimeout(async () => {
      const { suggestions } = await getSearchSuggestions(trimmed, 6);
      setLiveSuggestions(suggestions);
      setSuggestionsLoading(false);
    }, 200);

    return () => clearTimeout(suggestionHandler);
  }, [queryInput, isFocused]);

  // Dismiss dropdown on outside click
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
    setSearchParams(activeMode !== 'all' ? { mode: activeMode } : {}, { replace: true });
    setLiveSuggestions([]);
    executeDiscovery('', activeMode);
  };

  const handleSelectSearchTerm = (term: string) => {
    setQueryInput(term);
    setIsFocused(false);
    const params: Record<string, string> = { q: term };
    if (activeMode !== 'all') params.mode = activeMode;
    setSearchParams(params, { replace: true });
    executeDiscovery(term, activeMode);
  };

  const handleSuggestionClick = (item: SearchSuggestionItem) => {
    setIsFocused(false);
    if (item.type === 'artist') {
      navigate(`/artists/${item.id}`);
    } else if (item.type === 'album') {
      navigate(`/albums/${item.id}`);
    } else if (item.type === 'song') {
      navigate(`/songs/${item.id}`);
    } else {
      handleSelectSearchTerm(item.title);
    }
  };

  // Convert Normalized items to standard model DTOs for reusable components
  const mapToSong = (item: NormalizedSongItem): Song =>
    ({
      _id: item.id,
      title: item.title,
      duration: item.duration,
      audioUrl: item.audioUrl || '',
      coverImage: item.coverImage,
      artist: item.artist
        ? ({
            _id: item.artist.id,
            name: item.artist.name,
            profileImage: item.artist.profileImage,
            verified: item.artist.verified,
          } as any)
        : undefined,
      album: item.album
        ? ({
            _id: item.album.id,
            title: item.album.title,
            coverImage: item.album.coverImage,
            releaseYear: item.album.releaseYear,
          } as any)
        : undefined,
      genre: item.genre
        ? ({
            _id: item.genre.id,
            name: item.genre.name,
            slug: item.genre.slug,
          } as any)
        : undefined,
      recommendationScore: item.score,
      matchReason: item.matchReason,
      sources: item.sources,
    } as any);

  const mapToArtist = (item: NormalizedArtistItem): Artist =>
    ({
      _id: item.id,
      name: item.name,
      bio: item.bio,
      profileImage: item.profileImage,
      avatar: item.avatar,
      verified: item.verified,
      genres: item.genres,
      monthlyListeners: item.monthlyListeners,
    } as any);

  const mapToAlbum = (item: NormalizedAlbumItem): Album =>
    ({
      _id: item.id,
      title: item.title,
      artist: item.artist ? ({ _id: item.artist.id, name: item.artist.name } as any) : undefined,
      genre: item.genre ? ({ _id: item.genre.id, name: item.genre.name } as any) : undefined,
      coverImage: item.coverImage,
      releaseYear: item.releaseYear,
      trackCount: item.trackCount,
    } as any);

  const songsList = (discoveryData?.results.songs || []).map(mapToSong);
  const recommendedList = (discoveryData?.results.recommendedSongs || []).map(mapToSong);
  const artistsList = (discoveryData?.results.artists || []).map(mapToArtist);
  const similarArtistsList = (discoveryData?.results.similarArtists || []).map(mapToArtist);
  const albumsList = (discoveryData?.results.albums || []).map(mapToAlbum);

  const handleSongPlay = (song: Song) => {
    const queue = songsList.length > 0 ? songsList : recommendedList;
    playSong(song, queue);
  };

  const hasQuery = Boolean(queryInput.trim());
  const hasAnyResults =
    (discoveryData?.counts.total || 0) > 0 ||
    songsList.length > 0 ||
    artistsList.length > 0 ||
    similarArtistsList.length > 0 ||
    albumsList.length > 0 ||
    recommendedList.length > 0;

  return (
    <div className="space-y-8 pb-16">
      {/* Breadcrumbs */}
      <Breadcrumbs items={[{ label: 'Discovery' }]} />

      {/* Header & Unified Search Box */}
      <div ref={containerRef} className="max-w-4xl space-y-4 relative">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-xs font-semibold mb-2">
              <span>✨ Unified Discovery Hub</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
              Music Discovery
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Search across songs, artists, albums, and AI-personalized recommendations in real-time.
            </p>
          </div>

          {/* Discovery Mode Selector Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 shrink-0 shadow-inner">
            {(
              [
                { id: 'all', label: 'All', icon: '🌐' },
                { id: 'keyword', label: 'Keyword', icon: '🔍' },
                { id: 'semantic', label: 'Semantic Vibe', icon: '🧠' },
                { id: 'recommendations', label: 'For You', icon: '✨' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveMode(tab.id);
                  const params: Record<string, string> = {};
                  if (queryInput.trim()) params.q = queryInput.trim();
                  if (tab.id !== 'all') params.mode = tab.id;
                  setSearchParams(params, { replace: true });
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeMode === tab.id
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Search Input with Live Autocomplete */}
        <div className="relative flex items-center">
          <div className="absolute left-4 text-indigo-400 pointer-events-none">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          <input
            type="text"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            onFocus={() => setIsFocused(true)}
            placeholder="Search songs, artists, albums, or describe a musical vibe..."
            className="w-full pl-12 pr-12 py-4 bg-slate-900/95 border border-slate-700/80 focus:border-indigo-500 rounded-2xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm sm:text-base shadow-2xl transition-all"
            autoFocus
          />

          {queryInput && (
            <button
              onClick={handleClear}
              className="absolute right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Clear Search"
            >
              ✕
            </button>
          )}

          {/* Autocomplete Suggestions Dropdown */}
          {isFocused && queryInput.trim() && liveSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-xl p-2.5 space-y-1 animate-in fade-in zoom-in-95 duration-150">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-1 flex items-center justify-between">
                <span>Suggestions</span>
                {suggestionsLoading && (
                  <div className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin" />
                )}
              </div>

              {liveSuggestions.map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  onClick={() => handleSuggestionClick(item)}
                  className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-800/90 cursor-pointer text-xs transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-slate-400 group-hover:text-indigo-400 text-sm shrink-0">
                      {item.type === 'artist' ? '🎤' : item.type === 'album' ? '💿' : '🎵'}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-200 group-hover:text-white truncate">
                        {item.title}
                      </p>
                      {item.subtitle && (
                        <p className="text-[11px] text-slate-400 truncate">{item.subtitle}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 group-hover:text-indigo-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60 uppercase">
                    {item.type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Vibe Discovery Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs text-slate-500 font-medium shrink-0">Quick Vibes:</span>
          {VIBE_QUICK_SEARCHES.map((vibe) => (
            <button
              key={vibe.label}
              onClick={() => handleSelectSearchTerm(vibe.label)}
              className="px-3 py-1 bg-slate-800/70 hover:bg-indigo-600/20 text-slate-300 hover:text-indigo-200 border border-slate-700/60 hover:border-indigo-500/40 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <span>{vibe.icon}</span>
              <span>{vibe.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 1. Loading Skeleton */}
      {loading && !discoveryData && <SearchSkeletonLoader />}

      {/* 2. Error State */}
      {error && !loading && (
        <div className="p-6 bg-slate-900 border border-rose-500/40 rounded-2xl text-center max-w-lg mx-auto space-y-3 shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto text-xl font-bold">
            !
          </div>
          <h3 className="text-base font-bold text-rose-300">Discovery Error</h3>
          <p className="text-rose-400/90 text-xs">{error}</p>
          <button
            onClick={() => executeDiscovery(queryInput, activeMode)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Retry Search
          </button>
        </div>
      )}

      {/* 3. Empty Results State */}
      {hasQuery && !hasAnyResults && !loading && !error && (
        <div className="py-16 text-center max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 text-slate-500 flex items-center justify-center mx-auto shadow-inner text-2xl">
            🔍
          </div>
          <h3 className="text-lg font-bold text-slate-200">No matches found for "{queryInput}"</h3>
          <p className="text-slate-400 text-xs leading-relaxed">
            We couldn't find any songs, artists, or albums matching your query. Try a different keyword, genre, or mood description!
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {VIBE_QUICK_SEARCHES.slice(0, 3).map((vibe) => (
              <button
                key={vibe.label}
                onClick={() => handleSelectSearchTerm(vibe.label)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
              >
                {vibe.icon} {vibe.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 4. Initial Screen (When no search query is active) */}
      {!hasQuery && !loading && (
        <div className="space-y-12">
          {/* Trending Searches */}
          <TrendingSearches onSelectTrending={handleSelectSearchTerm} />

          {/* Recommended for You in Cold-Start / Initial View */}
          {recommendedList.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">✨</span>
                  <div>
                    <h2 className="text-xl font-bold text-slate-100">Recommended for You</h2>
                    <p className="text-xs text-slate-400">Handcrafted recommendations tailored to your taste</p>
                  </div>
                </div>
              </div>
              <MusicGrid songs={recommendedList} onPlaySong={handleSongPlay} />
            </section>
          )}
        </div>
      )}

      {/* 5. Grouped Unified Discovery Results */}
      {hasQuery && hasAnyResults && (
        <div className="space-y-12">
          {/* Section A: Artists */}
          {artistsList.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl text-purple-400">🎤</span>
                  <div>
                    <h2 className="text-xl font-bold text-slate-100">Artists</h2>
                    <p className="text-xs text-slate-400">
                      {artistsList.length} {artistsList.length === 1 ? 'artist' : 'artists'} matching your discovery query
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-700">
                {artistsList.map((artist) => (
                  <ArtistCard key={artist._id} artist={artist} />
                ))}
              </div>
            </section>
          )}

          {/* Section A.2: Similar & Related Artists */}
          {similarArtistsList.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl text-indigo-400">✨</span>
                  <div>
                    <h2 className="text-xl font-bold text-slate-100">Similar Artists You Might Like</h2>
                    <p className="text-xs text-slate-400">
                      Discovered based on genre alignment and your taste profile
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-700">
                {similarArtistsList.map((artist) => (
                  <ArtistCard key={artist._id} artist={artist} />
                ))}
              </div>
            </section>
          )}

          {/* Section B: Albums */}
          {albumsList.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl text-emerald-400">💿</span>
                  <div>
                    <h2 className="text-xl font-bold text-slate-100">Albums</h2>
                    <p className="text-xs text-slate-400">
                      {albumsList.length} {albumsList.length === 1 ? 'album' : 'albums'} found
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-700">
                {albumsList.map((album) => (
                  <AlbumCard key={album._id} album={album} />
                ))}
              </div>
            </section>
          )}

          {/* Section C: Matching Songs */}
          {songsList.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl text-indigo-400">🎵</span>
                  <div>
                    <h2 className="text-xl font-bold text-slate-100">Songs</h2>
                    <p className="text-xs text-slate-400">
                      {songsList.length} {songsList.length === 1 ? 'song' : 'songs'} matched across title, artist, and acoustic features
                    </p>
                  </div>
                </div>
              </div>
              <MusicGrid songs={songsList} onPlaySong={handleSongPlay} />
            </section>
          )}

          {/* Section D: Recommended for You (AI & Contextual Similarity) */}
          {recommendedList.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl text-amber-400">✨</span>
                  <div>
                    <h2 className="text-xl font-bold text-slate-100">Recommended for You</h2>
                    <p className="text-xs text-slate-400">
                      Intelligent recommendations based on your query context and taste profile
                    </p>
                  </div>
                </div>
              </div>
              <MusicGrid songs={recommendedList} onPlaySong={handleSongPlay} />
            </section>
          )}
        </div>
      )}
    </div>
  );
};
