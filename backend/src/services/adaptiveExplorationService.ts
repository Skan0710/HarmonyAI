import { Types } from 'mongoose';
import {
  ExplorationExploitationConfig,
  getExplorationExploitationConfig,
} from '../config/recommendationSignalConfig.js';
import { UserClassificationType } from './coldStartDetectionService.js';
import { UnifiedLayeredTasteProfile } from './layeredTemporalTasteProfileService.js';
import { UserFeedbackProfile } from './recommendationScoreCalibrationService.js';
import { IListeningSession } from '../models/ListeningSession.js';
import { NoveltyScoringService } from './noveltyScoringService.js';
import { HybridRankedResult } from './hybridRankingPipeline.js';

export interface ExplorationRationale {
  factor: string;
  adjustment: number;
  reason: string;
}

export type ExplorationMode = 'EXPLORATION' | 'EXPLOITATION' | 'BALANCED';

export interface AdaptiveExplorationInputs {
  userId: string;
  userClassification?: UserClassificationType;
  temporalProfile?: UnifiedLayeredTasteProfile | null;
  feedbackProfile?: UserFeedbackProfile | null;
  activeSession?: IListeningSession | null;
  userEncounteredSongIds?: Set<string> | Map<string, number>;
  configOverride?: Partial<ExplorationExploitationConfig>;
}

export interface AdaptiveExplorationRateResult {
  userId: string;
  effectiveExplorationRate: number; // epsilon in [minExplorationRate, maxExplorationRate]
  effectiveExploitationRate: number; // 1 - epsilon
  mode: ExplorationMode;
  rationales: ExplorationRationale[];
  explanation: string;
  config: ExplorationExploitationConfig;
}

export interface ExplorationScoredItem<T = any> {
  item: T;
  song: any;
  originalScore: number;
  exploitationScore: number;
  explorationScore: number;
  rawNoveltyScore: number;
  finalScore: number;
}

