import mongoose, { Types } from 'mongoose';
import { CandidateGenerationService, HybridCandidate } from './candidateGenerationService.js';
import { HybridRankingPipeline, HybridRankedResult } from './hybridRankingPipeline.js';
import { ColdStartDetectionService } from './coldStartDetectionService.js';
import { ColdStartRecommendationService } from './coldStartRecommendationService.js';
import {
  HybridScoringWeights,
  getHybridConfigWeights,
  NoveltyScoringWeights,
} from '../config/recommendationConfig.js';
import { RecommendationContextAttributes } from '../schemas/recommendationContextSchema.js';
import {
  SessionTasteProfile,
  SessionTasteProfileService,
} from './sessionTasteProfileService.js';
import { ListeningSessionService } from './listeningSessionService.js';
import { IListeningSession } from '../models/ListeningSession.js';
import {
  LayeredTemporalTasteProfileService,
  UnifiedLayeredTasteProfile,
} from './layeredTemporalTasteProfileService.js';
import {
  RecommendationScoreCalibrationService,
  UserFeedbackProfile,
} from './recommendationScoreCalibrationService.js';
import { UserSpecificSignalWeightingService } from './userSpecificSignalWeightingService.js';
import { AdaptiveExplorationService } from './adaptiveExplorationService.js';
import { DiversityAwareRankingService } from './diversityAwareRankingService.js';
import { NoveltyScoringService, UserFamiliarityProfile } from './noveltyScoringService.js';

export interface AdaptivePipelineOptions {
  userId: string;
  seedSongId?: string;
  limit?: number;
  candidateLimit?: number;
  candidates?: HybridCandidate[];
  customWeights?: Partial<HybridScoringWeights>;
  context?: RecommendationContextAttributes | string | null;
  contextInfluence?: number;
  sessionProfile?: SessionTasteProfile | null;
  sessionInfluence?: number;
  sessionId?: string | null;
  useActiveSession?: boolean;
  temporalProfile?: UnifiedLayeredTasteProfile | null;
  temporalInfluence?: number;
  useTemporalProfile?: boolean;
  useScoreCalibration?: boolean;
  feedbackProfile?: UserFeedbackProfile | null;
  useUserSpecificWeights?: boolean;
  useAdaptiveExploration?: boolean;
  explorationRate?: number;
  useNoveltyScoring?: boolean;
  familiarityProfile?: UserFamiliarityProfile | null;
  noveltyWeights?: Partial<NoveltyScoringWeights>;
  useDiversityRanking?: boolean;
  diversityStrength?: number;
  enableAllStages?: boolean;
  userClassification?: 'NEW' | 'LIMITED_DATA' | 'ACTIVE' | 'WELL_ESTABLISHED';
}

export interface AdaptivePipelineStageDiagnostics {
  candidateGeneration: {
    candidatesCount: number;
    sourcesFound: string[];
    isColdStart: boolean;
  };
  baseScoring: {
    scoredCandidatesCount: number;
    topBaseScore: number;
  };
  userSpecificWeighting: {
    applied: boolean;
    userClassification: string;
    effectiveBaselineWeights?: Record<string, number>;
  };
  feedbackAdjustment: {
    applied: boolean;
    likedCount: number;
    skippedCount: number;
  };
  explorationAdjustment: {
    applied: boolean;
    effectiveExplorationRate?: number;
    exploredCount?: number;
  };
  noveltyAdjustment: {
    applied: boolean;
    averageNovelty?: number;
    unfamiliarCount?: number;
  };
  diversityReranking: {
    applied: boolean;
    penalizedCount?: number;
  };
  finalRanking: {
    finalCount: number;
    deterministicTieBreaksApplied: number;
  };
}

export interface AdaptivePipelineResult {
  strategyUsed: 'COLD_START' | 'HYBRID_PERSONALIZED';
  userClassification: 'NEW' | 'LIMITED_DATA' | 'ACTIVE' | 'WELL_ESTABLISHED';
  recommendations: HybridRankedResult[];
  diagnostics: AdaptivePipelineStageDiagnostics;
}

