export interface HybridScoringWeights {
  contentSimilarityWeight: number; // default: 0.25
  collaborativeWeight: number;     // default: 0.25
  userTasteAffinityWeight: number; // default: 0.25 (User Taste Profile signal)
  popularityWeight: number;        // default: 0.125
  recencyWeight: number;           // default: 0.125
}

export const DEFAULT_HYBRID_WEIGHTS: HybridScoringWeights = {
  contentSimilarityWeight: 0.25,
  collaborativeWeight: 0.25,
  userTasteAffinityWeight: 0.25,
  popularityWeight: 0.125,
  recencyWeight: 0.125,
};

let currentHybridWeights: HybridScoringWeights = { ...DEFAULT_HYBRID_WEIGHTS };

export const getHybridConfigWeights = (): HybridScoringWeights => {
  return { ...currentHybridWeights };
};

export const updateHybridConfigWeights = (
  newWeights: Partial<HybridScoringWeights>
): HybridScoringWeights => {
  currentHybridWeights = { ...currentHybridWeights, ...newWeights };
  return { ...currentHybridWeights };
};

export const resetHybridConfigWeights = (): HybridScoringWeights => {
  currentHybridWeights = { ...DEFAULT_HYBRID_WEIGHTS };
  return { ...currentHybridWeights };
};

export interface TasteProfileRecencyConfig {
  halfLifeDays: number; // Days after which interaction influence decays by 50%
  minWeightFloor: number; // Minimum weight floor to prevent zeroing out older history
}

export const DEFAULT_RECENCY_CONFIG: TasteProfileRecencyConfig = {
  halfLifeDays: 30, // 30-day half-life by default
  minWeightFloor: 0.05,
};

let currentRecencyConfig: TasteProfileRecencyConfig = { ...DEFAULT_RECENCY_CONFIG };

export const getRecencyConfig = (): TasteProfileRecencyConfig => {
  return { ...currentRecencyConfig };
};

export const updateRecencyConfig = (
  newConfig: Partial<TasteProfileRecencyConfig>
): TasteProfileRecencyConfig => {
  currentRecencyConfig = { ...currentRecencyConfig, ...newConfig };
  return { ...currentRecencyConfig };
};

export const resetRecencyConfig = (): TasteProfileRecencyConfig => {
  currentRecencyConfig = { ...DEFAULT_RECENCY_CONFIG };
  return { ...currentRecencyConfig };
};
