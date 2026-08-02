import { API_CONFIG } from '../config/api';
import { getToken } from '../utils/token';

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  status: number;
}

export const apiClient = async <T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> => {
  const url = `${API_CONFIG.baseURL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const token = getToken();
  const authHeaders: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...API_CONFIG.headers,
        ...authHeaders,
        ...options.headers,
      },
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      let errorMessage = data?.message || `Request failed with status ${response.status}`;
      if (response.status === 401) {
        errorMessage = data?.message || 'Authentication session expired. Please sign in again.';
      } else if (response.status === 403) {
        errorMessage = 'You do not have permission to access this resource.';
      } else if (response.status === 500) {
        errorMessage = 'Internal server error. Please try again later.';
      }

      return {
        error: errorMessage,
        status: response.status,
      };
    }

    return {
      data: data as T,
      status: response.status,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Network connection error. Please check your backend server.',
      status: 500,
    };
  }
};
