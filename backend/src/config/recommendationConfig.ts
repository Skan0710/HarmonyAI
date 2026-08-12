export interface HybridScoringWeights {
  contentSimilarityWeight: number; // default: 0.35
  collaborativeWeight: number;     // default: 0.35
  popularityWeight: number;        // default: 0.15
  recencyWeight: number;           // default: 0.15
}

export const DEFAULT_HYBRID_WEIGHTS: HybridScoringWeights = {
  contentSimilarityWeight: 0.35,
  collaborativeWeight: 0.35,
  popularityWeight: 0.15,
  recencyWeight: 0.15,
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
