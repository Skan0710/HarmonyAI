import { apiClient } from './api';
import type { Playlist, Song } from '../types/music';

export interface PlaylistsApiResponse {
  success: boolean;
  data?: Playlist[];
  message?: string;
  error?: string;
}

export interface PlaylistApiResponse {
  success: boolean;
  data?: Playlist;
  message?: string;
  error?: string;
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

  if (response.error) {
    return { playlists: null, error: response.error };
  }

  if (response.data && response.data.success && response.data.data) {
    return { playlists: response.data.data, error: null };
  }

  return { playlists: null, error: response.data?.message || 'Failed to fetch playlists' };
};

export const fetchPlaylistByIdApi = async (
  id: string
): Promise<{ playlist: Playlist | null; error: string | null }> => {
  const response = await apiClient<PlaylistApiResponse>(`/playlists/${id}`);

  if (response.error) {
    return { playlist: null, error: response.error };
  }

  if (response.data && response.data.success && response.data.data) {
    return { playlist: response.data.data, error: null };
  }

  return { playlist: null, error: response.data?.message || 'Failed to fetch playlist' };
};

export const createPlaylistApi = async (
  params: CreatePlaylistParams
): Promise<{ playlist: Playlist | null; error: string | null }> => {
  const response = await apiClient<PlaylistApiResponse>('/playlists', {
    method: 'POST',
    body: JSON.stringify(params),
  });

  if (response.error) {
    return { playlist: null, error: response.error };
  }

  if (response.data && response.data.success && response.data.data) {
    return { playlist: response.data.data, error: null };
  }

  return { playlist: null, error: response.data?.message || 'Failed to create playlist' };
};

export const updatePlaylistApi = async (
  id: string,
  params: Partial<CreatePlaylistParams>
): Promise<{ playlist: Playlist | null; error: string | null }> => {
  const response = await apiClient<PlaylistApiResponse>(`/playlists/${id}`, {
    method: 'PUT',
    body: JSON.stringify(params),
  });

  if (response.error) {
    return { playlist: null, error: response.error };
  }

  if (response.data && response.data.success && response.data.data) {
    return { playlist: response.data.data, error: null };
  }

  return { playlist: null, error: response.data?.message || 'Failed to update playlist' };
};

export const deletePlaylistApi = async (id: string): Promise<{ success: boolean; error: string | null }> => {
  const response = await apiClient<{ success: boolean; message?: string }>(`/playlists/${id}`, {
    method: 'DELETE',
  });

  if (response.error) {
    return { success: false, error: response.error };
  }

  return { success: response.data?.success || false, error: null };
};

export const addSongToPlaylistApi = async (
  playlistId: string,
  songId: string
): Promise<{ playlist: Playlist | null; error: string | null }> => {
  const response = await apiClient<PlaylistApiResponse>(`/playlists/${playlistId}/songs`, {
    method: 'POST',
    body: JSON.stringify({ songId }),
  });

  if (response.error) {
    return { playlist: null, error: response.error };
  }

  if (response.data && response.data.success && response.data.data) {
    return { playlist: response.data.data, error: null };
  }

  return { playlist: null, error: response.data?.message || 'Failed to add song to playlist' };
};

export const removeSongFromPlaylistApi = async (
  playlistId: string,
  songId: string
): Promise<{ playlist: Playlist | null; error: string | null }> => {
  const response = await apiClient<PlaylistApiResponse>(`/playlists/${playlistId}/songs/${songId}`, {
    method: 'DELETE',
  });

  if (response.error) {
    return { playlist: null, error: response.error };
  }

  if (response.data && response.data.success && response.data.data) {
    return { playlist: response.data.data, error: null };
  }

  return { playlist: null, error: response.data?.message || 'Failed to remove song from playlist' };
};

export const generateAIPlaylistApi = async (
  prompt: string,
  count?: number
): Promise<{ result: AIPlaylistGenerationData | null; error: string | null }> => {
  const response = await apiClient<AIPlaylistApiResponse>('/playlists/ai-generate', {
    method: 'POST',
    body: JSON.stringify({ prompt, count }),
  });

  if (response.error) {
    return { result: null, error: response.error };
  }

  if (response.data && response.data.success && response.data.data) {
    return { result: response.data.data, error: null };
  }

  return { result: null, error: response.data?.message || 'Failed to generate AI playlist' };
};
