import { Types } from 'mongoose';
import {
  StandardListeningSituation,
  ListeningSituationType,
  normalizeListeningSituation,
} from './recommendationContextSchema.js';
import { ContextMood } from './contextPreferenceSchema.js';
import { TemporalTimeWindow, normalizeTimeWindow } from '../models/TemporalPreference.js';
import { IAudioFeatures } from '../models/Song.js';

export interface MusicDNAGenrePreference {
  genre?: Types.ObjectId | string;
  name: string;
  affinityScore: number; // 0.0 to 1.0
  playCount: number;
  lastInteractionAt?: Date;
}

export interface MusicDNAArtistPreference {
  artist?: Types.ObjectId | string;
  name: string;
  affinityScore: number; // 0.0 to 1.0
  playCount: number;
  lastInteractionAt?: Date;
}

export interface MusicDNAMoodPreference {
  mood: ContextMood | string;
  affinityScore: number; // 0.0 to 1.0
  playCount: number;
  lastInteractionAt?: Date;
}

export interface MusicDNAListeningPatterns {
  timeOfDayDistribution?: {
    morning?: number;
    afternoon?: number;
    evening?: number;
    night?: number;
    late_night?: number;
    [key: string]: number | undefined;
  };
  avgSessionDurationMinutes?: number;
  skipRate?: number; // 0.0 to 1.0
  completionRate?: number; // 0.0 to 1.0
  replayRate?: number; // 0.0 to 1.0
  preferredSituations?: (ListeningSituationType | string)[];
  audioFeaturePreferences?: Partial<IAudioFeatures>;
  preferredTempo?: {
    min?: number;
    max?: number;
    target?: number;
  };
}

export interface MusicDNATendencyDimensions {
  discoveryTendency: number; // 0.0 (prefers known/familiar) to 1.0 (seeks new discoveries)
  familiarityPreference: number; // 0.0 (craves novelty) to 1.0 (comfort in frequent favorites)
  diversityPreference: number; // 0.0 (narrow niche) to 1.0 (broad eclecticism)
  explorationPreference: number; // 0.0 (pure exploitation) to 1.0 (active exploratory branching)
}

export interface MusicDNATemporalWindowPreference {
  window: TemporalTimeWindow;
  topGenres: string[];
  topArtists: string[];
  topMoods: string[];
  score: number; // 0.0 to 1.0
}

export interface MusicDNATemporalTaste {
  stabilityScore?: number; // 0.0 (dynamic shift) to 1.0 (stable rock-solid taste)
  activeTimeWindow?: TemporalTimeWindow;
  trendingGenres?: string[];
  emergingGenres?: string[];
  decliningGenres?: string[];
  temporalAffinities?: MusicDNATemporalWindowPreference[];
  lastCalculatedAt?: Date;
}

export interface MusicDNAProfileAttributes {
  userId: Types.ObjectId | string;
  dnaVersion: string;
  genres: MusicDNAGenrePreference[];
  artists: MusicDNAArtistPreference[];
  moods: MusicDNAMoodPreference[];
  listeningPatterns: MusicDNAListeningPatterns;
  tendencies: MusicDNATendencyDimensions;
  temporalTaste: MusicDNATemporalTaste;
  confidenceScore: number; // 0.0 to 1.0 reflecting data sufficiency
  metadata?: Record<string, any>;
}

export type PreferenceEvolutionType = 'established' | 'emerging' | 'rising' | 'cooling' | 'stable';

export interface DetailedTasteItem {
  id?: string;
  name: string;
  score: number; // Normalized [0.0, 1.0]
  preferenceType: PreferenceEvolutionType;
  playCount: number;
  shortTermScore: number; // Normalized [0.0, 1.0]
  longTermScore: number; // Normalized [0.0, 1.0]
  momentumDelta: number; // shortTermScore - longTermScore
  explanation: string;
}

export type DiversityLevel = 'low' | 'moderate' | 'high' | 'very_high';

