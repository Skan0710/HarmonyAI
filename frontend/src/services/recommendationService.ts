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

export interface ContextualItemResponse {
  song: Song;
  contextScore: number;
  componentScores: {
    contentScore: number;
    collaborativeScore: number;
    userTasteAffinityScore: number;
    popularityScore: number;
    recencyScore: number;
    moodScore: number;
    activityScore: number;
  };
  sources: string[];
}

export interface ContextualApiResponse {
  success: boolean;
  strategyUsed?: string;
  userClassification?: string;
  detectedContext?: {
    timeOfDay?: string;
    mood?: string;
    activity?: string;
    energyLevel?: number;
    preferredDurationMinutes?: number;
  };
  count?: number;
  data?: ContextualItemResponse[];
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

export const fetchContextualRecommendationsApi = async (params: {
  mood?: string;
  activity?: string;
  energy?: number;
  duration?: number;
  limit?: number;
}): Promise<{
  songs: Song[];
  rawItems: ContextualItemResponse[];
  detectedContext?: ContextualApiResponse['detectedContext'];
  error: string | null;
}> => {
  const queryParams = new URLSearchParams();
  if (params.mood) queryParams.append('mood', params.mood);
  if (params.activity) queryParams.append('activity', params.activity);
  if (typeof params.energy === 'number') queryParams.append('energy', String(params.energy));
  if (typeof params.duration === 'number') queryParams.append('duration', String(params.duration));
  if (params.limit) queryParams.append('limit', String(params.limit));

  const response = await apiClient<ContextualApiResponse>(
    `/recommendations/contextual?${queryParams.toString()}`,
    { method: 'GET' }
  );

  if (response.error) {
    return { songs: [], rawItems: [], error: response.error };
  }

  if (response.data && response.data.success && Array.isArray(response.data.data)) {
    const rawItems = response.data.data;
    const songs = rawItems.filter((item) => Boolean(item.song)).map((item) => item.song);
    return { songs, rawItems, detectedContext: response.data.detectedContext, error: null };
  }

  return {
    songs: [],
    rawItems: [],
    error: response.data?.message || 'Failed to fetch contextual recommendations',
  };
};
