import { Types } from 'mongoose';
import { UnifiedMusicDNAService } from './unifiedMusicDnaService.js';
import { TasteStabilityTransformationService } from './tasteStabilityTransformationService.js';

export type ListenerArchetypeType =
  | 'Explorer'
  | 'Loyal Listener'
  | 'Mood Listener'
  | 'Genre Hopper'
  | 'Discovery Seeker'
  | 'Comfort Listener'
  | 'Balanced Listener';

export interface ArchetypeDefinition {
  type: ListenerArchetypeType;
  title: string;
  tagline: string;
  description: string;
  primaryTraits: string[];
}

export const ARCHETYPE_DEFINITIONS: Record<ListenerArchetypeType, ArchetypeDefinition> = {
  'Explorer': {
    type: 'Explorer',
    title: 'Sonic Explorer',
    tagline: 'Constantly charting unfamiliar musical landscapes',
    description: 'Driven by high curiosity and low reliance on routine, actively venturing across genres and seeking rare sonic territory.',
    primaryTraits: ['High Novelty', 'Broad Horizons', 'Low Repetition', 'High Exploration'],
  },
  'Loyal Listener': {
    type: 'Loyal Listener',
    title: 'Devoted Loyalist',
    tagline: 'Deep connection to cherished sounds and bedrock artists',
    description: 'Finds supreme joy in repeated listening, building deep familiarity with core artists and cherishing classic rotation.',
    primaryTraits: ['High Replay Value', 'Deep Artist Loyalty', 'Stable Preferences', 'Predictable Joy'],
  },
  'Mood Listener': {
    type: 'Mood Listener',
    title: 'Atmospheric Harmonizer',
    tagline: 'Music tuned to emotion, setting, and vibe',
    description: 'Driven primarily by feelings and contexts rather than rigid genres, selecting tracks that harmonize with their immediate state of mind.',
    primaryTraits: ['Emotionally Driven', 'Context Sensitive', 'Atmospheric Sensitivity', 'Fluid Palette'],
  },
  'Genre Hopper': {
    type: 'Genre Hopper',
    title: 'Genre Hopper',
    tagline: 'Boundaryless listener jumping effortlessly across styles',
    description: 'Refuses to be confined to single genres, transitioning rapidly from hip-hop to synthwave to jazz without missing a beat.',
    primaryTraits: ['High Genre Diversity', 'Style Fluidity', 'Eclectic Palette', 'Low Genre Boundaries'],
  },
  'Discovery Seeker': {
    type: 'Discovery Seeker',
    title: 'Discovery Seeker',
    tagline: 'Hungry for new releases, emerging artists, and hidden gems',
    description: 'Focused on finding what is next, with a passionate appetite for freshness, new creators, and rising momentum tracks.',
    primaryTraits: ['Freshness Focused', 'Emerging Artist Affinity', 'Novelty Drive', 'Active Discovery'],
  },
  'Comfort Listener': {
    type: 'Comfort Listener',
    title: 'Comfort Listener',
    tagline: 'Finding peace and reliability in musical familiarity',
    description: 'Prefers familiar, comforting tracks that evoke nostalgia and security, showing strong resistance to erratic taste drift.',
    primaryTraits: ['High Preference Stability', 'Familiarity Affinity', 'Low Skip Rate', 'Emotional Grounding'],
  },
  'Balanced Listener': {
    type: 'Balanced Listener',
    title: 'Balanced Listener',
    tagline: 'Harmonious blend of familiar favorites and intriguing discoveries',
    description: 'Enjoys a well-rounded listening diet, striking an effortless balance between treasured tracks and exciting new releases.',
    primaryTraits: ['Well-Rounded Palette', 'Balanced Exploration', 'Moderate Replay', 'Adaptive Habits'],
  },
};

/**
 * Multi-signal input structure feeding the archetype decision engine.
 */
