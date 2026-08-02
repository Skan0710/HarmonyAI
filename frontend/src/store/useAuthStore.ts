import { create } from 'zustand';
import { apiClient } from '../services/api';
import { getToken, setToken, removeToken } from '../utils/token';

export interface User {
  id: string;
  name: string;
  email: string;
  profilePicture?: string;
  createdAt: string;
}

interface AuthResponseData {
  user: User;
  token: string;
}

interface UserProfileResponseData {
  id: string;
  name: string;
  email: string;
  profilePicture?: string;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitializing: boolean;
  error: string | null;
  login: (credentials: { email: string; password?: string }) => Promise<boolean>;
  register: (userData: { name: string; email: string; password?: string }) => Promise<boolean>;
  logout: () => void;
  fetchCurrentUser: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: getToken(),
  isAuthenticated: !!getToken(),
  isLoading: false,
  isInitializing: true,
  error: null,

  login: async (credentials) => {
    set({ isLoading: true, error: null });
    const response = await apiClient<AuthResponseData>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (response.error || !response.data) {
      set({
        isLoading: false,
        error: response.error || 'Failed to authenticate.',
        isAuthenticated: false,
      });
      return false;
    }

    const { user, token } = response.data;
    setToken(token);

    set({
      user,
      token,
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

    if (response.error || !response.data) {
      set({
        isLoading: false,
        error: response.error || 'Failed to create account.',
        isAuthenticated: false,
      });
      return false;
    }

    const { user, token } = response.data;
    setToken(token);

    set({
      user,
      token,
      isAuthenticated: true,
      isLoading: false,
      isInitializing: false,
      error: null,
    });
    return true;
  },

  logout: () => {
    removeToken();
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      isInitializing: false,
      error: null,
    });
  },

  fetchCurrentUser: async () => {
    const token = getToken();
    if (!token) {
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        isInitializing: false,
      });
      return;
    }

    set({ isLoading: true });
    const response = await apiClient<UserProfileResponseData>('/users/me');

    if (response.error || !response.data) {
      // Invalid/expired token -> clear auth state
      removeToken();
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        isInitializing: false,
      });
    } else {
      set({
        user: response.data,
        isAuthenticated: true,
        isLoading: false,
        isInitializing: false,
      });
    }
  },

  clearError: () => set({ error: null }),
}));
