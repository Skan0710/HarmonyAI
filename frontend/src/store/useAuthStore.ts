import { create } from 'zustand';
import { apiClient } from '../services/api';

export interface User {
  id: string;
  name: string;
  email: string;
  profilePicture?: string;
  createdAt: string;
}

interface AuthResponseData {
  success: boolean;
  data: {
    user: User;
  };
}

interface UserProfileResponseData {
  success: boolean;
  data: {
    id: string;
    name: string;
    email: string;
    profilePicture?: string;
    createdAt: string;
  };
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitializing: boolean;
  error: string | null;
  login: (credentials: { email: string; password?: string }) => Promise<boolean>;
  register: (userData: { name: string; email: string; password?: string }) => Promise<boolean>;
  logout: () => Promise<void>;
  fetchCurrentUser: () => Promise<void>;
  updateUser: (partial: Partial<User>) => void;
  clearError: () => void;
}

// The session token lives only in an httpOnly cookie the browser manages —
// there is nothing for this store to read synchronously on init, so auth
// state starts unknown and is resolved by fetchCurrentUser() on app mount.
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isInitializing: true,
  error: null,

  login: async (credentials) => {
    set({ isLoading: true, error: null });
    const response = await apiClient<AuthResponseData>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (response.error || !response.data?.data) {
      set({
        isLoading: false,
        error: response.error || 'Failed to authenticate.',
        isAuthenticated: false,
      });
      return false;
    }

    const { user } = response.data.data;

    set({
      user,
      isAuthenticated: true,
      isLoading: false,
      isInitializing: false,
      error: null,
    });
    return true;
  },

  register: async (userData) => {
    set({ isLoading: true, error: null });
    const response = await apiClient<AuthResponseData>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });

    if (response.error || !response.data?.data) {
      set({
        isLoading: false,
        error: response.error || 'Failed to create account.',
        isAuthenticated: false,
      });
      return false;
    }

    const { user } = response.data.data;

    set({
      user,
      isAuthenticated: true,
      isLoading: false,
      isInitializing: false,
      error: null,
    });
    return true;
  },

  logout: async () => {
    // Clears the httpOnly cookie server-side — client JS has no way to read
    // or remove it itself, so this request is the only thing that can
    // actually end the session before its 7-day expiry.
    await apiClient('/auth/logout', { method: 'POST' });
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isInitializing: false,
      error: null,
    });
  },

  fetchCurrentUser: async () => {
    set({ isLoading: true });
    const response = await apiClient<UserProfileResponseData>('/users/me');

    if (response.error || !response.data?.data) {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        isInitializing: false,
      });
    } else {
      set({
        user: response.data.data,
        isAuthenticated: true,
        isLoading: false,
        isInitializing: false,
      });
    }
  },

  updateUser: (partial) => {
    const current = get().user;
    if (current) {
      set({ user: { ...current, ...partial } });
    }
  },

  clearError: () => set({ error: null }),
}));
