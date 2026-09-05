import { Types } from 'mongoose';
import {
  BaselineSignalWeights,
  ContextSignalWeights,
  FeedbackSignalWeights,
  ModulationLayerWeights,
  RecommendationSignalConfig,
  SessionBehaviorSignalWeights,
  TemporalHorizonSignalWeights,
  getRecommendationSignalConfig,
} from '../config/recommendationSignalConfig.js';
import { ColdStartDetectionService, UserClassificationType } from './coldStartDetectionService.js';
import {
  LayeredTemporalTasteProfileService,
  UnifiedLayeredTasteProfile,
} from './layeredTemporalTasteProfileService.js';
import {
  RecommendationScoreCalibrationService,
  UserFeedbackProfile,
} from './recommendationScoreCalibrationService.js';
import { ListeningSessionService } from './listeningSessionService.js';
import { IListeningSession } from '../models/ListeningSession.js';
import { SessionTasteProfile } from './sessionTasteProfileService.js';

export interface SignalRationale {
  signal: string;
  factor: string;
  adjustment: number;
  reason: string;
}

export interface UserSignalWeightingInputs {
  userId: string;
  userClassification?: UserClassificationType;
  temporalProfile?: UnifiedLayeredTasteProfile | null;
  feedbackProfile?: UserFeedbackProfile | null;
  activeSession?: IListeningSession | null;
  sessionProfile?: SessionTasteProfile | null;
  baseConfig?: RecommendationSignalConfig;
  customOverrides?: Partial<BaselineSignalWeights>;
}

export interface UserSpecificSignalWeightingResult {
  userId: string;
  userClassification: UserClassificationType;
  baselineWeights: BaselineSignalWeights;
  modulationLayers: ModulationLayerWeights;
  temporalHorizons: TemporalHorizonSignalWeights;
  sessionBehavior: SessionBehaviorSignalWeights;
  contextSignals: ContextSignalWeights;
  feedbackSignals: FeedbackSignalWeights;
  rationales: SignalRationale[];
  explanation: string;
  isPersonalized: boolean;
}

export class UserSpecificSignalWeightingService {
  /**
   * Minimum weight floor for any baseline scoring signal to guarantee
   * no critical signal is completely extinguished due to sparse data.
   */
  public static readonly MIN_SIGNAL_FLOOR = 0.05;

