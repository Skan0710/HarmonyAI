export type TempoPreferenceType = 'slow' | 'medium' | 'fast' | number;

export interface AIPlaylistPreference {
  title: string;
  description: string;
  requestedMood?: string;
  genres: string[];
  artists: string[];
  language?: string;
  energyLevel: number; // 0.0 to 1.0
  tempoPreference: TempoPreferenceType; // 'slow'|'medium'|'fast' or BPM number
  acousticPreference: number; // 0.0 to 1.0
  instrumentalPreference: number; // 0.0 to 1.0
  requestedSongCount: number; // 1 to 50
  excludedArtists: string[];
  excludedGenres: string[];
  searchKeywords: string[];
}

export const DEFAULT_PLAYLIST_PREFERENCES: AIPlaylistPreference = {
  title: 'Custom AI Playlist',
  description: 'AI-curated music selection based on your prompt.',
  requestedMood: undefined,
  genres: [],
  artists: [],
  language: undefined,
  energyLevel: 0.5,
  tempoPreference: 'medium',
  acousticPreference: 0.5,
  instrumentalPreference: 0.1,
  requestedSongCount: 12,
  excludedArtists: [],
  excludedGenres: [],
  searchKeywords: [],
};

/**
 * Sanitizes an input array by removing empty, non-string, or duplicate entries.
 */
function sanitizeStringArray(arr: any): string[] {
  if (!Array.isArray(arr)) return [];
  const set = new Set<string>();
  for (const item of arr) {
    if (typeof item === 'string' && item.trim()) {
      set.add(item.trim());
    }
  }
  return Array.from(set);
}

/**
 * Clamps a numeric value strictly between min and max bounds, returning defaultValue if invalid.
 */
function clampNumber(val: any, min: number, max: number, defaultValue: number): number {
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return defaultValue;
  return Number(Math.max(min, Math.min(max, num)).toFixed(4));
}

/**
 * Validates and sanitizes raw AI-extracted playlist preference objects, providing sensible
 * default values for optional fields and enforcing strict type/numeric bounds before objects
 * reach recommendation engines.
 */
export function validateAndSanitizePlaylistPreference(raw: any): AIPlaylistPreference {
  const input = raw && typeof raw === 'object' ? raw : {};

  const title =
    typeof input.title === 'string' && input.title.trim()
      ? input.title.trim()
      : DEFAULT_PLAYLIST_PREFERENCES.title;

  const description =
    typeof input.description === 'string' && input.description.trim()
      ? input.description.trim()
      : DEFAULT_PLAYLIST_PREFERENCES.description;

  const requestedMood =
    typeof input.requestedMood === 'string' && input.requestedMood.trim()
      ? input.requestedMood.trim()
      : input.targetMood && typeof input.targetMood === 'string'
      ? input.targetMood.trim()
      : undefined;

  const genres = sanitizeStringArray(input.genres || input.targetGenres);
  const artists = sanitizeStringArray(input.artists || input.targetArtists);
  const language =
    typeof input.language === 'string' && input.language.trim()
      ? input.language.trim()
      : undefined;

  const energyLevel = clampNumber(
    input.energyLevel ?? input.desiredEnergy,
    0.0,
    1.0,
    DEFAULT_PLAYLIST_PREFERENCES.energyLevel
  );

  let tempoPreference: TempoPreferenceType = DEFAULT_PLAYLIST_PREFERENCES.tempoPreference;
  if (typeof input.tempoPreference === 'string' && ['slow', 'medium', 'fast'].includes(input.tempoPreference.toLowerCase())) {
    tempoPreference = input.tempoPreference.toLowerCase() as any;
  } else if (typeof input.desiredTempoBpm === 'number' && !isNaN(input.desiredTempoBpm)) {
    tempoPreference = Math.max(30, Math.min(300, input.desiredTempoBpm));
  } else if (typeof input.tempoPreference === 'number' && !isNaN(input.tempoPreference)) {
    tempoPreference = Math.max(30, Math.min(300, input.tempoPreference));
  }

  const acousticPreference = clampNumber(
    input.acousticPreference,
    0.0,
    1.0,
    DEFAULT_PLAYLIST_PREFERENCES.acousticPreference
  );

  const instrumentalPreference = clampNumber(
    input.instrumentalPreference,
    0.0,
    1.0,
    DEFAULT_PLAYLIST_PREFERENCES.instrumentalPreference
  );

  const rawCount = input.requestedSongCount ?? input.suggestedTrackCount;
  const requestedSongCount = Math.round(
    clampNumber(rawCount, 1, 50, DEFAULT_PLAYLIST_PREFERENCES.requestedSongCount)
  );

  const excludedArtists = sanitizeStringArray(input.excludedArtists);
  const excludedGenres = sanitizeStringArray(input.excludedGenres);
  const searchKeywords = sanitizeStringArray(input.searchKeywords);

  return {
    title,
    description,
    requestedMood,
    genres,
    artists,
    language,
    energyLevel,
    tempoPreference,
    acousticPreference,
    instrumentalPreference,
    requestedSongCount,
    excludedArtists,
    excludedGenres,
    searchKeywords,
  };
}