export interface DiversityMetric {
  score: number; // Normalized [0.0, 1.0]
  effectiveCount: number;
  normalizedEntropy: number; // [0.0, 1.0]
  level: DiversityLevel;
  summary: string;
}

export interface DetailedMusicDNAProfile {
  userId: string;
  dnaVersion: string;
  topGenres: DetailedTasteItem[];
  emergingGenres: DetailedTasteItem[];
  strongestArtists: DetailedTasteItem[];
  emergingArtists: DetailedTasteItem[];
  preferredMoods: DetailedTasteItem[];
  genreDiversity: DiversityMetric;
  artistDiversity: DiversityMetric;
  temporalOverview: {
    stabilityScore: number;
    activeWindow: TemporalTimeWindow;
    establishedTasteSummary: string;
    emergingTasteSummary: string;
  };
  confidenceScore: number;
  generatedAt: Date;
  metadata?: Record<string, any>;
}

export type ListenerArchetype =
  | 'Loyalist'
  | 'Adventurer'
  | 'Eclectic Nomad'
  | 'Restless Searcher'
  | 'Focused Devotee'
  | 'Casual Listener'
  | 'Balanced Listener';

export interface BehavioralMetricsBreakdown {
  totalPlaysAnalyzed: number;
  uniqueTracksCount: number;
  uniqueArtistsCount: number;
  uniqueGenresCount: number;
  totalSessionsAnalyzed: number;
  avgTracksPerSession: number;
  avgSessionDurationMinutes: number;
  skipRatio: number;
  completionRatio: number;
  replayRatio: number;
  feedbackCount?: number;
}

export interface MusicDNAListeningBehaviorProfile {
  userId: string;
  repeatListeningTendency: number; // [0.0, 1.0]
  discoveryTendency: number; // [0.0, 1.0]
  skipTendency: number; // [0.0, 1.0]
  familiarityPreference: number; // [0.0, 1.0]
  explorationTendency: number; // [0.0, 1.0]
  diversityPreference: number; // [0.0, 1.0]
  sessionListeningIntensity: number; // [0.0, 1.0]
  preferenceStability: number; // [0.0, 1.0]
  preferenceChangeRate: number; // [0.0, 1.0]
  listenerArchetype: ListenerArchetype;
  isDataSufficient: boolean;
  metricsBreakdown: BehavioralMetricsBreakdown;
  confidenceScore: number; // [0.0, 1.0]
  generatedAt: Date;
  metadata?: Record<string, any>;
}

export interface UnifiedGenreProfile {
  topGenres: DetailedTasteItem[];
  emergingGenres: DetailedTasteItem[];
  diversity: DiversityMetric;
}

export interface UnifiedArtistProfile {
  strongestArtists: DetailedTasteItem[];
  emergingArtists: DetailedTasteItem[];
  diversity: DiversityMetric;
}

export interface UnifiedMoodProfile {
  preferredMoods: DetailedTasteItem[];
}

export interface UnifiedMusicDNA {
  userId: string;
  dnaVersion: string;
  genreProfile: UnifiedGenreProfile;
  artistProfile: UnifiedArtistProfile;
  moodProfile: UnifiedMoodProfile;
  listeningBehavior: MusicDNAListeningBehaviorProfile;
  temporalPreferences: MusicDNATemporalTaste;
  tendencies: MusicDNATendencyDimensions;
  listeningPatterns: MusicDNAListeningPatterns;
  confidenceScore: number;
  lastRefreshedAt: Date;
  interactionsCountAtLastRefresh: number;
  metadata?: Record<string, any>;
}

export interface UnifiedRefreshResult {
  profile: UnifiedMusicDNA;
  refreshed: boolean;
  reason: string;
}

export interface MusicDNAValidationResult {
  isValid: boolean;
  errors: string[];
  sanitized: MusicDNAProfileAttributes;
}

export const DEFAULT_TENDENCY_DIMENSIONS: MusicDNATendencyDimensions = {
  discoveryTendency: 0.5,
  familiarityPreference: 0.5,
  diversityPreference: 0.5,
  explorationPreference: 0.5,
};