  /**
   * Pure calculation function: Determines user-specific recommendation signal weights
   * based on user classification, taste stability, recent momentum, and feedback history.
   */
  static calculateUserSpecificWeights(
    inputs: UserSignalWeightingInputs
  ): UserSpecificSignalWeightingResult {
    const config = inputs.baseConfig || getRecommendationSignalConfig();
    const classification = inputs.userClassification || 'ACTIVE';
    const rationales: SignalRationale[] = [];

    // Working copies of configuration sections
    const baseline: BaselineSignalWeights = { ...config.baselineSignals };
    const modulation: ModulationLayerWeights = { ...config.modulationLayers };
    const temporal: TemporalHorizonSignalWeights = { ...config.temporalHorizons };
    const session: SessionBehaviorSignalWeights = { ...config.sessionBehavior };
    const context: ContextSignalWeights = { ...config.contextSignals };
    const feedback: FeedbackSignalWeights = { ...config.feedbackSignals };

    let isPersonalized = true;

    // =========================================================================
    // 1. COLD START & LIMITED HISTORY FALLBACKS
    // =========================================================================
    if (classification === 'NEW') {
      isPersonalized = false;
      // For completely new users: prioritize global popularity, recency, and broad discovery
      baseline.popularityWeight = 0.325;
      baseline.recencyWeight = 0.225;
      baseline.contentSimilarityWeight = 0.20;
      baseline.collaborativeWeight = 0.125;
      baseline.userTasteAffinityWeight = 0.125; // Sensible floor preserved

      modulation.temporalInfluence = 0.05; // Minimal temporal influence
      modulation.sessionInfluence = inputs.activeSession ? 0.25 : 0.10;
      modulation.contextInfluence = 0.20;

      rationales.push({
        signal: 'baseline_all',
        factor: 'new_user_cold_start',
        adjustment: 0,
        reason: 'Applied exploratory baseline weights prioritizing popularity and recency for new user',
      });
    } else if (classification === 'LIMITED_DATA') {
      // Early personalization: balanced exploration with emerging taste
      baseline.contentSimilarityWeight = 0.28;
      baseline.collaborativeWeight = 0.18;
      baseline.userTasteAffinityWeight = 0.22;
      baseline.popularityWeight = 0.18;
      baseline.recencyWeight = 0.14;

      modulation.temporalInfluence = 0.15;
      modulation.sessionInfluence = 0.20;
      modulation.contextInfluence = 0.25;

      rationales.push({
        signal: 'baseline_all',
        factor: 'limited_data_adaptation',
        adjustment: 0,
        reason: 'Balanced exploratory signals with emerging taste affinities for user with limited history',
      });
    } else {
      // If no active session is present, idle session influence to 0.10 to prevent crowding out temporal signals
      if (!inputs.activeSession) {
        modulation.sessionInfluence = 0.10;
      }

      // A. Temporal Taste Stability & Horizon Adaptation
      if (inputs.temporalProfile) {
        const stability = inputs.temporalProfile.tasteStabilityScore;

        if (stability < 0.60) {
          // ACTIVE PIVOT / STRONG RECENT PREFERENCES
          // User is currently exploring new sounds diverging from historical baseline
          const pivotIntensity = Math.min(1.0, (0.60 - stability) / 0.60);
          const shortBoost = 0.15 * pivotIntensity;
          temporal.shortTermWeight = Number((temporal.shortTermWeight + shortBoost).toFixed(4));
          temporal.longTermWeight = Number(
            Math.max(this.MIN_SIGNAL_FLOOR, temporal.longTermWeight - shortBoost * 0.6).toFixed(4)
          );

          // Boost macro temporal layer influence and reallocate from idle signals
          const tempBoost = Math.min(
            modulation.maxTemporalInfluence - modulation.temporalInfluence,
            0.10 * pivotIntensity
          );
          modulation.temporalInfluence = Number((modulation.temporalInfluence + tempBoost).toFixed(4));
          modulation.contextInfluence = 0.15;
          if (!inputs.activeSession) {
            modulation.sessionInfluence = 0.05;
          }

          // Elevate recency slightly in baseline
          baseline.recencyWeight = Number((baseline.recencyWeight + 0.025).toFixed(4));
          baseline.popularityWeight = Number(
            Math.max(this.MIN_SIGNAL_FLOOR, baseline.popularityWeight - 0.025).toFixed(4)
          );

          rationales.push({
            signal: 'temporal_taste',
            factor: 'active_taste_pivot',
            adjustment: shortBoost,
            reason: `Strengthened recent-preference horizon (shortTerm: ${temporal.shortTermWeight}) due to active taste evolution (stability: ${stability.toFixed(2)})`,
          });
        } else if (stability >= 0.75) {
          // HIGH TASTE STABILITY / STABLE LONG-TERM PREFERENCES
          // User's short-term listening matches long-term rotational habits
          const stabilityIntensity = Math.min(1.0, (stability - 0.75) / 0.25);
          const longBoost = 0.15 * stabilityIntensity;

          // Strengthen long-term taste in baseline and temporal horizons
          baseline.userTasteAffinityWeight = Number((baseline.userTasteAffinityWeight + 0.08).toFixed(4));
          baseline.popularityWeight = Number(
            Math.max(this.MIN_SIGNAL_FLOOR, baseline.popularityWeight - 0.05).toFixed(4)
          );

          temporal.longTermWeight = Number((temporal.longTermWeight + longBoost).toFixed(4));
          temporal.shortTermWeight = Number(
            Math.max(0.30, temporal.shortTermWeight - longBoost * 0.5).toFixed(4)
          );

          rationales.push({
            signal: 'long_term_taste',
            factor: 'high_taste_stability',
            adjustment: longBoost,
            reason: `Strengthened foundational long-term taste affinity (tasteAffinity: ${baseline.userTasteAffinityWeight}) due to consistent listening habits (stability: ${stability.toFixed(2)})`,
          });
        }
      }

      // B. Feedback Signal Influences
      if (inputs.feedbackProfile && inputs.feedbackProfile.signalPerformance) {
        const perf = inputs.feedbackProfile.signalPerformance;

        // 1. Collaborative signal feedback
        const collabPerf = perf['collaborative'];
        if (collabPerf && collabPerf.total >= 3) {
          if (collabPerf.skipRate >= 0.50) {
            const reduction = 0.08;
            baseline.collaborativeWeight = Number(
              Math.max(this.MIN_SIGNAL_FLOOR, baseline.collaborativeWeight - reduction).toFixed(4)
            );
            baseline.contentSimilarityWeight = Number((baseline.contentSimilarityWeight + 0.05).toFixed(4));
            baseline.userTasteAffinityWeight = Number((baseline.userTasteAffinityWeight + 0.03).toFixed(4));

            rationales.push({
              signal: 'collaborative',
              factor: 'negative_collaborative_feedback',
              adjustment: -reduction,
              reason: `Down-weighted collaborative signal due to high skip rate (${(collabPerf.skipRate * 100).toFixed(0)}%) on collaborative recommendations`,
            });
          } else if (collabPerf.likeRate + collabPerf.saveRate >= 0.35) {
            const boost = 0.06;
            baseline.collaborativeWeight = Number((baseline.collaborativeWeight + boost).toFixed(4));
            rationales.push({
              signal: 'collaborative',
              factor: 'positive_collaborative_feedback',
              adjustment: boost,
              reason: `Boosted collaborative signal due to high positive feedback (${((collabPerf.likeRate + collabPerf.saveRate) * 100).toFixed(0)}%)`,
            });
          }
        }

        // 2. Content similarity feedback
        const contentPerf = perf['content'];
        if (contentPerf && contentPerf.total >= 3) {
          if (contentPerf.likeRate + contentPerf.saveRate >= 0.35) {
            const boost = 0.05;
            baseline.contentSimilarityWeight = Number((baseline.contentSimilarityWeight + boost).toFixed(4));
            rationales.push({
              signal: 'content_similarity',
              factor: 'positive_content_feedback',
              adjustment: boost,
              reason: `Boosted content similarity weight based on positive acoustic and genre matching feedback`,
            });
          }
        }
      }

      // C. Active Session Responsiveness
      if (inputs.activeSession) {
        modulation.sessionInfluence = Number(
          Math.min(modulation.maxSessionInfluence, modulation.sessionInfluence + 0.05).toFixed(4)
        );
        rationales.push({
          signal: 'session_behavior',
          factor: 'active_listening_session',
          adjustment: 0.05,
          reason: 'Enhanced session behavioral modulation due to active listening session',
        });
      }
    }

    // Apply any explicit custom overrides if provided
    if (inputs.customOverrides) {
      Object.assign(baseline, inputs.customOverrides);
    }

    // =========================================================================
    // 3. SAFETY, BOUNDS, & NORMALIZATION
    // =========================================================================

    // A. Enforce MIN_SIGNAL_FLOOR on all baseline signals so none are extinguished
    baseline.contentSimilarityWeight = Math.max(this.MIN_SIGNAL_FLOOR, baseline.contentSimilarityWeight);
    baseline.collaborativeWeight = Math.max(this.MIN_SIGNAL_FLOOR, baseline.collaborativeWeight);
    baseline.userTasteAffinityWeight = Math.max(this.MIN_SIGNAL_FLOOR, baseline.userTasteAffinityWeight);
    baseline.popularityWeight = Math.max(this.MIN_SIGNAL_FLOOR, baseline.popularityWeight);
    baseline.recencyWeight = Math.max(this.MIN_SIGNAL_FLOOR, baseline.recencyWeight);

    // Normalize baseline weights to sum exactly to 1.0
    const baseSum =
      baseline.contentSimilarityWeight +
      baseline.collaborativeWeight +
      baseline.userTasteAffinityWeight +
      baseline.popularityWeight +
      baseline.recencyWeight;

    baseline.contentSimilarityWeight = Number((baseline.contentSimilarityWeight / baseSum).toFixed(4));
    baseline.collaborativeWeight = Number((baseline.collaborativeWeight / baseSum).toFixed(4));
    baseline.userTasteAffinityWeight = Number((baseline.userTasteAffinityWeight / baseSum).toFixed(4));
    baseline.popularityWeight = Number((baseline.popularityWeight / baseSum).toFixed(4));
    baseline.recencyWeight = Number((baseline.recencyWeight / baseSum).toFixed(4));

    // Normalize temporal horizon weights
    const tempSum = temporal.shortTermWeight + temporal.mediumTermWeight + temporal.longTermWeight;
    temporal.shortTermWeight = Number((temporal.shortTermWeight / tempSum).toFixed(4));
    temporal.mediumTermWeight = Number((temporal.mediumTermWeight / tempSum).toFixed(4));
    temporal.longTermWeight = Number((temporal.longTermWeight / tempSum).toFixed(4));

    // Bound combined modulation influence to preserve baseline hybrid weight floor
    const totalModulation =
      modulation.temporalInfluence + modulation.sessionInfluence + modulation.contextInfluence;
    if (totalModulation > modulation.maxCombinedModulationInfluence) {
      const scale = modulation.maxCombinedModulationInfluence / totalModulation;
      modulation.temporalInfluence = Number((modulation.temporalInfluence * scale).toFixed(4));
      modulation.sessionInfluence = Number((modulation.sessionInfluence * scale).toFixed(4));
      modulation.contextInfluence = Number((modulation.contextInfluence * scale).toFixed(4));
    }

    const explanation =
      rationales.length > 0
        ? rationales.map((r) => r.reason).join('; ')
        : 'Default balanced recommendation weights applied';

    return {
      userId: inputs.userId,
      userClassification: classification,
      baselineWeights: baseline,
      modulationLayers: modulation,
      temporalHorizons: temporal,
      sessionBehavior: session,
      contextSignals: context,
      feedbackSignals: feedback,
      rationales,
      explanation,
      isPersonalized,
    };
  }

