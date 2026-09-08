/**
 * Configuration for Taste-Evolution-Aware Discovery Recommendations.
 * Directs recommendations toward where the user's musical taste is actively heading,
 * boosting emerging preferences and adjacent frontiers while requiring meaningful evidence
 * to avoid overreacting to isolated, one-off interactions.
 */

export interface TasteEvolutionDiscoveryConfig {
  minInteractionsForEmergenceTrend: number; // Minimum play/interaction count required to treat an emerging item as a verified trend (default: 2)
  minEmergenceConfidence: number;           // Minimum emergence confidence threshold (default: 0.35)
  emergingGenreBoost: number;               // Boost applied to verified emerging genre candidates (default: 0.35)
  sustainedEmergingBonus: number;           // Additional boost if preference has been sustained across multiple snapshots (default: 0.15)
  relatedEmergingArtistBoost: number;       // Boost applied to artists related to emerging artists (default: 0.25)
  risingMoodBoost: number;                  // Boost applied to moods with rising temporal momentum (default: 0.20)
  adjacentRecentGenreBoost: number;         // Boost applied to genres adjacent to recent emerging behavior (default: 0.20)
  fadingPenalty: number;                    // Penalty applied to fading/declining preferences (default: 0.25)
  stableAnchorBaseScore: number;            // Foundational score weight for established stable preferences (default: 0.35)
  transformationIntensityMultiplier: number;// Multiplier for emerging signals when user is in rapid transformation (default: 1.25)
  maxFadingThreshold: number;               // Momentum delta threshold below which preference is classified as fading (default: -0.20)
  flukeSuppressionPenalty: number;          // Attenuation applied to isolated unverified flukes without interaction evidence (default: 0.30)
  diversityDecayRate: number;               // Penalty per duplicate genre occurrence in evolution recommendations (default: 0.05)
}

export const DEFAULT_TASTE_EVOLUTION_DISCOVERY_CONFIG: TasteEvolutionDiscoveryConfig = {
  minInteractionsForEmergenceTrend: 2,
  minEmergenceConfidence: 0.35,
  emergingGenreBoost: 0.35,
  sustainedEmergingBonus: 0.15,
  relatedEmergingArtistBoost: 0.25,
  risingMoodBoost: 0.20,
  adjacentRecentGenreBoost: 0.20,
  fadingPenalty: 0.25,
  stableAnchorBaseScore: 0.35,
  transformationIntensityMultiplier: 1.25,
  maxFadingThreshold: -0.20,
  flukeSuppressionPenalty: 0.30,
  diversityDecayRate: 0.05,
};

let currentTasteEvolutionDiscoveryConfig: TasteEvolutionDiscoveryConfig = {
  ...DEFAULT_TASTE_EVOLUTION_DISCOVERY_CONFIG,
};

export const getTasteEvolutionDiscoveryConfig = (): TasteEvolutionDiscoveryConfig => {
  return { ...currentTasteEvolutionDiscoveryConfig };
};

export const updateTasteEvolutionDiscoveryConfig = (
  newConfig: Partial<TasteEvolutionDiscoveryConfig>
): TasteEvolutionDiscoveryConfig => {
  currentTasteEvolutionDiscoveryConfig = {
    ...currentTasteEvolutionDiscoveryConfig,
    ...newConfig,
  };
  return getTasteEvolutionDiscoveryConfig();
};

export const resetTasteEvolutionDiscoveryConfig = (): TasteEvolutionDiscoveryConfig => {
  currentTasteEvolutionDiscoveryConfig = { ...DEFAULT_TASTE_EVOLUTION_DISCOVERY_CONFIG };
  return getTasteEvolutionDiscoveryConfig();
};