/**
 * Adaptive Recommendation Ranking Pipeline
 *
 * Combines all recommendation intelligence developed across Day 30 into a clean,
 * modular, and deterministic 8-stage pipeline:
 *
 * Stage 1: Candidate Generation
 * Stage 2: Base Recommendation Score
 * Stage 3: User-Specific Weighting
 * Stage 4: Feedback Adjustment
 * Stage 5: Exploration Adjustment
 * Stage 6: Novelty Adjustment
 * Stage 7: Diversity Re-ranking
 * Stage 8: Final Ranking & Deterministic Tie-Breaking
 */
export class AdaptiveRecommendationRankingPipeline {
  /**
   * Stage 1: Candidate Generation
   * Retrieves or accepts candidate items for the user, checking cold-start status.
   */
  static async generateCandidatesStage(options: {
    userId: string;
    seedSongId?: string;
    candidateLimit?: number;
    candidates?: HybridCandidate[];
    userClassification?: 'NEW' | 'LIMITED_DATA' | 'ACTIVE' | 'WELL_ESTABLISHED';
  }): Promise<{
    candidates: HybridCandidate[];
    isColdStart: boolean;
    userClassification: 'NEW' | 'LIMITED_DATA' | 'ACTIVE' | 'WELL_ESTABLISHED';
    coldStartSongs?: any[];
    candidateSources?: string[];
  }> {
    const { userId, seedSongId, candidateLimit = 50, candidates, userClassification: providedClass } = options;

    // If pre-generated candidates are supplied, use them directly without DB overhead
    if (candidates && Array.isArray(candidates) && candidates.length > 0) {
      return {
        candidates,
        isColdStart: false,
        userClassification: providedClass || 'ACTIVE',
      };
    }

    if (!userId || !Types.ObjectId.isValid(userId)) {
      return {
        candidates: [],
        isColdStart: true,
        userClassification: 'NEW',
        coldStartSongs: [],
        candidateSources: ['cold_start'],
      };
    }

    let userClassification = providedClass || 'ACTIVE';
    let isColdStart = false;

    try {
      const coldStartInfo = await ColdStartDetectionService.detectUserColdStartStatus(userId);
      userClassification = coldStartInfo.classification;
      isColdStart = coldStartInfo.isColdStart;
    } catch {
      // Safe fallback on database absence or timeout
    }

    if (isColdStart) {
      try {
        const coldStartRes = await ColdStartRecommendationService.getColdStartRecommendations({
          userId,
          limit: candidateLimit,
        });
        return {
          candidates: [],
          isColdStart: true,
          userClassification,
          coldStartSongs: coldStartRes.songs,
          candidateSources: coldStartRes.candidateSources || ['cold_start'],
        };
      } catch {
        return {
          candidates: [],
          isColdStart: true,
          userClassification,
          coldStartSongs: [],
          candidateSources: ['cold_start_fallback'],
        };
      }
    }

    try {
      const generated = await CandidateGenerationService.generateHybridCandidates({
        userId,
        seedSongId,
        candidateLimit,
      });

      return {
        candidates: generated,
        isColdStart: false,
        userClassification,
      };
    } catch {
      return {
        candidates: [],
        isColdStart: false,
        userClassification,
      };
    }
  }

  /**
   * Stage 2: Base Recommendation Score
   * Computes personalized hybrid score combining content similarity, collaborative filtering,
   * long-term user taste affinity, popularity, recency, context fit, and temporal/session layers.
   */
  static scoreBaseCandidatesStage(options: {
    candidates: HybridCandidate[];
    limit: number;
    weights: HybridScoringWeights;
    context?: RecommendationContextAttributes | string | null;
    contextInfluence?: number;
    sessionProfile?: SessionTasteProfile | null;
    sessionInfluence?: number;
    activeSessionDoc?: IListeningSession | null;
    temporalProfile?: UnifiedLayeredTasteProfile | null;
    temporalInfluence?: number;
  }): HybridRankedResult[] {
    const {
      candidates,
      limit,
      weights,
      context,
      contextInfluence,
      sessionProfile,
      sessionInfluence,
      activeSessionDoc,
      temporalProfile,
      temporalInfluence,
    } = options;

    if (!Array.isArray(candidates) || candidates.length === 0) {
      return [];
    }

    return HybridRankingPipeline.rankCandidates(
      candidates,
      limit,
      weights,
      context,
      contextInfluence,
      sessionProfile,
      sessionInfluence,
      activeSessionDoc,
      temporalProfile,
      temporalInfluence
    );
  }

