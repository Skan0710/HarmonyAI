/**
 * Recommendation Signal Configuration System
 *
 * Centralizes all major scoring signals, weights, layer influences,
 * and modulation bounds for the HarmonyAI recommendation engine.
 *
 * Major signals managed:
 * 1. Long-Term Taste (User Taste Profile affinity)
 * 2. Short-Term / Temporal Taste (Discrete horizons: short, medium, long)
 * 3. Session Behavior (Active session dynamics, completion boosts, skip penalties)
 * 4. Context (Listening context: situation, mood, energy, tempo, genre match)
 * 5. Feedback / Quality Calibration (Post-evaluation boosts, skip suppressions)
 * 6. Popularity & Recency (Catalog discovery signals)
 * 7. Content & Collaborative (Foundational similarity signals)
 */

export type RecommendationSignalIdentifier =
  | 'content_similarity'
  | 'collaborative'
  | 'long_term_taste'
  | 'short_term_taste'
  | 'medium_term_taste'
  | 'session_behavior'
  | 'context'
  | 'feedback_calibration'
  | 'popularity'
  | 'recency';

/**
 * Foundational baseline hybrid scoring weights.
 * Normalizes relative contributions before external layer modulations.
 */
export interface BaselineSignalWeights {
  contentSimilarityWeight: number;      // default: 0.25
  collaborativeWeight: number;          // default: 0.25
  userTasteAffinityWeight: number;      // default: 0.25 (Long-term taste signal)
  popularityWeight: number;             // default: 0.125
  recencyWeight: number;                // default: 0.125
}

/**
 * Macro layer modulation bounds & influences.
 * Controls how strongly context, session, and temporal layers blend with baseline personalized scores.
 */
export interface ModulationLayerWeights {
  temporalInfluence: number;              // default: 0.25 (25% temporal blend)
  maxTemporalInfluence: number;           // default: 0.40
  minTemporalInfluence: number;           // default: 0.00
  sessionInfluence: number;               // default: 0.20 (20% session blend)
  maxSessionInfluence: number;            // default: 0.35
  minSessionInfluence: number;            // default: 0.00
  contextInfluence: number;               // default: 0.25 (25% context blend)
  maxContextInfluence: number;            // default: 0.40
  minContextInfluence: number;            // default: 0.00
  maxCombinedModulationInfluence: number; // default: 0.50 (guarantees baseline hybrid score retains >= 50%)
  minBaselineWeightFloor: number;         // default: 0.50
}

/**
 * Discrete temporal horizon weights.
 */
export interface TemporalHorizonSignalWeights {
  shortTermWeight: number;        // default: 0.50 (immediate momentum)
  mediumTermWeight: number;       // default: 0.30 (rotational habits)
  longTermWeight: number;         // default: 0.20 (foundational favorites)
  genreMatchWeight: number;       // default: 0.40
  artistMatchWeight: number;      // default: 0.30
  moodMatchWeight: number;        // default: 0.15
  acousticMatchWeight: number;    // default: 0.15
}

/**
 * Active session behavioral weights and penalties.
 */
export interface SessionBehaviorSignalWeights {
  recentCompletionBoost: number;        // default: 1.25
  repeatedSkipPenalty: number;          // default: 0.40
  directSkippedSongSuppression: number; // default: 0.10
}

/**
 * Context feature compatibility weights and acoustic difference tolerances.
 */
export interface ContextSignalWeights {
  energyMatchWeight: number;      // default: 0.35
  tempoMatchWeight: number;       // default: 0.25
  moodMatchWeight: number;        // default: 0.20
  genreMatchWeight: number;       // default: 0.20
  energyTolerance: number;        // default: 0.40
  tempoTolerance: number;         // default: 35.0
}

/**
 * Historical user feedback and score calibration signals.
 */
export interface FeedbackSignalWeights {
  enabled: boolean;                 // default: true
  likedBoostFactor: number;          // default: 1.15
  savedBoostFactor: number;          // default: 1.20
  skipPenaltyFactor: number;         // default: 0.85
  repeatedSkipPenaltyFactor: number; // default: 0.70
  highCompletionBoostFactor: number; // default: 1.10
  minCalibrationMultiplier: number;  // default: 0.50
  maxCalibrationMultiplier: number;  // default: 1.50
  sourceWeightAdjustment: number;   // default: 0.15
}

/**
 * Adaptive exploration vs exploitation configuration.
 * Governs the balance between known user preferences (exploitation)
 * and relevant but less familiar discoveries (exploration).
 */