export class AdaptiveExplorationService {
  /**
   * Pure calculation: Determines user-specific exploration rate (epsilon)
   * balancing familiar exploitation vs novel exploration based on user classification,
   * temporal taste stability, feedback history, and session behavior.
   */
  static calculateAdaptiveExplorationRate(
    inputs: AdaptiveExplorationInputs
  ): AdaptiveExplorationRateResult {
    const config: ExplorationExploitationConfig = {
      ...getExplorationExploitationConfig(),
      ...inputs.configOverride,
    };

    const classification: UserClassificationType = inputs.userClassification || 'ACTIVE';
    const rationales: ExplorationRationale[] = [];

    // 1. Baseline Exploration Rate from User History State
    let epsilon = config.defaultExplorationRate;

    if (classification === 'NEW') {
      epsilon = config.newUserExplorationRate;
      rationales.push({
        factor: 'new_user_cold_start',
        adjustment: Number((config.newUserExplorationRate - config.defaultExplorationRate).toFixed(4)),
        reason: 'Applied elevated exploration rate for new user to discover preferences across diverse catalog',
      });
    } else if (classification === 'LIMITED_DATA') {
      epsilon = config.limitedHistoryExplorationRate;
      rationales.push({
        factor: 'limited_history_discovery',
        adjustment: Number((config.limitedHistoryExplorationRate - config.defaultExplorationRate).toFixed(4)),
        reason: 'Applied balanced exploration rate for user with emerging taste history',
      });
    } else if (classification === 'WELL_ESTABLISHED') {
      const reduction = 0.05;
      epsilon = Math.max(config.minExplorationRate, config.defaultExplorationRate - reduction);
      rationales.push({
        factor: 'established_preference_exploitation',
        adjustment: -reduction,
        reason: 'Prioritized familiar exploitation for well-established user with extensive history',
      });
    } else {
      rationales.push({
        factor: 'default_active_balance',
        adjustment: 0,
        reason: 'Applied default balanced exploration/exploitation rate for active user',
      });
    }

    // 2. Temporal Taste Stability & Drift Influence
    if (inputs.temporalProfile && classification !== 'NEW') {
      const stability = inputs.temporalProfile.tasteStabilityScore;

      if (stability < 0.60) {
        // Active pivot: user is currently diverging from historical baseline
        const pivotIntensity = Math.min(1.0, (0.60 - stability) / 0.60);
        const boost = Number((config.activePivotExplorationBoost * pivotIntensity).toFixed(4));
        epsilon += boost;
        rationales.push({
          factor: 'active_taste_pivot_exploration',
          adjustment: boost,
          reason: `Boosted exploration (+${boost.toFixed(2)}) due to active taste evolution (stability: ${stability.toFixed(2)})`,
        });
      } else if (stability >= 0.75) {
        // High stability: user short-term listening matches long-term rotational habits
        const stabilityIntensity = Math.min(1.0, (stability - 0.75) / 0.25);
        const dampen = Number((config.highStabilityExplorationDampen * stabilityIntensity).toFixed(4));
        epsilon -= dampen;
        rationales.push({
          factor: 'stable_habits_exploitation',
          adjustment: -dampen,
          reason: `Reduced exploration (-${dampen.toFixed(2)}) to honor consistent long-term listening habits (stability: ${stability.toFixed(2)})`,
        });
      }
    }

    // 3. Feedback Influence: Repeated Skips vs Positive Feedback
    if (inputs.feedbackProfile && classification !== 'NEW') {
      let totalInteractions = 0;
      let totalSkips = 0;
      let totalLikes = 0;

      if (inputs.feedbackProfile.signalPerformance) {
        for (const metrics of Object.values(inputs.feedbackProfile.signalPerformance)) {
          totalInteractions += metrics.total || 0;
          totalSkips += metrics.skippedCount || 0;
          totalLikes += metrics.likedCount || 0;
        }
      }

      const skipRate: number =
        typeof (inputs.feedbackProfile as any).overallSkipRate === 'number'
          ? (inputs.feedbackProfile as any).overallSkipRate
          : totalInteractions > 0
          ? totalSkips / totalInteractions
          : inputs.feedbackProfile.skippedSongIds && inputs.feedbackProfile.skippedSongIds.size > 0
          ? inputs.feedbackProfile.skippedSongIds.size /
            (inputs.feedbackProfile.skippedSongIds.size + inputs.feedbackProfile.likedSongIds.size + 1)
          : 0;

      const likeRate: number =
        typeof (inputs.feedbackProfile as any).overallLikeRate === 'number'
          ? (inputs.feedbackProfile as any).overallLikeRate
          : totalInteractions > 0
          ? totalLikes / totalInteractions
          : inputs.feedbackProfile.likedSongIds && inputs.feedbackProfile.likedSongIds.size > 0
          ? inputs.feedbackProfile.likedSongIds.size /
            (inputs.feedbackProfile.skippedSongIds.size + inputs.feedbackProfile.likedSongIds.size + 1)
          : 0;

      if (skipRate >= 0.50) {
        // Repeated negative feedback: user is frustrated by unfitting recommendations
        const skipIntensity = Math.min(1.0, (skipRate - 0.50) / 0.50);
        const reduction = Number((config.negativeFeedbackDampenFactor * skipIntensity).toFixed(4));
        epsilon -= reduction;
        rationales.push({
          factor: 'negative_feedback_exploration_suppression',
          adjustment: -reduction,
          reason: `Throttled exploration (-${reduction.toFixed(2)}) due to high skip rate (${(skipRate * 100).toFixed(0)}%) to protect user comfort`,
        });
      } else if (likeRate >= 0.35) {
        // High positive feedback: user is receptive and enjoying recommendations
        const boost = config.positiveFeedbackBoostFactor;
        epsilon += boost;
        rationales.push({
          factor: 'positive_feedback_exploration_boost',
          adjustment: boost,
          reason: `Slightly increased exploration (+${boost.toFixed(2)}) due to high like rate (${(likeRate * 100).toFixed(0)}%)`,
        });
      }
    }

    // 4. Session Behavior: Active Pickiness vs Sustained Engagement
    if (inputs.activeSession && classification !== 'NEW') {
      const session = inputs.activeSession;
      const skippedCount = Array.isArray(session.tracksSkipped)
        ? session.tracksSkipped.length
        : Array.isArray((session as any).skippedSongs)
        ? (session as any).skippedSongs.length
        : 0;
      const playedCount = Array.isArray(session.tracksPlayed)
        ? session.tracksPlayed.length
        : Array.isArray(session.songsPlayed)
        ? session.songsPlayed.length
        : 0;

      if (skippedCount >= 2 && skippedCount >= playedCount) {
        const sessionDampen = 0.05;
        epsilon -= sessionDampen;
        rationales.push({
          factor: 'active_session_pickiness',
          adjustment: -sessionDampen,
          reason: 'Dampened exploration due to frequent skips in current session',
        });
      }
    }

    // 5. Safety Floors & Bounding
    const boundedEpsilon = Number(
      Math.max(config.minExplorationRate, Math.min(config.maxExplorationRate, epsilon)).toFixed(4)
    );
    const exploitationRate = Number((1.0 - boundedEpsilon).toFixed(4));

    // Determine Mode
    let mode: ExplorationMode = 'BALANCED';
    if (boundedEpsilon >= 0.35) {
      mode = 'EXPLORATION';
    } else if (boundedEpsilon <= 0.15) {
      mode = 'EXPLOITATION';
    }

    const explanation =
      rationales.length > 0
        ? rationales.map((r) => r.reason).join('; ')
        : `Balanced exploration (${boundedEpsilon}) and exploitation (${exploitationRate})`;

    return {
      userId: inputs.userId,
      effectiveExplorationRate: boundedEpsilon,
      effectiveExploitationRate: exploitationRate,
      mode,
      rationales,
      explanation,
      config,
    };
  }

