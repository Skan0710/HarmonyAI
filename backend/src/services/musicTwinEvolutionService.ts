import {
  PersonalMusicTwinAttributes,
  validateAndSanitizePersonalMusicTwin,
} from '../schemas/personalMusicTwinSchema.js';

export type TwinPersonalityState =
  | 'stable personality'
  | 'developing personality'
  | 'rapidly changing taste';

export interface ChangingCharacteristicDetail {
  trait: string;
  previousValue: number | string;
  currentValue: number | string;
  delta: number;
  explanation: string;
}

export interface TwinEvolutionSummary {
  personalityState: TwinPersonalityState;
  hasMeaningfulChange: boolean;
  stableCharacteristics: string[];
  changingCharacteristics: ChangingCharacteristicDetail[];
  emergingPreferences: string[];
  fadingPreferences: string[];
  explanation: string;
}

export interface TwinEvolutionResult {
  personalityState: TwinPersonalityState;
  confidenceScore: number;
  evolvedTwin: PersonalMusicTwinAttributes;
  changeSummary: TwinEvolutionSummary;
}

export interface TwinEvolutionConfig {
  meaningfulChangeThreshold: number; // default: 0.15 (delta required to flag a changing trait)
  minInteractionsForStability: number; // default: 25
  minInteractionsForMeaningfulShift: number; // default: 5 (prevent overreacting to 1-2 plays)
  rapidTransformationThreshold: number; // default: 0.45
  stableInertiaWeight: number; // default: 0.85 (smoothing weight for stable users)
  volatileInertiaWeight: number; // default: 0.40 (smoothing weight for rapidly changing users)
  developingInertiaWeight: number; // default: 0.60
  fadingDeltaThreshold: number; // default: -0.20
  emergingMomentumThreshold: number; // default: 0.20
}

export const DEFAULT_TWIN_EVOLUTION_CONFIG: TwinEvolutionConfig = {
  meaningfulChangeThreshold: 0.15,
  minInteractionsForStability: 25,
  minInteractionsForMeaningfulShift: 5,
  rapidTransformationThreshold: 0.45,
  stableInertiaWeight: 0.85,
  volatileInertiaWeight: 0.40,
  developingInertiaWeight: 0.60,
  fadingDeltaThreshold: -0.20,
  emergingMomentumThreshold: 0.20,
};

let currentTwinEvolutionConfig: TwinEvolutionConfig = { ...DEFAULT_TWIN_EVOLUTION_CONFIG };

export function getTwinEvolutionConfig(): TwinEvolutionConfig {
  return { ...currentTwinEvolutionConfig };
}

export function updateTwinEvolutionConfig(
  newConfig: Partial<TwinEvolutionConfig>
): TwinEvolutionConfig {
  currentTwinEvolutionConfig = { ...currentTwinEvolutionConfig, ...newConfig };
  return { ...currentTwinEvolutionConfig };
}

export function resetTwinEvolutionConfig(): TwinEvolutionConfig {
  currentTwinEvolutionConfig = { ...DEFAULT_TWIN_EVOLUTION_CONFIG };
  return { ...currentTwinEvolutionConfig };
}

export interface EvolveTwinOptions {
  configOverride?: Partial<TwinEvolutionConfig>;
  interactionCountDelta?: number;
  totalInteractionCount?: number;
}

export class MusicTwinEvolutionService {
  /**
   * Evaluates the user's personality state based on interaction count, stability, and volatility.
   */
  static determinePersonalityState(
    interactionsCount: number,
    tasteStability: number,
    tasteVolatility: number,
    transformationIntensity: number,
    config: TwinEvolutionConfig = getTwinEvolutionConfig()
  ): TwinPersonalityState {
    if (interactionsCount < config.minInteractionsForStability) {
      return 'developing personality';
    }
    if (
      transformationIntensity >= config.rapidTransformationThreshold ||
      tasteVolatility >= 0.45
    ) {
      return 'rapidly changing taste';
    }
    return 'stable personality';
  }

