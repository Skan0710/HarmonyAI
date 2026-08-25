import { apiClient } from './api';
import { extractEnvelopeData } from '../utils/apiHelpers';
import type { Song, Artist, Album } from '../types/music';

export interface GroupedSearchResults {
  songs: Song[];
  artists: Artist[];
  albums: Album[];
  total: number;
}

export interface SearchApiResponse {
  success: boolean;
  data?: GroupedSearchResults;
  message?: string;
}

export type DiscoverySourceType = 'keyword_search' | 'semantic_search' | 'recommendation' | 'trending' | 'hybrid';

export interface NormalizedArtistSummary {
  id: string;
  name: string;
  avatar?: string;
  profileImage?: string;
  verified?: boolean;
}

export interface NormalizedAlbumSummary {
  id: string;
  title: string;
  coverImage?: string;
  releaseYear?: number;
}

export interface NormalizedGenreSummary {
  id: string;
  name: string;
  slug?: string;
}

export interface NormalizedSongItem {
  type: 'song';
  id: string;
  title: string;
  artist: NormalizedArtistSummary | null;
  album: NormalizedAlbumSummary | null;
  genre: NormalizedGenreSummary | null;
  duration: number;
  durationFormatted: string;
  coverImage?: string;
  audioUrl?: string;
  score: number;
  matchReason?: string;
  source: DiscoverySourceType;
  sources: DiscoverySourceType[];
  raw?: any;
}

export interface NormalizedArtistItem {
  type: 'artist';
  id: string;
  name: string;
  bio?: string;
  profileImage?: string;
  avatar?: string;
  verified?: boolean;
  genres: string[];
  monthlyListeners?: number;
  score: number;
  matchReason?: string;
  source: DiscoverySourceType;
  sources: DiscoverySourceType[];
  raw?: any;
}

export interface NormalizedAlbumItem {
  type: 'album';
  id: string;
  title: string;
  artist: NormalizedArtistSummary | null;
  genre: NormalizedGenreSummary | null;
  coverImage?: string;
  releaseYear?: number;
  trackCount?: number;
  score: number;
  matchReason?: string;
  source: DiscoverySourceType;
  sources: DiscoverySourceType[];
  raw?: any;
}

export interface UnifiedDiscoveryResponse {
  query: string;
  mode: 'all' | 'keyword' | 'semantic' | 'recommendations' | 'hybrid';
  results: {
    songs: NormalizedSongItem[];
    artists: NormalizedArtistItem[];
    albums: NormalizedAlbumItem[];
  };
  counts: {
    songs: number;
    artists: number;
    albums: number;
    total: number;
  };
  metadata: {
    executedAt: string;
    sourcesUsed: DiscoverySourceType[];
    tookMs: number;
    hasResults: boolean;
    fallbackApplied: boolean;
    userState?: string;
  };
}

export interface UnifiedDiscoveryApiResponse {
  success: boolean;
  data?: UnifiedDiscoveryResponse;
  message?: string;
}

export const searchGlobal = async (
  query: string,
  limit: number = 10
): Promise<{ results: GroupedSearchResults | null; error: string | null }> => {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      results: { songs: [], artists: [], albums: [], total: 0 },
      error: null,
    };
  }

  const response = await apiClient<SearchApiResponse>(
    `/search?q=${encodeURIComponent(trimmed)}&limit=${limit}`
  );

  const res = extractEnvelopeData<GroupedSearchResults>(response, 'Failed to search catalog');
  return { results: res.data, error: res.error };
};

export const searchUnifiedDiscovery = async (
  options: {
    query?: string;
    mode?: 'all' | 'keyword' | 'semantic' | 'recommendations' | 'hybrid';
    seedSongId?: string;
    limit?: number;
  } = {}
): Promise<{ discovery: UnifiedDiscoveryResponse | null; error: string | null }> => {
  const queryParams = new URLSearchParams();
  if (options.query) queryParams.append('q', options.query.trim());
  if (options.mode) queryParams.append('mode', options.mode);
  if (options.seedSongId) queryParams.append('seedSongId', options.seedSongId);
  if (options.limit) queryParams.append('limit', String(options.limit));

  const endpoint = `/search/discover?${queryParams.toString()}`;
  const response = await apiClient<UnifiedDiscoveryApiResponse>(endpoint);

  const res = extractEnvelopeData<UnifiedDiscoveryResponse>(response, 'Failed to discover music');
  return { discovery: res.data, error: res.error };
};
