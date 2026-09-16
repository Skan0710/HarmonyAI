import { create } from 'zustand';
import { apiClient } from '../services/api';

export interface User {
  id: string;
  name: string;
  email: string;
  profilePicture?: string;
  role?: string;
  createdAt: string;
}

interface AuthResponseData {
  success: boolean;
  data: {
    user: User;
    token?: string;
  };
}

interface UserProfileResponseData {
  success: boolean;
  data: {
    id: string;
    name: string;
    email: string;
    profilePicture?: string;
    role?: string;
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

    const { user, token } = response.data.data;
    if (token) {
      localStorage.setItem('harmonyai_token', token);
    }

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

    const { user, token } = response.data.data;
    if (token) {
      localStorage.setItem('harmonyai_token', token);
    }

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
    localStorage.removeItem('harmonyai_token');
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
      if (response.status === 401) {
        localStorage.removeItem('harmonyai_token');
      }
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
