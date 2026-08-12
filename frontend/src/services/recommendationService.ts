import { apiClient } from './api';
import type { Song } from '../types/music';

export interface HybridItemResponse {
  song: Song;
  hybridScore: number;
  componentScores: {
    contentScore: number;
    collaborativeScore: number;
    popularityScore: number;
    recencyScore: number;
  };
  sources: string[];
}

export interface HybridApiResponse {
  success: boolean;
  data?: HybridItemResponse[];
  message?: string;
}

export interface CollaborativeApiResponse {
  success: boolean;
  data?: Song[];
  message?: string;
}

export const fetchCollaborativeRecommendationsApi = async (
  limit = 10
): Promise<{ songs: Song[]; error: string | null }> => {
  const response = await apiClient<CollaborativeApiResponse>(
    `/recommendations/collaborative?limit=${limit}`,
    { method: 'GET' }
  );

  if (response.error) {
    return { songs: [], error: response.error };
  }

  if (response.data && response.data.success && Array.isArray(response.data.data)) {
    return { songs: response.data.data, error: null };
  }

  return { songs: [], error: response.data?.message || 'Failed to fetch collaborative recommendations' };
};

export const fetchHybridRecommendationsApi = async (
  limit = 10,
  seedSongId?: string
): Promise<{ songs: Song[]; rawHybridItems: HybridItemResponse[]; error: string | null }> => {
  const queryParams = new URLSearchParams();
  queryParams.append('limit', String(limit));
  if (seedSongId) queryParams.append('seedSongId', seedSongId);

  const response = await apiClient<HybridApiResponse>(
    `/recommendations/hybrid?${queryParams.toString()}`,
    { method: 'GET' }
  );

  if (response.error) {
    return { songs: [], rawHybridItems: [], error: response.error };
  }

  if (response.data && response.data.success && Array.isArray(response.data.data)) {
    const rawHybridItems = response.data.data;
    const songs = rawHybridItems
      .filter((item) => Boolean(item.song))
      .map((item) => ({
        ...item.song,
        hybridScore: item.hybridScore,
        componentScores: item.componentScores,
        sources: item.sources,
      }));

    return { songs, rawHybridItems, error: null };
  }

  return {
    songs: [],
    rawHybridItems: [],
    error: response.data?.message || 'Failed to fetch hybrid recommendations',
  };
};
