import { apiClient } from './api';
import type { Song } from '../types/music';

export interface LikedSongsResponse {
  success: boolean;
  data?: Song[];
  message?: string;
  error?: string;
}

export interface ToggleLikeResponse {
  success: boolean;
  data?: {
    likedSongs: string[];
  };
  message?: string;
  error?: string;
}

export const fetchLikedSongsApi = async (): Promise<{ songs: Song[] | null; error: string | null }> => {
  const response = await apiClient<LikedSongsResponse>('/users/liked-songs');

  if (response.error) {
    return { songs: null, error: response.error };
  }

  if (response.data && response.data.success && response.data.data) {
    return { songs: response.data.data, error: null };
  }

  return { songs: null, error: response.data?.message || 'Failed to fetch liked songs' };
};

export const likeSongApi = async (songId: string): Promise<{ likedSongs: string[] | null; error: string | null }> => {
  const response = await apiClient<ToggleLikeResponse>(`/users/liked-songs/${songId}`, {
    method: 'POST',
  });

  if (response.error) {
    return { likedSongs: null, error: response.error };
  }

  if (response.data && response.data.success && response.data.data) {
    return { likedSongs: response.data.data.likedSongs, error: null };
  }

  return { likedSongs: null, error: response.data?.message || 'Failed to like song' };
};

export const unlikeSongApi = async (songId: string): Promise<{ likedSongs: string[] | null; error: string | null }> => {
  const response = await apiClient<ToggleLikeResponse>(`/users/liked-songs/${songId}`, {
    method: 'DELETE',
  });

  if (response.error) {
    return { likedSongs: null, error: response.error };
  }

  if (response.data && response.data.success && response.data.data) {
    return { likedSongs: response.data.data.likedSongs, error: null };
  }

  return { likedSongs: null, error: response.data?.message || 'Failed to unlike song' };
};
