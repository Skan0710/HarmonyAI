import { apiClient } from './api';
import { extractEnvelopeData, extractEnvelopeList } from '../utils/apiHelpers';
import type { SongsApiResponse, Song, Genre, Artist, Album } from '../types/music';

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

export const fetchSongById = async (songId: string): Promise<{ song?: Song; error?: string }> => {
  const response = await apiClient<{ success: boolean; data: Song }>(`/songs/${songId}`, { method: 'GET' });
  const result = extractEnvelopeData(response, 'Failed to load song details');
  return { song: result.data || undefined, error: result.error || undefined };
};

export const recordSongPlay = async (songId: string): Promise<void> => {
  await apiClient(`/songs/${songId}/play`, { method: 'POST' });
};

export const fetchSimilarSongsApi = async (
  songId: string,
  limit = 10
): Promise<{ songs: Song[]; error?: string }> => {
  const response = await apiClient<{ success: boolean; data: Song[] }>(
    `/recommendations/similar/${songId}?limit=${limit}`,
    { method: 'GET' }
  );
  const result = extractEnvelopeData(response, 'Failed to load similar songs');
  return { songs: result.data || [], error: result.error || undefined };
};

export const fetchTrendingSongsApi = async (limit = 10): Promise<{ songs: Song[]; error?: string }> => {
  const response = await apiClient<{ success: boolean; data: Song[] }>(`/music/trending?limit=${limit}`, {
    method: 'GET',
  });
  const result = extractEnvelopeData(response, 'Failed to load trending songs');
  return { songs: result.data || [], error: result.error || undefined };
};

export const fetchNewReleasesApi = async (
  page = 1,
  limit = 10
): Promise<{
  songs: Song[];
  albums: Album[];
  pagination?: { page: number; limit: number; totalSongs: number; totalAlbums: number };
  error?: string;
}> => {
  const response = await apiClient<{
    success: boolean;
    data: {
      songs: Song[];
      albums: Album[];
      pagination: { page: number; limit: number; totalSongs: number; totalAlbums: number };
    };
  }>(`/music/new-releases?page=${page}&limit=${limit}`, { method: 'GET' });

  const result = extractEnvelopeData(response, 'Failed to load new releases');
  const data = result.data;
  return {
    songs: data?.songs || [],
    albums: data?.albums || [],
    pagination: data?.pagination,
    error: result.error || undefined,
  };
};

export const fetchGenres = async (): Promise<{ genres: Genre[]; error?: string }> => {
  const response = await apiClient<{ success: boolean; data: Genre[] }>('/genres', { method: 'GET' });
  const result = extractEnvelopeData(response, 'Failed to load genres');
  return { genres: result.data || [], error: result.error || undefined };
};

export const fetchArtists = async (): Promise<{ artists: Artist[]; error?: string }> => {
  const response = await apiClient<{ success: boolean; data: Artist[] }>('/artists', { method: 'GET' });
  const result = extractEnvelopeData(response, 'Failed to load artists');
  return { artists: result.data || [], error: result.error || undefined };
};

export const fetchArtistById = async (artistId: string): Promise<{ artist?: Artist; error?: string }> => {
  const response = await apiClient<{ success: boolean; data: Artist }>(`/artists/${artistId}`, { method: 'GET' });
  const result = extractEnvelopeData(response, 'Failed to load artist profile');
  return { artist: result.data || undefined, error: result.error || undefined };
};

export const fetchSimilarArtists = async (artistId: string): Promise<{ artists: Artist[]; error?: string }> => {
  const response = await apiClient<{ success: boolean; data: Artist[] }>(`/artists/${artistId}/similar`, { method: 'GET' });
  const result = extractEnvelopeData(response, 'Failed to load similar artists');
  return { artists: result.data || [], error: result.error || undefined };
};

export const fetchAlbums = async (params: { artistId?: string } = {}): Promise<{ albums: Album[]; error?: string }> => {
  const queryParams = new URLSearchParams();
  if (params.artistId) queryParams.append('artistId', params.artistId);

  const queryString = queryParams.toString();
  const endpoint = `/albums${queryString ? `?${queryString}` : ''}`;

  const response = await apiClient<{ success: boolean; data: Album[] }>(endpoint, { method: 'GET' });
  const result = extractEnvelopeData(response, 'Failed to load albums');
  return { albums: result.data || [], error: result.error || undefined };
};

export const fetchAlbumById = async (albumId: string): Promise<{ album?: Album; error?: string }> => {
  const response = await apiClient<{ success: boolean; data: Album }>(`/albums/${albumId}`, { method: 'GET' });
  const result = extractEnvelopeData(response, 'Failed to load album details');
  return { album: result.data || undefined, error: result.error || undefined };
};
