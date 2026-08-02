import { create } from 'zustand';
import { apiClient } from '../services/api';

export interface User {
  id: string;
  name: string;
  email: string;
  profilePicture?: string;
  createdAt: string;
}

interface AuthResponse {
  success: boolean;
  message?: string;
  data?: {
    user: User;
    token: string;
  };
}

interface UserProfileResponse {
  success: boolean;
  data?: User;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: { email: string; password?: string }) => Promise<boolean>;
  register: (userData: { name: string; email: string; password?: string }) => Promise<boolean>;
  logout: () => void;
  fetchCurrentUser: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('harmonyai_token'),
  isAuthenticated: !!localStorage.getItem('harmonyai_token'),
  isLoading: true,
  error: null,

  login: async (credentials) => {
    set({ isLoading: true, error: null });
    const response = await apiClient<AuthResponse['data']>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (response.error || !response.data) {
      set({
        isLoading: false,
        error: response.error || 'Failed to login',
        isAuthenticated: false,
      });
      return false;
    }

    const { user, token } = response.data;
    localStorage.setItem('harmonyai_token', token);
    set({
      user,
      token,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
    return true;
  },

  register: async (userData) => {
    set({ isLoading: true, error: null });
    const response = await apiClient<AuthResponse['data']>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });

    if (response.error || !response.data) {
      set({
        isLoading: false,
        error: response.error || 'Failed to register',
        isAuthenticated: false,
      });
      return false;
    }

    const { user, token } = response.data;
    localStorage.setItem('harmonyai_token', token);
    set({
      user,
      token,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
    return true;
  },

  logout: () => {
    localStorage.removeItem('harmonyai_token');
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  },

  fetchCurrentUser: async () => {
    const token = get().token;
    if (!token) {
      set({ isLoading: false, isAuthenticated: false, user: null });
      return;
    }

    set({ isLoading: true });
    const response = await apiClient<UserProfileResponse['data']>('/users/me');

    if (response.error || !response.data) {
      // Token invalid or expired
      localStorage.removeItem('harmonyai_token');
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
    } else {
      set({
        user: response.data,
        isAuthenticated: true,
        isLoading: false,
      });
    }
  },

  clearError: () => set({ error: null }),
}));
