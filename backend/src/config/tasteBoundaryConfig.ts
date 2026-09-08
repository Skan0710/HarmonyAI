/**
 * Configuration for Taste Boundary Detection.
 * Defines thresholds for core preferences, adjacent sister genres, underexplored areas,
 * and boundary breadth classifications.
 */

export interface TasteBoundaryConfig {
  coreAffinityThreshold: number;           // Affinity score >= this is classified as strongly preferred (0.70)
  secondaryAffinityThreshold: number;      // Affinity score in [0.40, 0.70) is candidate for familiar/underexplored
  underexploredPlayCountThreshold: number; // Play counts <= this indicate underexplored depth (5)
  maxAdjacentGenres: number;               // Max number of adjacent genres to return (8)
  maxAdjacentArtists: number;              // Max number of adjacent artists to return (8)
  maxUnderexploredAreas: number;           // Max number of familiar underexplored items (6)
  maxPotentialNewAreas: number;            // Max number of emerging frontier items (6)
  maxLowConfidenceAreas: number;           // Max number of low-confidence items (5)
  minInteractionHistory: number;           // Minimum interactions required for confident boundary mapping (5)
  narrowBreadthThreshold: number;          // Breadth score < this is NARROW (0.35)
  wideBreadthThreshold: number;            // Breadth score >= this is WIDE (0.65)
  expansiveBreadthThreshold: number;       // Breadth score >= this is EXPANSIVE (0.82)
}

export const DEFAULT_TASTE_BOUNDARY_CONFIG: TasteBoundaryConfig = {
  coreAffinityThreshold: 0.70,
  secondaryAffinityThreshold: 0.40,
  underexploredPlayCountThreshold: 5,
  maxAdjacentGenres: 8,
  maxAdjacentArtists: 8,
  maxUnderexploredAreas: 6,
  maxPotentialNewAreas: 6,
  maxLowConfidenceAreas: 5,
  minInteractionHistory: 5,
  narrowBreadthThreshold: 0.35,
  wideBreadthThreshold: 0.65,
  expansiveBreadthThreshold: 0.82,
};

let currentTasteBoundaryConfig: TasteBoundaryConfig = {
  ...DEFAULT_TASTE_BOUNDARY_CONFIG,
};

export const getTasteBoundaryConfig = (): TasteBoundaryConfig => {
  return { ...currentTasteBoundaryConfig };
};

export const updateTasteBoundaryConfig = (
  newConfig: Partial<TasteBoundaryConfig>
): TasteBoundaryConfig => {
  currentTasteBoundaryConfig = {
    ...currentTasteBoundaryConfig,
    ...newConfig,
  };
  return getTasteBoundaryConfig();
};

export const resetTasteBoundaryConfig = (): TasteBoundaryConfig => {
  currentTasteBoundaryConfig = { ...DEFAULT_TASTE_BOUNDARY_CONFIG };
  return getTasteBoundaryConfig();
};
