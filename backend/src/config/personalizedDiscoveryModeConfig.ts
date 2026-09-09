import {
  HybridScoringWeights,
  NoveltyScoringWeights,
} from './recommendationConfig.js';
import { OutsideComfortZoneConfig } from './outsideComfortZoneConfig.js';
import { TasteEvolutionDiscoveryConfig } from './tasteEvolutionDiscoveryConfig.js';

export type PersonalizedDiscoveryMode =
  | 'FOR_YOU'
  | 'COMFORT'
  | 'DISCOVER'
  | 'OUTSIDE_YOUR_TASTE'
  | 'WHATS_NEW_FOR_YOU';

export interface PersonalizedDiscoveryModeConfig {
  mode: PersonalizedDiscoveryMode;
  label: string;
  description: string;
  strategyType: 'STANDARD' | 'OUTSIDE_COMFORT_ZONE' | 'TASTE_EVOLUTION_DISCOVERY';
  hybridWeights: HybridScoringWeights;
  noveltyWeights: NoveltyScoringWeights;
  useNoveltyScoring: boolean;
  explorationRate: number;
  useAdaptiveExploration: boolean;
  diversityStrength: number;
  useDiversityRanking: boolean;
  musicDnaInfluence: number;
  personalMusicTwinInfluence: number;
  outsideComfortZoneOverrides?: Partial<OutsideComfortZoneConfig>;
  tasteEvolutionOverrides?: Partial<TasteEvolutionDiscoveryConfig>;
}

export const DEFAULT_PERSONALIZED_DISCOVERY_MODES: Record<
  PersonalizedDiscoveryMode,
  PersonalizedDiscoveryModeConfig
