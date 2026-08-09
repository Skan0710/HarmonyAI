import { apiClient } from './api';
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

  if (response.error) {
    return { favoriteArtists: [], favoriteGenres: [], error: response.error };
  }

  if (response.data && response.data.success && response.data.data) {
    return {
      favoriteArtists: response.data.data.favoriteArtists || [],
      favoriteGenres: response.data.data.favoriteGenres || [],
      error: null,
    };
  }

  return {
    favoriteArtists: [],
    favoriteGenres: [],
    error: response.data?.message || 'Failed to fetch preferences',
  };
};

export const addFavoriteArtistApi = async (
  artistId: string
): Promise<{ favoriteArtists: Artist[] | null; error: string | null }> => {
  const response = await apiClient<FavoriteArtistsApiResponse>(`/users/favorite-artists/${artistId}`, {
    method: 'POST',
  });

  if (response.error) {
    return { favoriteArtists: null, error: response.error };
  }

  if (response.data && response.data.success && response.data.data) {
    return { favoriteArtists: response.data.data.favoriteArtists, error: null };
  }

  return { favoriteArtists: null, error: response.data?.message || 'Failed to add favorite artist' };
};

export const removeFavoriteArtistApi = async (
  artistId: string
): Promise<{ favoriteArtists: Artist[] | null; error: string | null }> => {
  const response = await apiClient<FavoriteArtistsApiResponse>(`/users/favorite-artists/${artistId}`, {
    method: 'DELETE',
  });

  if (response.error) {
    return { favoriteArtists: null, error: response.error };
  }

  if (response.data && response.data.success && response.data.data) {
    return { favoriteArtists: response.data.data.favoriteArtists, error: null };
  }

  return { favoriteArtists: null, error: response.data?.message || 'Failed to remove favorite artist' };
};

export const addFavoriteGenreApi = async (
  genreId: string
): Promise<{ favoriteGenres: Genre[] | null; error: string | null }> => {
  const response = await apiClient<FavoriteGenresApiResponse>(`/users/favorite-genres/${genreId}`, {
    method: 'POST',
  });

  if (response.error) {
    return { favoriteGenres: null, error: response.error };
  }

  if (response.data && response.data.success && response.data.data) {
    return { favoriteGenres: response.data.data.favoriteGenres, error: null };
  }

  return { favoriteGenres: null, error: response.data?.message || 'Failed to add favorite genre' };
};

export const removeFavoriteGenreApi = async (
  genreId: string
): Promise<{ favoriteGenres: Genre[] | null; error: string | null }> => {
  const response = await apiClient<FavoriteGenresApiResponse>(`/users/favorite-genres/${genreId}`, {
    method: 'DELETE',
  });

  if (response.error) {
    return { favoriteGenres: null, error: response.error };
  }

  if (response.data && response.data.success && response.data.data) {
    return { favoriteGenres: response.data.data.favoriteGenres, error: null };
  }

  return { favoriteGenres: null, error: response.data?.message || 'Failed to remove favorite genre' };
};
