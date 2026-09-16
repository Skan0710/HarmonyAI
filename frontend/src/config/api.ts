const rawBaseUrl: string =
  (import.meta.env.VITE_API_BASE_URL as string) ||
  (import.meta.env.VITE_API_URL as string) ||
  'http://localhost:5000/api';

const cleanBaseUrl = rawBaseUrl.replace(/\/+$/, '');
const normalizedBaseUrl = cleanBaseUrl.endsWith('/api') ? cleanBaseUrl : `${cleanBaseUrl}/api`;

export const API_CONFIG = {
  baseURL: normalizedBaseUrl,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
};
