/**
 * Configuration for Outside-Comfort-Zone Recommendations.
 * Balances relevance against novelty to recommend music that is
 * close enough to be appealing, but different enough to provide true discovery.
 */

export interface OutsideComfortZoneConfig {
  defaultRelevanceWeight: number;      // Weight given to musical relevance (default: 0.55)
  defaultNoveltyWeight: number;        // Weight given to boundary expansion & novelty (default: 0.45)
  minRelevanceFloor: number;           // Rejects songs with relevance below this threshold to avoid random songs (default: 0.25)
  maxFamiliarPlaysThreshold: number;   // Songs with plays > this are considered inside comfort zone and penalized (default: 3)
  comfortLeaningRelevanceBoost: number;// Added to relevance weight when user is comfort-oriented (default: 0.15)
  exploratoryNoveltyBoost: number;     // Added to novelty weight when user is highly exploratory (default: 0.15)
  adjacentGenreWeight: number;         // Weight for matching adjacent genres (default: 0.40)
  moodHarmonyWeight: number;           // Weight for emotional/mood compatibility (default: 0.30)
  acousticHarmonyWeight: number;       // Weight for acoustic feature harmony (default: 0.30)
  diversityDecayRate: number;          // Penalty per duplicate genre occurrence in recommendations (default: 0.05)
}

export const DEFAULT_OUTSIDE_COMFORT_ZONE_CONFIG: OutsideComfortZoneConfig = {
  defaultRelevanceWeight: 0.55,
  defaultNoveltyWeight: 0.45,
  minRelevanceFloor: 0.25,
  maxFamiliarPlaysThreshold: 3,
  comfortLeaningRelevanceBoost: 0.15,
  exploratoryNoveltyBoost: 0.15,
  adjacentGenreWeight: 0.40,
  moodHarmonyWeight: 0.30,
  acousticHarmonyWeight: 0.30,
  diversityDecayRate: 0.05,
};

let currentOutsideComfortZoneConfig: OutsideComfortZoneConfig = {
  ...DEFAULT_OUTSIDE_COMFORT_ZONE_CONFIG,
};

export const getOutsideComfortZoneConfig = (): OutsideComfortZoneConfig => {
  return { ...currentOutsideComfortZoneConfig };
};

export const updateOutsideComfortZoneConfig = (
  newConfig: Partial<OutsideComfortZoneConfig>
): OutsideComfortZoneConfig => {
  currentOutsideComfortZoneConfig = {
    ...currentOutsideComfortZoneConfig,
    ...newConfig,
  };
  return getOutsideComfortZoneConfig();
};

export const resetOutsideComfortZoneConfig = (): OutsideComfortZoneConfig => {
  currentOutsideComfortZoneConfig = { ...DEFAULT_OUTSIDE_COMFORT_ZONE_CONFIG };
  return getOutsideComfortZoneConfig();
};
