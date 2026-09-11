import { isValidObjectId } from '../utils/validators.js';
import {
  ComfortDiscoveryConfig,
  getComfortDiscoveryConfig,
} from '../config/comfortDiscoveryConfig.js';
import { UnifiedMusicDNAService } from './unifiedMusicDnaService.js';
import { PersonalMusicTwinService } from './personalMusicTwinService.js';
import { LayeredTemporalTasteProfileService } from './layeredTemporalTasteProfileService.js';
import { RecommendationScoreCalibrationService } from './recommendationScoreCalibrationService.js';
import { UnifiedMusicDNA } from '../schemas/musicDnaSchema.js';
import { PersonalMusicTwinAttributes } from '../schemas/personalMusicTwinSchema.js';
import { UnifiedLayeredTasteProfile } from './layeredTemporalTasteProfileService.js';
import { UserFeedbackProfile } from './recommendationScoreCalibrationService.js';

export type ComfortDiscoveryMode = 'COMFORT' | 'DISCOVERY' | 'BALANCED';

export interface ComfortDiscoveryScoringInputs {
  userId: string;
  musicDna?: UnifiedMusicDNA | any | null;
  personalMusicTwin?: PersonalMusicTwinAttributes | any | null;
  temporalProfile?: UnifiedLayeredTasteProfile | any | null;
  feedbackProfile?: UserFeedbackProfile | any | null;
  recentInteractions?: any[] | null;
  totalInteractionsCount?: number;
  configOverride?: Partial<ComfortDiscoveryConfig>;
}

export interface ComfortDiscoveryComponentBreakdown {
  repeatListeningContribution: { comfort: number; discovery: number; weight: number };
  explorationTendencyContribution: { comfort: number; discovery: number; weight: number };
  noveltyInteractionContribution: { comfort: number; discovery: number; weight: number };
  feedbackContribution: {
    skipRate: number;
    likeRate: number;
    comfort: number;
    discovery: number;
    weight: number;
  };
  diversityContribution: {
    genreDiversity: number;
    artistDiversity: number;
    comfort: number;
    discovery: number;
    weight: number;
  };
  tasteStabilityContribution: {
    stabilityScore: number;
    comfort: number;
    discovery: number;
    weight: number;
  };
  emergingInterestsContribution: {
    emergingCount: number;
    transformationIntensity: number;
    comfort: number;
    discovery: number;
    weight: number;
  };
}

export interface ComfortDiscoveryScoreResult {
  userId: string;
  comfortScore: number;      // 0.0 to 1.0 (preference for familiar favorites and safe bedrock music)
  discoveryScore: number;    // 0.0 to 1.0 (preference for new, unfamiliar, emerging tracks)
  balanceRatio: number;      // -1.0 (pure comfort) to +1.0 (pure discovery)
  dominantMode: ComfortDiscoveryMode;
  confidenceScore: number;   // 0.0 to 1.0 based on data history depth and signal consistency
  isDataSufficient: boolean;
  componentBreakdown: ComfortDiscoveryComponentBreakdown;
  rationales: string[];
  explanation: string;
  lastCalculatedAt: Date;
}

