import { apiClient } from './api';
import { extractEnvelopeData } from '../utils/apiHelpers';
import type { Artist, Genre } from '../types/music';

export interface PreferencesApiResponse {
  success: boolean;
  data?: {
    favoriteArtists: Artist[];
    favoriteGenres: Genre[];
  };
  message?: string;
}

export interface FavoriteArtistsApiResponse {
  success: boolean;
  data?: {
    favoriteArtists: Artist[];
  };
  message?: string;
}

export interface FavoriteGenresApiResponse {
  success: boolean;
  data?: {
    favoriteGenres: Genre[];
  };
  message?: string;
}

export const fetchUserPreferencesApi = async (): Promise<{
  favoriteArtists: Artist[];
  favoriteGenres: Genre[];
  error: string | null;
}> => {
  const response = await apiClient<PreferencesApiResponse>('/users/preferences');
  const result = extractEnvelopeData(response, 'Failed to fetch preferences');
  return {
    favoriteArtists: result.data?.favoriteArtists || [],
    favoriteGenres: result.data?.favoriteGenres || [],
    error: result.error,
  };
};

export const addFavoriteArtistApi = async (
  artistId: string
): Promise<{ favoriteArtists: Artist[] | null; error: string | null }> => {
  const response = await apiClient<FavoriteArtistsApiResponse>(`/users/favorite-artists/${artistId}`, {
    method: 'POST',
  });
  const result = extractEnvelopeData(response, 'Failed to add favorite artist');
  return { favoriteArtists: result.data?.favoriteArtists ?? null, error: result.error };
};

export const removeFavoriteArtistApi = async (
  artistId: string
): Promise<{ favoriteArtists: Artist[] | null; error: string | null }> => {
  const response = await apiClient<FavoriteArtistsApiResponse>(`/users/favorite-artists/${artistId}`, {
    method: 'DELETE',
  });
  const result = extractEnvelopeData(response, 'Failed to remove favorite artist');
  return { favoriteArtists: result.data?.favoriteArtists ?? null, error: result.error };
};

export const addFavoriteGenreApi = async (
  genreId: string
): Promise<{ favoriteGenres: Genre[] | null; error: string | null }> => {
  const response = await apiClient<FavoriteGenresApiResponse>(`/users/favorite-genres/${genreId}`, {
    method: 'POST',
  });
  const result = extractEnvelopeData(response, 'Failed to add favorite genre');
  return { favoriteGenres: result.data?.favoriteGenres ?? null, error: result.error };
};

export const removeFavoriteGenreApi = async (
  genreId: string
): Promise<{ favoriteGenres: Genre[] | null; error: string | null }> => {
  const response = await apiClient<FavoriteGenresApiResponse>(`/users/favorite-genres/${genreId}`, {
    method: 'DELETE',
  });
  const result = extractEnvelopeData(response, 'Failed to remove favorite genre');
  return { favoriteGenres: result.data?.favoriteGenres ?? null, error: result.error };
};
