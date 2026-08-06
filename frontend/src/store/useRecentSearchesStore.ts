import { create } from 'zustand';

const STORAGE_KEY = 'harmony_recent_searches';
const MAX_RECENT = 10;

const getStoredSearches = (): string[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => typeof item === 'string' && item.trim());
      }
    }
  } catch {}
  return [];
};

interface RecentSearchesState {
  recentSearches: string[];
  addSearch: (query: string) => void;
  removeSearch: (query: string) => void;
  clearAllSearches: () => void;
}

export const useRecentSearchesStore = create<RecentSearchesState>((set, get) => ({
  recentSearches: getStoredSearches(),

  addSearch: (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    const current = get().recentSearches;
    // Remove if already exists and prepend to front
    const filtered = current.filter((item) => item.toLowerCase() !== trimmed.toLowerCase());
    const updated = [trimmed, ...filtered].slice(0, MAX_RECENT);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}

    set({ recentSearches: updated });
  },

  removeSearch: (query: string) => {
    const current = get().recentSearches;
    const updated = current.filter((item) => item.toLowerCase() !== query.toLowerCase());

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}

    set({ recentSearches: updated });
  },

  clearAllSearches: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}

    set({ recentSearches: [] });
  },
}));
