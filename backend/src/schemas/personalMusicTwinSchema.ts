
/**
 * Higher-level acoustic and musical traits defining the user's sonic signature.
 */
export interface ITwinMusicalTraits {
  energyPreference: number;          // 0.0 (ambient/acoustic) to 1.0 (hyper/high-energy)
  danceabilityPreference: number;    // 0.0 to 1.0
  valencePreference: number;         // 0.0 (melancholic/dark) to 1.0 (cheerful/euphoric)
  acousticnessPreference: number;     // 0.0 (electronic/synthesized) to 1.0 (organic/acoustic)
  instrumentalnessPreference: number; // 0.0 (vocal heavy) to 1.0 (purely instrumental)
  targetTempoBpm: number;            // BPM (e.g., 120)
  tempoRange: {
    min: number;
    max: number;
  };
  keyAcousticDescriptors: string[];  // e.g. ['High Energy', 'Electronic', 'Atmospheric']
}

/**
 * Core genre identity and diversity profile.
 */
export interface ITwinGenreIdentity {
  coreGenres: {
    name: string;
    affinityScore: number;           // 0.0 to 1.0
    isPrimary: boolean;
  }[];
  secondaryGenres: {
    name: string;
    affinityScore: number;           // 0.0 to 1.0
  }[];
  genreDiversityScore: number;       // 0.0 (hyper-focused) to 1.0 (radically eclectic)
  signatureSound: string;            // Textual descriptor (e.g. 'Cyber-Electronic & Synthwave Fusion')
}

/**
 * Mood identity and emotional resonance palette.
 */
export interface ITwinMoodIdentity {
  dominantMoods: {
    mood: string;
    affinityScore: number;           // 0.0 to 1.0
  }[];
  emotionalBreadth: 'focused' | 'moderate' | 'broad' | 'dynamic';
  contextualMoodAffinity: Record<string, string>; // e.g., { workout: 'Energetic', late_night: 'Chill' }
}

/**
 * High-level listening behavior dimensions derived from session & playback analytics.
 */
export interface ITwinListeningBehavior {
  repeatListeningTendency: number;   // 0.0 to 1.0 (loyalty to repeated tracks)
  discoveryTendency: number;         // 0.0 to 1.0 (drive to unearth new music)
  skipTendency: number;              // 0.0 to 1.0 (skipping habit frequency)
  sessionListeningIntensity: number; // 0.0 to 1.0 (tracks per session and duration)
  completionRate: number;            // 0.0 to 1.0 (ratio of fully heard songs)
  avgSessionDurationMinutes: number; // in minutes
  peakListeningTime: string;         // 'morning' | 'afternoon' | 'evening' | 'night' | 'late_night'
  isDataSufficient: boolean;
}

/**
 * Taste stability and volatility metrics.
 */
export interface ITwinTasteStability {
  stabilityScore: number;            // 0.0 to 1.0
  volatilityScore: number;           // 0.0 to 1.0
  preferencePersistence: number;     // 0.0 to 1.0
  stabilityRating: 'highly_stable' | 'moderate_drift' | 'rapid_transformation' | 'unrated';
  description: string;
}

/**
 * Directional taste trajectory and active evolution phase.
 */
export interface ITwinTasteEvolution {
  transformationIntensity: number;   // 0.0 to 1.0
  evolutionArchetype: string;        // e.g. 'Gradual Evolver', 'Anchor / High Stability', 'Transforming / Paradigm Shift'
  primaryTasteDirection: string;     // Textual explanation of taste shift
  activePhase: string;               // Current musical chapter/era (e.g. 'Synthwave Era')
  velocity: 'rapid' | 'moderate' | 'gradual' | 'static';
}

/**
 * Recently emerging preferences with high short-term momentum.
 */
export interface ITwinEmergingInterests {
  genres: {
    name: string;
    confidence: number;
    momentumVelocity?: number;
  }[];
  artists: {
    name: string;
    confidence: number;
    momentumVelocity?: number;
  }[];
  moods: string[];
  narrative: string;
}