export interface ExplorationExploitationConfig {
  defaultExplorationRate: number;        // default: 0.20
  minExplorationRate: number;            // default: 0.05
  maxExplorationRate: number;            // default: 0.50
  newUserExplorationRate: number;        // default: 0.40
  limitedHistoryExplorationRate: number; // default: 0.30
  activePivotExplorationBoost: number;   // default: 0.10
  highStabilityExplorationDampen: number;// default: 0.08
  negativeFeedbackDampenFactor: number;  // default: 0.15 (throttles exploration on high skips)
  positiveFeedbackBoostFactor: number;   // default: 0.05
  minRelevanceThreshold: number;         // default: 0.25 (prevents unrelated items from receiving novelty boost)
  enabled: boolean;                      // default: true
}

export const DEFAULT_EXPLORATION_EXPLOITATION_CONFIG: ExplorationExploitationConfig = {
  defaultExplorationRate: 0.20,
  minExplorationRate: 0.05,
  maxExplorationRate: 0.50,
  newUserExplorationRate: 0.40,
  limitedHistoryExplorationRate: 0.30,
  activePivotExplorationBoost: 0.10,
  highStabilityExplorationDampen: 0.08,
  negativeFeedbackDampenFactor: 0.15,
  positiveFeedbackBoostFactor: 0.05,
  minRelevanceThreshold: 0.25,
  enabled: true,
};

/**
 * Master recommendation signal configuration.
 */
export interface RecommendationSignalConfig {
  baselineSignals: BaselineSignalWeights;
  modulationLayers: ModulationLayerWeights;
  temporalHorizons: TemporalHorizonSignalWeights;
  sessionBehavior: SessionBehaviorSignalWeights;
  contextSignals: ContextSignalWeights;
  feedbackSignals: FeedbackSignalWeights;
  explorationExploitation: ExplorationExploitationConfig;
}

/**
 * Default master signal configuration matching 100% of existing behavior.
 */
export const DEFAULT_RECOMMENDATION_SIGNAL_CONFIG: RecommendationSignalConfig = {
  baselineSignals: {
    contentSimilarityWeight: 0.25,
    collaborativeWeight: 0.25,
    userTasteAffinityWeight: 0.25,
    popularityWeight: 0.125,
    recencyWeight: 0.125,
  },
  modulationLayers: {
    temporalInfluence: 0.25,
    maxTemporalInfluence: 0.40,
    minTemporalInfluence: 0.00,
    sessionInfluence: 0.20,
    maxSessionInfluence: 0.35,
    minSessionInfluence: 0.00,
    contextInfluence: 0.25,
    maxContextInfluence: 0.40,
    minContextInfluence: 0.00,
    maxCombinedModulationInfluence: 0.50,
    minBaselineWeightFloor: 0.50,
  },
  temporalHorizons: {
    shortTermWeight: 0.50,
    mediumTermWeight: 0.30,
    longTermWeight: 0.20,
    genreMatchWeight: 0.40,
    artistMatchWeight: 0.30,
    moodMatchWeight: 0.15,
    acousticMatchWeight: 0.15,
  },
  sessionBehavior: {
    recentCompletionBoost: 1.25,
    repeatedSkipPenalty: 0.40,
    directSkippedSongSuppression: 0.10,
  },
  contextSignals: {
    energyMatchWeight: 0.35,
    tempoMatchWeight: 0.25,
    moodMatchWeight: 0.20,
    genreMatchWeight: 0.20,
    energyTolerance: 0.40,
    tempoTolerance: 35.0,
  },
  feedbackSignals: {
    enabled: true,
    likedBoostFactor: 1.15,
    savedBoostFactor: 1.20,
    skipPenaltyFactor: 0.85,
    repeatedSkipPenaltyFactor: 0.70,
    highCompletionBoostFactor: 1.10,
    minCalibrationMultiplier: 0.50,
    maxCalibrationMultiplier: 1.50,
    sourceWeightAdjustment: 0.15,
  },
  explorationExploitation: { ...DEFAULT_EXPLORATION_EXPLOITATION_CONFIG },
};

let currentSignalConfig: RecommendationSignalConfig = {
  baselineSignals: { ...DEFAULT_RECOMMENDATION_SIGNAL_CONFIG.baselineSignals },
  modulationLayers: { ...DEFAULT_RECOMMENDATION_SIGNAL_CONFIG.modulationLayers },
  temporalHorizons: { ...DEFAULT_RECOMMENDATION_SIGNAL_CONFIG.temporalHorizons },
  sessionBehavior: { ...DEFAULT_RECOMMENDATION_SIGNAL_CONFIG.sessionBehavior },
  contextSignals: { ...DEFAULT_RECOMMENDATION_SIGNAL_CONFIG.contextSignals },
  feedbackSignals: { ...DEFAULT_RECOMMENDATION_SIGNAL_CONFIG.feedbackSignals },
  explorationExploitation: { ...DEFAULT_RECOMMENDATION_SIGNAL_CONFIG.explorationExploitation },
};

/**
 * Returns current master signal configuration.
 */
