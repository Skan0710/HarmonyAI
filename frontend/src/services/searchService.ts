import { apiClient } from './api';
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
  error?: string;
}

export const searchGlobal = async (
  query: string,
  limit: number = 10
): Promise<{ results: GroupedSearchResults | null; error: string | null }> => {
  try {
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

    if (response.error) {
      return { results: null, error: response.error };
    }

    if (response.data && response.data.success && response.data.data) {
      return { results: response.data.data, error: null };
    }

    return { results: null, error: response.data?.message || 'Failed to search catalog' };
  } catch (err: any) {
    const errorMessage = err.message || 'Error searching catalog';
    return { results: null, error: errorMessage };
  }
};