/**
 * Extensible Persona & Character layer (USP feature for shareable Twin identity).
 */
export interface ITwinPersonalityProfile {
  personaName: string;               // e.g., 'The Neon Nightcrawler'
  tagline: string;                   // e.g., 'Chasing retro horizons with synthetic pulses'
  bio: string;                       // Narrative description of the user's music persona
  vibeKeywords: string[];            // e.g., ['electric', 'nostalgic', 'night-drive']
  rarityScore: number;               // 0.0 to 1.0 (uniqueness relative to global listeners)
}

/**
 * Compatibility vectors for twin matching and future social/discovery features.
 */
export interface ITwinCompatibilityDimensions {
  opennessScore: number;             // 0.0 to 1.0
  intensityScore: number;            // 0.0 to 1.0
  eclecticismScore: number;          // 0.0 to 1.0
  tasteVector: number[];             // Normalized coordinates for semantic similarity distance
}

/**
 * Complete Personal Music Twin data attributes.
 */
export interface PersonalMusicTwinAttributes {
  userId: string;
  twinVersion: string;
  listenerArchetype: string;
  archetypeDescription: string;
  dominantMusicalTraits: ITwinMusicalTraits;
  genreIdentity: ITwinGenreIdentity;
  moodIdentity: ITwinMoodIdentity;
  explorationTendency: number;       // 0.0 (pure familiarity) to 1.0 (radical novelty)
  familiarityTendency: number;       // 0.0 to 1.0
  diversityPreference: number;       // 0.0 to 1.0
  listeningBehavior: ITwinListeningBehavior;
  tasteStability: ITwinTasteStability;
  tasteEvolution: ITwinTasteEvolution;
  currentEmergingInterests: ITwinEmergingInterests;
  personalityProfile: ITwinPersonalityProfile;
  compatibilityDimensions: ITwinCompatibilityDimensions;
  confidenceScore: number;           // 0.0 to 1.0
  lastUpdatedTimestamp: Date;
  isDataSufficient: boolean;
  metadata?: Record<string, any>;
}

export const DEFAULT_MUSICAL_TRAITS: ITwinMusicalTraits = {
  energyPreference: 0.5,
  danceabilityPreference: 0.5,
  valencePreference: 0.5,
  acousticnessPreference: 0.5,
  instrumentalnessPreference: 0.3,
  targetTempoBpm: 120,
  tempoRange: { min: 80, max: 140 },
  keyAcousticDescriptors: ['Balanced Energy', 'Modern Production'],
};

export const DEFAULT_GENRE_IDENTITY: ITwinGenreIdentity = {
  coreGenres: [],
  secondaryGenres: [],
  genreDiversityScore: 0.5,
  signatureSound: 'Eclectic Palette',
};

export const DEFAULT_MOOD_IDENTITY: ITwinMoodIdentity = {
  dominantMoods: [],
  emotionalBreadth: 'moderate',
  contextualMoodAffinity: {},
};

export const DEFAULT_TWIN_LISTENING_BEHAVIOR: ITwinListeningBehavior = {
  repeatListeningTendency: 0.5,
  discoveryTendency: 0.5,
  skipTendency: 0.3,
  sessionListeningIntensity: 0.5,
  completionRate: 0.75,
  avgSessionDurationMinutes: 25,
  peakListeningTime: 'evening',
  isDataSufficient: false,
};

export const DEFAULT_TASTE_STABILITY: ITwinTasteStability = {
  stabilityScore: 0.5,
  volatilityScore: 0.5,
  preferencePersistence: 0.5,
  stabilityRating: 'unrated',
  description: 'Establishing baseline listening patterns.',
};

export const DEFAULT_TASTE_EVOLUTION: ITwinTasteEvolution = {
  transformationIntensity: 0.0,
  evolutionArchetype: 'Gradual Evolver',
  primaryTasteDirection: 'Establishing baseline musical preferences.',
  activePhase: 'Discovery Era',
  velocity: 'static',
};