> = {
  FOR_YOU: {
    mode: 'FOR_YOU',
    label: 'For You',
    description: 'Balanced personalized recommendations tailored to your overall taste and current listening habits.',
    strategyType: 'STANDARD',
    hybridWeights: {
      contentSimilarityWeight: 0.25,
      collaborativeWeight: 0.25,
      userTasteAffinityWeight: 0.25,
      popularityWeight: 0.125,
      recencyWeight: 0.125,
    },
    noveltyWeights: {
      noveltyWeight: 0.15,
      minRelevanceThreshold: 0.35,
      maxCatalogPlayCount: 1000,
      userExposureDecayFactor: 0.20,
    },
    useNoveltyScoring: true,
    explorationRate: 0.20,
    useAdaptiveExploration: true,
    diversityStrength: 0.25,
    useDiversityRanking: true,
    musicDnaInfluence: 0.25,
    personalMusicTwinInfluence: 0.25,
  },
  COMFORT: {
    mode: 'COMFORT',
    label: 'Comfort',
    description: 'Strongly familiar recommendations anchored in your core genres, top artists, and beloved favorites.',
    strategyType: 'STANDARD',
    hybridWeights: {
      contentSimilarityWeight: 0.30,
      collaborativeWeight: 0.15,
      userTasteAffinityWeight: 0.35,
      popularityWeight: 0.15,
      recencyWeight: 0.05,
    },
    noveltyWeights: {
      noveltyWeight: 0.05,
      minRelevanceThreshold: 0.45,
      maxCatalogPlayCount: 5000,
      userExposureDecayFactor: 0.10,
    },
    useNoveltyScoring: false,
    explorationRate: 0.05,
    useAdaptiveExploration: false,
    diversityStrength: 0.10,
    useDiversityRanking: true,
    musicDnaInfluence: 0.35,
    personalMusicTwinInfluence: 0.35,
  },
  DISCOVER: {
    mode: 'DISCOVER',
    label: 'Discover',
    description: 'More novel but still relevant recommendations introducing new sounds while respecting your aesthetic signature.',
    strategyType: 'STANDARD',
    hybridWeights: {
      contentSimilarityWeight: 0.20,
      collaborativeWeight: 0.25,
      userTasteAffinityWeight: 0.20,
      popularityWeight: 0.10,
      recencyWeight: 0.25,
    },
    noveltyWeights: {
      noveltyWeight: 0.40,
      minRelevanceThreshold: 0.25,
      maxCatalogPlayCount: 500,
      userExposureDecayFactor: 0.35,
    },
    useNoveltyScoring: true,
    explorationRate: 0.45,
    useAdaptiveExploration: true,
    diversityStrength: 0.45,
    useDiversityRanking: true,
    musicDnaInfluence: 0.20,
    personalMusicTwinInfluence: 0.25,
  },
  OUTSIDE_YOUR_TASTE: {
    mode: 'OUTSIDE_YOUR_TASTE',
    label: 'Outside Your Taste',
    description: 'Carefully selected recommendations beyond established preferences, exploring adjacent genres and artistic frontiers.',
    strategyType: 'OUTSIDE_COMFORT_ZONE',
    hybridWeights: {
      contentSimilarityWeight: 0.15,
      collaborativeWeight: 0.25,
      userTasteAffinityWeight: 0.15,
      popularityWeight: 0.15,
      recencyWeight: 0.30,
    },
    noveltyWeights: {
      noveltyWeight: 0.45,
      minRelevanceThreshold: 0.20,
      maxCatalogPlayCount: 500,
      userExposureDecayFactor: 0.40,
    },
    useNoveltyScoring: true,
    explorationRate: 0.50,
    useAdaptiveExploration: true,
    diversityStrength: 0.50,
    useDiversityRanking: true,
    musicDnaInfluence: 0.20,
    personalMusicTwinInfluence: 0.30,
    outsideComfortZoneOverrides: {
      defaultRelevanceWeight: 0.55,
      defaultNoveltyWeight: 0.45,
    },
  },
  WHATS_NEW_FOR_YOU: {
    mode: 'WHATS_NEW_FOR_YOU',
    label: "What's New For You",
    description: 'Recommendations based on emerging taste momentum, newly rising genres, and active taste evolution chapters.',
    strategyType: 'TASTE_EVOLUTION_DISCOVERY',
    hybridWeights: {
      contentSimilarityWeight: 0.20,
      collaborativeWeight: 0.20,
      userTasteAffinityWeight: 0.25,
      popularityWeight: 0.10,
      recencyWeight: 0.25,
    },
    noveltyWeights: {
      noveltyWeight: 0.30,
      minRelevanceThreshold: 0.30,
      maxCatalogPlayCount: 800,
      userExposureDecayFactor: 0.25,
    },
    useNoveltyScoring: true,
    explorationRate: 0.35,
    useAdaptiveExploration: true,
    diversityStrength: 0.35,
    useDiversityRanking: true,
    musicDnaInfluence: 0.30,
    personalMusicTwinInfluence: 0.35,
    tasteEvolutionOverrides: {
      emergingGenreBoost: 0.40,
      relatedEmergingArtistBoost: 0.30,
      risingMoodBoost: 0.25,
      adjacentRecentGenreBoost: 0.25,
    },
  },
};

const cloneModeConfig = (
  config: PersonalizedDiscoveryModeConfig
): PersonalizedDiscoveryModeConfig => ({
  ...config,
  hybridWeights: { ...config.hybridWeights },
  noveltyWeights: { ...config.noveltyWeights },
  outsideComfortZoneOverrides: config.outsideComfortZoneOverrides
    ? { ...config.outsideComfortZoneOverrides }
    : undefined,
  tasteEvolutionOverrides: config.tasteEvolutionOverrides
    ? { ...config.tasteEvolutionOverrides }
    : undefined,
});

const cloneAllModeConfigs = (): Record<
  PersonalizedDiscoveryMode,
  PersonalizedDiscoveryModeConfig
> => ({
  FOR_YOU: cloneModeConfig(DEFAULT_PERSONALIZED_DISCOVERY_MODES.FOR_YOU),
  COMFORT: cloneModeConfig(DEFAULT_PERSONALIZED_DISCOVERY_MODES.COMFORT),
  DISCOVER: cloneModeConfig(DEFAULT_PERSONALIZED_DISCOVERY_MODES.DISCOVER),
  OUTSIDE_YOUR_TASTE: cloneModeConfig(DEFAULT_PERSONALIZED_DISCOVERY_MODES.OUTSIDE_YOUR_TASTE),
  WHATS_NEW_FOR_YOU: cloneModeConfig(DEFAULT_PERSONALIZED_DISCOVERY_MODES.WHATS_NEW_FOR_YOU),
});

