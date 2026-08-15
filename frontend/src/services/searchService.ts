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

export interface SemanticSearchItem {
  song: Song;
  similarityScore: number;
}

export interface SemanticSearchApiResponse {
  success: boolean;
  query: string;
  count: number;
  data?: SemanticSearchItem[];
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

export const searchSemanticApi = async (
  query: string,
  limit: number = 12
): Promise<{ songs: Song[]; error: string | null }> => {
  try {
    const trimmed = query.trim();
    if (!trimmed) {
      return { songs: [], error: null };
    }

    const response = await apiClient<SemanticSearchApiResponse>(
      `/search/semantic?q=${encodeURIComponent(trimmed)}&limit=${limit}`
    );

    if (response.error) {
      return { songs: [], error: response.error };
    }

    if (response.data && response.data.success && Array.isArray(response.data.data)) {
      const formattedSongs: Song[] = response.data.data.map((item) => {
        const songObj = { ...item.song };
        const percentMatch = Math.round((item.similarityScore || 0) * 100);

        (songObj as any).componentScores = {
          contentScore: item.similarityScore || 0,
          collaborativeScore: 0,
          userTasteAffinityScore: 0,
          popularityScore: 0,
          recencyScore: 0,
        };
        (songObj as any).hybridScore = item.similarityScore || 0;
        (songObj as any).explanation = {
          majorContributors: ['Semantic Intent Match'],
          text: `Matches your search intent (${percentMatch}% match)`,
        };
        (songObj as any).sources = ['semantic_search'];

        return songObj;
      });

      return { songs: formattedSongs, error: null };
    }

    return { songs: [], error: response.data?.message || 'Failed to perform semantic search' };
  } catch (err: any) {
    return { songs: [], error: err.message || 'Error performing semantic search' };
  }
};
