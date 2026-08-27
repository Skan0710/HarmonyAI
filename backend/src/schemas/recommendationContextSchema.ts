export enum StandardListeningSituation {
  Study = 'study',
  Work = 'work',
  Workout = 'workout',
  Relaxation = 'relaxation',
  Commute = 'commute',
  Party = 'party',
  Sleep = 'sleep',
  Focus = 'focus',
  GeneralListening = 'general_listening',
}

export type ListeningSituationType =
  | 'study'
  | 'work'
  | 'workout'
  | 'relaxation'
  | 'commute'
  | 'party'
  | 'sleep'
  | 'focus'
  | 'general_listening'
  | string;

export interface RecommendationContextAttributes {
  situation?: ListeningSituationType;
  mood?: string;
  desiredEnergy?: number; // strictly 0.0 to 1.0
  desiredTempo?: number; // 30 to 250 BPM
  preferredGenres?: string[];
  discoveryLevel?: number; // strictly 0.0 to 1.0 (0 = high familiarity, 1 = high novelty/exploration)
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night' | 'late_night' | string;
  targetDurationMinutes?: number; // 1 to 480 minutes
  metadata?: Record<string, any>;
}

export interface RecommendationContextValidationResult {
  isValid: boolean;
  errors: string[];
  sanitized: RecommendationContextAttributes;
}

export const STANDARD_SITUATIONS: StandardListeningSituation[] = [
  StandardListeningSituation.Study,
  StandardListeningSituation.Work,
  StandardListeningSituation.Workout,
  StandardListeningSituation.Relaxation,
  StandardListeningSituation.Commute,
  StandardListeningSituation.Party,
  StandardListeningSituation.Sleep,
  StandardListeningSituation.Focus,
  StandardListeningSituation.GeneralListening,
];

/**
 * Normalizes input situation string to standard format or preserves extensible custom string.
 * Handles aliases such as 'general listening' -> 'general_listening', 'studying' -> 'study', 'working' -> 'work'.
 */
export function normalizeListeningSituation(situation: any): string | undefined {
  if (typeof situation !== 'string' || !situation.trim()) {
    return undefined;
  }

  const clean = situation.trim().toLowerCase().replace(/[-\s]+/g, '_');

  switch (clean) {
    case 'study':
    case 'studying':
    case 'homework':
      return StandardListeningSituation.Study;

    case 'work':
    case 'working':
    case 'office':
    case 'coding':
      return StandardListeningSituation.Work;

    case 'workout':
    case 'exercise':
    case 'gym':
    case 'running':
    case 'fitness':
      return StandardListeningSituation.Workout;

    case 'relaxation':
    case 'relax':
    case 'relaxing':
    case 'chill':
    case 'unwind':
      return StandardListeningSituation.Relaxation;

    case 'commute':
    case 'commuting':
    case 'driving':
    case 'transit':
    case 'travel':
      return StandardListeningSituation.Commute;

    case 'party':
    case 'celebration':
    case 'club':
    case 'social':
      return StandardListeningSituation.Party;

    case 'sleep':
    case 'sleeping':
    case 'bedtime':
    case 'nap':
      return StandardListeningSituation.Sleep;

    case 'focus':
    case 'deep_focus':
    case 'concentration':
      return StandardListeningSituation.Focus;

    case 'general':
    case 'general_listening':
    case 'casual':
    case 'daily':
      return StandardListeningSituation.GeneralListening;

    default:
      // Return trimmed custom situation for extensibility
      return situation.trim();
  }
}

/**
 * Helper to clamp numeric attributes within bounded limits.
 */
function clampNumber(val: any, min: number, max: number, defaultVal?: number): number | undefined {
  if (val === undefined || val === null || val === '') return defaultVal;
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num) || !Number.isFinite(num)) return defaultVal;
  return Number(Math.max(min, Math.min(max, num)).toFixed(4));
}

/**
 * Validates and sanitizes any raw context input into a clean, typed RecommendationContextAttributes structure.
 */
