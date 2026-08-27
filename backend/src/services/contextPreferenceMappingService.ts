import {
  StandardListeningSituation,
  normalizeListeningSituation,
  RecommendationContextAttributes,
} from '../schemas/recommendationContextSchema.js';

export interface ContextRankingWeights {
  contentWeight: number;
  collaborativeWeight: number;
  popularityWeight: number;
  recencyWeight: number;
  noveltyWeight: number;
  genreAffinityWeight: number;
  artistAffinityWeight: number;
  acousticSimilarityWeight: number;
  [key: string]: number;
}

export interface ContextAcousticRanges {
  minEnergy?: number;
  maxEnergy?: number;
  minTempo?: number;
  maxTempo?: number;
  instrumentalnessPreference?: number; // 0.0 (vocal) to 1.0 (pure instrumental)
  danceabilityPreference?: number; // 0.0 to 1.0
  acousticnessPreference?: number; // 0.0 to 1.0
}

export interface ContextPreferenceMapping {
  situation: StandardListeningSituation | string;
  name: string;
  description: string;
  targetEnergy: number; // 0.0 to 1.0
  targetTempo: number; // BPM
  energyTolerance: number; // e.g. 0.20
  tempoTolerance: number; // e.g. 15 BPM
  targetMood: string;
  supportedMoods: string[];
  recommendedGenres: string[];
  noveltyPreference: number; // 0.0 to 1.0 (0 = familiar favorites, 1 = exploration)
  weights: ContextRankingWeights;
  acousticRanges: ContextAcousticRanges;
}

export interface ContextDerivedPreferences {
  situation: string;
  targetEnergy: number;
  targetTempo: number;
  targetMood: string;
  preferredGenres: string[];
  noveltyPreference: number;
  rankingWeights: ContextRankingWeights;
  acousticRanges: ContextAcousticRanges;
  appliedOverrides: string[];
}

/**
 * Standard sensible default configurations for all 9 primary listening contexts.
 * Configurable, centralized, and thoroughly documented.
 */
