import { apiClient } from './api';
import type { Song } from '../types/music';

export interface HistoryItem {
  _id: string;
  user: string;
  song: Song;
  playedAt: string;
}

export interface HistoryResponse {
  success: boolean;
  data?: HistoryItem[];
  message?: string;
  error?: string;
}

export interface RecentlyPlayedResponse {
  success: boolean;
  data?: Song[];
  message?: string;
  error?: string;
}

export const recordPlaybackApi = async (songId: string): Promise<void> => {
  try {
    await apiClient(`/history/record/${songId}`, {
      method: 'POST',
    });
  } catch {}
};

export const fetchListeningHistoryApi = async (
  limit: number = 50
): Promise<{ history: HistoryItem[] | null; error: string | null }> => {
  const response = await apiClient<HistoryResponse>(`/history?limit=${limit}`);

  if (response.error) {
    return { history: null, error: response.error };
  }

  if (response.data && response.data.success && response.data.data) {
    return { history: response.data.data, error: null };
  }

  return { history: null, error: response.data?.message || 'Failed to fetch listening history' };
};

export const fetchRecentlyPlayedApi = async (
  limit: number = 20
): Promise<{ songs: Song[] | null; error: string | null }> => {
  const response = await apiClient<RecentlyPlayedResponse>(`/history/recently-played?limit=${limit}`);

  if (response.error) {
    return { songs: null, error: response.error };
  }

  if (response.data && response.data.success && response.data.data) {
    return { songs: response.data.data, error: null };
  }

  return { songs: null, error: response.data?.message || 'Failed to fetch recently played songs' };
};
