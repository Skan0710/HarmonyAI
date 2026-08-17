export enum ContextMood {
  Chill = 'Chill',
  Energetic = 'Energetic',
  Melancholic = 'Melancholic',
  Upbeat = 'Upbeat',
  Focus = 'Focus',
  Relaxed = 'Relaxed',
  Party = 'Party',
  Romantic = 'Romantic',
}

export enum ContextActivity {
  Workout = 'Workout',
  Study = 'Study',
  Commute = 'Commute',
  Relaxing = 'Relaxing',
  Party = 'Party',
  Sleeping = 'Sleeping',
  Coding = 'Coding',
  Cooking = 'Cooking',
}

export enum ContextTimeOfDay {
  Morning = 'Morning',
  Afternoon = 'Afternoon',
  Evening = 'Evening',
  Night = 'Night',
  LateNight = 'LateNight',
}

export enum ContextInstrumentalPreference {
  Any = 'Any',
  VocalOnly = 'VocalOnly',
  InstrumentalOnly = 'InstrumentalOnly',
  MostlyInstrumental = 'MostlyInstrumental',
}

export interface ContextPreference {
  mood?: ContextMood;
  activity?: ContextActivity;
  energyLevel?: number; // 0.0 to 1.0
  timeOfDay?: ContextTimeOfDay;
  preferredDurationMinutes?: number; // 1 to 300
  language?: string;
  instrumentalPreference?: ContextInstrumentalPreference;
}

export const DEFAULT_CONTEXT_PREFERENCE: ContextPreference = {
  mood: undefined,
  activity: undefined,
  energyLevel: 0.5,
  timeOfDay: undefined,
  preferredDurationMinutes: 30,
  language: undefined,
  instrumentalPreference: ContextInstrumentalPreference.Any,
};

/**
 * Helper to check if a value exists in an Enum values array.
 */
function parseEnum<T extends Record<string, string>>(enumObj: T, val: any): T[keyof T] | undefined {
  if (typeof val !== 'string') return undefined;
  const matchKey = Object.keys(enumObj).find(
    (k) => enumObj[k].toLowerCase() === val.trim().toLowerCase()
  );
  return matchKey ? (enumObj[matchKey] as T[keyof T]) : undefined;
}

/**
 * Clamps a numeric value strictly between min and max bounds.
 */
function clampNumber(val: any, min: number, max: number, defaultValue?: number): number | undefined {
  if (val === undefined || val === null) return defaultValue;
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return defaultValue;
  return Number(Math.max(min, Math.min(max, num)).toFixed(4));
}

/**
 * Validates and sanitizes raw input into a valid ContextPreference object with controlled enums and bounded values.
 */
export function validateAndSanitizeContextPreference(raw: any): ContextPreference {
  const input = raw && typeof raw === 'object' ? raw : {};

  const mood = parseEnum(ContextMood, input.mood);
  const activity = parseEnum(ContextActivity, input.activity);
  const timeOfDay = parseEnum(ContextTimeOfDay, input.timeOfDay);
  const instrumentalPreference =
    parseEnum(ContextInstrumentalPreference, input.instrumentalPreference) ||
    ContextInstrumentalPreference.Any;

  const energyLevel = clampNumber(input.energyLevel, 0.0, 1.0, undefined);
  const preferredDurationMinutes = clampNumber(input.preferredDurationMinutes, 1, 300, undefined);

  const language =
    typeof input.language === 'string' && input.language.trim()
      ? input.language.trim()
      : undefined;

  return {
    mood,
    activity,
    energyLevel,
    timeOfDay,
    preferredDurationMinutes: preferredDurationMinutes ? Math.round(preferredDurationMinutes) : undefined,
    language,
    instrumentalPreference,
  };
}