  /**
   * Stage 3: User-Specific Weighting
   * Adapts recommendation signal weights based on user profile maturity, temporal momentum,
   * and session stability.
   */
  static applyUserSpecificWeightingStage(options: {
    userId: string;
    userClassification: 'NEW' | 'LIMITED_DATA' | 'ACTIVE' | 'WELL_ESTABLISHED';
    temporalProfile?: UnifiedLayeredTasteProfile | null;
    activeSession?: IListeningSession | null;
    sessionProfile?: SessionTasteProfile | null;
    defaultWeights: HybridScoringWeights;
    defaultTemporalInfluence?: number;
    defaultSessionInfluence?: number;
  }): {
    effectiveWeights: HybridScoringWeights;
    effectiveTemporalInfluence?: number;
    effectiveSessionInfluence?: number;
    applied: boolean;
  } {
    try {
      const userWeights = UserSpecificSignalWeightingService.calculateUserSpecificWeights({
        userId: options.userId,
        userClassification: options.userClassification,
        temporalProfile: options.temporalProfile,
        activeSession: options.activeSession,
        sessionProfile: options.sessionProfile,
      });

      return {
        effectiveWeights: userWeights.baselineWeights,
        effectiveTemporalInfluence:
          options.defaultTemporalInfluence ?? userWeights.modulationLayers.temporalInfluence,
        effectiveSessionInfluence:
          options.defaultSessionInfluence ?? userWeights.modulationLayers.sessionInfluence,
        applied: true,
      };
    } catch {
      return {
        effectiveWeights: options.defaultWeights,
        effectiveTemporalInfluence: options.defaultTemporalInfluence,
        effectiveSessionInfluence: options.defaultSessionInfluence,
        applied: false,
      };
    }
  }

  /**
   * Stage 4: Feedback Adjustment
   * Adjusts candidate scores using historical user likes, skips, saves, and completion rates.
   */
  static applyFeedbackAdjustmentStage(options: {
    rankedResults: HybridRankedResult[];
    feedbackProfile?: UserFeedbackProfile | null;
  }): {
    results: HybridRankedResult[];
    applied: boolean;
  } {
    const { rankedResults, feedbackProfile } = options;
    if (!feedbackProfile || !Array.isArray(rankedResults) || rankedResults.length === 0) {
      return { results: rankedResults, applied: false };
    }

    try {
      const calibrated = RecommendationScoreCalibrationService.calibrateRankedResults(
        rankedResults,
        feedbackProfile
      );
      return { results: calibrated, applied: true };
    } catch {
      return { results: rankedResults, applied: false };
    }
  }

  /**
   * Stage 5: Exploration Adjustment
   * Balances exploitation with intelligent taste-aligned exploration.
   */
  static applyExplorationAdjustmentStage(options: {
    rankedResults: HybridRankedResult[];
    userId: string;
    userClassification: 'NEW' | 'LIMITED_DATA' | 'ACTIVE' | 'WELL_ESTABLISHED';
    temporalProfile?: UnifiedLayeredTasteProfile | null;
    feedbackProfile?: UserFeedbackProfile | null;
    activeSession?: IListeningSession | null;
    customExplorationRate?: number;
  }): {
    results: HybridRankedResult[];
    applied: boolean;
    explorationRateUsed?: number;
    exploredCandidatesCount?: number;
  } {
    const {
      rankedResults,
      userId,
      userClassification,
      temporalProfile,
      feedbackProfile,
      activeSession,
      customExplorationRate,
    } = options;

    if (!Array.isArray(rankedResults) || rankedResults.length === 0) {
      return { results: rankedResults, applied: false };
    }

    try {
      const explorationRes = AdaptiveExplorationService.applyExplorationReranking(
        rankedResults,
        {
          userId,
          userClassification,
          temporalProfile,
          feedbackProfile,
          activeSession,
          userEncounteredSongIds: feedbackProfile?.likedSongIds,
        },
        {
          customExplorationRate,
        }
      );

      return {
        results: explorationRes.results,
        applied: true,
        explorationRateUsed: explorationRes.explorationDetails?.effectiveExplorationRate,
        exploredCandidatesCount: explorationRes.results.filter(
          (r) => (r.metadata as any)?.exploration?.isExplorationCandidate
        ).length,
      };
    } catch {
      return { results: rankedResults, applied: false };
    }
  }

