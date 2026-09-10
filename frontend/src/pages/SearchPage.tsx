import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search as SearchIcon, X, Mic2, Disc3, Music, Sparkles, AlertTriangle, RefreshCw } from 'lucide-react';
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
import { TrendingSearches } from '../components/TrendingSearches';
import { usePlayerStore } from '../store/usePlayerStore';
import { useRecentSearchesStore } from '../store/useRecentSearchesStore';

type DiscoveryMode = 'all' | 'keyword' | 'semantic' | 'recommendations' | 'hybrid';

const MODE_TABS: { id: DiscoveryMode; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'keyword', label: 'Keyword' },
  { id: 'semantic', label: 'Semantic vibe' },
  { id: 'recommendations', label: 'For you' },
];

const VIBE_QUICK_SEARCHES = [
  'Synthwave night drive',
  'Lo-fi chill study',
  'Late night R&B',
  'High energy workout',
  'Acoustic morning coffee',
  'Deep focus ambient',
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

  useEffect(() => {
    const q = searchParams.get('q') || '';
    const mode = (searchParams.get('mode') as DiscoveryMode) || 'all';
    setQueryInput(q);
    setActiveMode(mode);
  }, [searchParams]);

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

  const mapToSong = (item: NormalizedSongItem): Song =>
    ({
      _id: item.id,
      title: item.title,
      duration: item.duration,
      audioUrl: item.audioUrl || '',
      coverImage: item.coverImage,
      artist: item.artist
        ? ({ _id: item.artist.id, name: item.artist.name, profileImage: item.artist.profileImage, verified: item.artist.verified } as any)
        : undefined,
      album: item.album
        ? ({ _id: item.album.id, title: item.album.title, coverImage: item.album.coverImage, releaseYear: item.album.releaseYear } as any)
        : undefined,
      genre: item.genre ? ({ _id: item.genre.id, name: item.genre.name, slug: item.genre.slug } as any) : undefined,
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

  const suggestionIcon = (type: string) => {
    if (type === 'artist') return Mic2;
    if (type === 'album') return Disc3;
    return Music;
  };

  return (
    <div className="pb-16">
      <section className="border-b border-border-subtle px-5 sm:px-8 lg:px-12 pt-10 pb-8">
        <p className="text-xs font-medium text-text-tertiary uppercase tracking-[0.14em]">Search</p>
        <h1 className="font-display text-2xl sm:text-3xl text-text-primary leading-snug mt-3">
          What are you in the mood for?
        </h1>

        <div ref={containerRef} className="relative max-w-2xl mt-6">
          <div className="relative flex items-center">
            <SearchIcon size={17} className="absolute left-4 text-text-tertiary pointer-events-none" strokeWidth={1.75} />
            <input
              type="text"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              onFocus={() => setIsFocused(true)}
              placeholder="Try 'something like Arctic Monkeys but dreamier'…"
              className="w-full pl-11 pr-11 py-3.5 bg-surface-1 rounded-[var(--radius-md)] text-text-primary placeholder-text-tertiary text-sm focus:outline-none focus:ring-1 focus:ring-border-strong transition-shadow"
              autoFocus
            />
            {queryInput && (
              <button
                onClick={handleClear}
                className="absolute right-3.5 p-1.5 rounded-full text-text-tertiary hover:text-text-primary hover:bg-surface-2 transition-colors cursor-pointer"
                title="Clear search"
              >
                <X size={15} />
              </button>
            )}

            {isFocused && queryInput.trim() && liveSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-30 mt-2 bg-surface-1 rounded-[var(--radius-md)] shadow-[var(--shadow-md)] p-2 space-y-0.5">
                <div className="text-2xs font-semibold text-text-tertiary uppercase tracking-wide px-2.5 py-1 flex items-center justify-between">
                  <span>Suggestions</span>
                  {suggestionsLoading && <div className="w-3 h-3 border border-accent/40 border-t-accent rounded-full animate-spin" />}
                </div>
                {liveSuggestions.map((item) => {
                  const Icon = suggestionIcon(item.type);
                  return (
                    <div
                      key={`${item.type}-${item.id}`}
                      onClick={() => handleSuggestionClick(item)}
                      className="flex items-center justify-between px-2.5 py-2 rounded-[var(--radius-sm)] hover:bg-surface-2 cursor-pointer text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon size={14} className="text-text-tertiary shrink-0" strokeWidth={1.75} />
                        <div className="min-w-0">
                          <p className="font-medium text-text-primary truncate">{item.title}</p>
                          {item.subtitle && <p className="text-2xs text-text-tertiary truncate">{item.subtitle}</p>}
                        </div>
                      </div>
                      <span className="text-2xs font-mono text-text-tertiary uppercase shrink-0">{item.type}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-4">
            {MODE_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveMode(tab.id);
                  const params: Record<string, string> = {};
                  if (queryInput.trim()) params.q = queryInput.trim();
                  if (tab.id !== 'all') params.mode = tab.id;
                  setSearchParams(params, { replace: true });
                }}
                className={`px-3 py-1.5 rounded-[var(--radius-pill)] text-xs font-medium transition-colors cursor-pointer ${
                  activeMode === tab.id ? 'bg-accent text-text-on-accent font-semibold' : 'bg-surface-2 text-text-secondary hover:text-text-primary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mt-4 -mx-1 px-1">
            <span className="text-2xs text-text-tertiary font-medium shrink-0">Quick vibes</span>
            {VIBE_QUICK_SEARCHES.map((vibe) => (
              <button
                key={vibe}
                onClick={() => handleSelectSearchTerm(vibe)}
                className="px-3 py-1 bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-text-primary rounded-[var(--radius-pill)] text-xs font-medium transition-colors shrink-0 cursor-pointer"
              >
                {vibe}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="px-5 sm:px-8 lg:px-12 pt-9 space-y-11">
        {loading && !discoveryData && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="bg-surface-1 rounded-[var(--radius-md)] p-3 animate-pulse">
                <div className="w-full aspect-square bg-surface-2 rounded-[var(--radius-artwork)] mb-3" />
                <div className="h-3 bg-surface-2 rounded w-3/4 mb-2" />
                <div className="h-2.5 bg-surface-2 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {error && !loading && (
          <div className="p-6 bg-danger-wash rounded-[var(--radius-md)] text-center max-w-lg space-y-3">
            <AlertTriangle size={22} className="text-danger mx-auto" strokeWidth={1.5} />
            <p className="text-danger text-xs">{error}</p>
            <button
              onClick={() => executeDiscovery(queryInput, activeMode)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-danger text-text-on-accent rounded-[var(--radius-pill)] text-xs font-semibold transition-opacity hover:opacity-90 cursor-pointer"
            >
              <RefreshCw size={13} />
              Retry
            </button>
          </div>
        )}

        {hasQuery && !hasAnyResults && !loading && !error && (
          <div className="py-16 text-center max-w-md mx-auto space-y-4">
            <SearchIcon size={28} className="text-text-tertiary mx-auto" strokeWidth={1.5} />
            <h3 className="font-display text-lg text-text-primary">No matches for "{queryInput}"</h3>
            <p className="text-text-tertiary text-xs leading-relaxed">
              Try a different keyword, genre, or describe the vibe you're after.
            </p>
            <div className="flex flex-wrap justify-center gap-1.5 pt-2">
              {VIBE_QUICK_SEARCHES.slice(0, 3).map((vibe) => (
                <button
                  key={vibe}
                  onClick={() => handleSelectSearchTerm(vibe)}
                  className="px-3 py-1.5 bg-surface-2 text-text-secondary hover:text-text-primary rounded-[var(--radius-pill)] text-xs font-medium transition-colors cursor-pointer"
                >
                  {vibe}
                </button>
              ))}
            </div>
          </div>
        )}

        {!hasQuery && !loading && (
          <div className="space-y-11">
            <TrendingSearches onSelectTrending={handleSelectSearchTerm} />

            {recommendedList.length > 0 && (
              <section className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary font-body flex items-center gap-2">
                    <Sparkles size={16} className="text-accent" strokeWidth={1.75} />
                    Recommended for you
                  </h2>
                  <p className="text-xs text-text-tertiary mt-0.5">Handcrafted picks tailored to your taste</p>
                </div>
                <MusicGrid songs={recommendedList} onPlaySong={handleSongPlay} />
              </section>
            )}
          </div>
        )}

        {hasQuery && hasAnyResults && (
          <div className="space-y-11">
            {artistsList.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-text-primary font-body">
                  Artists <span className="text-text-tertiary font-normal text-sm">· {artistsList.length}</span>
                </h2>
                <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
                  {artistsList.map((artist) => (
                    <ArtistCard key={artist._id} artist={artist} />
                  ))}
                </div>
              </section>
            )}

            {similarArtistsList.length > 0 && (
              <section className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary font-body">Similar artists</h2>
                  <p className="text-xs text-text-tertiary mt-0.5">Discovered from genre alignment and your taste profile</p>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
                  {similarArtistsList.map((artist) => (
                    <ArtistCard key={artist._id} artist={artist} />
                  ))}
                </div>
              </section>
            )}

            {albumsList.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-text-primary font-body">
                  Albums <span className="text-text-tertiary font-normal text-sm">· {albumsList.length}</span>
                </h2>
                <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
                  {albumsList.map((album) => (
                    <AlbumCard key={album._id} album={album} />
                  ))}
                </div>
              </section>
            )}

            {songsList.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-text-primary font-body">
                  Songs <span className="text-text-tertiary font-normal text-sm">· {songsList.length}</span>
                </h2>
                <MusicGrid songs={songsList} onPlaySong={handleSongPlay} />
              </section>
            )}

            {recommendedList.length > 0 && (
              <section className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary font-body flex items-center gap-2">
                    <Sparkles size={16} className="text-accent" strokeWidth={1.75} />
                    Recommended for you
                  </h2>
                  <p className="text-xs text-text-tertiary mt-0.5">Based on your query context and taste profile</p>
                </div>
                <MusicGrid songs={recommendedList} onPlaySong={handleSongPlay} />
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