export const DEFAULT_CONTEXT_MAPPINGS: Record<string, ContextPreferenceMapping> = {
  // 1. STUDY
  [StandardListeningSituation.Study]: {
    situation: StandardListeningSituation.Study,
    name: 'Study & Academics',
    description:
      'Low-distraction, ambient, and lo-fi textures designed for reading comprehension and academic retention with minimal vocal interference.',
    targetEnergy: 0.30,
    targetTempo: 82,
    energyTolerance: 0.18,
    tempoTolerance: 15,
    targetMood: 'Focus',
    supportedMoods: ['Focus', 'Chill', 'Calm', 'Peaceful'],
    recommendedGenres: ['Lo-Fi', 'Ambient', 'Classical', 'Instrumental', 'Neo-Classical', 'Downtempo'],
    noveltyPreference: 0.25,
    weights: {
      contentWeight: 0.45,
      collaborativeWeight: 0.20,
      popularityWeight: 0.10,
      recencyWeight: 0.05,
      noveltyWeight: 0.05,
      genreAffinityWeight: 0.40,
      artistAffinityWeight: 0.25,
      acousticSimilarityWeight: 0.50,
    },
    acousticRanges: {
      minEnergy: 0.10,
      maxEnergy: 0.50,
      minTempo: 65,
      maxTempo: 105,
      instrumentalnessPreference: 0.85,
      danceabilityPreference: 0.30,
      acousticnessPreference: 0.65,
    },
  },

  // 2. WORK
  [StandardListeningSituation.Work]: {
    situation: StandardListeningSituation.Work,
    name: 'Work & Coding',
    description:
      'Steady rhythm, moderate energy, and melodic electronic grooves engineered for cognitive momentum, problem solving, and productive flow.',
    targetEnergy: 0.55,
    targetTempo: 112,
    energyTolerance: 0.20,
    tempoTolerance: 18,
    targetMood: 'Focus',
    supportedMoods: ['Focus', 'Upbeat', 'Chill', 'Productive'],
    recommendedGenres: ['Deep House', 'Synthwave', 'Indie Electronic', 'Progressive House', 'Lo-Fi Beats', 'Chillhop'],
    noveltyPreference: 0.35,
    weights: {
      contentWeight: 0.40,
      collaborativeWeight: 0.25,
      popularityWeight: 0.15,
      recencyWeight: 0.10,
      noveltyWeight: 0.10,
      genreAffinityWeight: 0.35,
      artistAffinityWeight: 0.30,
      acousticSimilarityWeight: 0.45,
    },
    acousticRanges: {
      minEnergy: 0.35,
      maxEnergy: 0.75,
      minTempo: 95,
      maxTempo: 128,
      instrumentalnessPreference: 0.65,
      danceabilityPreference: 0.55,
      acousticnessPreference: 0.30,
    },
  },

  // 3. WORKOUT
  [StandardListeningSituation.Workout]: {
    situation: StandardListeningSituation.Workout,
    name: 'Workout & Fitness',
    description:
      'High-octane, driving beats with strong percussive energy and dynamic tempo for cardiovascular intensity, weightlifting, and peak motivation.',
    targetEnergy: 0.90,
    targetTempo: 140,
    energyTolerance: 0.15,
    tempoTolerance: 20,
    targetMood: 'Energetic',
    supportedMoods: ['Energetic', 'Upbeat', 'Driving', 'Intense', 'Motivated'],
    recommendedGenres: ['EDM', 'Hard Rock', 'Trap', 'Hip Hop', 'Drum & Bass', 'Electro Pop', 'Synthwave'],
    noveltyPreference: 0.45,
    weights: {
      contentWeight: 0.35,
      collaborativeWeight: 0.30,
      popularityWeight: 0.25,
      recencyWeight: 0.15,
      noveltyWeight: 0.15,
      genreAffinityWeight: 0.40,
      artistAffinityWeight: 0.35,
      acousticSimilarityWeight: 0.40,
    },
    acousticRanges: {
      minEnergy: 0.75,
      maxEnergy: 1.00,
      minTempo: 125,
      maxTempo: 175,
      instrumentalnessPreference: 0.30,
      danceabilityPreference: 0.85,
      acousticnessPreference: 0.10,
    },
  },

  // 4. RELAXATION
  [StandardListeningSituation.Relaxation]: {
    situation: StandardListeningSituation.Relaxation,
    name: 'Relaxation & Unwind',
    description:
      'Warm acoustic textures, soothing harmonies, and organic timbres to reduce stress, lower heart rate, and cultivate serene relaxation.',
    targetEnergy: 0.25,
    targetTempo: 76,
    energyTolerance: 0.15,
    tempoTolerance: 15,
    targetMood: 'Relaxed',
    supportedMoods: ['Relaxed', 'Chill', 'Calm', 'Peaceful', 'Serene'],
    recommendedGenres: ['Acoustic', 'Ambient', 'Indie Folk', 'Soul', 'Bossa Nova', 'Downtempo', 'R&B'],
    noveltyPreference: 0.30,
    weights: {
      contentWeight: 0.45,
      collaborativeWeight: 0.20,
      popularityWeight: 0.10,
      recencyWeight: 0.05,
      noveltyWeight: 0.08,
      genreAffinityWeight: 0.40,
      artistAffinityWeight: 0.30,
      acousticSimilarityWeight: 0.50,
    },
    acousticRanges: {
      minEnergy: 0.05,
      maxEnergy: 0.45,
      minTempo: 60,
      maxTempo: 95,
      instrumentalnessPreference: 0.40,
      danceabilityPreference: 0.35,
      acousticnessPreference: 0.75,
    },
  },

  // 5. COMMUTE
  [StandardListeningSituation.Commute]: {
    situation: StandardListeningSituation.Commute,
    name: 'Commute & Travel',
    description:
      'Engaging, rhythmic, and melodic tracks to keep listeners alert, entertained, and energized during daily transit or road trips.',
    targetEnergy: 0.70,
    targetTempo: 122,
    energyTolerance: 0.20,
    tempoTolerance: 18,
    targetMood: 'Upbeat',
    supportedMoods: ['Upbeat', 'Happy', 'Energetic', 'Chill'],
    recommendedGenres: ['Pop', 'Indie Rock', 'Alternative Rock', 'Synthpop', 'Hip Hop', 'Classic Rock'],
    noveltyPreference: 0.50,
    weights: {
      contentWeight: 0.35,
      collaborativeWeight: 0.35,
      popularityWeight: 0.20,
      recencyWeight: 0.15,
      noveltyWeight: 0.20,
      genreAffinityWeight: 0.35,
      artistAffinityWeight: 0.35,
      acousticSimilarityWeight: 0.35,
    },
    acousticRanges: {
      minEnergy: 0.50,
      maxEnergy: 0.85,
      minTempo: 105,
      maxTempo: 138,
      instrumentalnessPreference: 0.20,
      danceabilityPreference: 0.70,
      acousticnessPreference: 0.25,
    },
  },

  // 6. PARTY
  [StandardListeningSituation.Party]: {
    situation: StandardListeningSituation.Party,
    name: 'Party & Celebration',
    description:
      'Infectious rhythms, uplifting drops, and crowd-pleasing anthems tailored for social gatherings, dance floors, and celebratory energy.',
    targetEnergy: 0.95,
    targetTempo: 128,
    energyTolerance: 0.10,
    tempoTolerance: 15,
    targetMood: 'Party',
    supportedMoods: ['Party', 'Upbeat', 'Energetic', 'Happy', 'Euphoric'],
    recommendedGenres: ['Dance Pop', 'House', 'Hip Hop', 'Funk', 'Disco', 'Reggaeton', 'Nu-Disco'],
    noveltyPreference: 0.30,
    weights: {
      contentWeight: 0.30,
      collaborativeWeight: 0.40,
      popularityWeight: 0.35,
      recencyWeight: 0.20,
      noveltyWeight: 0.10,
      genreAffinityWeight: 0.35,
      artistAffinityWeight: 0.35,
      acousticSimilarityWeight: 0.35,
    },
    acousticRanges: {
      minEnergy: 0.80,
      maxEnergy: 1.00,
      minTempo: 118,
      maxTempo: 140,
      instrumentalnessPreference: 0.15,
      danceabilityPreference: 0.90,
      acousticnessPreference: 0.05,
    },
  },

  // 7. SLEEP
  [StandardListeningSituation.Sleep]: {
    situation: StandardListeningSituation.Sleep,
    name: 'Sleep & Night Rest',
    description:
      'Ultra-calm, minimal harmonic structures and steady acoustic washes without sharp percussive transitions to facilitate deep sleep.',
    targetEnergy: 0.10,
    targetTempo: 58,
    energyTolerance: 0.10,
    tempoTolerance: 12,
    targetMood: 'Calm',
    supportedMoods: ['Calm', 'Peaceful', 'Quiet', 'Dreamy'],
    recommendedGenres: ['Sleep Ambient', 'Drone', 'Nature Soundscapes', 'Soft Piano', 'White Noise', 'Lullaby'],
    noveltyPreference: 0.15,
    weights: {
      contentWeight: 0.50,
      collaborativeWeight: 0.15,
      popularityWeight: 0.05,
      recencyWeight: 0.02,
      noveltyWeight: 0.02,
      genreAffinityWeight: 0.45,
      artistAffinityWeight: 0.20,
      acousticSimilarityWeight: 0.55,
    },
    acousticRanges: {
      minEnergy: 0.00,
      maxEnergy: 0.25,
      minTempo: 40,
      maxTempo: 75,
      instrumentalnessPreference: 0.95,
      danceabilityPreference: 0.10,
      acousticnessPreference: 0.85,
    },
  },

  // 8. FOCUS
  [StandardListeningSituation.Focus]: {
    situation: StandardListeningSituation.Focus,
    name: 'Deep Focus & Flow',
    description:
      'Immersive, rhythmic flow states with repetitive harmonic progressions and low vocal distraction to sustain prolonged mental concentration.',
    targetEnergy: 0.50,
    targetTempo: 108,
    energyTolerance: 0.18,
    tempoTolerance: 15,
    targetMood: 'Focus',
    supportedMoods: ['Focus', 'Concentration', 'Chill', 'Atmospheric'],
    recommendedGenres: ['Minimal Techno', 'Post-Rock', 'Ambient Electronic', 'IDM', 'Lo-Fi', 'Modular Synth'],
    noveltyPreference: 0.30,
    weights: {
      contentWeight: 0.42,
      collaborativeWeight: 0.22,
      popularityWeight: 0.12,
      recencyWeight: 0.08,
      noveltyWeight: 0.08,
      genreAffinityWeight: 0.38,
      artistAffinityWeight: 0.28,
      acousticSimilarityWeight: 0.48,
    },
    acousticRanges: {
      minEnergy: 0.30,
      maxEnergy: 0.70,
      minTempo: 90,
      maxTempo: 122,
      instrumentalnessPreference: 0.85,
      danceabilityPreference: 0.45,
      acousticnessPreference: 0.40,
    },
  },

  // 9. GENERAL LISTENING
  [StandardListeningSituation.GeneralListening]: {
    situation: StandardListeningSituation.GeneralListening,
    name: 'General & Daily Listening',
    description:
      'Balanced, versatile baseline tuned to the user’s core personal taste profile, combining familiar favorites with organic discovery.',
    targetEnergy: 0.55,
    targetTempo: 110,
    energyTolerance: 0.35,
    tempoTolerance: 30,
    targetMood: 'Upbeat',
    supportedMoods: ['Upbeat', 'Chill', 'Happy', 'Eclectic'],
    recommendedGenres: [], // Open: dynamically defers to user's taste profile
    noveltyPreference: 0.50,
    weights: {
      contentWeight: 0.35,
      collaborativeWeight: 0.30,
      popularityWeight: 0.20,
      recencyWeight: 0.15,
      noveltyWeight: 0.20,
      genreAffinityWeight: 0.35,
      artistAffinityWeight: 0.35,
      acousticSimilarityWeight: 0.35,
    },
    acousticRanges: {
      minEnergy: 0.20,
      maxEnergy: 0.85,
      minTempo: 70,
      maxTempo: 145,
      instrumentalnessPreference: 0.50,
      danceabilityPreference: 0.55,
      acousticnessPreference: 0.40,
    },
  },
};