  /**
   * Stage 6: Novelty Adjustment
   * Scores unfamiliar candidate items with relevance gating.
   */
  static applyNoveltyAdjustmentStage(options: {
    rankedResults: HybridRankedResult[];
    familiarityProfile?: UserFamiliarityProfile | null;
    noveltyWeights?: Partial<NoveltyScoringWeights>;
  }): {
    results: HybridRankedResult[];
    applied: boolean;
    averageNovelty?: number;
    unfamiliarCount?: number;
  } {
    const { rankedResults, familiarityProfile, noveltyWeights } = options;
    if (!Array.isArray(rankedResults) || rankedResults.length === 0) {
      return { results: rankedResults, applied: false };
    }

    try {
      const noveltyRes = NoveltyScoringService.applyNoveltyScoringToRankedResults(
        rankedResults,
        familiarityProfile,
        noveltyWeights
      );

      return {
        results: noveltyRes.results,
        applied: true,
        averageNovelty: noveltyRes.diagnostics?.averageNoveltyScore,
        unfamiliarCount: noveltyRes.diagnostics?.completelyUnfamiliarCount,
      };
    } catch {
      return { results: rankedResults, applied: false };
    }
  }

  /**
   * Stage 7: Diversity Re-ranking
   * Applies marginal utility penalties across repeated artists, genres, and pairwise similarity.
   */
  static applyDiversityRerankingStage(options: {
    rankedResults: HybridRankedResult[];
    targetLimit?: number;
    diversityStrength?: number;
  }): {
    results: HybridRankedResult[];
    applied: boolean;
    penalizedCount?: number;
  } {
    const { rankedResults, targetLimit, diversityStrength } = options;
    if (!Array.isArray(rankedResults) || rankedResults.length === 0) {
      return { results: rankedResults, applied: false };
    }

    try {
      const diversityRes = DiversityAwareRankingService.applyDiversityAwareRanking(
        rankedResults,
        {
          targetLimit: targetLimit || rankedResults.length,
          diversityStrength,
        }
      );

      return {
        results: diversityRes.results,
        applied: true,
        penalizedCount: diversityRes.diagnostics?.appliedAdjustmentsCount,
      };
    } catch {
      return { results: rankedResults, applied: false };
    }
  }

  /**
   * Stage 8: Final Ranking & Deterministic Tie-Breaking
   * Binds scores in [0.0, 1.0], applies deterministic sorting with unique tie-breaking,
   * and limits candidate results.
   */
  static finalizeRankingStage(options: {
    results: HybridRankedResult[];
    limit: number;
  }): {
    finalResults: HybridRankedResult[];
    tieBreaksApplied: number;
  } {
    const { results, limit } = options;
    if (!Array.isArray(results) || results.length === 0) {
      return { finalResults: [], tieBreaksApplied: 0 };
    }

    let tieBreaksApplied = 0;

    // Clone and ensure scores are bounded
    const boundedResults: HybridRankedResult[] = results.map((res) => {
      const score = res.finalScore ?? res.hybridScore ?? 0;
      const normalizedScore = Number(Math.max(0, Math.min(1, score)).toFixed(4));
      return {
        ...res,
        finalScore: normalizedScore,
      };
    });

    // Deterministic sorting with stable tie-breaker
    boundedResults.sort((a, b) => {
      const scoreA = a.finalScore ?? a.hybridScore ?? 0;
      const scoreB = b.finalScore ?? b.hybridScore ?? 0;
      const scoreDiff = scoreB - scoreA;

      if (Math.abs(scoreDiff) > 1e-5) {
        return scoreDiff;
      }

      // Exact or near-identical score -> deterministic tie breaker via song ID or title
      tieBreaksApplied++;
      const idA = a.song?._id?.toString() || a.song?.id?.toString() || a.song?.title || '';
      const idB = b.song?._id?.toString() || b.song?.id?.toString() || b.song?.title || '';
      return idA.localeCompare(idB);
    });

    const finalResults = boundedResults.slice(0, Math.max(1, limit));
    return {
      finalResults,
      tieBreaksApplied,
    };
  }

