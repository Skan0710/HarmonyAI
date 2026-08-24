import { apiClient } from './api';
import { extractEnvelopeData } from '../utils/apiHelpers';
import type { Song } from '../types/music';

export interface LikedSongsResponse {
  success: boolean;
  data?: Song[];
  message?: string;
}

export interface ToggleLikeResponse {
  success: boolean;
  data?: {
    likedSongs: string[];
  };
  message?: string;
}

export const fetchLikedSongsApi = async (): Promise<{ songs: Song[] | null; error: string | null }> => {
  const response = await apiClient<LikedSongsResponse>('/users/liked-songs');
  return extractEnvelopeData(response, 'Failed to fetch liked songs');
};

export const likeSongApi = async (songId: string): Promise<{ likedSongs: string[] | null; error: string | null }> => {
  const response = await apiClient<ToggleLikeResponse>(`/users/liked-songs/${songId}`, {
    method: 'POST',
  });
  const result = extractEnvelopeData(response, 'Failed to like song');
  return { likedSongs: result.data?.likedSongs ?? null, error: result.error };
};

export const unlikeSongApi = async (songId: string): Promise<{ likedSongs: string[] | null; error: string | null }> => {
  const response = await apiClient<ToggleLikeResponse>(`/users/liked-songs/${songId}`, {
    method: 'DELETE',
  });
  const result = extractEnvelopeData(response, 'Failed to unlike song');
  return { likedSongs: result.data?.likedSongs ?? null, error: result.error };
};
