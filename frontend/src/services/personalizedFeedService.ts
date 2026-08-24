import { apiClient } from './api';
import { extractEnvelopeData } from '../utils/apiHelpers';
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
  return extractEnvelopeData(response, 'Failed to fetch personalized feed');
};