export const getRecommendationSignalConfig = (): RecommendationSignalConfig => {
  return {
    baselineSignals: { ...currentSignalConfig.baselineSignals },
    modulationLayers: { ...currentSignalConfig.modulationLayers },
    temporalHorizons: { ...currentSignalConfig.temporalHorizons },
    sessionBehavior: { ...currentSignalConfig.sessionBehavior },
    contextSignals: { ...currentSignalConfig.contextSignals },
    feedbackSignals: { ...currentSignalConfig.feedbackSignals },
    explorationExploitation: { ...currentSignalConfig.explorationExploitation },
  };
};

/**
 * Updates partial recommendation signal configuration and returns updated state.
 */
export const updateRecommendationSignalConfig = (
  newConfig: Partial<{
    baselineSignals: Partial<BaselineSignalWeights>;
    modulationLayers: Partial<ModulationLayerWeights>;
    temporalHorizons: Partial<TemporalHorizonSignalWeights>;
    sessionBehavior: Partial<SessionBehaviorSignalWeights>;
    contextSignals: Partial<ContextSignalWeights>;
    feedbackSignals: Partial<FeedbackSignalWeights>;
    explorationExploitation: Partial<ExplorationExploitationConfig>;
  }>
): RecommendationSignalConfig => {
  if (newConfig.baselineSignals) {
    currentSignalConfig.baselineSignals = {
      ...currentSignalConfig.baselineSignals,
      ...newConfig.baselineSignals,
    };
  }
  if (newConfig.modulationLayers) {
    currentSignalConfig.modulationLayers = {
      ...currentSignalConfig.modulationLayers,
      ...newConfig.modulationLayers,
    };
  }
  if (newConfig.temporalHorizons) {
    currentSignalConfig.temporalHorizons = {
      ...currentSignalConfig.temporalHorizons,
      ...newConfig.temporalHorizons,
    };
  }
  if (newConfig.sessionBehavior) {
    currentSignalConfig.sessionBehavior = {
      ...currentSignalConfig.sessionBehavior,
      ...newConfig.sessionBehavior,
    };
  }
  if (newConfig.contextSignals) {
    currentSignalConfig.contextSignals = {
      ...currentSignalConfig.contextSignals,
      ...newConfig.contextSignals,
    };
  }
  if (newConfig.feedbackSignals) {
    currentSignalConfig.feedbackSignals = {
      ...currentSignalConfig.feedbackSignals,
      ...newConfig.feedbackSignals,
    };
  }
  if (newConfig.explorationExploitation) {
    currentSignalConfig.explorationExploitation = {
      ...currentSignalConfig.explorationExploitation,
      ...newConfig.explorationExploitation,
    };
  }

  notifyChangeListeners();
  return getRecommendationSignalConfig();
};

/**
 * Resets recommendation signal configuration to defaults.
 */
export const resetRecommendationSignalConfig = (): RecommendationSignalConfig => {
  currentSignalConfig = {
    baselineSignals: { ...DEFAULT_RECOMMENDATION_SIGNAL_CONFIG.baselineSignals },
    modulationLayers: { ...DEFAULT_RECOMMENDATION_SIGNAL_CONFIG.modulationLayers },
    temporalHorizons: { ...DEFAULT_RECOMMENDATION_SIGNAL_CONFIG.temporalHorizons },
    sessionBehavior: { ...DEFAULT_RECOMMENDATION_SIGNAL_CONFIG.sessionBehavior },
    contextSignals: { ...DEFAULT_RECOMMENDATION_SIGNAL_CONFIG.contextSignals },
    feedbackSignals: { ...DEFAULT_RECOMMENDATION_SIGNAL_CONFIG.feedbackSignals },
    explorationExploitation: { ...DEFAULT_RECOMMENDATION_SIGNAL_CONFIG.explorationExploitation },
  };

  notifyChangeListeners();
  return getRecommendationSignalConfig();
};

export const getExplorationExploitationConfig = (): ExplorationExploitationConfig => {
  return { ...currentSignalConfig.explorationExploitation };
};

export const updateExplorationExploitationConfig = (
  newConfig: Partial<ExplorationExploitationConfig>
): ExplorationExploitationConfig => {
  updateRecommendationSignalConfig({ explorationExploitation: newConfig });
  return getExplorationExploitationConfig();
};

export const resetExplorationExploitationConfig = (): ExplorationExploitationConfig => {
  updateRecommendationSignalConfig({
    explorationExploitation: { ...DEFAULT_EXPLORATION_EXPLOITATION_CONFIG },
  });
  return getExplorationExploitationConfig();
};

export type SignalConfigChangeListener = (config: RecommendationSignalConfig) => void;
const changeListeners: SignalConfigChangeListener[] = [];

export const registerSignalConfigChangeListener = (listener: SignalConfigChangeListener): void => {
  changeListeners.push(listener);
};