export class ComfortDiscoveryScoringService {
  /**
   * Pure deterministic calculation: Evaluates multi-source listening behavior,
   * Music DNA, Personal Music Twin, temporal taste, and feedback signals to compute
   * separate comfort and discovery preference scores.
   */
  static calculateScores(inputs: ComfortDiscoveryScoringInputs): ComfortDiscoveryScoreResult {
    const finiteNumber = (value: unknown, fallback: number): number =>
      typeof value === 'number' && Number.isFinite(value) ? value : fallback;
    const normalizedScore = (value: unknown, fallback = 0.5): number =>
      Math.max(0, Math.min(1, finiteNumber(value, fallback)));

    const config: ComfortDiscoveryConfig = {
      ...getComfortDiscoveryConfig(),
      ...inputs.configOverride,
      weights: {
        ...getComfortDiscoveryConfig().weights,
        ...(inputs.configOverride?.weights || {}),
      },
    };

    const userIdStr = inputs.userId ? inputs.userId.toString() : '';
    const rationales: string[] = [];

    const dna = inputs.musicDna;
    const twin = inputs.personalMusicTwin;
    const temporal = inputs.temporalProfile;
    const feedback = inputs.feedbackProfile;

    // 1. Data Sufficiency & Interaction Depth Assessment
    const totalInteractions = Math.max(0, finiteNumber(
      inputs.totalInteractionsCount ??
      dna?.interactionsCountAtLastRefresh ??
      (twin?.isDataSufficient ? 20 : 0),
      0
    ));

    const hasAnyProfile = Boolean(dna || twin || temporal || feedback);
    const isDataSufficient =
      hasAnyProfile &&
      (totalInteractions >= config.minHistoryInteractions ||
        Boolean(dna?.listeningBehavior?.isDataSufficient) ||
        Boolean(twin?.isDataSufficient));

    // Handle Cold Start / Insufficient Data gracefully with sensible defaults
    if (!isDataSufficient) {
      rationales.push('Insufficient listening history detected: applied calibrated neutral defaults (0.50/0.50).');
      return {
        userId: userIdStr,
        comfortScore: config.defaultComfortScore,
        discoveryScore: config.defaultDiscoveryScore,
        balanceRatio: 0.0,
        dominantMode: 'BALANCED',
        confidenceScore: config.minConfidenceFloor,
        isDataSufficient: false,
        componentBreakdown: {
          repeatListeningContribution: { comfort: 0.5, discovery: 0.5, weight: config.weights.repeatListening },
          explorationTendencyContribution: { comfort: 0.5, discovery: 0.5, weight: config.weights.explorationTendency },
          noveltyInteractionContribution: { comfort: 0.5, discovery: 0.5, weight: config.weights.noveltyInteraction },
          feedbackContribution: { skipRate: 0, likeRate: 0, comfort: 0.5, discovery: 0.5, weight: config.weights.feedback },
          diversityContribution: { genreDiversity: 0.5, artistDiversity: 0.5, comfort: 0.5, discovery: 0.5, weight: config.weights.diversity },
          tasteStabilityContribution: { stabilityScore: 0.5, comfort: 0.5, discovery: 0.5, weight: config.weights.tasteStability },
          emergingInterestsContribution: { emergingCount: 0, transformationIntensity: 0, comfort: 0.5, discovery: 0.5, weight: config.weights.emergingInterests },
        },
        rationales,
        explanation: 'User has limited listening history. System is operating in balanced mode with neutral comfort and discovery weights.',
        lastCalculatedAt: new Date(),
      };
    }

    // 2. Repeat Listening Signal (Bedrock Loyalty vs Novelty)
    const repeatTendency = normalizedScore(
      twin?.listeningBehavior?.repeatListeningTendency ?? dna?.listeningBehavior?.repeatListeningTendency
    );

    const repeatComfort = Number(Math.max(0.0, Math.min(1.0, repeatTendency)).toFixed(4));
    const repeatDiscovery = Number(Math.max(0.0, Math.min(1.0, 1.0 - repeatTendency)).toFixed(4));

    if (repeatTendency >= 0.65) {
      rationales.push(`High repeat listening habit (${(repeatTendency * 100).toFixed(0)}%) strongly reinforces comfort preference.`);
    } else if (repeatTendency <= 0.35) {
      rationales.push(`Low repeat listening habit (${(repeatTendency * 100).toFixed(0)}%) indicates appetite for fresh song rotations.`);
    }

    // 3. Exploration Tendency Signal (Horizon Broadening)
    const explorationTendency = normalizedScore(
      twin?.explorationTendency ??
      dna?.tendencies?.explorationPreference ??
      dna?.listeningBehavior?.explorationTendency
    );

    const explorationComfort = Number(Math.max(0.0, Math.min(1.0, 1.0 - explorationTendency)).toFixed(4));
    const explorationDiscovery = Number(Math.max(0.0, Math.min(1.0, explorationTendency)).toFixed(4));

    if (explorationTendency >= 0.65) {
      rationales.push(`High exploration tendency (${(explorationTendency * 100).toFixed(0)}%) drives elevated discovery appetite.`);
    } else if (explorationTendency <= 0.35) {
      rationales.push(`Low exploration tendency (${(explorationTendency * 100).toFixed(0)}%) indicates strong comfort focus.`);
    }

    // 4. Novelty Interaction Signal (Actual Unfamiliar Exposure Engagement)
    const noveltyInteraction = normalizedScore(
      twin?.listeningBehavior?.discoveryTendency ??
      dna?.tendencies?.discoveryTendency ??
      dna?.listeningBehavior?.discoveryTendency
    );

    const noveltyComfort = Number(Math.max(0.0, Math.min(1.0, 1.0 - noveltyInteraction)).toFixed(4));
    const noveltyDiscovery = Number(Math.max(0.0, Math.min(1.0, noveltyInteraction)).toFixed(4));

    // 5. Recent Feedback Signals (Skips vs Positive Feedback)
    let skipRate = 0.20;
    let likeRate = 0.20;

    if (feedback) {
      if (typeof feedback.overallSkipRate === 'number') {
        skipRate = normalizedScore(feedback.overallSkipRate, skipRate);
      } else if (feedback.skippedSongIds && feedback.likedSongIds) {
        const totalFeedback = feedback.skippedSongIds.size + feedback.likedSongIds.size;
        skipRate = totalFeedback > 0 ? feedback.skippedSongIds.size / totalFeedback : 0.20;
      }

      if (typeof feedback.overallLikeRate === 'number') {
        likeRate = normalizedScore(feedback.overallLikeRate, likeRate);
      } else if (feedback.skippedSongIds && feedback.likedSongIds) {
        const totalFeedback = feedback.skippedSongIds.size + feedback.likedSongIds.size;
        likeRate = totalFeedback > 0 ? feedback.likedSongIds.size / totalFeedback : 0.20;
      }
    }

    // If skip rate is high, user is experiencing friction with unfamiliar/unfitting tracks -> triggers protective comfort retreat
    // If like rate is high, user is enjoying recommendations -> boosts discovery openness
    const skipDeviation = skipRate - 0.25;
    const likeDeviation = likeRate - 0.25;

    const feedbackComfortDelta = config.skipPenaltySensitivity * skipDeviation - config.likeBoostSensitivity * likeDeviation;
    const feedbackComfort = Number(Math.max(0.0, Math.min(1.0, 0.50 + feedbackComfortDelta)).toFixed(4));
    const feedbackDiscovery = Number(Math.max(0.0, Math.min(1.0, 0.50 - feedbackComfortDelta)).toFixed(4));

    if (skipRate >= 0.45) {
      rationales.push(`Elevated skip rate (${(skipRate * 100).toFixed(0)}%) triggers comfort retreat to protect listener experience.`);
    } else if (likeRate >= 0.40) {
      rationales.push(`High positive feedback rate (${(likeRate * 100).toFixed(0)}%) indicates receptive listener ready for discovery.`);
    }

    // 6. Genre & Artist Diversity Signal
    const genreDiversity = normalizedScore(
      twin?.genreIdentity?.genreDiversityScore ??
      dna?.genreProfile?.diversity ??
      twin?.diversityPreference
    );

    const artistDiversity = normalizedScore(
      dna?.artistProfile?.diversity ?? twin?.diversityPreference,
      genreDiversity
    );

    const avgDiversity = (genreDiversity + artistDiversity) / 2;
    const diversityComfort = Number(Math.max(0.0, Math.min(1.0, 1.0 - avgDiversity)).toFixed(4));
    const diversityDiscovery = Number(Math.max(0.0, Math.min(1.0, avgDiversity)).toFixed(4));

    if (avgDiversity >= 0.70) {
      rationales.push(`Broad catalog diversity (genre: ${genreDiversity.toFixed(2)}, artist: ${artistDiversity.toFixed(2)}) reflects expansive taste.`);
    } else if (avgDiversity <= 0.35) {
      rationales.push(`Focused catalog concentration reflects loyalty to specific signature genres and artists.`);
    }

    // 7. Taste Stability Signal
    const stabilityScore = normalizedScore(
      twin?.tasteStability?.stabilityScore ??
      temporal?.tasteStabilityScore ??
      dna?.listeningBehavior?.preferenceStability,
      0.60
    );

    const stabilityComfort = Number(Math.max(0.0, Math.min(1.0, stabilityScore)).toFixed(4));
    const stabilityDiscovery = Number(Math.max(0.0, Math.min(1.0, 1.0 - stabilityScore)).toFixed(4));

    if (stabilityScore >= 0.75) {
      rationales.push(`High taste stability (${(stabilityScore * 100).toFixed(0)}%) stabilizes comfort preference.`);
    } else if (stabilityScore < 0.50) {
      rationales.push(`Active taste shift (stability: ${(stabilityScore * 100).toFixed(0)}%) indicates evolving exploratory phase.`);
    }

    // 8. Emerging Interests Signal
    const emergingGenres =
      twin?.currentEmergingInterests?.genres ||
      dna?.genreProfile?.emergingGenres ||
      dna?.temporalTaste?.emergingGenres ||
      [];
    const emergingArtists =
      twin?.currentEmergingInterests?.artists ||
      dna?.artistProfile?.emergingArtists ||
      [];
    const emergingCount = emergingGenres.length + emergingArtists.length;

    const transformationIntensity = normalizedScore(twin?.tasteEvolution?.transformationIntensity, 0);

    let emergingComfort = 0.50;
    let emergingDiscovery = 0.50;

    if (emergingCount > 0 || transformationIntensity > 0) {
      const momentumMagnitude = Math.min(1.0, transformationIntensity * 0.7 + Math.min(emergingCount, 4) * 0.15);
      emergingDiscovery = Number(Math.min(1.0, 0.50 + 0.40 * momentumMagnitude).toFixed(4));
      emergingComfort = Number(Math.max(0.0, 0.50 - 0.30 * momentumMagnitude).toFixed(4));
      rationales.push(`Detected ${emergingCount} emerging interests with active taste momentum (+${(momentumMagnitude * 100).toFixed(0)}%).`);
    }

    // 9. Archetype Specific Calibration (Modulation from Personal Music Twin if present)
    let archetypeComfortMod = 0;
    let archetypeDiscoveryMod = 0;

    if (twin?.listenerArchetype) {
      const archetype = twin.listenerArchetype;
      if (archetype === 'Comfort Listener' || archetype === 'Loyal Listener') {
        archetypeComfortMod = 0.06;
        archetypeDiscoveryMod = -0.06;
        rationales.push(`Archetype [${archetype}] amplifies comfort preference.`);
      } else if (archetype === 'Explorer' || archetype === 'Discovery Seeker') {
        archetypeComfortMod = -0.06;
        archetypeDiscoveryMod = 0.06;
        rationales.push(`Archetype [${archetype}] amplifies discovery preference.`);
      } else if (archetype === 'Genre Hopper') {
        archetypeDiscoveryMod = 0.04;
      }
    }

    // 10. Multi-Signal Fusion via Normalized Weights
    const w = {
      repeatListening: Math.max(0, finiteNumber(config.weights.repeatListening, 0)),
      explorationTendency: Math.max(0, finiteNumber(config.weights.explorationTendency, 0)),
      noveltyInteraction: Math.max(0, finiteNumber(config.weights.noveltyInteraction, 0)),
      feedback: Math.max(0, finiteNumber(config.weights.feedback, 0)),
      diversity: Math.max(0, finiteNumber(config.weights.diversity, 0)),
      tasteStability: Math.max(0, finiteNumber(config.weights.tasteStability, 0)),
      emergingInterests: Math.max(0, finiteNumber(config.weights.emergingInterests, 0)),
    };
    const totalWeight =
      w.repeatListening +
      w.explorationTendency +
      w.noveltyInteraction +
      w.feedback +
      w.diversity +
      w.tasteStability +
      w.emergingInterests;

    const rawComfort =
      (w.repeatListening * repeatComfort +
        w.explorationTendency * explorationComfort +
        w.noveltyInteraction * noveltyComfort +
        w.feedback * feedbackComfort +
        w.diversity * diversityComfort +
        w.tasteStability * stabilityComfort +
        w.emergingInterests * emergingComfort) /
      Math.max(0.01, totalWeight);

    const rawDiscovery =
      (w.repeatListening * repeatDiscovery +
        w.explorationTendency * explorationDiscovery +
        w.noveltyInteraction * noveltyDiscovery +
        w.feedback * feedbackDiscovery +
        w.diversity * diversityDiscovery +
        w.tasteStability * stabilityDiscovery +
        w.emergingInterests * emergingDiscovery) /
      Math.max(0.01, totalWeight);

    const finalComfortScore = Number(
      Math.max(0.0, Math.min(1.0, rawComfort + archetypeComfortMod)).toFixed(4)
    );
    const finalDiscoveryScore = Number(
      Math.max(0.0, Math.min(1.0, rawDiscovery + archetypeDiscoveryMod)).toFixed(4)
    );

    // 11. Balance Ratio & Dominant Mode
    // Balance ratio ranges from -1.0 (pure comfort) to +1.0 (pure discovery)
    const balanceRatio = Number((finalDiscoveryScore - finalComfortScore).toFixed(4));

    let dominantMode: ComfortDiscoveryMode = 'BALANCED';
    if (balanceRatio >= 0.15) {
      dominantMode = 'DISCOVERY';
    } else if (balanceRatio <= -0.15) {
      dominantMode = 'COMFORT';
    }

    // 12. Calibrated Confidence Score
    const baseConfidence = normalizedScore(twin?.confidenceScore ?? dna?.confidenceScore, 0.60);

    // Scale confidence with interaction depth
    const dataMultiplier = Math.min(1.0, totalInteractions / 25);
    const confidenceScore = Number(
      Math.max(
        config.minConfidenceFloor,
        Math.min(
          config.maxConfidenceCeiling,
          0.30 * config.minConfidenceFloor + 0.70 * (baseConfidence * (0.60 + 0.40 * dataMultiplier))
        )
      ).toFixed(2)
    );

    // Explanation Synthesis
    const explanation =
      dominantMode === 'COMFORT'
        ? `Listener shows strong preference for familiar classics, repeat favorites, and established catalog (Comfort: ${finalComfortScore}, Discovery: ${finalDiscoveryScore}).`
        : dominantMode === 'DISCOVERY'
        ? `Listener shows strong appetite for unfamiliar tracks, diverse genres, and emerging sounds (Discovery: ${finalDiscoveryScore}, Comfort: ${finalComfortScore}).`
        : `Listener exhibits a balanced appetite between comfortable favorites and intriguing musical discoveries (Comfort: ${finalComfortScore}, Discovery: ${finalDiscoveryScore}).`;

    return {
      userId: userIdStr,
      comfortScore: finalComfortScore,
      discoveryScore: finalDiscoveryScore,
      balanceRatio,
      dominantMode,
      confidenceScore,
      isDataSufficient,
      componentBreakdown: {
        repeatListeningContribution: { comfort: repeatComfort, discovery: repeatDiscovery, weight: w.repeatListening },
        explorationTendencyContribution: { comfort: explorationComfort, discovery: explorationDiscovery, weight: w.explorationTendency },
        noveltyInteractionContribution: { comfort: noveltyComfort, discovery: noveltyDiscovery, weight: w.noveltyInteraction },
        feedbackContribution: { skipRate, likeRate, comfort: feedbackComfort, discovery: feedbackDiscovery, weight: w.feedback },
        diversityContribution: { genreDiversity, artistDiversity, comfort: diversityComfort, discovery: diversityDiscovery, weight: w.diversity },
        tasteStabilityContribution: { stabilityScore, comfort: stabilityComfort, discovery: stabilityDiscovery, weight: w.tasteStability },
        emergingInterestsContribution: { emergingCount, transformationIntensity, comfort: emergingComfort, discovery: emergingDiscovery, weight: w.emergingInterests },
      },
      rationales,
      explanation,
      lastCalculatedAt: new Date(),
    };
  }