  /**
   * Deterministically updates a Personal Music Twin as user behavior evolves over time.
   * - Strengthens established stable characteristics.
   * - Flags changing characteristics and emerging/fading preferences.
   * - Avoids overreacting to small playback samples using adaptive inertia smoothing.
   * - Recalibrates confidence mathematically.
   */
  static evolveTwin(
    previousTwin: PersonalMusicTwinAttributes | null,
    incomingTwin: PersonalMusicTwinAttributes,
    options: EvolveTwinOptions = {}
  ): TwinEvolutionResult {
    const config: TwinEvolutionConfig = {
      ...getTwinEvolutionConfig(),
      ...options.configOverride,
    };

    const totalInteractions =
      options.totalInteractionCount ??
      incomingTwin.metadata?.totalPlaysAnalyzed ??
      incomingTwin.metadata?.interactionsCount ??
      (incomingTwin.isDataSufficient ? 30 : 5);

    const interactionDelta = options.interactionCountDelta ?? 10;

    const stabilityScore = incomingTwin.tasteStability?.stabilityScore ?? 0.5;
    const volatilityScore = incomingTwin.tasteStability?.volatilityScore ?? 0.3;
    const transformScore = incomingTwin.tasteEvolution?.transformationIntensity ?? 0.15;

    // 1. Determine Personality State
    const personalityState = this.determinePersonalityState(
      totalInteractions,
      stabilityScore,
      volatilityScore,
      transformScore,
      config
    );

    // -------------------------------------------------------------------------
    // Case 1: First-time generation (No previous twin exists)
    // -------------------------------------------------------------------------
    if (!previousTwin) {
      const initialConfidence = this.calculateConfidenceScore(
        totalInteractions,
        stabilityScore,
        volatilityScore,
        personalityState,
        incomingTwin.confidenceScore
      );

      const changeSummary: TwinEvolutionSummary = {
        personalityState,
        hasMeaningfulChange: true,
        stableCharacteristics: [],
        changingCharacteristics: [],
        emergingPreferences: incomingTwin.currentEmergingInterests?.genres?.map((g) => g.name) || [],
        fadingPreferences: [],
        explanation: `Initial Personal Music Twin established in ${personalityState} state with ${(initialConfidence * 100).toFixed(0)}% confidence.`,
      };

      const evolvedTwin = validateAndSanitizePersonalMusicTwin({
        ...incomingTwin,
        confidenceScore: initialConfidence,
        metadata: {
          ...incomingTwin.metadata,
          personalityState,
          evolutionSummary: changeSummary,
          lastEvolutionTimestamp: new Date().toISOString(),
        },
      });

      return {
        personalityState,
        confidenceScore: initialConfidence,
        evolvedTwin,
        changeSummary,
      };
    }

    // -------------------------------------------------------------------------
    // Case 2: Evolving an Existing Twin
    // -------------------------------------------------------------------------

    // Select inertia factor based on personality state
    let inertiaWeight = config.stableInertiaWeight;
    if (personalityState === 'rapidly changing taste') {
      inertiaWeight = config.volatileInertiaWeight;
    } else if (personalityState === 'developing personality') {
      inertiaWeight = config.developingInertiaWeight;
    }

    // Guard against overreacting to tiny sample changes
    if (interactionDelta < config.minInteractionsForMeaningfulShift) {
      // Very few plays occurred; heavily weight prior state to prevent jitter
      inertiaWeight = Math.min(0.95, inertiaWeight + 0.15);
    }

    const smooth = (prev: number, incoming: number): number => {
      const smoothed = inertiaWeight * prev + (1.0 - inertiaWeight) * incoming;
      return Number(smoothed.toFixed(4));
    };

    const stableCharacteristics: string[] = [];
    const changingCharacteristics: ChangingCharacteristicDetail[] = [];

    // Helper to evaluate and smooth numerical traits
    const trackTraitChange = (
      name: string,
      prevVal: number,
      incomingVal: number,
      category = 'behavior'
    ): number => {
      const delta = Number((incomingVal - prevVal).toFixed(4));
      const absDelta = Math.abs(delta);

      if (absDelta >= config.meaningfulChangeThreshold) {
        changingCharacteristics.push({
          trait: name,
          previousValue: prevVal,
          currentValue: incomingVal,
          delta,
          explanation: `${name} changed by ${(delta * 100).toFixed(1)}% (${delta > 0 ? 'increased' : 'decreased'}).`,
        });
      } else {
        stableCharacteristics.push(name);
      }

      return smooth(prevVal, incomingVal);
    };

    // Smooth Core Behavioral Traits
    const evolvedExploration = trackTraitChange(
      'explorationTendency',
      previousTwin.explorationTendency,
      incomingTwin.explorationTendency
    );

    const evolvedFamiliarity = trackTraitChange(
      'familiarityTendency',
      previousTwin.familiarityTendency,
      incomingTwin.familiarityTendency
    );

    const evolvedDiversity = trackTraitChange(
      'diversityPreference',
      previousTwin.diversityPreference,
      incomingTwin.diversityPreference
    );

    const evolvedRepeat = trackTraitChange(
      'repeatListeningTendency',
      previousTwin.listeningBehavior.repeatListeningTendency,
      incomingTwin.listeningBehavior.repeatListeningTendency
    );

    const evolvedDiscovery = trackTraitChange(
      'discoveryTendency',
      previousTwin.listeningBehavior.discoveryTendency,
      incomingTwin.listeningBehavior.discoveryTendency
    );

    const evolvedIntensity = trackTraitChange(
      'sessionListeningIntensity',
      previousTwin.listeningBehavior.sessionListeningIntensity,
      incomingTwin.listeningBehavior.sessionListeningIntensity
    );

    // Smooth Acoustic Feature Traits
    const evolvedEnergy = trackTraitChange(
      'energyPreference',
      previousTwin.dominantMusicalTraits.energyPreference,
      incomingTwin.dominantMusicalTraits.energyPreference,
      'acoustic'
    );

    const evolvedDanceability = trackTraitChange(
      'danceabilityPreference',
      previousTwin.dominantMusicalTraits.danceabilityPreference,
      incomingTwin.dominantMusicalTraits.danceabilityPreference,
      'acoustic'
    );

    // Detect Archetype Transition
    if (previousTwin.listenerArchetype !== incomingTwin.listenerArchetype) {
      changingCharacteristics.push({
        trait: 'listenerArchetype',
        previousValue: previousTwin.listenerArchetype,
        currentValue: incomingTwin.listenerArchetype,
        delta: 1.0,
        explanation: `Listener archetype transitioned from ${previousTwin.listenerArchetype} to ${incomingTwin.listenerArchetype}.`,
      });
    } else {
      stableCharacteristics.push('listenerArchetype');
    }

    // -------------------------------------------------------------------------
    // Emerging and Fading Preference Detection
    // -------------------------------------------------------------------------
    const emergingPreferences: string[] = [];
    const fadingPreferences: string[] = [];

    // Analyze incoming emerging genres
    const incomingEmerging = incomingTwin.currentEmergingInterests?.genres || [];
    for (const g of incomingEmerging) {
      if (
        (g.momentumVelocity !== undefined && g.momentumVelocity >= config.emergingMomentumThreshold) ||
        g.confidence >= 0.70
      ) {
        emergingPreferences.push(g.name);
      }
    }

    // Detect Fading Genres from Previous Twin
    const incomingTopGenreNames = new Set(incomingTwin.genreIdentity.coreGenres.map((g) => g.name));
    for (const prevG of previousTwin.genreIdentity.coreGenres) {
      const incomingMatch = incomingTwin.genreIdentity.coreGenres.find((g) => g.name === prevG.name);
      if (!incomingMatch) {
        // Exited core genres
        fadingPreferences.push(prevG.name);
      } else if (incomingMatch.affinityScore - prevG.affinityScore <= config.fadingDeltaThreshold) {
        fadingPreferences.push(prevG.name);
      }
    }

    // -------------------------------------------------------------------------
    // Recalibrate Confidence Score
    // -------------------------------------------------------------------------
    const updatedConfidence = this.calculateConfidenceScore(
      totalInteractions,
      stabilityScore,
      volatilityScore,
      personalityState,
      incomingTwin.confidenceScore
    );

    const hasMeaningfulChange =
      changingCharacteristics.length > 0 ||
      emergingPreferences.length > 0 ||
      fadingPreferences.length > 0;

    let narrative = `Twin evaluated in ${personalityState} state. `;
    if (personalityState === 'stable personality') {
      narrative += `Characteristics anchored with ${stableCharacteristics.length} stable traits. `;
    } else if (personalityState === 'rapidly changing taste') {
      narrative += `High musical velocity observed with ${changingCharacteristics.length} changing traits. `;
    } else {
      narrative += `Preferences actively developing across ${totalInteractions} plays. `;
    }

    if (emergingPreferences.length > 0) {
      narrative += `Emerging: ${emergingPreferences.join(', ')}. `;
    }
    if (fadingPreferences.length > 0) {
      narrative += `Fading: ${fadingPreferences.join(', ')}. `;
    }

    const changeSummary: TwinEvolutionSummary = {
      personalityState,
      hasMeaningfulChange,
      stableCharacteristics,
      changingCharacteristics,
      emergingPreferences,
      fadingPreferences,
      explanation: narrative.trim(),
    };

    // Construct the evolved twin representation
    const evolvedTwin: PersonalMusicTwinAttributes = {
      ...incomingTwin,
      explorationTendency: evolvedExploration,
      familiarityTendency: evolvedFamiliarity,
      diversityPreference: evolvedDiversity,
      dominantMusicalTraits: {
        ...incomingTwin.dominantMusicalTraits,
        energyPreference: evolvedEnergy,
        danceabilityPreference: evolvedDanceability,
      },
      listeningBehavior: {
        ...incomingTwin.listeningBehavior,
        repeatListeningTendency: evolvedRepeat,
        discoveryTendency: evolvedDiscovery,
        sessionListeningIntensity: evolvedIntensity,
      },
      confidenceScore: updatedConfidence,
      lastUpdatedTimestamp: new Date(),
      metadata: {
        ...incomingTwin.metadata,
        personalityState,
        evolutionSummary: changeSummary,
        lastEvolutionTimestamp: new Date().toISOString(),
      },
    };

    return {
      personalityState,
      confidenceScore: updatedConfidence,
      evolvedTwin: validateAndSanitizePersonalMusicTwin(evolvedTwin),
      changeSummary,
    };
  }