export const DEFAULT_LISTENING_PATTERNS: MusicDNAListeningPatterns = {
  timeOfDayDistribution: {
    morning: 0.2,
    afternoon: 0.25,
    evening: 0.35,
    night: 0.15,
    late_night: 0.05,
  },
  avgSessionDurationMinutes: 30,
  skipRate: 0.15,
  completionRate: 0.85,
  replayRate: 0.2,
  preferredSituations: [StandardListeningSituation.GeneralListening],
  audioFeaturePreferences: {
    energy: 0.5,
    danceability: 0.5,
    valence: 0.5,
    acousticness: 0.3,
    instrumentalness: 0.2,
  },
  preferredTempo: {
    min: 80,
    max: 140,
    target: 115,
  },
};

export const DEFAULT_TEMPORAL_TASTE: MusicDNATemporalTaste = {
  stabilityScore: 0.7,
  activeTimeWindow: 'medium_term',
  trendingGenres: [],
  emergingGenres: [],
  decliningGenres: [],
  temporalAffinities: [],
  lastCalculatedAt: new Date(),
};

/**
 * Clamps a numeric value safely between min and max bounds.
 */
export function clampNumber(
  val: any,
  min: number,
  max: number,
  defaultValue?: number
): number | undefined {
  if (val === undefined || val === null || val === '') return defaultValue;
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num) || !Number.isFinite(num)) return defaultValue;
  return Number(Math.max(min, Math.min(max, num)).toFixed(4));
}

/**
 * Validates and sanitizes raw input into typed, bounded Music DNA attributes.
 */
