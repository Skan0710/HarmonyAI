import { apiClient } from './api';
import type { Song } from '../types/music';

export interface RecommendationsApiResponse {
  success: boolean;
  data?: Song[];
  message?: string;
}

export const fetchCollaborativeRecommendationsApi = async (
  limit = 10
): Promise<{ songs: Song[]; error: string | null }> => {
  const response = await apiClient<RecommendationsApiResponse>(
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