export const DEFAULT_EMERGING_INTERESTS: ITwinEmergingInterests = {
  genres: [],
  artists: [],
  moods: [],
  narrative: 'No emerging preferences identified yet.',
};

export const DEFAULT_PERSONALITY_PROFILE: ITwinPersonalityProfile = {
  personaName: 'The Open Explorer',
  tagline: 'Embarking on a musical journey',
  bio: 'A curious listener with an expanding palette, discovering sonic dimensions.',
  vibeKeywords: ['curious', 'balanced', 'exploratory'],
  rarityScore: 0.5,
};

export const DEFAULT_COMPATIBILITY_DIMENSIONS: ITwinCompatibilityDimensions = {
  opennessScore: 0.5,
  intensityScore: 0.5,
  eclecticismScore: 0.5,
  tasteVector: [0.5, 0.5, 0.5, 0.5, 0.5],
};

/**
 * Factory for creating a clean default Personal Music Twin representation.
 */
export function getDefaultPersonalMusicTwin(
  userId: string
): PersonalMusicTwinAttributes {
  return {
    userId,
    twinVersion: '1.0.0',
    listenerArchetype: 'Balanced Explorer',
    archetypeDescription: 'A versatile listener who appreciates a balanced mix of familiar favorites and intriguing discoveries.',
    dominantMusicalTraits: { ...DEFAULT_MUSICAL_TRAITS },
    genreIdentity: { ...DEFAULT_GENRE_IDENTITY },
    moodIdentity: { ...DEFAULT_MOOD_IDENTITY },
    explorationTendency: 0.5,
    familiarityTendency: 0.5,
    diversityPreference: 0.5,
    listeningBehavior: { ...DEFAULT_TWIN_LISTENING_BEHAVIOR },
    tasteStability: { ...DEFAULT_TASTE_STABILITY },
    tasteEvolution: { ...DEFAULT_TASTE_EVOLUTION },
    currentEmergingInterests: { ...DEFAULT_EMERGING_INTERESTS },
    personalityProfile: { ...DEFAULT_PERSONALITY_PROFILE },
    compatibilityDimensions: { ...DEFAULT_COMPATIBILITY_DIMENSIONS },
    confidenceScore: 0.1,
    lastUpdatedTimestamp: new Date(),
    isDataSufficient: false,
    metadata: {},
  };
}

/**
 * Validates and sanitizes a Personal Music Twin object.
 * Clamps floating-point metrics into standard [0.0, 1.0] bounds and guarantees structural integrity.
 */