  /**
   * Deterministic confidence score calculation based on interaction count,
   * stability rating, volatility, and personality maturity state.
   */
  static calculateConfidenceScore(
    interactionsCount: number,
    tasteStability: number,
    tasteVolatility: number,
    personalityState: TwinPersonalityState,
    baselineConfidence = 0.5
  ): number {
    // 1. Data volume factor (saturates near 50 interactions)
    const volumeFactor = Math.min(1.0, interactionsCount / 50);

    // 2. Stability factor (higher stability = higher confidence)
    const stabilityFactor = Math.min(1.0, Math.max(0.0, tasteStability));

    // 3. Volatility penalty (rapid shifts slightly dampen instant confidence)
    const volatilityPenalty = 0.15 * Math.min(1.0, Math.max(0.0, tasteVolatility));

    let rawScore =
      0.40 * volumeFactor +
      0.30 * stabilityFactor +
      0.30 * baselineConfidence -
      volatilityPenalty;

    // Apply state caps and floors
    if (personalityState === 'developing personality') {
      rawScore = Math.min(0.65, rawScore);
    } else if (personalityState === 'rapidly changing taste') {
      rawScore = Math.min(0.85, rawScore);
    }

    // Minimum floor 0.15, maximum ceiling 0.98
    return Number(Math.min(0.98, Math.max(0.15, rawScore)).toFixed(2));
  }
}

export default MusicTwinEvolutionService;
