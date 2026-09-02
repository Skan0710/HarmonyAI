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

export interface AutoplayTrackResponse {
  song: Song;
  queuePosition?: number;
  queueScore?: number;
  autoplayScore?: number;
  hybridScore?: number;
  sessionScore?: number;
  contextScore?: number;
  tier?: string;
  reason?: string;
  sources?: string[];
}

export interface AutoplayApiResponse {
  success: boolean;
  strategyUsed?: string;
  currentTrack?: Song | null;
  currentTrackId?: string;
  sessionActive?: boolean;
  context?: string;
  count?: number;
  queueSize?: number;
  data?: AutoplayCandidateResponse[] | AutoplayTrackResponse[];
  queue?: AutoplayTrackResponse[];
  candidates?: AutoplayCandidateResponse[];
  explanationMetadata?: {
    primaryReason?: string;
    contextApplied?: string;
    dominantGenres?: string[];
    uniqueArtistsCount?: number;
  };
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
  currentTrackId?: string;
  context?: string | any;
  queueSize?: number;
  limit?: number;
  lastPlayedArtistId?: string;
  excludeQueue?: string[];
}): Promise<{
  songs: Song[];
  queue: AutoplayTrackResponse[];
  rawCandidates: AutoplayCandidateResponse[];
  explanationMetadata?: any;
  error: string | null;
}> => {
  const queryParams = new URLSearchParams();
  const effectiveLimit = params.queueSize || params.limit || 5;
  queryParams.append('limit', String(effectiveLimit));
  queryParams.append('queueSize', String(effectiveLimit));
  if (params.currentTrackId) queryParams.append('currentTrack', params.currentTrackId);
  if (params.context) {
    queryParams.append(
      'context',
      typeof params.context === 'string' ? params.context : JSON.stringify(params.context)
    );
  }
  if (params.lastPlayedArtistId) queryParams.append('lastPlayedArtistId', params.lastPlayedArtistId);
  if (params.excludeQueue && params.excludeQueue.length > 0) {
    queryParams.append('excludeQueue', params.excludeQueue.join(','));
  }

  const response = await apiClient<AutoplayApiResponse>(
    `/recommendations/autoplay?${queryParams.toString()}`,
    { method: 'GET' }
  );

  const result = extractEnvelopeData(response, 'Failed to fetch autoplay candidates');
  const payload = response.data;
  const rawQueue: AutoplayTrackResponse[] = payload?.queue || [];
  const rawCandidates: AutoplayCandidateResponse[] =
    payload?.candidates ||
    (Array.isArray(result.data) ? (result.data as AutoplayCandidateResponse[]) : []);

  // Extract valid songs from queue or fallback candidates
  const songsFromQueue = rawQueue.map((item) => item.song).filter(Boolean);
  const songsFromCandidates = rawCandidates.map((item) => item.song).filter(Boolean);
  const songs = songsFromQueue.length > 0 ? songsFromQueue : songsFromCandidates;

  return {
    songs,
    queue: rawQueue,
    rawCandidates,
    explanationMetadata: payload?.explanationMetadata,
    error: result.error,
  };
};

export interface RecommendationExplanationResponse {
  song: Song;
  isCurrentlyRecommended: boolean;
  recommendationScore: number;
  primaryExplanation: string;
  topReasons: {
    type: string;
    message: string;
    importanceScore: number;
    supportingValue?: any;
    metadata?: Record<string, any>;
  }[];
  contributingSignals: {
    userTasteAffinityScore?: number;
    contentSimilarity?: number;
    collaborativeScore?: number;
    genreAffinity?: number;
    artistAffinity?: number;
    popularityScore?: number;
    sources?: string[];
    [key: string]: any;
  };
  summary: string;
  confidenceScore: number;
}

export const fetchRecommendationExplanationApi = async (
  songId: string
): Promise<{
  data: RecommendationExplanationResponse | null;
  error: string | null;
}> => {
  const response = await apiClient<{ success: boolean; data?: RecommendationExplanationResponse; message?: string }>(
    `/recommendations/explain/${songId}`,
    { method: 'GET' }
  );

  const result = extractEnvelopeData(response, 'Failed to fetch recommendation explanation');
  return {
    data: result.data || null,
    error: result.error,
  };
};

export interface ContextAwareRecommendationItem {
  song: Song;
  hybridScore: number;
  recommendationScore: number;
  primaryExplanation?: string;
  topReasons?: {
    type: string;
    message: string;
    importanceScore: number;
    supportingValue?: any;
    metadata?: Record<string, any>;
  }[];
  componentScores: {
    contentScore: number;
    collaborativeScore: number;
    userTasteAffinityScore: number;
    popularityScore: number;
    recencyScore: number;
    contextScore?: number;
  };
  sources: string[];
  metadata?: Record<string, any>;
}

export interface ContextAwareApiResponse {
  success: boolean;
  context: {
    situation: string;
    mood?: string;
    desiredEnergy?: number;
    desiredTempo?: number;
    preferredGenres?: string[];
    discoveryLevel?: number;
    derivedPreferences?: Record<string, any>;
    appliedOverrides?: string[];
  };
  strategyUsed?: string;
  userClassification?: string;
  count: number;
  data: ContextAwareRecommendationItem[];
  message?: string;
}

export const fetchContextAwareRecommendationsApi = async (params: {
  context?: string;
  mood?: string;
  energy?: number;
  tempo?: number;
  genres?: string[];
  discoveryLevel?: number;
  limit?: number;
}): Promise<{
  data: ContextAwareRecommendationItem[];
  contextInfo: ContextAwareApiResponse['context'] | null;
  error: string | null;
}> => {
  const queryParams = new URLSearchParams();
  if (params.context) queryParams.append('context', params.context);
  if (params.mood) queryParams.append('mood', params.mood);
  if (params.energy !== undefined) queryParams.append('energy', String(params.energy));
  if (params.tempo !== undefined) queryParams.append('tempo', String(params.tempo));
  if (params.genres && params.genres.length > 0) queryParams.append('genres', params.genres.join(','));
  if (params.discoveryLevel !== undefined) queryParams.append('discoveryLevel', String(params.discoveryLevel));
  if (params.limit) queryParams.append('limit', String(params.limit));

  try {
    const response = await apiClient<ContextAwareApiResponse>(
      `/recommendations/context?${queryParams.toString()}`,
      { method: 'GET' }
    );

    const result = extractEnvelopeData(response, 'Failed to fetch context-aware recommendations');
    return {
      data: result.data || [],
      contextInfo: (response as any)?.context || null,
      error: result.error,
    };
  } catch (err: any) {
    return {
      data: [],
      contextInfo: null,
      error: err?.message || 'Network error fetching context-aware recommendations',
    };
  }
};