  /**
   * High-level asynchronous accessor: Fetches missing intelligence sources
   * (Music DNA, Personal Music Twin, Temporal Taste Profile, Feedback Profile)
   * and computes the user's Comfort vs Discovery score profile.
   */
  static async getUserComfortDiscoveryScores(
    userId: string,
    options: {
      configOverride?: Partial<ComfortDiscoveryConfig>;
      forceRefresh?: boolean;
    } = {}
  ): Promise<ComfortDiscoveryScoreResult> {
    const userIdStr = userId.toString();

    // Concurrently fetch upstream intelligence signals
    const [dna, twin, temporal, feedback] = await Promise.all([
      UnifiedMusicDNAService.getOrGenerateProfile(userIdStr, {
        forceRefresh: options.forceRefresh,
      }).catch(() => null),
      PersonalMusicTwinService.getOrGenerateTwin(userIdStr, {
        forceRefresh: options.forceRefresh,
      }).catch(() => null),
      LayeredTemporalTasteProfileService.generateLayeredTasteProfile(userIdStr).catch(() => null),
      RecommendationScoreCalibrationService.buildUserFeedbackProfile(userIdStr).catch(() => null),
    ]);

    return this.calculateScores({
      userId: userIdStr,
      musicDna: dna,
      personalMusicTwin: twin ? (twin as any).toObject ? (twin as any).toObject() : twin : null,
      temporalProfile: temporal,
      feedbackProfile: feedback,
      configOverride: options.configOverride,
    });
  }
}

export default ComfortDiscoveryScoringService;