const notifyChangeListeners = (): void => {
  const current = getRecommendationSignalConfig();
  for (const listener of changeListeners) {
    try {
      listener(current);
    } catch {
      // Safe catch for listener errors
    }
  }
};

/**
 * Computes the normalized, effective distribution of active scoring signals
 * across baseline, temporal horizons, session behavior, context, and feedback.
 */
export const getEffectiveSignalDistribution = (activeLayers?: {
  useTemporal?: boolean;
  useSession?: boolean;
  useContext?: boolean;
  useFeedback?: boolean;
}): Record<RecommendationSignalIdentifier, { weight: number; percentage: number; active: boolean }> => {
  const config = getRecommendationSignalConfig();
  const useTemporal = activeLayers?.useTemporal ?? true;
  const useSession = activeLayers?.useSession ?? true;
  const useContext = activeLayers?.useContext ?? true;
  const useFeedback = activeLayers?.useFeedback ?? config.feedbackSignals.enabled;

  let effectiveTemporal = useTemporal ? config.modulationLayers.temporalInfluence : 0;
  let effectiveSession = useSession ? config.modulationLayers.sessionInfluence : 0;
  let effectiveContext = useContext ? config.modulationLayers.contextInfluence : 0;

  const totalModulation = effectiveTemporal + effectiveSession + effectiveContext;
  if (totalModulation > config.modulationLayers.maxCombinedModulationInfluence) {
    const scale = config.modulationLayers.maxCombinedModulationInfluence / totalModulation;
    effectiveTemporal *= scale;
    effectiveSession *= scale;
    effectiveContext *= scale;
  }

  const baselineFraction = 1 - effectiveTemporal - effectiveSession - effectiveContext;
  const base = config.baselineSignals;
  const baseSum =
    base.contentSimilarityWeight +
    base.collaborativeWeight +
    base.userTasteAffinityWeight +
    base.popularityWeight +
    base.recencyWeight || 1;

  const contentEff = (base.contentSimilarityWeight / baseSum) * baselineFraction;
  const collabEff = (base.collaborativeWeight / baseSum) * baselineFraction;
  const longTermBaseEff = (base.userTasteAffinityWeight / baseSum) * baselineFraction;
  const popEff = (base.popularityWeight / baseSum) * baselineFraction;
  const recEff = (base.recencyWeight / baseSum) * baselineFraction;

  const th = config.temporalHorizons;
  const thSum = th.shortTermWeight + th.mediumTermWeight + th.longTermWeight || 1;
  const shortTermEff = effectiveTemporal * (th.shortTermWeight / thSum);
  const mediumTermEff = effectiveTemporal * (th.mediumTermWeight / thSum);
  const longTermTemporalEff = effectiveTemporal * (th.longTermWeight / thSum);

  const totalLongTerm = longTermBaseEff + longTermTemporalEff;

  const signals: Record<RecommendationSignalIdentifier, { weight: number; percentage: number; active: boolean }> = {
    content_similarity: {
      weight: Number(contentEff.toFixed(4)),
      percentage: Number((contentEff * 100).toFixed(2)),
      active: true,
    },
    collaborative: {
      weight: Number(collabEff.toFixed(4)),
      percentage: Number((collabEff * 100).toFixed(2)),
      active: true,
    },
    long_term_taste: {
      weight: Number(totalLongTerm.toFixed(4)),
      percentage: Number((totalLongTerm * 100).toFixed(2)),
      active: true,
    },
    short_term_taste: {
      weight: Number(shortTermEff.toFixed(4)),
      percentage: Number((shortTermEff * 100).toFixed(2)),
      active: useTemporal,
    },
    medium_term_taste: {
      weight: Number(mediumTermEff.toFixed(4)),
      percentage: Number((mediumTermEff * 100).toFixed(2)),
      active: useTemporal,
    },
    session_behavior: {
      weight: Number(effectiveSession.toFixed(4)),
      percentage: Number((effectiveSession * 100).toFixed(2)),
      active: useSession,
    },
    context: {
      weight: Number(effectiveContext.toFixed(4)),
      percentage: Number((effectiveContext * 100).toFixed(2)),
      active: useContext,
    },
    feedback_calibration: {
      weight: useFeedback ? config.feedbackSignals.sourceWeightAdjustment : 0,
      percentage: useFeedback ? Number((config.feedbackSignals.sourceWeightAdjustment * 100).toFixed(2)) : 0,
      active: useFeedback,
    },
    popularity: {
      weight: Number(popEff.toFixed(4)),
      percentage: Number((popEff * 100).toFixed(2)),
      active: true,
    },
    recency: {
      weight: Number(recEff.toFixed(4)),
      percentage: Number((recEff * 100).toFixed(2)),
      active: true,
    },
  };

  return signals;
};
