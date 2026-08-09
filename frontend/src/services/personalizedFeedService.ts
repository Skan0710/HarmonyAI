import { apiClient } from './api';
import type { Song, Artist } from '../types/music';

export interface PersonalizedFeedData {
  basedOnTaste: Song[];
  favoriteGenreTracks: Song[];
  suggestedArtists: Artist[];
}

export interface PersonalizedFeedApiResponse {
  success: boolean;
  data?: PersonalizedFeedData;
  message?: string;
}

export const fetchPersonalizedFeedApi = async (): Promise<{
  feed: PersonalizedFeedData | null;
  error: string | null;
}> => {
  const response = await apiClient<PersonalizedFeedApiResponse>('/music/personalized-feed');

  if (response.error) {
    return { feed: null, error: response.error };
  }

  if (response.data && response.data.success && response.data.data) {
    return { feed: response.data.data, error: null };
  }

  return { feed: null, error: response.data?.message || 'Failed to fetch personalized feed' };
};