export class ContextPreferenceMappingService {
  private static mappings: Record<string, ContextPreferenceMapping> = {
    ...DEFAULT_CONTEXT_MAPPINGS,
  };

  /**
   * Retrieves the configured preference mapping for a specific listening situation.
   * Resolves aliases (e.g. 'gym' -> 'workout', 'coding' -> 'work') or provides dynamic custom mapping.
   */
  public static getMapping(situationInput?: string): ContextPreferenceMapping {
    const normalized = normalizeListeningSituation(situationInput) || StandardListeningSituation.GeneralListening;

    if (this.mappings[normalized]) {
      return { ...this.mappings[normalized] };
    }

    // Dynamic fallback for custom/unregistered contexts
    return {
      situation: normalized,
      name: `Custom (${normalized})`,
      description: `Dynamic preference mapping for custom situation: ${normalized}`,
      targetEnergy: 0.55,
      targetTempo: 115,
      energyTolerance: 0.25,
      tempoTolerance: 25,
      targetMood: 'Upbeat',
      supportedMoods: ['Upbeat', 'Chill', 'Focus'],
      recommendedGenres: [],
      noveltyPreference: 0.50,
      weights: {
        contentWeight: 0.35,
        collaborativeWeight: 0.30,
        popularityWeight: 0.20,
        recencyWeight: 0.15,
        noveltyWeight: 0.20,
        genreAffinityWeight: 0.35,
        artistAffinityWeight: 0.35,
        acousticSimilarityWeight: 0.35,
      },
      acousticRanges: {
        minEnergy: 0.20,
        maxEnergy: 0.85,
        minTempo: 70,
        maxTempo: 145,
        instrumentalnessPreference: 0.50,
        danceabilityPreference: 0.55,
        acousticnessPreference: 0.40,
      },
    };
  }