export interface ArchetypeSignalInputs {
  userId?: string;
  explorationTendency?: number;       // [0.0, 1.0]
  repeatListeningTendency?: number;   // [0.0, 1.0]
  genreDiversity?: number;            // [0.0, 1.0]
  artistDiversity?: number;           // [0.0, 1.0]
  noveltyPreference?: number;         // [0.0, 1.0]
  familiarityPreference?: number;     // [0.0, 1.0]
  preferenceStability?: number;       // [0.0, 1.0]
  recentTasteChanges?: number;        // [0.0, 1.0] (volatility / transformation intensity)
  moodFocusScore?: number;            // [0.0, 1.0] (contextual / mood selectivity)
  interactionCount?: number;
  isDataSufficient?: boolean;
}

export interface ArchetypeEngineConfig {
  minInteractionThreshold: number; // default: 10 plays to exit fallback
  confidenceBaseMarginWeight: number; // default: 0.35
  confidenceDataVolumeWeight: number; // default: 0.30
  confidenceScorePeakWeight: number; // default: 0.35
  fallbackArchetype: ListenerArchetypeType; // default: 'Balanced Listener'
  minConfidenceFloor: number; // default: 0.15
}

export const DEFAULT_ARCHETYPE_ENGINE_CONFIG: ArchetypeEngineConfig = {
  minInteractionThreshold: 10,
  confidenceBaseMarginWeight: 0.35,
  confidenceDataVolumeWeight: 0.30,
  confidenceScorePeakWeight: 0.35,
  fallbackArchetype: 'Balanced Listener',
  minConfidenceFloor: 0.15,
};

let currentArchetypeEngineConfig: ArchetypeEngineConfig = { ...DEFAULT_ARCHETYPE_ENGINE_CONFIG };

export function getArchetypeEngineConfig(): ArchetypeEngineConfig {
  return { ...currentArchetypeEngineConfig };
}

export function updateArchetypeEngineConfig(
  newConfig: Partial<ArchetypeEngineConfig>
): ArchetypeEngineConfig {
  currentArchetypeEngineConfig = { ...currentArchetypeEngineConfig, ...newConfig };
  return { ...currentArchetypeEngineConfig };
}

export function resetArchetypeEngineConfig(): ArchetypeEngineConfig {
  currentArchetypeEngineConfig = { ...DEFAULT_ARCHETYPE_ENGINE_CONFIG };
  return { ...currentArchetypeEngineConfig };
}

export interface ArchetypeDeterminationResult {
  userId?: string;
  primaryArchetype: ListenerArchetypeType;
  title: string;
  tagline: string;
  description: string;
  primaryTraits: string[];
  confidenceScore: number;
  isFallback: boolean;
  archetypeScores: Record<ListenerArchetypeType, number>;
  signalBreakdown: {
    explorationTendency: number;
    repeatListening: number;
    genreDiversity: number;
    artistDiversity: number;
    noveltyPreference: number;
    familiarityPreference: number;
    preferenceStability: number;
    recentTasteChanges: number;
    moodFocus: number;
  };
  explanation: string;
}

