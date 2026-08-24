import { apiClient } from './api';
import { extractEnvelopeData } from '../utils/apiHelpers';
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
}

export interface RecentlyPlayedResponse {
  success: boolean;
  data?: Song[];
  message?: string;
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
  const res = extractEnvelopeData<HistoryItem[]>(response, 'Failed to fetch listening history');
  return { history: res.data, error: res.error };
};

export const fetchRecentlyPlayedApi = async (
  limit: number = 20
): Promise<{ songs: Song[] | null; error: string | null }> => {
  const response = await apiClient<RecentlyPlayedResponse>(`/history/recently-played?limit=${limit}`);
  const res = extractEnvelopeData<Song[]>(response, 'Failed to fetch recently played songs');
  return { songs: res.data, error: res.error };
};