  /**
   * Returns all active context mappings in the system.
   */
  public static getAllMappings(): Record<string, ContextPreferenceMapping> {
    return { ...this.mappings };
  }

  /**
   * Updates an existing context mapping or registers a new customized context.
   */
  public static updateMapping(
    situation: string,
    updates: Partial<ContextPreferenceMapping>
  ): ContextPreferenceMapping {
    const normalized = normalizeListeningSituation(situation) || situation.trim().toLowerCase();
    const existing = this.getMapping(normalized);

    const merged: ContextPreferenceMapping = {
      ...existing,
      ...updates,
      situation: normalized,
      weights: {
        ...existing.weights,
        ...(updates.weights || {}),
      },
      acousticRanges: {
        ...existing.acousticRanges,
        ...(updates.acousticRanges || {}),
      },
    };

    this.mappings[normalized] = merged;
    return { ...merged };
  }

  /**
   * Resets all context mappings to default standard configurations.
   */
  public static resetMappings(): void {
    this.mappings = { ...DEFAULT_CONTEXT_MAPPINGS };
  }

  /**
   * Converts a given context (and optional user overrides) into concrete recommendation preference signals and weights.
   * This is consumed directly by recommendation candidate generators and ranking pipelines.
   */
  public static mapContextToPreferences(
    context?: RecommendationContextAttributes | null,
    overrides?: Partial<RecommendationContextAttributes>
  ): ContextDerivedPreferences {
    const rawSituation = overrides?.situation || context?.situation || 'general_listening';
    const mapping = this.getMapping(rawSituation);
    const appliedOverrides: string[] = [];

    // Target Energy (User override > Context input > Default mapping)
    let targetEnergy = mapping.targetEnergy;
    if (typeof overrides?.desiredEnergy === 'number') {
      targetEnergy = Math.max(0.0, Math.min(1.0, overrides.desiredEnergy));
      appliedOverrides.push('desiredEnergy');
    } else if (typeof context?.desiredEnergy === 'number') {
      targetEnergy = Math.max(0.0, Math.min(1.0, context.desiredEnergy));
      appliedOverrides.push('context.desiredEnergy');
    }

    // Target Tempo (User override > Context input > Default mapping)
    let targetTempo = mapping.targetTempo;
    if (typeof overrides?.desiredTempo === 'number') {
      targetTempo = Math.max(30, Math.min(250, overrides.desiredTempo));
      appliedOverrides.push('desiredTempo');
    } else if (typeof context?.desiredTempo === 'number') {
      targetTempo = Math.max(30, Math.min(250, context.desiredTempo));
      appliedOverrides.push('context.desiredTempo');
    }

    // Target Mood (User override > Context input > Default mapping)
    let targetMood = mapping.targetMood;
    if (typeof overrides?.mood === 'string' && overrides.mood.trim()) {
      targetMood = overrides.mood.trim();
      appliedOverrides.push('mood');
    } else if (typeof context?.mood === 'string' && context.mood.trim()) {
      targetMood = context.mood.trim();
      appliedOverrides.push('context.mood');
    }

    // Preferred Genres (Merge user overrides + context input + recommended genres)
    const genreSet = new Set<string>();
    if (Array.isArray(overrides?.preferredGenres) && overrides.preferredGenres.length > 0) {
      overrides.preferredGenres.forEach((g) => genreSet.add(g.trim()));
      appliedOverrides.push('preferredGenres');
    } else if (Array.isArray(context?.preferredGenres) && context.preferredGenres.length > 0) {
      context.preferredGenres.forEach((g) => genreSet.add(g.trim()));
      appliedOverrides.push('context.preferredGenres');
    } else {
      mapping.recommendedGenres.forEach((g) => genreSet.add(g));
    }

    // Novelty Preference (User override > Context input > Default mapping)
    let noveltyPreference = mapping.noveltyPreference;
    if (typeof overrides?.discoveryLevel === 'number') {
      noveltyPreference = Math.max(0.0, Math.min(1.0, overrides.discoveryLevel));
      appliedOverrides.push('discoveryLevel');
    } else if (typeof context?.discoveryLevel === 'number') {
      noveltyPreference = Math.max(0.0, Math.min(1.0, context.discoveryLevel));
      appliedOverrides.push('context.discoveryLevel');
    }

    return {
      situation: mapping.situation,
      targetEnergy,
      targetTempo,
      targetMood,
      preferredGenres: Array.from(genreSet).filter(Boolean),
      noveltyPreference,
      rankingWeights: { ...mapping.weights },
      acousticRanges: { ...mapping.acousticRanges },
      appliedOverrides,
    };
  }
}
