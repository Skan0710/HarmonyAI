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

export interface ContextInfluenceConfig {
  defaultContextInfluence: number; // default: 0.25 (25% context influence, 75% personalized signal)
  maxContextInfluence: number;     // default: 0.40 (ensures personalized score remains primary signal >= 60%)
  minContextInfluence: number;     // default: 0.00
}

export const DEFAULT_CONTEXT_INFLUENCE_CONFIG: ContextInfluenceConfig = {
  defaultContextInfluence: 0.25,
  maxContextInfluence: 0.40,
  minContextInfluence: 0.00,
};

let currentContextInfluenceConfig: ContextInfluenceConfig = { ...DEFAULT_CONTEXT_INFLUENCE_CONFIG };

export const getContextInfluenceConfig = (): ContextInfluenceConfig => {
  return { ...currentContextInfluenceConfig };
};

export const updateContextInfluenceConfig = (
  newConfig: Partial<ContextInfluenceConfig>
): ContextInfluenceConfig => {
  currentContextInfluenceConfig = { ...currentContextInfluenceConfig, ...newConfig };
  return { ...currentContextInfluenceConfig };
};

export const resetContextInfluenceConfig = (): ContextInfluenceConfig => {
  currentContextInfluenceConfig = { ...DEFAULT_CONTEXT_INFLUENCE_CONFIG };
  return { ...currentContextInfluenceConfig };
};

export interface SessionInfluenceConfig {
  defaultSessionInfluence: number;       // default: 0.20 (20% session influence, keeping taste profile primary)
  maxSessionInfluence: number;           // default: 0.35 (ensures core preferences never completely overridden)
  minSessionInfluence: number;           // default: 0.00
  recentCompletionBoost: number;         // default: 1.25 (boosts tracks similar to recent completions/replays)
  repeatedSkipPenalty: number;           // default: 0.40 (penalty multiplier for tracks similar to repeatedly skipped items)
  directSkippedSongSuppression: number;  // default: 0.10 (direct suppression for songs skipped in current session)
}

export const DEFAULT_SESSION_INFLUENCE_CONFIG: SessionInfluenceConfig = {
  defaultSessionInfluence: 0.20,
  maxSessionInfluence: 0.35,
  minSessionInfluence: 0.00,
  recentCompletionBoost: 1.25,
  repeatedSkipPenalty: 0.40,
  directSkippedSongSuppression: 0.10,
};

let currentSessionInfluenceConfig: SessionInfluenceConfig = { ...DEFAULT_SESSION_INFLUENCE_CONFIG };

export const getSessionInfluenceConfig = (): SessionInfluenceConfig => {
  return { ...currentSessionInfluenceConfig };
};

export const updateSessionInfluenceConfig = (
  newConfig: Partial<SessionInfluenceConfig>
): SessionInfluenceConfig => {
  currentSessionInfluenceConfig = { ...currentSessionInfluenceConfig, ...newConfig };
  return { ...currentSessionInfluenceConfig };
};

export interface SessionAdaptationConfig {
  driftThreshold: number;              // default: 0.30 (overall drift score threshold to trigger regeneration)
  genreDriftThreshold: number;         // default: 0.35 (genre distribution divergence threshold)
  artistDriftThreshold: number;        // default: 0.35 (artist distribution divergence threshold)
  energyDriftThreshold: number;        // default: 0.20 (delta in average energy)
  tempoDriftThreshold: number;         // default: 15.0 (delta in BPM)
  moodDriftThreshold: number;          // default: 0.30 (mood divergence threshold)
  minInteractionsBeforeRegen: number;  // default: 2 (cooldown / min events before checking regeneration)
  maxConsecutiveSkipsBeforeRegen: number; // default: 2 (triggers immediate regeneration when 2+ consecutive skips happen)
}

export const DEFAULT_SESSION_ADAPTATION_CONFIG: SessionAdaptationConfig = {
  driftThreshold: 0.30,
  genreDriftThreshold: 0.35,
  artistDriftThreshold: 0.35,
  energyDriftThreshold: 0.20,
  tempoDriftThreshold: 15.0,
  moodDriftThreshold: 0.30,
  minInteractionsBeforeRegen: 2,
  maxConsecutiveSkipsBeforeRegen: 2,
};

let currentSessionAdaptationConfig: SessionAdaptationConfig = {
  ...DEFAULT_SESSION_ADAPTATION_CONFIG,
};

export const getSessionAdaptationConfig = (): SessionAdaptationConfig => {
  return { ...currentSessionAdaptationConfig };
};

export const updateSessionAdaptationConfig = (
  newConfig: Partial<SessionAdaptationConfig>
): SessionAdaptationConfig => {
  currentSessionAdaptationConfig = { ...currentSessionAdaptationConfig, ...newConfig };
  return { ...currentSessionAdaptationConfig };
};

export const resetSessionAdaptationConfig = (): SessionAdaptationConfig => {
  currentSessionAdaptationConfig = { ...DEFAULT_SESSION_ADAPTATION_CONFIG };
  return { ...currentSessionAdaptationConfig };
};

export type PreferenceDecayModel = 'exponential' | 'linear' | 'step';

export interface StepDecayBracket {
  maxDays: number;
  multiplier: number;
}

