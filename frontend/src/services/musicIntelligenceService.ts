import { apiClient } from './api';
import { extractEnvelopeData } from '../utils/apiHelpers';
import type { Song } from '../types/music';

/** A single scored taste dimension (genre, artist, or mood) inside a Music DNA profile. */
export interface TasteItem {
  id?: string;
  name: string;
  score: number;
  preferenceType: 'established' | 'emerging' | 'fading' | string;
  playCount: number;
  shortTermScore: number;
  longTermScore: number;
  momentumDelta: number;
  explanation: string;
}

export interface DiversityMetric {
  score: number;
  level?: 'low' | 'moderate' | 'high' | 'very_high';
}

export interface MusicDnaProfile {
  userId: string;
  dnaVersion: string;
  confidenceScore: number;
  topGenres: TasteItem[];
  topArtists: TasteItem[];
  preferredMoods: TasteItem[];
  explorationTendency: number;
  familiarityPreference: number;
  diversityPreference: number;
  discoveryTendency: number;
  listeningBehavior: {
    listenerArchetype: string;
    repeatListeningTendency: number;
    skipTendency: number;
    sessionListeningIntensity: number;
    preferenceStability: number;
    isDataSufficient: boolean;
  };
  emergingPreferences: {
    genres: TasteItem[];
    artists: TasteItem[];
  };
  genreProfile: { topGenres: TasteItem[]; emergingGenres: TasteItem[]; diversity: DiversityMetric };
  artistProfile: { strongestArtists: TasteItem[]; emergingArtists: TasteItem[]; diversity: DiversityMetric };
  moodProfile: { preferredMoods: TasteItem[] };
  lastRefreshedAt: string;
}

export const fetchMusicDnaProfileApi = async (
  limit = 12
): Promise<{ profile: MusicDnaProfile | null; error: string | null }> => {
  const response = await apiClient<{ success: boolean; data?: MusicDnaProfile; message?: string }>(
    `/recommendations/music-dna?limit=${limit}`
  );
  const result = extractEnvelopeData(response, 'Failed to fetch Music DNA profile');
  return { profile: result.data, error: result.error };
};

export interface MusicDnaEvolutionOverview {
  isDataSufficient: boolean;
  snapshotCount: number;
  currentMusicDna: {
    confidenceScore: number;
    topGenres: TasteItem[];
    topArtists: TasteItem[];
    listenerArchetype: string;
  };
  recentChanges: {
    hasMeaningfulShift: boolean;
    overallChangeIntensity: number;
    tasteStabilityRating: string;
    genreChanges: any[];
    artistChanges: any[];
    summary: string;
  };
  emergingTastes: {
    hasEmergingPreferences: boolean;
    emergingGenres: TasteItem[];
    emergingArtists: TasteItem[];
    summary: string;
  };
  fadingPreferences: {
    fadingGenres: string[];
    fadingArtists: string[];
  };
  stabilityMetrics: {
    tasteStabilityScore: number;
    tasteVolatilityScore: number;
    discoveryTendencyScore: number;
    archetype: string;
    explanation: string;
  };
  evolutionTimeline: {
    totalEvents: number;
    events: any[];
    milestones: any[];
  };
}

export const fetchMusicDnaEvolutionOverviewApi = async (
  limit = 10
): Promise<{ overview: MusicDnaEvolutionOverview | null; error: string | null }> => {
  const response = await apiClient<{ success: boolean; data?: MusicDnaEvolutionOverview; message?: string }>(
    `/recommendations/music-dna/evolution?limit=${limit}`
  );
  const result = extractEnvelopeData(response, 'Failed to fetch Music DNA evolution overview');
  return { overview: result.data, error: result.error };
};

export interface PersonalMusicTwin {
  userId: string;
  isDataSufficient: boolean;
  listenerArchetype: string;
  archetypeDescription: string;
  confidence: number;
  personalityTraits: { id: string; trait: string; category: string; confidence: number }[];
  dominantGenres: string[];
  dominantMoods: string[];
  importantArtists: string[];
  explorationTendency: number;
  familiarityPreference: number;
  diversityPreference: number;
  emergingPreferences: {
    genres: string[];
    artists: string[];
    moods: string[];
    narrative: string;
  };
  tasteStability: {
    stabilityScore: number;
    volatilityScore: number;
    stabilityRating: string;
    description: string;
  };
  tasteEvolution: {
    transformationIntensity: number;
    evolutionArchetype: string;
    primaryTasteDirection: string;
    velocity: string;
  };
  currentMusicalIdentity: {
    personaName: string;
    tagline: string;
    bio: string;
    signatureSound: string;
    vibeKeywords: string[];
    rarityScore: number;
  };
}

export const fetchPersonalMusicTwinApi = async (
  limit = 10
): Promise<{ twin: PersonalMusicTwin | null; error: string | null }> => {
  const response = await apiClient<{ success: boolean; data?: PersonalMusicTwin; message?: string }>(
    `/recommendations/personal-music-twin?limit=${limit}`
  );
  const result = extractEnvelopeData(response, 'Failed to fetch Personal Music Twin');
  return { twin: result.data, error: result.error };
};

export type DiscoveryModeId = 'FOR_YOU' | 'COMFORT' | 'DISCOVER' | 'OUTSIDE_YOUR_TASTE' | 'WHATS_NEW_FOR_YOU';

export interface DiscoveryModeConfig {
  mode: DiscoveryModeId;
  label: string;
  description: string;
  strategyType: string;
  explorationRate: number;
}

export const fetchDiscoveryModesApi = async (): Promise<{
  modes: Record<string, DiscoveryModeConfig>;
  error: string | null;
}> => {
  const response = await apiClient<{ success: boolean; data?: Record<string, DiscoveryModeConfig> }>(
    '/recommendations/modes'
  );
  const result = extractEnvelopeData(response, 'Failed to fetch discovery modes');
  return { modes: result.data || {}, error: result.error };
};

export interface ModeRecommendationItem {
  song: Song;
  hybridScore?: number;
  recommendationScore?: number;
  noveltyScore?: number;
  sources?: string[];
}

export const fetchModeRecommendationsApi = async (
  mode: DiscoveryModeId | string,
  limit = 12,
  seedSongId?: string
): Promise<{
  songs: Song[];
  rawItems: ModeRecommendationItem[];
  label?: string;
  description?: string;
  strategyUsed?: string;
  error: string | null;
}> => {
  const params = new URLSearchParams();
  params.append('limit', String(limit));
  if (seedSongId) params.append('seedSongId', seedSongId);

  const response = await apiClient<{
    success: boolean;
    mode?: string;
    label?: string;
    description?: string;
    strategyUsed?: string;
    data?: ModeRecommendationItem[];
    message?: string;
  }>(`/recommendations/modes/${mode}?${params.toString()}`);

  if (response.error) {
    return { songs: [], rawItems: [], error: response.error };
  }

  const rawItems = response.data?.data || [];
  const songs = rawItems.filter((item) => Boolean(item.song)).map((item) => item.song);

  return {
    songs,
    rawItems,
    label: response.data?.label,
    description: response.data?.description,
    strategyUsed: response.data?.strategyUsed,
    error: null,
  };
};
