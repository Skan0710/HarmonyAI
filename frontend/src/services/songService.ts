import { apiClient } from './api';
import type { SongsApiResponse, Genre, Artist, Album } from '../types/music';

export interface GetSongsParams {
  search?: string;
  artistId?: string;
  albumId?: string;
  genreId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export const fetchSongs = async (params: GetSongsParams = {}): Promise<{
  songs: SongsApiResponse['data'];
  pagination?: SongsApiResponse['pagination'];
  error?: string;
}> => {
  const queryParams = new URLSearchParams();

  if (params.search) queryParams.append('search', params.search);
  if (params.artistId) queryParams.append('artistId', params.artistId);
  if (params.albumId) queryParams.append('albumId', params.albumId);
  if (params.genreId) queryParams.append('genreId', params.genreId);
  if (params.sortBy) queryParams.append('sortBy', params.sortBy);
  if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);
  if (params.page) queryParams.append('page', String(params.page));
  if (params.limit) queryParams.append('limit', String(params.limit));

  const queryString = queryParams.toString();
  const endpoint = `/songs${queryString ? `?${queryString}` : ''}`;

  const response = await apiClient<SongsApiResponse>(endpoint, { method: 'GET' });

  if (response.error || !response.data) {
    return {
      songs: [],
      error: response.error || 'Failed to load songs',
    };
  }

  return {
    songs: response.data.data || [],
    pagination: response.data.pagination,
  };
};

export const fetchGenres = async (): Promise<{ genres: Genre[]; error?: string }> => {
  const response = await apiClient<{ success: boolean; data: Genre[] }>('/genres', { method: 'GET' });

  if (response.error || !response.data) {
    return { genres: [], error: response.error || 'Failed to load genres' };
  }

  return { genres: response.data.data || [] };
};

export const fetchArtists = async (): Promise<{ artists: Artist[]; error?: string }> => {
  const response = await apiClient<{ success: boolean; data: Artist[] }>('/artists', { method: 'GET' });

  if (response.error || !response.data) {
    return { artists: [], error: response.error || 'Failed to load artists' };
  }

  return { artists: response.data.data || [] };
};

export const fetchAlbums = async (): Promise<{ albums: Album[]; error?: string }> => {
  const response = await apiClient<{ success: boolean; data: Album[] }>('/albums', { method: 'GET' });

  if (response.error || !response.data) {
    return { albums: [], error: response.error || 'Failed to load albums' };
  }

  return { albums: response.data.data || [] };
};
