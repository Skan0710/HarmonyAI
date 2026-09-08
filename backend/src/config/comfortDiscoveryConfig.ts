/**
 * Configuration for Comfort vs Discovery Scoring.
 * Determines how much a user prefers familiar music versus discovering something new.
 */

export interface ComfortDiscoverySignalWeights {
  repeatListening: number;       // Weight for repeat listening tendency (default: 0.18)
  explorationTendency: number;   // Weight for exploration tendency (default: 0.18)
  noveltyInteraction: number;    // Weight for novelty interactions (default: 0.14)
  feedback: number;              // Weight for recent skips and positive feedback (default: 0.14)
  diversity: number;             // Weight for genre and artist diversity (default: 0.12)
  tasteStability: number;        // Weight for taste stability and persistence (default: 0.12)
  emergingInterests: number;     // Weight for emerging interests & momentum (default: 0.12)
}

export interface ComfortDiscoveryConfig {
  defaultComfortScore: number;     // Default comfort score for neutral/cold-start users (0.50)
  defaultDiscoveryScore: number;   // Default discovery score for neutral/cold-start users (0.50)
  weights: ComfortDiscoverySignalWeights;
  skipPenaltySensitivity: number;  // Multiplier for recent skips shifting preference toward comfort (0.25)
  likeBoostSensitivity: number;    // Multiplier for positive feedback boosting discovery (0.20)
  minHistoryInteractions: number;  // Minimum interaction count for full data sufficiency (5)
  minConfidenceFloor: number;      // Minimum confidence score (0.10)
  maxConfidenceCeiling: number;    // Maximum confidence score (0.98)
}

export const DEFAULT_COMFORT_DISCOVERY_WEIGHTS: ComfortDiscoverySignalWeights = {
  repeatListening: 0.18,
  explorationTendency: 0.18,
  noveltyInteraction: 0.14,
  feedback: 0.14,
  diversity: 0.12,
  tasteStability: 0.12,
  emergingInterests: 0.12,
};

export const DEFAULT_COMFORT_DISCOVERY_CONFIG: ComfortDiscoveryConfig = {
  defaultComfortScore: 0.50,
  defaultDiscoveryScore: 0.50,
  weights: { ...DEFAULT_COMFORT_DISCOVERY_WEIGHTS },
  skipPenaltySensitivity: 0.25,
  likeBoostSensitivity: 0.20,
  minHistoryInteractions: 5,
  minConfidenceFloor: 0.15,
  maxConfidenceCeiling: 0.98,
};

let currentComfortDiscoveryConfig: ComfortDiscoveryConfig = {
  ...DEFAULT_COMFORT_DISCOVERY_CONFIG,
  weights: { ...DEFAULT_COMFORT_DISCOVERY_WEIGHTS },
};

/**
 * Returns a copy of the current Comfort vs Discovery configuration.
 */
export const getComfortDiscoveryConfig = (): ComfortDiscoveryConfig => {
  return {
    ...currentComfortDiscoveryConfig,
    weights: { ...currentComfortDiscoveryConfig.weights },
  };
};

/**
 * Dynamically updates the Comfort vs Discovery configuration at runtime.
 */
export const updateComfortDiscoveryConfig = (
  newConfig: Partial<ComfortDiscoveryConfig>
): ComfortDiscoveryConfig => {
  currentComfortDiscoveryConfig = {
    ...currentComfortDiscoveryConfig,
    ...newConfig,
    weights: {
      ...currentComfortDiscoveryConfig.weights,
      ...(newConfig.weights || {}),
    },
  };
  return getComfortDiscoveryConfig();
};

/**
 * Resets the Comfort vs Discovery configuration back to default values.
 */
export const resetComfortDiscoveryConfig = (): ComfortDiscoveryConfig => {
  currentComfortDiscoveryConfig = {
    ...DEFAULT_COMFORT_DISCOVERY_CONFIG,
    weights: { ...DEFAULT_COMFORT_DISCOVERY_WEIGHTS },
  };
  return getComfortDiscoveryConfig();
};
