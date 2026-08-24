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

  return extractEnvelopeData(response, 'Failed to search catalog');
};