export class ListenerArchetypeEngine {
  /**
   * Pure deterministic calculation: Evaluates multiple behavioral signals
   * and computes compatibility scores across all candidate archetypes.
   */
  static determineArchetypeFromSignals(
    inputs: ArchetypeSignalInputs,
    configOverride?: Partial<ArchetypeEngineConfig>
  ): ArchetypeDeterminationResult {
    const config: ArchetypeEngineConfig = {
      ...getArchetypeEngineConfig(),
      ...configOverride,
    };

    const isDataSufficient =
      inputs.isDataSufficient !== undefined
        ? inputs.isDataSufficient
        : (inputs.interactionCount ?? 0) >= config.minInteractionThreshold;

    const clamp01 = (v?: number, fallback = 0.5): number => {
      if (v === undefined || isNaN(v)) return fallback;
      return Math.min(1.0, Math.max(0.0, Number(v)));
    };

    const signals = {
      explorationTendency: clamp01(inputs.explorationTendency, 0.5),
      repeatListening: clamp01(inputs.repeatListeningTendency, 0.5),
      genreDiversity: clamp01(inputs.genreDiversity, 0.5),
      artistDiversity: clamp01(inputs.artistDiversity, 0.5),
      noveltyPreference: clamp01(inputs.noveltyPreference, 0.5),
      familiarityPreference: clamp01(inputs.familiarityPreference, 0.5),
      preferenceStability: clamp01(inputs.preferenceStability, 0.5),
      recentTasteChanges: clamp01(inputs.recentTasteChanges, 0.2),
      moodFocus: clamp01(inputs.moodFocusScore, 0.4),
    };

    // -------------------------------------------------------------------------
    // Cold Start / Insufficient History Guard
    // -------------------------------------------------------------------------
    if (!isDataSufficient) {
      const fallbackDef = ARCHETYPE_DEFINITIONS[config.fallbackArchetype];
      const flatScores: Record<ListenerArchetypeType, number> = {
        'Explorer': 0.14,
        'Loyal Listener': 0.14,
        'Mood Listener': 0.14,
        'Genre Hopper': 0.14,
        'Discovery Seeker': 0.14,
        'Comfort Listener': 0.14,
        'Balanced Listener': 0.16,
      };

      return {
        userId: inputs.userId,
        primaryArchetype: config.fallbackArchetype,
        title: fallbackDef.title,
        tagline: fallbackDef.tagline,
        description: fallbackDef.description,
        primaryTraits: fallbackDef.primaryTraits,
        confidenceScore: config.minConfidenceFloor,
        isFallback: true,
        archetypeScores: flatScores,
        signalBreakdown: signals,
        explanation: 'User interaction history is currently insufficient for full behavioral archetype classification. Assigned balanced default archetype.',
      };
    }

    // -------------------------------------------------------------------------
    // Multi-Signal Scoring per Archetype
    // -------------------------------------------------------------------------

    // 1. Explorer: broad exploration across musical horizons, high artist & genre variety, low familiarity
    let explorerScore =
      0.40 * signals.explorationTendency +
      0.25 * signals.artistDiversity +
      0.20 * signals.genreDiversity +
      0.15 * signals.noveltyPreference -
      0.20 * signals.familiarityPreference -
      0.15 * signals.repeatListening;

    // 2. Loyal Listener: high replay, deep artist loyalty, high familiarity, steady favorites
    let loyalScore =
      0.48 * signals.repeatListening +
      0.30 * signals.familiarityPreference +
      0.20 * (1.0 - signals.artistDiversity) +
      0.15 * signals.preferenceStability -
      0.25 * signals.explorationTendency -
      0.20 * signals.noveltyPreference;

    // 3. Mood Listener: high mood focus, context sensitive, atmospheric sensitivity
    let moodScore =
      0.55 * signals.moodFocus +
      0.25 * signals.genreDiversity +
      0.20 * signals.preferenceStability -
      0.15 * Math.abs(signals.explorationTendency - 0.5);

    // 4. Genre Hopper: high genre diversity, strong exploration, style fluidity, low stability
    let genreHopperScore =
      0.50 * signals.genreDiversity +
      0.25 * signals.explorationTendency +
      0.20 * signals.recentTasteChanges +
      0.15 * signals.artistDiversity -
      0.25 * signals.preferenceStability -
      0.15 * signals.repeatListening;

    // 5. Discovery Seeker: high novelty drive, hunger for emerging tracks & fresh releases, zero repeat
    let discoverySeekerScore =
      0.50 * signals.noveltyPreference +
      0.25 * signals.explorationTendency +
      0.20 * signals.recentTasteChanges +
      0.15 * signals.artistDiversity -
      0.30 * signals.repeatListening -
      0.15 * signals.familiarityPreference;

    // 6. Comfort Listener: high stability, low volatility, emotional grounding, high familiarity
    let comfortScore =
      0.45 * signals.preferenceStability +
      0.35 * signals.familiarityPreference +
      0.20 * (1.0 - signals.recentTasteChanges) +
      0.08 * signals.repeatListening -
      0.30 * signals.explorationTendency -
      0.20 * signals.noveltyPreference;

    // 7. Balanced Listener: measure closeness to the golden mean (0.5 equilibrium across dimensions)
    const deviationFromCenter =
      (Math.abs(signals.explorationTendency - 0.5) +
        Math.abs(signals.repeatListening - 0.5) +
        Math.abs(signals.genreDiversity - 0.5) +
        Math.abs(signals.noveltyPreference - 0.5) +
        Math.abs(signals.preferenceStability - 0.5) +
        Math.abs(signals.familiarityPreference - 0.5)) /
      3.0; // in [0.0, 1.0]
    let balancedScore = 0.85 * (1.0 - deviationFromCenter) + 0.05;

    // Normalize raw scores into non-negative values
    const rawScores: Record<ListenerArchetypeType, number> = {
      'Explorer': Math.max(0.01, explorerScore),
      'Loyal Listener': Math.max(0.01, loyalScore),
      'Mood Listener': Math.max(0.01, moodScore),
      'Genre Hopper': Math.max(0.01, genreHopperScore),
      'Discovery Seeker': Math.max(0.01, discoverySeekerScore),
      'Comfort Listener': Math.max(0.01, comfortScore),
      'Balanced Listener': Math.max(0.01, balancedScore),
    };

    // Softmax / Proportional Normalization
    const totalScore = Object.values(rawScores).reduce((sum, s) => sum + s, 0);
    const archetypeScores: Record<ListenerArchetypeType, number> = {
      'Explorer': Number((rawScores['Explorer'] / totalScore).toFixed(4)),
      'Loyal Listener': Number((rawScores['Loyal Listener'] / totalScore).toFixed(4)),
      'Mood Listener': Number((rawScores['Mood Listener'] / totalScore).toFixed(4)),
      'Genre Hopper': Number((rawScores['Genre Hopper'] / totalScore).toFixed(4)),
      'Discovery Seeker': Number((rawScores['Discovery Seeker'] / totalScore).toFixed(4)),
      'Comfort Listener': Number((rawScores['Comfort Listener'] / totalScore).toFixed(4)),
      'Balanced Listener': Number((rawScores['Balanced Listener'] / totalScore).toFixed(4)),
    };

    // Rank archetypes descending
    const sortedEntries = (Object.entries(archetypeScores) as [ListenerArchetypeType, number][]).sort(
      (a, b) => b[1] - a[1]
    );

    const [topArchetype, topScore] = sortedEntries[0];
    const secondScore = sortedEntries[1]?.[1] || 0;

    // Calculate confidence
    const scoreMargin = Math.min(1.0, Math.max(0.0, (topScore - secondScore) / (topScore + 0.001)));
    const interactions = inputs.interactionCount ?? 20;
    const dataVolumeFactor = Math.min(1.0, interactions / 30);

    const confidenceScore = Number(
      Math.min(
        1.0,
        Math.max(
          config.minConfidenceFloor,
          config.confidenceScorePeakWeight * topScore * 2.5 +
            config.confidenceBaseMarginWeight * scoreMargin +
            config.confidenceDataVolumeWeight * dataVolumeFactor
        )
      ).toFixed(2)
    );

    const definition = ARCHETYPE_DEFINITIONS[topArchetype];

    let explanation = `Classified as ${definition.title} with ${(confidenceScore * 100).toFixed(0)}% confidence based on `;
    if (topArchetype === 'Explorer') {
      explanation += `high exploration tendency (${(signals.explorationTendency * 100).toFixed(0)}%) and desire for novelty.`;
    } else if (topArchetype === 'Loyal Listener') {
      explanation += `deep replay loyalty (${(signals.repeatListening * 100).toFixed(0)}%) and familiarity preference.`;
    } else if (topArchetype === 'Mood Listener') {
      explanation += `strong mood-driven listening patterns (${(signals.moodFocus * 100).toFixed(0)}%) across daily contexts.`;
    } else if (topArchetype === 'Genre Hopper') {
      explanation += `exceptional genre diversity (${(signals.genreDiversity * 100).toFixed(0)}%) and fluid boundary traversal.`;
    } else if (topArchetype === 'Discovery Seeker') {
      explanation += `active search for emerging tracks and high novelty appetite (${(signals.noveltyPreference * 100).toFixed(0)}%).`;
    } else if (topArchetype === 'Comfort Listener') {
      explanation += `high preference stability (${(signals.preferenceStability * 100).toFixed(0)}%) and affinity for familiar classics.`;
    } else {
      explanation += `a harmonious balance across familiar and exploratory listening behaviors.`;
    }

    return {
      userId: inputs.userId,
      primaryArchetype: topArchetype,
      title: definition.title,
      tagline: definition.tagline,
      description: definition.description,
      primaryTraits: definition.primaryTraits,
      confidenceScore,
      isFallback: false,
      archetypeScores,
      signalBreakdown: signals,
      explanation,
    };
  }