  /**
   * Resolves user-specific recommendation signal weights for an authenticated user
   * by loading their cold-start status, temporal profile, feedback profile, and active session.
   */
  static async resolveUserSpecificSignalWeights(
    userId: string,
    options: {
      customOverrides?: Partial<BaselineSignalWeights>;
      baseConfig?: RecommendationSignalConfig;
    } = {}
  ): Promise<UserSpecificSignalWeightingResult> {
    if (!Types.ObjectId.isValid(userId)) {
      // Fallback for invalid ID
      return this.calculateUserSpecificWeights({
        userId,
        userClassification: 'NEW',
        baseConfig: options.baseConfig,
        customOverrides: options.customOverrides,
      });
    }

    let userClassification: UserClassificationType = 'ACTIVE';
    try {
      const coldStartStatus = await ColdStartDetectionService.detectUserColdStartStatus(userId);
      userClassification = coldStartStatus.classification;
    } catch {
      // Graceful fallback
    }

    let temporalProfile: UnifiedLayeredTasteProfile | null = null;
    try {
      temporalProfile = await LayeredTemporalTasteProfileService.generateLayeredTasteProfile(userId);
    } catch {
      // Graceful fallback
    }

    let feedbackProfile: UserFeedbackProfile | null = null;
    try {
      feedbackProfile = await RecommendationScoreCalibrationService.buildUserFeedbackProfile(userId);
    } catch {
      // Graceful fallback
    }

    let activeSession: IListeningSession | null = null;
    try {
      activeSession = await ListeningSessionService.getActiveSession(userId);
    } catch {
      // Graceful fallback
    }

    return this.calculateUserSpecificWeights({
      userId,
      userClassification,
      temporalProfile,
      feedbackProfile,
      activeSession,
      baseConfig: options.baseConfig,
      customOverrides: options.customOverrides,
    });
  }
}