let currentDiscoveryModes = cloneAllModeConfigs();

/**
 * Returns all configured discovery modes.
 */
export const getAllDiscoveryModeConfigs = (): Record<
  PersonalizedDiscoveryMode,
  PersonalizedDiscoveryModeConfig
> => {
  return {
    FOR_YOU: cloneModeConfig(currentDiscoveryModes.FOR_YOU),
    COMFORT: cloneModeConfig(currentDiscoveryModes.COMFORT),
    DISCOVER: cloneModeConfig(currentDiscoveryModes.DISCOVER),
    OUTSIDE_YOUR_TASTE: cloneModeConfig(currentDiscoveryModes.OUTSIDE_YOUR_TASTE),
    WHATS_NEW_FOR_YOU: cloneModeConfig(currentDiscoveryModes.WHATS_NEW_FOR_YOU),
  };
};

/**
 * Returns configuration for a specific discovery mode.
 */
export const getDiscoveryModeConfig = (
  mode: PersonalizedDiscoveryMode
): PersonalizedDiscoveryModeConfig => {
  return cloneModeConfig(currentDiscoveryModes[mode]);
};

/**
 * Dynamically updates configuration for a specific discovery mode.
 */
export const updateDiscoveryModeConfig = (
  mode: PersonalizedDiscoveryMode,
  overrides: Partial<PersonalizedDiscoveryModeConfig>
): PersonalizedDiscoveryModeConfig => {
  currentDiscoveryModes[mode] = {
    ...currentDiscoveryModes[mode],
    ...overrides,
    hybridWeights: {
      ...currentDiscoveryModes[mode].hybridWeights,
      ...(overrides.hybridWeights || {}),
    },
    noveltyWeights: {
      ...currentDiscoveryModes[mode].noveltyWeights,
      ...(overrides.noveltyWeights || {}),
    },
    outsideComfortZoneOverrides: {
      ...(currentDiscoveryModes[mode].outsideComfortZoneOverrides || {}),
      ...(overrides.outsideComfortZoneOverrides || {}),
    },
    tasteEvolutionOverrides: {
      ...(currentDiscoveryModes[mode].tasteEvolutionOverrides || {}),
      ...(overrides.tasteEvolutionOverrides || {}),
    },
  };
  return cloneModeConfig(currentDiscoveryModes[mode]);
};

/**
 * Resets all discovery modes to their default weights.
 */
export const resetDiscoveryModeConfigs = (): void => {
  currentDiscoveryModes = cloneAllModeConfigs();
};

/**
 * Resolves a raw string input into a canonical PersonalizedDiscoveryMode.
 * Defaults gracefully to 'FOR_YOU' for empty or unrecognized strings.
 */
export const resolvePersonalizedDiscoveryMode = (
  input?: string | null
): PersonalizedDiscoveryMode => {
  if (!input) return 'FOR_YOU';

  const normalized = input.trim().toUpperCase().replace(/[\s-]+/g, '_');

  switch (normalized) {
    case 'COMFORT':
    case 'COMFORT_ZONE':
    case 'FAMILIAR':
      return 'COMFORT';

    case 'DISCOVER':
    case 'DISCOVERY':
    case 'EXPLORE':
    case 'EXPLORATION':
      return 'DISCOVER';

    case 'OUTSIDE_YOUR_TASTE':
    case 'OUTSIDE_TASTE':
    case 'OUTSIDE_COMFORT_ZONE':
    case 'OUTSIDE_ZONE':
    case 'FRONTIER':
      return 'OUTSIDE_YOUR_TASTE';

    case 'WHATS_NEW_FOR_YOU':
    case 'WHATS_NEW':
    case 'WHAT_IS_NEW':
    case 'NEW_FOR_YOU':
    case 'TASTE_EVOLUTION':
    case 'EVOLVING':
    case 'EMERGING':
      return 'WHATS_NEW_FOR_YOU';

    case 'FOR_YOU':
    case 'STANDARD':
    case 'BALANCED':
    case 'HYBRID':
    default:
      return 'FOR_YOU';
  }
};
