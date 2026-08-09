import { create } from 'zustand';
import type { Artist, Genre } from '../types/music';
import {
  fetchUserPreferencesApi,
  addFavoriteArtistApi,
  removeFavoriteArtistApi,
  addFavoriteGenreApi,
  removeFavoriteGenreApi,
} from '../services/preferenceService';

interface PreferenceState {
  favoriteArtists: Artist[];
  favoriteGenres: Genre[];
  loading: boolean;
  error: string | null;

  fetchPreferences: () => Promise<void>;
  addArtist: (artist: Artist) => Promise<boolean>;
  removeArtist: (artistId: string) => Promise<boolean>;
  addGenre: (genre: Genre) => Promise<boolean>;
  removeGenre: (genreId: string) => Promise<boolean>;
  isFavoriteArtist: (artistId: string) => boolean;
  isFavoriteGenre: (genreId: string) => boolean;
}

export const usePreferenceStore = create<PreferenceState>((set, get) => ({
  favoriteArtists: [],
  favoriteGenres: [],
  loading: false,
  error: null,

  fetchPreferences: async () => {
    set({ loading: true, error: null });
    const { favoriteArtists, favoriteGenres, error } = await fetchUserPreferencesApi();

    if (error) {
      set({ error, loading: false });
    } else {
      set({ favoriteArtists, favoriteGenres, loading: false });
    }
  },

  addArtist: async (artist: Artist) => {
    const current = get().favoriteArtists;
    if (current.some((a) => a._id === artist._id)) return true;

    // Optimistic UI update
    set({ favoriteArtists: [artist, ...current] });

    const { favoriteArtists: updated, error } = await addFavoriteArtistApi(artist._id);
    if (error || !updated) {
      set({ favoriteArtists: current });
      return false;
    }

    set({ favoriteArtists: updated });
    return true;
  },

  removeArtist: async (artistId: string) => {
    const current = get().favoriteArtists;
    // Optimistic UI update
    set({ favoriteArtists: current.filter((a) => a._id !== artistId) });

    const { favoriteArtists: updated, error } = await removeFavoriteArtistApi(artistId);
    if (error || !updated) {
      set({ favoriteArtists: current });
      return false;
    }

    set({ favoriteArtists: updated });
    return true;
  },

  addGenre: async (genre: Genre) => {
    const current = get().favoriteGenres;
    if (current.some((g) => g._id === genre._id)) return true;

    // Optimistic UI update
    set({ favoriteGenres: [genre, ...current] });

    const { favoriteGenres: updated, error } = await addFavoriteGenreApi(genre._id);
    if (error || !updated) {
      set({ favoriteGenres: current });
      return false;
    }

    set({ favoriteGenres: updated });
    return true;
  },

  removeGenre: async (genreId: string) => {
    const current = get().favoriteGenres;
    // Optimistic UI update
    set({ favoriteGenres: current.filter((g) => g._id !== genreId) });

    const { favoriteGenres: updated, error } = await removeFavoriteGenreApi(genreId);
    if (error || !updated) {
      set({ favoriteGenres: current });
      return false;
    }

    set({ favoriteGenres: updated });
    return true;
  },

  isFavoriteArtist: (artistId: string) => {
    return get().favoriteArtists.some((a) => a._id === artistId);
  },

  isFavoriteGenre: (genreId: string) => {
    return get().favoriteGenres.some((g) => g._id === genreId);
  },
}));