  /**
   * Full pipeline execution orchestrating all 8 stages from candidate generation to final ranking.
   */
  static async executePipeline(options: AdaptivePipelineOptions): Promise<AdaptivePipelineResult> {
    const {
      userId,
      seedSongId,
      limit = 10,
      candidateLimit = 50,
      candidates: providedCandidates,
      customWeights,
      context,
      contextInfluence,
      sessionProfile,
      sessionInfluence,
      useActiveSession,
      temporalProfile,
      temporalInfluence,
      useTemporalProfile,
      useScoreCalibration,
      feedbackProfile: providedFeedbackProfile,
      useUserSpecificWeights,
      useAdaptiveExploration,
      explorationRate,
      useNoveltyScoring,
      familiarityProfile: providedFamiliarityProfile,
      noveltyWeights,
      useDiversityRanking,
      diversityStrength,
      enableAllStages = false,
    } = options;

    const diagnostics: AdaptivePipelineStageDiagnostics = {
      candidateGeneration: { candidatesCount: 0, sourcesFound: [], isColdStart: false },
      baseScoring: { scoredCandidatesCount: 0, topBaseScore: 0 },
      userSpecificWeighting: { applied: false, userClassification: 'NEW' },
      feedbackAdjustment: { applied: false, likedCount: 0, skippedCount: 0 },
      explorationAdjustment: { applied: false },
      noveltyAdjustment: { applied: false },
      diversityReranking: { applied: false },
      finalRanking: { finalCount: 0, deterministicTieBreaksApplied: 0 },
    };

    // =========================================================================
    // Stage 1: Candidate Generation
    // =========================================================================
    const candidateStageRes = await this.generateCandidatesStage({
      userId,
      seedSongId,
      candidateLimit,
      candidates: providedCandidates,
      userClassification: options.userClassification,
    });

    const userClassification = candidateStageRes.userClassification;
    diagnostics.userSpecificWeighting.userClassification = userClassification;

    if (candidateStageRes.isColdStart) {
      diagnostics.candidateGeneration.isColdStart = true;
      diagnostics.candidateGeneration.candidatesCount = candidateStageRes.coldStartSongs?.length || 0;
      diagnostics.candidateGeneration.sourcesFound = candidateStageRes.candidateSources || ['cold_start'];

      const formattedResults: HybridRankedResult[] = (candidateStageRes.coldStartSongs || []).map((songDoc, idx) => ({
        song: songDoc,
        hybridScore: Number((1.0 - idx * 0.05).toFixed(4)),
        componentScores: {
          contentScore: 0,
          collaborativeScore: 0,
          userTasteAffinityScore: 0.5,
          popularityScore: Number((songDoc.playCount ? Math.min(1, songDoc.playCount / 1000) : 0.5).toFixed(4)),
          recencyScore: 0.8,
        },
        sources: candidateStageRes.candidateSources || ['cold_start'],
      }));

      const finalRes = this.finalizeRankingStage({ results: formattedResults, limit });
      diagnostics.finalRanking.finalCount = finalRes.finalResults.length;
      diagnostics.finalRanking.deterministicTieBreaksApplied = finalRes.tieBreaksApplied;

      return {
        strategyUsed: 'COLD_START',
        userClassification,
        recommendations: finalRes.finalResults,
        diagnostics,
      };
    }

    let candidateList = candidateStageRes.candidates;
    diagnostics.candidateGeneration.candidatesCount = candidateList.length;

    if (candidateList.length === 0) {
      // Fallback to cold start if candidate generation produces no candidates
      const fallbackRes = await ColdStartRecommendationService.getColdStartRecommendations({
        userId,
        limit,
      });

      const fallbackFormatted: HybridRankedResult[] = fallbackRes.songs.map((songDoc, idx) => ({
        song: songDoc,
        hybridScore: Number((0.8 - idx * 0.05).toFixed(4)),
        componentScores: {
          contentScore: 0,
          collaborativeScore: 0,
          userTasteAffinityScore: 0.3,
          popularityScore: 0.5,
          recencyScore: 0.5,
        },
        sources: ['catalog_fallback'],
      }));

      const finalRes = this.finalizeRankingStage({ results: fallbackFormatted, limit });
      diagnostics.finalRanking.finalCount = finalRes.finalResults.length;
      return {
        strategyUsed: 'COLD_START',
        userClassification,
        recommendations: finalRes.finalResults,
        diagnostics,
      };
    }

    // Resolve context & profiles
    const isDbConnected = mongoose.connection?.readyState === 1;
    let effectiveSessionProfile = sessionProfile || null;
    let activeSessionDoc: IListeningSession | null = null;
    if (!effectiveSessionProfile && useActiveSession && userId && Types.ObjectId.isValid(userId) && isDbConnected) {
      try {
        activeSessionDoc = await ListeningSessionService.getActiveSession(userId);
        if (activeSessionDoc) {
          effectiveSessionProfile = await SessionTasteProfileService.generateSessionTasteProfile(activeSessionDoc);
        }
      } catch {
        // Safe fallback
      }
    }

    let effectiveTemporalProfile = temporalProfile || null;
    if (!effectiveTemporalProfile && useTemporalProfile && userId && Types.ObjectId.isValid(userId) && isDbConnected) {
      try {
        effectiveTemporalProfile = await LayeredTemporalTasteProfileService.generateLayeredTasteProfile(userId);
      } catch {
        // Safe fallback
      }
    }

    // =========================================================================
    // Stage 3: User-Specific Weighting (Resolved prior to base scoring)
    // =========================================================================
    let effectiveWeights: HybridScoringWeights = {
      ...getHybridConfigWeights(),
      ...customWeights,
    };
    let effectiveTemporalInf = temporalInfluence;
    let effectiveSessionInf = sessionInfluence;

    const shouldApplyUserWeights = enableAllStages || useUserSpecificWeights;
    if (shouldApplyUserWeights && !customWeights && userId) {
      const weightStageRes = this.applyUserSpecificWeightingStage({
        userId,
        userClassification,
        temporalProfile: effectiveTemporalProfile,
        activeSession: activeSessionDoc,
        sessionProfile: effectiveSessionProfile,
        defaultWeights: effectiveWeights,
        defaultTemporalInfluence: temporalInfluence,
        defaultSessionInfluence: sessionInfluence,
      });

      effectiveWeights = weightStageRes.effectiveWeights;
      effectiveTemporalInf = weightStageRes.effectiveTemporalInfluence;
      effectiveSessionInf = weightStageRes.effectiveSessionInfluence;
      diagnostics.userSpecificWeighting.applied = weightStageRes.applied;
      diagnostics.userSpecificWeighting.effectiveBaselineWeights = { ...effectiveWeights };
    }

    // =========================================================================
    // Stage 2: Base Recommendation Score
    // =========================================================================
    let rankedResults = this.scoreBaseCandidatesStage({
      candidates: candidateList,
      limit: Math.max(limit * 3, candidateLimit), // Retrieve wider pool for reranking stages
      weights: effectiveWeights,
      context,
      contextInfluence,
      sessionProfile: effectiveSessionProfile,
      sessionInfluence: effectiveSessionInf,
      activeSessionDoc,
      temporalProfile: effectiveTemporalProfile,
      temporalInfluence: effectiveTemporalInf,
    });

    diagnostics.baseScoring.scoredCandidatesCount = rankedResults.length;
    diagnostics.baseScoring.topBaseScore = rankedResults[0]?.hybridScore || 0;

    // =========================================================================
    // Stage 4: Feedback Adjustment
    // =========================================================================
    let feedbackProfile = providedFeedbackProfile || null;
    const shouldApplyFeedback = enableAllStages || useScoreCalibration !== false;
    if (shouldApplyFeedback && userId && Types.ObjectId.isValid(userId)) {
      if (!feedbackProfile && isDbConnected) {
        try {
          feedbackProfile = await RecommendationScoreCalibrationService.buildUserFeedbackProfile(userId);
        } catch {
          // Safe fallback
        }
      }

      if (feedbackProfile) {
        const feedbackStageRes = this.applyFeedbackAdjustmentStage({
          rankedResults,
          feedbackProfile,
        });
        rankedResults = feedbackStageRes.results;
        diagnostics.feedbackAdjustment.applied = feedbackStageRes.applied;
        diagnostics.feedbackAdjustment.likedCount = feedbackProfile.likedSongIds?.size || 0;
        diagnostics.feedbackAdjustment.skippedCount = feedbackProfile.skippedSongIds?.size || 0;
      }
    }

    // =========================================================================
    // Stage 5: Exploration Adjustment
    // =========================================================================
    const shouldApplyExploration = enableAllStages || useAdaptiveExploration;
    if (shouldApplyExploration && userId) {
      const explorationStageRes = this.applyExplorationAdjustmentStage({
        rankedResults,
        userId,
        userClassification,
        temporalProfile: effectiveTemporalProfile,
        feedbackProfile,
        activeSession: activeSessionDoc,
        customExplorationRate: explorationRate,
      });

      rankedResults = explorationStageRes.results;
      diagnostics.explorationAdjustment.applied = explorationStageRes.applied;
      diagnostics.explorationAdjustment.effectiveExplorationRate = explorationStageRes.explorationRateUsed;
      diagnostics.explorationAdjustment.exploredCount = explorationStageRes.exploredCandidatesCount;
    }

    // =========================================================================
    // Stage 6: Novelty Adjustment
    // =========================================================================
    const shouldApplyNovelty = enableAllStages || useNoveltyScoring;
    if (shouldApplyNovelty && userId) {
      let familiarityProfile = providedFamiliarityProfile || null;
      if (!familiarityProfile && Types.ObjectId.isValid(userId) && isDbConnected) {
        try {
          familiarityProfile = await NoveltyScoringService.buildUserFamiliarityProfile(userId);
        } catch {
          // Safe fallback
        }
      }

      const noveltyStageRes = this.applyNoveltyAdjustmentStage({
        rankedResults,
        familiarityProfile,
        noveltyWeights,
      });

      rankedResults = noveltyStageRes.results;
      diagnostics.noveltyAdjustment.applied = noveltyStageRes.applied;
      diagnostics.noveltyAdjustment.averageNovelty = noveltyStageRes.averageNovelty;
      diagnostics.noveltyAdjustment.unfamiliarCount = noveltyStageRes.unfamiliarCount;
    }

    // =========================================================================
    // Stage 7: Diversity Re-ranking
    // =========================================================================
    const shouldApplyDiversity = enableAllStages || useDiversityRanking;
    if (shouldApplyDiversity) {
      const diversityStageRes = this.applyDiversityRerankingStage({
        rankedResults,
        targetLimit: limit,
        diversityStrength,
      });

      rankedResults = diversityStageRes.results;
      diagnostics.diversityReranking.applied = diversityStageRes.applied;
      diagnostics.diversityReranking.penalizedCount = diversityStageRes.penalizedCount;
    }

    // =========================================================================
    // Stage 8: Final Ranking & Deterministic Tie-Breaking
    // =========================================================================
    const finalStageRes = this.finalizeRankingStage({
      results: rankedResults,
      limit,
    });

    diagnostics.finalRanking.finalCount = finalStageRes.finalResults.length;
    diagnostics.finalRanking.deterministicTieBreaksApplied = finalStageRes.tieBreaksApplied;

    return {
      strategyUsed: 'HYBRID_PERSONALIZED',
      userClassification,
      recommendations: finalStageRes.finalResults,
      diagnostics,
    };
  }
}

export default AdaptiveRecommendationRankingPipeline;