export interface TemporalPreferenceAggregationConfig {
  decayModel: PreferenceDecayModel; // default: 'exponential' ('exponential' | 'linear' | 'step')
  linearDecayMaxDays: number;       // default: 180 (days until minWeightFloor is reached in linear mode)
  stepDecayBrackets: StepDecayBracket[]; // custom tiered brackets for step decay
  shortTermDays: number;            // default: 14 (short-term window in days)
  mediumTermDays: number;           // default: 60 (medium-term window in days)
  longTermDays: number;             // default: 180 (long-term window in days)
  shortTermHalfLifeDays: number;    // default: 5 (aggressive recency decay for immediate taste)
  mediumTermHalfLifeDays: number;   // default: 21 (balanced recency decay)
  longTermHalfLifeDays: number;     // default: 90 (gentle decay preserving long-term favorites)
  shortTermBlendWeight: number;     // default: 0.50 (weight of short-term in blended score)
  mediumTermBlendWeight: number;    // default: 0.30 (weight of medium-term in blended score)
  longTermBlendWeight: number;      // default: 0.20 (weight of long-term in blended score)
  playWeight: number;               // default: 1.0 (base weight for play)
  completeWeight: number;           // default: 1.5 (weight for full completion)
  replayWeight: number;             // default: 2.0 (weight for repeated play/replay)
  likeWeight: number;               // default: 2.0 (weight for explicit favorite/like)
  skipPenaltyWeight: number;        // default: -0.8 (penalty for skipped track)
  minWeightFloor: number;           // default: 0.05 (decay floor to preserve historical signal)
}

export const DEFAULT_TEMPORAL_AGGREGATION_CONFIG: TemporalPreferenceAggregationConfig = {
  decayModel: 'exponential',
  linearDecayMaxDays: 180,
  stepDecayBrackets: [
    { maxDays: 7, multiplier: 1.0 },
    { maxDays: 30, multiplier: 0.70 },
    { maxDays: 90, multiplier: 0.40 },
    { maxDays: 180, multiplier: 0.15 },
  ],
  shortTermDays: 14,
  mediumTermDays: 60,
  longTermDays: 180,
  shortTermHalfLifeDays: 5,
  mediumTermHalfLifeDays: 21,
  longTermHalfLifeDays: 90,
  shortTermBlendWeight: 0.50,
  mediumTermBlendWeight: 0.30,
  longTermBlendWeight: 0.20,
  playWeight: 1.0,
  completeWeight: 1.5,
  replayWeight: 2.0,
  likeWeight: 2.0,
  skipPenaltyWeight: -0.8,
  minWeightFloor: 0.05,
};

let currentTemporalAggregationConfig: TemporalPreferenceAggregationConfig = {
  ...DEFAULT_TEMPORAL_AGGREGATION_CONFIG,
};

export const getTemporalAggregationConfig = (): TemporalPreferenceAggregationConfig => {
  return { ...currentTemporalAggregationConfig };
};

export const updateTemporalAggregationConfig = (
  newConfig: Partial<TemporalPreferenceAggregationConfig>
): TemporalPreferenceAggregationConfig => {
  currentTemporalAggregationConfig = { ...currentTemporalAggregationConfig, ...newConfig };
  return { ...currentTemporalAggregationConfig };
};

export const resetTemporalAggregationConfig = (): TemporalPreferenceAggregationConfig => {
  currentTemporalAggregationConfig = { ...DEFAULT_TEMPORAL_AGGREGATION_CONFIG };
  return { ...currentTemporalAggregationConfig };
};

export interface TemporalTasteInfluenceConfig {
  defaultTemporalInfluence: number;   // default: 0.25
  maxTemporalInfluence: number;       // default: 0.40
  minTemporalInfluence: number;       // default: 0.00
  shortTermSignalWeight: number;      // default: 0.50 (recent momentum influences more strongly)
  mediumTermSignalWeight: number;     // default: 0.30
  longTermSignalWeight: number;       // default: 0.20 (preserving foundational long-term taste)
  genreMatchWeight: number;           // default: 0.40
  artistMatchWeight: number;          // default: 0.30
  moodMatchWeight: number;            // default: 0.15
  acousticMatchWeight: number;        // default: 0.15
}

export const DEFAULT_TEMPORAL_INFLUENCE_CONFIG: TemporalTasteInfluenceConfig = {
  defaultTemporalInfluence: 0.25,
  maxTemporalInfluence: 0.40,
  minTemporalInfluence: 0.00,
  shortTermSignalWeight: 0.50,
  mediumTermSignalWeight: 0.30,
  longTermSignalWeight: 0.20,
  genreMatchWeight: 0.40,
  artistMatchWeight: 0.30,
  moodMatchWeight: 0.15,
  acousticMatchWeight: 0.15,
};

let currentTemporalInfluenceConfig: TemporalTasteInfluenceConfig = {
  ...DEFAULT_TEMPORAL_INFLUENCE_CONFIG,
};

export const getTemporalTasteInfluenceConfig = (): TemporalTasteInfluenceConfig => {
  return { ...currentTemporalInfluenceConfig };
};

export const updateTemporalTasteInfluenceConfig = (
  newConfig: Partial<TemporalTasteInfluenceConfig>
): TemporalTasteInfluenceConfig => {
  currentTemporalInfluenceConfig = { ...currentTemporalInfluenceConfig, ...newConfig };
  return { ...currentTemporalInfluenceConfig };
};

export const resetTemporalTasteInfluenceConfig = (): TemporalTasteInfluenceConfig => {
  currentTemporalInfluenceConfig = { ...DEFAULT_TEMPORAL_INFLUENCE_CONFIG };
  return { ...currentTemporalInfluenceConfig };
};