export function validateAndSanitizeMusicDNA(raw: any): MusicDNAValidationResult {
  const errors: string[] = [];
  const input = raw && typeof raw === 'object' ? raw : {};

  // 1. User ID validation
  let userId = input.userId || input.user;
  if (!userId) {
    errors.push('userId is required');
  }

  // 2. DNA Version
  const dnaVersion =
    typeof input.dnaVersion === 'string' && input.dnaVersion.trim()
      ? input.dnaVersion.trim()
      : '1.0.0';

  // 3. Tendency Dimensions validation [0.0, 1.0]
  const rawTendencies = input.tendencies || {};
  const discoveryTendency = clampNumber(
    rawTendencies.discoveryTendency ?? input.discoveryTendency,
    0.0,
    1.0,
    DEFAULT_TENDENCY_DIMENSIONS.discoveryTendency
  )!;
  const familiarityPreference = clampNumber(
    rawTendencies.familiarityPreference ?? input.familiarityPreference,
    0.0,
    1.0,
    DEFAULT_TENDENCY_DIMENSIONS.familiarityPreference
  )!;
  const diversityPreference = clampNumber(
    rawTendencies.diversityPreference ?? input.diversityPreference,
    0.0,
    1.0,
    DEFAULT_TENDENCY_DIMENSIONS.diversityPreference
  )!;
  const explorationPreference = clampNumber(
    rawTendencies.explorationPreference ?? input.explorationPreference,
    0.0,
    1.0,
    DEFAULT_TENDENCY_DIMENSIONS.explorationPreference
  )!;

  const tendencies: MusicDNATendencyDimensions = {
    discoveryTendency,
    familiarityPreference,
    diversityPreference,
    explorationPreference,
  };

  // 4. Genre Preferences sanitization
  const genres: MusicDNAGenrePreference[] = [];
  if (Array.isArray(input.genres)) {
    for (const g of input.genres) {
      if (!g || (!g.name && !g.genre)) continue;
      const name = String(g.name || g.genre || '').trim();
      const affinityScore = clampNumber(g.affinityScore ?? g.score ?? g.weight, 0.0, 1.0, 0.5)!;
      const playCount = Math.max(0, Math.round(Number(g.playCount ?? g.interactionCount ?? 1)));
      genres.push({
        genre: g.genre,
        name: name || 'Unknown Genre',
        affinityScore,
        playCount,
        lastInteractionAt: g.lastInteractionAt ? new Date(g.lastInteractionAt) : new Date(),
      });
    }
  }

  // 5. Artist Preferences sanitization
  const artists: MusicDNAArtistPreference[] = [];
  if (Array.isArray(input.artists)) {
    for (const a of input.artists) {
      if (!a || (!a.name && !a.artist)) continue;
      const name = String(a.name || a.artist || '').trim();
      const affinityScore = clampNumber(a.affinityScore ?? a.score ?? a.weight, 0.0, 1.0, 0.5)!;
      const playCount = Math.max(0, Math.round(Number(a.playCount ?? a.interactionCount ?? 1)));
      artists.push({
        artist: a.artist,
        name: name || 'Unknown Artist',
        affinityScore,
        playCount,
        lastInteractionAt: a.lastInteractionAt ? new Date(a.lastInteractionAt) : new Date(),
      });
    }
  }

  // 6. Mood Preferences sanitization
  const moods: MusicDNAMoodPreference[] = [];
  if (Array.isArray(input.moods)) {
    for (const m of input.moods) {
      if (!m || (!m.mood && !m.name)) continue;
      const mood = String(m.mood || m.name || '').trim();
      const affinityScore = clampNumber(m.affinityScore ?? m.score ?? m.weight, 0.0, 1.0, 0.5)!;
      const playCount = Math.max(0, Math.round(Number(m.playCount ?? m.interactionCount ?? 1)));
      moods.push({
        mood: mood || 'Chill',
        affinityScore,
        playCount,
        lastInteractionAt: m.lastInteractionAt ? new Date(m.lastInteractionAt) : new Date(),
      });
    }
  }

  // 7. Listening Patterns sanitization
  const rawPatterns = input.listeningPatterns || {};
  const preferredSituations: (ListeningSituationType | string)[] = [];
  if (Array.isArray(rawPatterns.preferredSituations)) {
    for (const s of rawPatterns.preferredSituations) {
      const norm = normalizeListeningSituation(s);
      if (norm) preferredSituations.push(norm);
    }
  }

  const rawAudio = rawPatterns.audioFeaturePreferences || {};
  const audioFeaturePreferences: Partial<IAudioFeatures> = {
    energy: clampNumber(rawAudio.energy, 0.0, 1.0, DEFAULT_LISTENING_PATTERNS.audioFeaturePreferences?.energy),
    danceability: clampNumber(rawAudio.danceability, 0.0, 1.0, DEFAULT_LISTENING_PATTERNS.audioFeaturePreferences?.danceability),
    valence: clampNumber(rawAudio.valence, 0.0, 1.0, DEFAULT_LISTENING_PATTERNS.audioFeaturePreferences?.valence),
    acousticness: clampNumber(rawAudio.acousticness, 0.0, 1.0, DEFAULT_LISTENING_PATTERNS.audioFeaturePreferences?.acousticness),
    instrumentalness: clampNumber(rawAudio.instrumentalness, 0.0, 1.0, DEFAULT_LISTENING_PATTERNS.audioFeaturePreferences?.instrumentalness),
  };

  const rawTempo = rawPatterns.preferredTempo || {};
  const preferredTempo = {
    min: clampNumber(rawTempo.min, 30, 250, DEFAULT_LISTENING_PATTERNS.preferredTempo?.min),
    max: clampNumber(rawTempo.max, 30, 250, DEFAULT_LISTENING_PATTERNS.preferredTempo?.max),
    target: clampNumber(rawTempo.target, 30, 250, DEFAULT_LISTENING_PATTERNS.preferredTempo?.target),
  };

  const listeningPatterns: MusicDNAListeningPatterns = {
    timeOfDayDistribution: {
      morning: clampNumber(rawPatterns.timeOfDayDistribution?.morning, 0.0, 1.0, 0.2),
      afternoon: clampNumber(rawPatterns.timeOfDayDistribution?.afternoon, 0.0, 1.0, 0.25),
      evening: clampNumber(rawPatterns.timeOfDayDistribution?.evening, 0.0, 1.0, 0.35),
      night: clampNumber(rawPatterns.timeOfDayDistribution?.night, 0.0, 1.0, 0.15),
      late_night: clampNumber(rawPatterns.timeOfDayDistribution?.late_night, 0.0, 1.0, 0.05),
    },
    avgSessionDurationMinutes: clampNumber(rawPatterns.avgSessionDurationMinutes, 1, 600, 30),
    skipRate: clampNumber(rawPatterns.skipRate, 0.0, 1.0, 0.15),
    completionRate: clampNumber(rawPatterns.completionRate, 0.0, 1.0, 0.85),
    replayRate: clampNumber(rawPatterns.replayRate, 0.0, 1.0, 0.2),
    preferredSituations: preferredSituations.length > 0 ? preferredSituations : DEFAULT_LISTENING_PATTERNS.preferredSituations,
    audioFeaturePreferences,
    preferredTempo,
  };

  // 8. Temporal Taste Information
  const rawTemporal = input.temporalTaste || {};
  const activeTimeWindow = normalizeTimeWindow(rawTemporal.activeTimeWindow || 'medium_term');
  const stabilityScore = clampNumber(rawTemporal.stabilityScore, 0.0, 1.0, DEFAULT_TEMPORAL_TASTE.stabilityScore)!;

  const temporalAffinities: MusicDNATemporalWindowPreference[] = [];
  if (Array.isArray(rawTemporal.temporalAffinities)) {
    for (const aff of rawTemporal.temporalAffinities) {
      if (!aff) continue;
      temporalAffinities.push({
        window: normalizeTimeWindow(aff.window || 'medium_term'),
        topGenres: Array.isArray(aff.topGenres) ? aff.topGenres.map(String) : [],
        topArtists: Array.isArray(aff.topArtists) ? aff.topArtists.map(String) : [],
        topMoods: Array.isArray(aff.topMoods) ? aff.topMoods.map(String) : [],
        score: clampNumber(aff.score, 0.0, 1.0, 0.5)!,
      });
    }
  }

  const temporalTaste: MusicDNATemporalTaste = {
    stabilityScore,
    activeTimeWindow,
    trendingGenres: Array.isArray(rawTemporal.trendingGenres) ? rawTemporal.trendingGenres.map(String) : [],
    emergingGenres: Array.isArray(rawTemporal.emergingGenres) ? rawTemporal.emergingGenres.map(String) : [],
    decliningGenres: Array.isArray(rawTemporal.decliningGenres) ? rawTemporal.decliningGenres.map(String) : [],
    temporalAffinities,
    lastCalculatedAt: rawTemporal.lastCalculatedAt ? new Date(rawTemporal.lastCalculatedAt) : new Date(),
  };

  // 9. Confidence Score [0.0, 1.0]
  const confidenceScore = clampNumber(input.confidenceScore, 0.0, 1.0, 0.5)!;

  // 10. Extensible Metadata
  const metadata: Record<string, any> =
    input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
      ? { ...input.metadata }
      : {};

  const sanitized: MusicDNAProfileAttributes = {
    userId,
    dnaVersion,
    genres,
    artists,
    moods,
    listeningPatterns,
    tendencies,
    temporalTaste,
    confidenceScore,
    metadata,
  };

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
}

/**
 * Returns a baseline Music DNA profile structure for a given user.
 */
export function getDefaultMusicDNAProfile(
  userId: string | Types.ObjectId
): MusicDNAProfileAttributes {
  return {
    userId,
    dnaVersion: '1.0.0',
    genres: [],
    artists: [],
    moods: [],
    listeningPatterns: { ...DEFAULT_LISTENING_PATTERNS },
    tendencies: { ...DEFAULT_TENDENCY_DIMENSIONS },
    temporalTaste: { ...DEFAULT_TEMPORAL_TASTE },
    confidenceScore: 0.1,
    metadata: {},
  };
}