  /**
   * DB-backed method: Retrieves user's Unified Music DNA and Stability intelligence
   * and determines their primary listener archetype.
   */
  static async determineUserArchetype(
    userId: string,
    configOverride?: Partial<ArchetypeEngineConfig>
  ): Promise<ArchetypeDeterminationResult> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error(`Invalid userId: ${userId}`);
    }

    // 1. Fetch current Unified Music DNA
    const dna = await UnifiedMusicDNAService.getOrGenerateProfile(userId);

    // 2. Optionally fetch Stability metrics
    const stabilityMetrics = await TasteStabilityTransformationService.calculateUserStabilityMetrics(
      userId
    ).catch(() => null);

    // 3. Extract Multi-Dimensional Signals
    const explorationTendency = dna.tendencies?.explorationPreference ?? 0.5;
    const repeatListeningTendency = dna.listeningBehavior?.repeatListeningTendency ?? 0.5;
    const genreDiversity = dna.genreProfile?.diversity?.score ?? 0.5;
    const artistDiversity = dna.artistProfile?.diversity?.score ?? 0.5;
    const noveltyPreference = dna.listeningBehavior?.discoveryTendency ?? 0.5;
    const familiarityPreference = dna.tendencies?.familiarityPreference ?? 0.5;
    const preferenceStability =
      stabilityMetrics?.tasteStability ?? dna.listeningBehavior?.preferenceStability ?? 0.5;
    const recentTasteChanges =
      stabilityMetrics?.transformationIntensity ?? stabilityMetrics?.tasteVolatility ?? 0.2;

    // Mood focus: based on top mood score and mood distribution concentration
    const topMoodScore = dna.moodProfile?.preferredMoods?.[0]?.score ?? 0.5;
    const moodFocusScore = Math.min(1.0, topMoodScore * 0.9);

    const interactionCount = dna.interactionsCountAtLastRefresh ?? 0;
    const isDataSufficient =
      dna.listeningBehavior?.isDataSufficient ?? (interactionCount >= 10);

    const inputs: ArchetypeSignalInputs = {
      userId,
      explorationTendency,
      repeatListeningTendency,
      genreDiversity,
      artistDiversity,
      noveltyPreference,
      familiarityPreference,
      preferenceStability,
      recentTasteChanges,
      moodFocusScore,
      interactionCount,
      isDataSufficient,
    };

    return this.determineArchetypeFromSignals(inputs, configOverride);
  }
}

export default ListenerArchetypeEngine;
