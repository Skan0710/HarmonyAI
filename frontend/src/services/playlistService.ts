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
}

export interface AIPlaylistPreferenceDTO {
  title: string;
  description: string;
  requestedMood?: string;
  genres: string[];
  artists: string[];
  language?: string;
  energyLevel: number;
  tempoPreference: string | number;
  acousticPreference: number;
  instrumentalPreference: number;
  requestedSongCount: number;
  excludedArtists: string[];
  excludedGenres: string[];
  searchKeywords: string[];
}

export interface AIPlaylistGenerationData {
  preferences: AIPlaylistPreferenceDTO;
  songs: Song[];
  candidatesEvaluated: number;
  selectedCount: number;
  metadata: {
    prompt: string;
    generatedAt: string;
    strategy: string;
    userId?: string;
  };
}

export interface AIPlaylistApiResponse {
  success: boolean;
  message?: string;
  data?: AIPlaylistGenerationData;
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
  return extractEnvelopeData(response, 'Failed to fetch playlist');
};

export const createPlaylistApi = async (
  params: CreatePlaylistParams
): Promise<{ playlist: Playlist | null; error: string | null }> => {
  const response = await apiClient<PlaylistApiResponse>('/playlists', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return extractEnvelopeData(response, 'Failed to create playlist');
};

export const updatePlaylistApi = async (
  id: string,
  params: Partial<CreatePlaylistParams>
): Promise<{ playlist: Playlist | null; error: string | null }> => {
  const response = await apiClient<PlaylistApiResponse>(`/playlists/${id}`, {
    method: 'PUT',
    body: JSON.stringify(params),
  });
  return extractEnvelopeData(response, 'Failed to update playlist');
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
  return extractEnvelopeData(response, 'Failed to add song to playlist');
};

export const removeSongFromPlaylistApi = async (
  playlistId: string,
  songId: string
): Promise<{ playlist: Playlist | null; error: string | null }> => {
  const response = await apiClient<PlaylistApiResponse>(`/playlists/${playlistId}/songs/${songId}`, {
    method: 'DELETE',
  });
  return extractEnvelopeData(response, 'Failed to remove song from playlist');
};

export const generateAIPlaylistApi = async (
  prompt: string,
  count?: number
): Promise<{ result: AIPlaylistGenerationData | null; error: string | null }> => {
  const response = await apiClient<AIPlaylistApiResponse>('/playlists/ai-generate', {
    method: 'POST',
    body: JSON.stringify({ prompt, count }),
  });
  return extractEnvelopeData(response, 'Failed to generate AI playlist');
};
