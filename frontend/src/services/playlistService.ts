import { apiClient } from './api';
import { extractEnvelopeData, extractEnvelopeList, extractSuccess } from '../utils/apiHelpers';
import type { Playlist, Song } from '../types/music';

export interface PlaylistsApiResponse {
  success: boolean;
  data?: Playlist[];
  message?: string;
}

export interface PlaylistApiResponse {
  success: boolean;
  data?: Playlist;
  message?: string;
}

export interface CreatePlaylistParams {
  name: string;
  description?: string;
  coverImage?: string;
  visibility?: 'public' | 'private';
  songs?: string[];
}

export interface GeneratedPlaylistTrackDTO {
  song: Song;
  score: number;
  matchScore: number;
  noveltyScore?: number;
  genre: string;
  artist: string;
  durationSeconds: number;
  durationFormatted: string;
}

export interface DurationOptimizationDiagnosticsDTO {
  targetDurationSeconds: number;
  achievedDurationSeconds: number;
  durationVarianceSeconds: number;
  durationToleranceSeconds: number;
  isWithinTolerance: boolean;
  isDurationGoalMet: boolean;
  duplicateTracksPrevented: number;
}

export interface PlaylistDiversityDiagnosticsDTO {
  uniqueArtistsCount: number;
  uniqueGenresCount: number;
  artistDistribution: Record<string, number>;
  genreDistribution: Record<string, number>;
  discoveryPercentage: number;
  recentSkipsFiltered: number;
}

export interface SequencingDiagnosticsDTO {
  strategy: string;
  trackCount: number;
  averageTransitionDelta: number;
  maxTransitionDelta: number;
  smoothnessScore: number;
  sameArtistAdjacentCount: number;
}

export interface DedicatedAIPlaylistResponseData {
  title: string;
  description: string;
  tracks: GeneratedPlaylistTrackDTO[];
  songs?: Song[];
  totalDurationSeconds: number;
  totalDurationFormatted: string;
  trackCount: number;
  candidateCountEvaluated: number;
  durationDiagnostics?: DurationOptimizationDiagnosticsDTO;
  diversityDiagnostics?: PlaylistDiversityDiagnosticsDTO;
  sequencingDiagnostics?: SequencingDiagnosticsDTO;
  preferences?: any;
  metadata?: {
    generatedAt: string;
    requestedBy: string;
    strategy: string;
    promptUsed?: string | null;
  };
}

export interface GenerateAIPlaylistRequestParams {
  prompt?: string;
  duration?: number;
  targetDurationMinutes?: number;
  mood?: string;
  activity?: string;
  genre?: string;
  genres?: string[];
  artist?: string;
  artists?: string[];
  discoveryLevel?: string | number;
  discoveryPercentage?: number;
  sequencingStrategy?: 'balanced' | 'energetic' | 'gradual' | 'discovery';
  count?: number;
  targetSongCount?: number;
}

export interface AIPlaylistApiResponse {
  success: boolean;
  message?: string;
  data?: DedicatedAIPlaylistResponseData;
}

export const fetchUserPlaylistsApi = async (): Promise<{ playlists: Playlist[] | null; error: string | null }> => {
  const response = await apiClient<PlaylistsApiResponse>('/playlists');
  const result = extractEnvelopeList(response, 'Failed to fetch playlists');
  return { playlists: result.items, error: result.error };
};

export const fetchPlaylistByIdApi = async (
  id: string
): Promise<{ playlist: Playlist | null; error: string | null }> => {
  const response = await apiClient<PlaylistApiResponse>(`/playlists/${id}`);
  const res = extractEnvelopeData<Playlist>(response, 'Failed to fetch playlist');
  return { playlist: res.data, error: res.error };
};

export const createPlaylistApi = async (
  params: CreatePlaylistParams
): Promise<{ playlist: Playlist | null; error: string | null }> => {
  const response = await apiClient<PlaylistApiResponse>('/playlists', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  const res = extractEnvelopeData<Playlist>(response, 'Failed to create playlist');
  return { playlist: res.data, error: res.error };
};

export const updatePlaylistApi = async (
  id: string,
  params: Partial<CreatePlaylistParams>
): Promise<{ playlist: Playlist | null; error: string | null }> => {
  const response = await apiClient<PlaylistApiResponse>(`/playlists/${id}`, {
    method: 'PUT',
    body: JSON.stringify(params),
  });
  const res = extractEnvelopeData<Playlist>(response, 'Failed to update playlist');
  return { playlist: res.data, error: res.error };
};

export const deletePlaylistApi = async (id: string): Promise<{ success: boolean; error: string | null }> => {
  const response = await apiClient<{ success: boolean; message?: string }>(`/playlists/${id}`, {
    method: 'DELETE',
  });
  return extractSuccess(response, 'Failed to delete playlist');
};

export const addSongToPlaylistApi = async (
  playlistId: string,
  songId: string
): Promise<{ playlist: Playlist | null; error: string | null }> => {
  const response = await apiClient<PlaylistApiResponse>(`/playlists/${playlistId}/songs`, {
    method: 'POST',
    body: JSON.stringify({ songId }),
  });
  const res = extractEnvelopeData<Playlist>(response, 'Failed to add song to playlist');
  return { playlist: res.data, error: res.error };
};

export const removeSongFromPlaylistApi = async (
  playlistId: string,
  songId: string
): Promise<{ playlist: Playlist | null; error: string | null }> => {
  const response = await apiClient<PlaylistApiResponse>(`/playlists/${playlistId}/songs/${songId}`, {
    method: 'DELETE',
  });
  const res = extractEnvelopeData<Playlist>(response, 'Failed to remove song from playlist');
  return { playlist: res.data, error: res.error };
};

export const generateAIPlaylistApi = async (
  params: string | GenerateAIPlaylistRequestParams,
  count?: number
): Promise<{ result: DedicatedAIPlaylistResponseData | null; error: string | null }> => {
  const payload = typeof params === 'string' ? { prompt: params, count } : params;
  const response = await apiClient<AIPlaylistApiResponse>('/playlists/ai-generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const res = extractEnvelopeData<DedicatedAIPlaylistResponseData>(response, 'Failed to generate AI playlist');
  return { result: res.data, error: res.error };
};