  /**
   * Applies relevance-gated exploration vs exploitation reranking across candidate items.
   *
   * Formulations:
   * S_exploit = Base Relevance Score (personalized hybrid match)
   * S_novelty = Composite Novelty (catalog rarity + user exposure)
   * S_explore = Gated Novelty Boost(S_exploit, S_novelty, minRelevanceThreshold)
   *   Note: If S_exploit <= minRelevanceThreshold, S_explore = 0.0 (NO random recommendations!)
   * S_final = (1 - epsilon) * S_exploit + epsilon * S_explore
   */
  static applyExplorationReranking<T extends HybridRankedResult = HybridRankedResult>(
    items: T[],
    inputs: AdaptiveExplorationInputs,
    options: {
      scoreExtractor?: (item: T) => number;
      songExtractor?: (item: T) => any;
      customExplorationRate?: number;
    } = {}
  ): {
    results: T[];
    explorationDetails: AdaptiveExplorationRateResult;
  } {
    if (!items || items.length === 0) {
      const rateDetails = this.calculateAdaptiveExplorationRate(inputs);
      return { results: [], explorationDetails: rateDetails };
    }

    const rateDetails = this.calculateAdaptiveExplorationRate(inputs);
    const epsilon =
      options.customExplorationRate !== undefined
        ? Math.max(0, Math.min(1, options.customExplorationRate))
        : rateDetails.effectiveExplorationRate;

    const encounteredSet =
      inputs.userEncounteredSongIds instanceof Set
        ? inputs.userEncounteredSongIds
        : inputs.userEncounteredSongIds instanceof Map
        ? new Set(inputs.userEncounteredSongIds.keys())
        : new Set<string>();

    const scoredList: {
      item: T;
      finalScore: number;
      exploitScore: number;
      exploreScore: number;
      rawNovelty: number;
    }[] = items.map((item) => {
      const songDoc = options.songExtractor ? options.songExtractor(item) : item.song || (item as any).songDoc || item;
      const baseScore =
        options.scoreExtractor
          ? options.scoreExtractor(item)
          : typeof item.hybridScore === 'number'
          ? item.hybridScore
          : typeof item.finalScore === 'number'
          ? item.finalScore
          : 0.5;

      const songId = songDoc?._id ? songDoc._id.toString() : songDoc?.id || (item as any).songId || '';
      const catalogPlayCount = typeof songDoc?.playCount === 'number' ? songDoc.playCount : 0;
      const userEncountered = songId ? encounteredSet.has(songId) : false;
      const userPlayCount = userEncountered ? 1 : 0;

      // 1. Composite Novelty
      const rawNovelty = NoveltyScoringService.computeCompositeNovelty({
        catalogPlayCount,
        userPlayCount,
      });

      // 2. Relevance-Gated Novelty (Prevents irrelevant noise from getting boosted)
      const gatedExplorationScore = NoveltyScoringService.calculateGatedNoveltyBoost(
        baseScore,
        rawNovelty,
        rateDetails.config.minRelevanceThreshold
      );

      // 3. Score Fusion: (1 - epsilon) * exploit + epsilon * explore
      const fusedScore = Number(
        ((1.0 - epsilon) * baseScore + epsilon * gatedExplorationScore).toFixed(4)
      );

      return {
        item,
        finalScore: Math.max(0, Math.min(1, fusedScore)),
        exploitScore: baseScore,
        exploreScore: gatedExplorationScore,
        rawNovelty,
      };
    });

    // Re-rank items descending by fused score
    scoredList.sort((a, b) => b.finalScore - a.finalScore);

    // Attach component scores & metadata back onto items
    const results: T[] = scoredList.map((entry) => {
      const resItem = { ...entry.item };
      resItem.finalScore = entry.finalScore;
      resItem.hybridScore = entry.finalScore;

      resItem.componentScores = {
        ...resItem.componentScores,
        noveltyScore: entry.rawNovelty,
        userPreferenceScore: entry.exploitScore,
      };

      resItem.metadata = {
        ...resItem.metadata,
        adaptiveExploration: {
          effectiveExplorationRate: epsilon,
          exploitationScore: entry.exploitScore,
          explorationScore: entry.exploreScore,
          rawNoveltyScore: entry.rawNovelty,
          mode: rateDetails.mode,
        },
      };

      return resItem;
    });

    return {
      results,
      explorationDetails: rateDetails,
    };
  }
}
