import { apiClient } from './api';
import { extractEnvelopeData } from '../utils/apiHelpers';
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

export interface SessionItemResponse {
  song: Song;
  sessionScore: number;
  contributingFactors: {
    contentSimilarityScore: number;
    sessionProfileAffinity: number;
    interactionFeedbackScore?: number;
    positiveFeedbackBoost?: number;
    negativeFeedbackPenalty?: number;
    seedSongId?: string;
  };
  source: string;
}

export interface SessionApiResponse {
  success: boolean;
  hasActiveSession?: boolean;
  strategyUsed?: string;
  sessionId?: string;
  songCountInSession?: number;
  count?: number;
  data?: SessionItemResponse[];
  message?: string;
}

export interface AutoplayCandidateResponse {
  song: Song;
  autoplayScore: number;
  sessionRelevanceScore: number;
  artistId: string;
  genre: string;
  reason: string;
}

export interface AutoplayApiResponse {
  success: boolean;
  strategyUsed?: string;
  count?: number;
  data?: AutoplayCandidateResponse[];
  message?: string;
}

export const fetchCollaborativeRecommendationsApi = async (
  limit = 10
): Promise<{ songs: Song[]; error: string | null }> => {
  const response = await apiClient<CollaborativeApiResponse>(
    `/recommendations/collaborative?limit=${limit}`,
    { method: 'GET' }
  );
  const result = extractEnvelopeData(response, 'Failed to fetch collaborative recommendations');
  return { songs: result.data || [], error: result.error };
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

  const result = extractEnvelopeData(response, 'Failed to fetch hybrid recommendations');
  const rawItems = result.data || [];
  const songs = rawItems
    .filter((item) => Boolean(item.song))
    .map((item) => ({
      ...item.song,
      hybridScore: item.hybridScore,
      componentScores: item.componentScores,
      sources: item.sources,
    }));

  return { songs, rawHybridItems: rawItems, error: result.error };
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

  const result = extractEnvelopeData(response, 'Failed to fetch contextual recommendations');
  const rawItems = result.data || [];
  const songs = rawItems.filter((item) => Boolean(item.song)).map((item) => item.song);

  return { songs, rawItems, detectedContext: undefined, error: result.error };
};

export const fetchSessionRecommendationsApi = async (
  limit = 10
): Promise<{
  songs: Song[];
  rawItems: SessionItemResponse[];
  hasActiveSession: boolean;
  error: string | null;
}> => {
  const response = await apiClient<SessionApiResponse>(
    `/recommendations/session?limit=${limit}`,
    { method: 'GET' }
  );

  const result = extractEnvelopeData(response, 'Failed to fetch session recommendations');
  const rawItems = result.data || [];
  const songs = rawItems.filter((item) => Boolean(item.song)).map((item) => item.song);

  return {
    songs,
    rawItems,
    hasActiveSession: false,
    error: result.error,
  };
};

export const fetchSmartAutoplayApi = async (params: {
  limit?: number;
  lastPlayedArtistId?: string;
  excludeQueue?: string[];
}): Promise<{
  songs: Song[];
  rawCandidates: AutoplayCandidateResponse[];
  error: string | null;
}> => {
  const queryParams = new URLSearchParams();
  if (params.limit) queryParams.append('limit', String(params.limit));
  if (params.lastPlayedArtistId) queryParams.append('lastPlayedArtistId', params.lastPlayedArtistId);
  if (params.excludeQueue && params.excludeQueue.length > 0) {
    queryParams.append('excludeQueue', params.excludeQueue.join(','));
  }

  const response = await apiClient<AutoplayApiResponse>(
    `/recommendations/autoplay?${queryParams.toString()}`,
    { method: 'GET' }
  );

  const result = extractEnvelopeData(response, 'Failed to fetch autoplay candidates');
  const rawCandidates = result.data || [];
  const songs = rawCandidates.filter((item) => Boolean(item.song)).map((item) => item.song);

  return { songs, rawCandidates, error: result.error };
};