export function validateAndSanitizePersonalMusicTwin(
  twin: Partial<PersonalMusicTwinAttributes>
): PersonalMusicTwinAttributes {
  const clamp01 = (val: any, fallback = 0.5): number => {
    const num = Number(val);
    if (isNaN(num)) return fallback;
    return Math.min(1.0, Math.max(0.0, num));
  };

  const userId = twin.userId || crypto.randomUUID();

  const traits = twin.dominantMusicalTraits || DEFAULT_MUSICAL_TRAITS;
  const musicalTraits: ITwinMusicalTraits = {
    energyPreference: clamp01(traits.energyPreference, 0.5),
    danceabilityPreference: clamp01(traits.danceabilityPreference, 0.5),
    valencePreference: clamp01(traits.valencePreference, 0.5),
    acousticnessPreference: clamp01(traits.acousticnessPreference, 0.5),
    instrumentalnessPreference: clamp01(traits.instrumentalnessPreference, 0.3),
    targetTempoBpm: Math.max(40, Math.min(240, Number(traits.targetTempoBpm) || 120)),
    tempoRange: {
      min: Math.max(40, Number(traits.tempoRange?.min) || 80),
      max: Math.min(240, Number(traits.tempoRange?.max) || 140),
    },
    keyAcousticDescriptors: Array.isArray(traits.keyAcousticDescriptors)
      ? traits.keyAcousticDescriptors.map((d) => String(d).trim()).filter(Boolean)
      : [...DEFAULT_MUSICAL_TRAITS.keyAcousticDescriptors],
  };

  const genreId = twin.genreIdentity || DEFAULT_GENRE_IDENTITY;
  const genreIdentity: ITwinGenreIdentity = {
    coreGenres: Array.isArray(genreId.coreGenres)
      ? genreId.coreGenres.map((g) => ({
          name: String(g.name || '').trim(),
          affinityScore: clamp01(g.affinityScore, 0.5),
          isPrimary: Boolean(g.isPrimary),
        })).filter((g) => g.name.length > 0)
      : [],
    secondaryGenres: Array.isArray(genreId.secondaryGenres)
      ? genreId.secondaryGenres.map((g) => ({
          name: String(g.name || '').trim(),
          affinityScore: clamp01(g.affinityScore, 0.5),
        })).filter((g) => g.name.length > 0)
      : [],
    genreDiversityScore: clamp01(genreId.genreDiversityScore, 0.5),
    signatureSound: String(genreId.signatureSound || 'Eclectic Sound').trim(),
  };

  const moodId = twin.moodIdentity || DEFAULT_MOOD_IDENTITY;
  const moodIdentity: ITwinMoodIdentity = {
    dominantMoods: Array.isArray(moodId.dominantMoods)
      ? moodId.dominantMoods.map((m) => ({
          mood: String(m.mood || '').trim(),
          affinityScore: clamp01(m.affinityScore, 0.5),
        })).filter((m) => m.mood.length > 0)
      : [],
    emotionalBreadth: ['focused', 'moderate', 'broad', 'dynamic'].includes(moodId.emotionalBreadth)
      ? moodId.emotionalBreadth
      : 'moderate',
    contextualMoodAffinity:
      typeof moodId.contextualMoodAffinity === 'object' && moodId.contextualMoodAffinity !== null
        ? { ...moodId.contextualMoodAffinity }
        : {},
  };

  const lb = twin.listeningBehavior || DEFAULT_TWIN_LISTENING_BEHAVIOR;
  const listeningBehavior: ITwinListeningBehavior = {
    repeatListeningTendency: clamp01(lb.repeatListeningTendency, 0.5),
    discoveryTendency: clamp01(lb.discoveryTendency, 0.5),
    skipTendency: clamp01(lb.skipTendency, 0.3),
    sessionListeningIntensity: clamp01(lb.sessionListeningIntensity, 0.5),
    completionRate: clamp01(lb.completionRate, 0.75),
    avgSessionDurationMinutes: Math.max(1, Number(lb.avgSessionDurationMinutes) || 25),
    peakListeningTime: String(lb.peakListeningTime || 'evening').trim(),
    isDataSufficient: Boolean(lb.isDataSufficient),
  };

  const ts = twin.tasteStability || DEFAULT_TASTE_STABILITY;
  const tasteStability: ITwinTasteStability = {
    stabilityScore: clamp01(ts.stabilityScore, 0.5),
    volatilityScore: clamp01(ts.volatilityScore, 0.5),
    preferencePersistence: clamp01(ts.preferencePersistence, 0.5),
    stabilityRating: ['highly_stable', 'moderate_drift', 'rapid_transformation', 'unrated'].includes(
      ts.stabilityRating
    )
      ? ts.stabilityRating
      : 'unrated',
    description: String(ts.description || DEFAULT_TASTE_STABILITY.description).trim(),
  };

  const te = twin.tasteEvolution || DEFAULT_TASTE_EVOLUTION;
  const tasteEvolution: ITwinTasteEvolution = {
    transformationIntensity: clamp01(te.transformationIntensity, 0.0),
    evolutionArchetype: String(te.evolutionArchetype || DEFAULT_TASTE_EVOLUTION.evolutionArchetype).trim(),
    primaryTasteDirection: String(te.primaryTasteDirection || DEFAULT_TASTE_EVOLUTION.primaryTasteDirection).trim(),
    activePhase: String(te.activePhase || DEFAULT_TASTE_EVOLUTION.activePhase).trim(),
    velocity: ['rapid', 'moderate', 'gradual', 'static'].includes(te.velocity) ? te.velocity : 'static',
  };

  const ei = twin.currentEmergingInterests || DEFAULT_EMERGING_INTERESTS;
  const currentEmergingInterests: ITwinEmergingInterests = {
    genres: Array.isArray(ei.genres)
      ? ei.genres.map((g) => ({
          name: String(g.name || '').trim(),
          confidence: clamp01(g.confidence, 0.5),
          momentumVelocity: typeof g.momentumVelocity === 'number' ? g.momentumVelocity : undefined,
        })).filter((g) => g.name.length > 0)
      : [],
    artists: Array.isArray(ei.artists)
      ? ei.artists.map((a) => ({
          name: String(a.name || '').trim(),
          confidence: clamp01(a.confidence, 0.5),
          momentumVelocity: typeof a.momentumVelocity === 'number' ? a.momentumVelocity : undefined,
        })).filter((a) => a.name.length > 0)
      : [],
    moods: Array.isArray(ei.moods) ? ei.moods.map((m) => String(m).trim()).filter(Boolean) : [],
    narrative: String(ei.narrative || DEFAULT_EMERGING_INTERESTS.narrative).trim(),
  };

  const pp = twin.personalityProfile || DEFAULT_PERSONALITY_PROFILE;
  const personalityProfile: ITwinPersonalityProfile = {
    personaName: String(pp.personaName || DEFAULT_PERSONALITY_PROFILE.personaName).trim(),
    tagline: String(pp.tagline || DEFAULT_PERSONALITY_PROFILE.tagline).trim(),
    bio: String(pp.bio || DEFAULT_PERSONALITY_PROFILE.bio).trim(),
    vibeKeywords: Array.isArray(pp.vibeKeywords)
      ? pp.vibeKeywords.map((k) => String(k).trim()).filter(Boolean)
      : [...DEFAULT_PERSONALITY_PROFILE.vibeKeywords],
    rarityScore: clamp01(pp.rarityScore, 0.5),
  };

  const cd = twin.compatibilityDimensions || DEFAULT_COMPATIBILITY_DIMENSIONS;
  const compatibilityDimensions: ITwinCompatibilityDimensions = {
    opennessScore: clamp01(cd.opennessScore, 0.5),
    intensityScore: clamp01(cd.intensityScore, 0.5),
    eclecticismScore: clamp01(cd.eclecticismScore, 0.5),
    tasteVector: Array.isArray(cd.tasteVector) && cd.tasteVector.length > 0
      ? cd.tasteVector.map((v) => clamp01(v, 0.5))
      : [0.5, 0.5, 0.5, 0.5, 0.5],
  };

  return {
    userId,
    twinVersion: String(twin.twinVersion || '1.0.0').trim(),
    listenerArchetype: String(twin.listenerArchetype || 'Balanced Explorer').trim(),
    archetypeDescription: String(
      twin.archetypeDescription ||
        'A versatile listener who appreciates a balanced mix of familiar favorites and intriguing discoveries.'
    ).trim(),
    dominantMusicalTraits: musicalTraits,
    genreIdentity,
    moodIdentity,
    explorationTendency: clamp01(twin.explorationTendency, 0.5),
    familiarityTendency: clamp01(twin.familiarityTendency, 0.5),
    diversityPreference: clamp01(twin.diversityPreference, 0.5),
    listeningBehavior,
    tasteStability,
    tasteEvolution,
    currentEmergingInterests,
    personalityProfile,
    compatibilityDimensions,
    confidenceScore: clamp01(twin.confidenceScore, 0.1),
    lastUpdatedTimestamp: twin.lastUpdatedTimestamp instanceof Date ? twin.lastUpdatedTimestamp : new Date(),
    isDataSufficient: Boolean(twin.isDataSufficient),
    metadata: typeof twin.metadata === 'object' && twin.metadata !== null ? { ...twin.metadata } : {},
  };
}
