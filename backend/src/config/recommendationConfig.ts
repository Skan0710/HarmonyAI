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

export interface ContextScoringWeights {
  contentSimilarityWeight: number; // default: 0.20
  collaborativeWeight: number;     // default: 0.20
  userTasteAffinityWeight: number; // default: 0.20
  popularityWeight: number;        // default: 0.10
  recencyWeight: number;           // default: 0.10
  moodCompatibilityWeight: number; // default: 0.10
  contextActivityCompatibilityWeight: number; // default: 0.10
}

export const DEFAULT_CONTEXT_WEIGHTS: ContextScoringWeights = {
  contentSimilarityWeight: 0.20,
  collaborativeWeight: 0.20,
  userTasteAffinityWeight: 0.20,
  popularityWeight: 0.10,
  recencyWeight: 0.10,
  moodCompatibilityWeight: 0.10,
  contextActivityCompatibilityWeight: 0.10,
};

let currentContextWeights: ContextScoringWeights = { ...DEFAULT_CONTEXT_WEIGHTS };

export const getContextConfigWeights = (): ContextScoringWeights => {
  return { ...currentContextWeights };
};

export const updateContextConfigWeights = (
  newWeights: Partial<ContextScoringWeights>
): ContextScoringWeights => {
  currentContextWeights = { ...currentContextWeights, ...newWeights };
  return { ...currentContextWeights };
};