export function validateAndSanitizeRecommendationContext(
  raw: any
): RecommendationContextValidationResult {
  const errors: string[] = [];
  const input = raw && typeof raw === 'object' ? raw : {};

  // 1. Situation validation & normalization
  const situation = normalizeListeningSituation(input.situation || input.contextType || input.activity);

  // 2. Mood sanitization
  let mood: string | undefined = undefined;
  if (typeof input.mood === 'string' && input.mood.trim()) {
    mood = input.mood.trim();
  } else if (input.mood && typeof input.mood === 'object' && input.mood.name) {
    mood = String(input.mood.name).trim();
  }

  // 3. Desired Energy validation [0.0, 1.0]
  let desiredEnergy: number | undefined = undefined;
  if (input.desiredEnergy !== undefined && input.desiredEnergy !== null && input.desiredEnergy !== '') {
    const rawVal = typeof input.desiredEnergy === 'number' ? input.desiredEnergy : parseFloat(input.desiredEnergy);
    if (isNaN(rawVal) || !Number.isFinite(rawVal)) {
      errors.push('desiredEnergy must be a valid finite number between 0.0 and 1.0');
    } else {
      desiredEnergy = clampNumber(rawVal, 0.0, 1.0);
    }
  } else if (input.energyLevel !== undefined && input.energyLevel !== null && input.energyLevel !== '') {
    desiredEnergy = clampNumber(input.energyLevel, 0.0, 1.0);
  }

  // 4. Desired Tempo validation [30, 250] BPM
  let desiredTempo: number | undefined = undefined;
  if (input.desiredTempo !== undefined && input.desiredTempo !== null && input.desiredTempo !== '') {
    const rawVal = typeof input.desiredTempo === 'number' ? input.desiredTempo : parseFloat(input.desiredTempo);
    if (isNaN(rawVal) || !Number.isFinite(rawVal)) {
      errors.push('desiredTempo must be a valid finite number between 30 and 250 BPM');
    } else {
      desiredTempo = clampNumber(rawVal, 30, 250);
    }
  } else if (input.targetTempo !== undefined && input.targetTempo !== null && input.targetTempo !== '') {
    desiredTempo = clampNumber(input.targetTempo, 30, 250);
  }

  // 5. Discovery Level validation [0.0, 1.0]
  let discoveryLevel: number | undefined = undefined;
  if (input.discoveryLevel !== undefined && input.discoveryLevel !== null && input.discoveryLevel !== '') {
    const rawVal = typeof input.discoveryLevel === 'number' ? input.discoveryLevel : parseFloat(input.discoveryLevel);
    if (isNaN(rawVal) || !Number.isFinite(rawVal)) {
      errors.push('discoveryLevel must be a valid finite number between 0.0 and 1.0');
    } else {
      discoveryLevel = clampNumber(rawVal, 0.0, 1.0);
    }
  }

  // 6. Preferred Genres validation
  let preferredGenres: string[] | undefined = undefined;
  const rawGenres = input.preferredGenres || input.genres || input.sessionGenres;
  if (Array.isArray(rawGenres)) {
    const validGenres = rawGenres
      .map((g) => (typeof g === 'string' ? g.trim() : typeof g === 'object' && g?.name ? String(g.name).trim() : ''))
      .filter((g) => g.length > 0);
    if (validGenres.length > 0) {
      preferredGenres = Array.from(new Set(validGenres));
    }
  } else if (typeof rawGenres === 'string' && rawGenres.trim()) {
    preferredGenres = [rawGenres.trim()];
  }

  // 7. Time of Day sanitization
  let timeOfDay: string | undefined = undefined;
  if (typeof input.timeOfDay === 'string' && input.timeOfDay.trim()) {
    timeOfDay = input.timeOfDay.trim().toLowerCase();
  }

  // 8. Target Duration Minutes validation [1, 480]
  let targetDurationMinutes: number | undefined = undefined;
  if (input.targetDurationMinutes !== undefined || input.preferredDurationMinutes !== undefined) {
    const rawDur = input.targetDurationMinutes ?? input.preferredDurationMinutes;
    targetDurationMinutes = clampNumber(rawDur, 1, 480);
  }

  // 9. Extensible Metadata
  const metadata: Record<string, any> =
    input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
      ? { ...input.metadata }
      : {};

  const sanitized: RecommendationContextAttributes = {
    situation,
    mood,
    desiredEnergy,
    desiredTempo,
    preferredGenres,
    discoveryLevel,
    timeOfDay,
    targetDurationMinutes,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
}