export const resetContextConfigWeights = (): ContextScoringWeights => {
  currentContextWeights = { ...DEFAULT_CONTEXT_WEIGHTS };
  return { ...currentContextWeights };
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

export interface AdaptiveSessionScoringWeights {
  contentSimilarityWeight: number;       // default: 0.35
  sessionProfileAffinityWeight: number;   // default: 0.35
  interactionFeedbackWeight: number;      // default: 0.30
  likeInteractionMultiplier: number;      // default: 1.5
  replayInteractionMultiplier: number;    // default: 1.3
  completeInteractionMultiplier: number;  // default: 1.1
  skipInteractionMultiplier: number;      // default: -1.2
  recencyDecayLambda: number;             // default: 0.20
}

export const DEFAULT_ADAPTIVE_SESSION_WEIGHTS: AdaptiveSessionScoringWeights = {
  contentSimilarityWeight: 0.35,
  sessionProfileAffinityWeight: 0.35,
  interactionFeedbackWeight: 0.30,
  likeInteractionMultiplier: 1.5,
  replayInteractionMultiplier: 1.3,
  completeInteractionMultiplier: 1.1,
  skipInteractionMultiplier: -1.2,
  recencyDecayLambda: 0.20,
};

let currentAdaptiveSessionWeights: AdaptiveSessionScoringWeights = { ...DEFAULT_ADAPTIVE_SESSION_WEIGHTS };

export const getAdaptiveSessionWeights = (): AdaptiveSessionScoringWeights => {
  return { ...currentAdaptiveSessionWeights };
};

export const updateAdaptiveSessionWeights = (
  newWeights: Partial<AdaptiveSessionScoringWeights>
): AdaptiveSessionScoringWeights => {
  currentAdaptiveSessionWeights = { ...currentAdaptiveSessionWeights, ...newWeights };
  return { ...currentAdaptiveSessionWeights };
};

export const resetAdaptiveSessionWeights = (): AdaptiveSessionScoringWeights => {
  currentAdaptiveSessionWeights = { ...DEFAULT_ADAPTIVE_SESSION_WEIGHTS };
  return { ...currentAdaptiveSessionWeights };
};

export interface GenreDiversityWeights {
  defaultMaxGenreConcentration: number;  // default: 0.40 (max 40% from a single genre)
  userPreferredGenreThreshold: number;   // default: 0.30 (affinity >= 0.30 allows increased concentration)
  userPreferredMaxConcentration: number;  // default: 0.70 (up to 70% if strongly preferred in user taste profile)
  diversityPenaltyWeight: number;        // default: 0.15
}

export const DEFAULT_GENRE_DIVERSITY_WEIGHTS: GenreDiversityWeights = {
  defaultMaxGenreConcentration: 0.40,
  userPreferredGenreThreshold: 0.30,
  userPreferredMaxConcentration: 0.70,
  diversityPenaltyWeight: 0.15,
};

let currentGenreDiversityWeights: GenreDiversityWeights = { ...DEFAULT_GENRE_DIVERSITY_WEIGHTS };

export const getGenreDiversityWeights = (): GenreDiversityWeights => {
  return { ...currentGenreDiversityWeights };
};

export const updateGenreDiversityWeights = (
  newWeights: Partial<GenreDiversityWeights>
): GenreDiversityWeights => {
  currentGenreDiversityWeights = { ...currentGenreDiversityWeights, ...newWeights };
  return { ...currentGenreDiversityWeights };
};

export const resetGenreDiversityWeights = (): GenreDiversityWeights => {
  currentGenreDiversityWeights = { ...DEFAULT_GENRE_DIVERSITY_WEIGHTS };
  return { ...currentGenreDiversityWeights };
};

export interface NoveltyScoringWeights {
  noveltyWeight: number;             // default: 0.15 (15% weight)
  minRelevanceThreshold: number;     // default: 0.35 (below 0.35 base relevance, novelty boost is gated to 0)
  maxCatalogPlayCount: number;       // default: 1000
  userExposureDecayFactor: number;   // default: 0.20
}

export const DEFAULT_NOVELTY_WEIGHTS: NoveltyScoringWeights = {
  noveltyWeight: 0.15,
  minRelevanceThreshold: 0.35,
  maxCatalogPlayCount: 1000,
  userExposureDecayFactor: 0.20,
};

let currentNoveltyWeights: NoveltyScoringWeights = { ...DEFAULT_NOVELTY_WEIGHTS };

export const getNoveltyConfigWeights = (): NoveltyScoringWeights => {
  return { ...currentNoveltyWeights };
};

export const updateNoveltyConfigWeights = (
  newWeights: Partial<NoveltyScoringWeights>
): NoveltyScoringWeights => {
  currentNoveltyWeights = { ...currentNoveltyWeights, ...newWeights };
  return { ...currentNoveltyWeights };
};

export const resetNoveltyConfigWeights = (): NoveltyScoringWeights => {
  currentNoveltyWeights = { ...DEFAULT_NOVELTY_WEIGHTS };
  return { ...currentNoveltyWeights };
};

export interface RecommendationRepetitionConfig {
  cooldownWindowHours: number;             // default: 24 hours
  skippedCooldownWindowHours: number;      // default: 72 hours
  repetitionPenalty: number;               // default: 0.35
  reappearanceRelevanceThreshold: number; // default: 0.85
  maxRecentHistoryLookback: number;        // default: 200
}

export const DEFAULT_REPETITION_CONFIG: RecommendationRepetitionConfig = {
  cooldownWindowHours: 24,
  skippedCooldownWindowHours: 72,
  repetitionPenalty: 0.35,
  reappearanceRelevanceThreshold: 0.85,
  maxRecentHistoryLookback: 200,
};

let currentRepetitionConfig: RecommendationRepetitionConfig = { ...DEFAULT_REPETITION_CONFIG };

export const getRepetitionConfig = (): RecommendationRepetitionConfig => {
  return { ...currentRepetitionConfig };
};

export const updateRepetitionConfig = (
  newConfig: Partial<RecommendationRepetitionConfig>
): RecommendationRepetitionConfig => {
  currentRepetitionConfig = { ...currentRepetitionConfig, ...newConfig };
  return { ...currentRepetitionConfig };
};

export const resetRepetitionConfig = (): RecommendationRepetitionConfig => {
  currentRepetitionConfig = { ...DEFAULT_REPETITION_CONFIG };
  return { ...currentRepetitionConfig };
};
