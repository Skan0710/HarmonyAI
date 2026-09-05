import { Types } from 'mongoose';
import { CandidateGenerationService } from './candidateGenerationService.js';
import { HybridRankingPipeline, HybridRankedResult } from './hybridRankingPipeline.js';
import { ColdStartDetectionService } from './coldStartDetectionService.js';
import { ColdStartRecommendationService } from './coldStartRecommendationService.js';
import {
  HybridScoringWeights,
  getHybridConfigWeights,
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
import { RecommendationScoreCalibrationService } from './recommendationScoreCalibrationService.js';
import { UserSpecificSignalWeightingService } from './userSpecificSignalWeightingService.js';

export { HybridRankedResult as HybridCandidateItem };

export interface HybridRecommendationServiceResult {
  strategyUsed: 'COLD_START' | 'HYBRID_PERSONALIZED';
  userClassification: 'NEW' | 'LIMITED_DATA' | 'ACTIVE' | 'WELL_ESTABLISHED';
  recommendations: HybridRankedResult[];
}

export class HybridRecommendationService {
  /**
   * Generates recommendations by first detecting the user's profile state (NEW, LIMITED_DATA, ACTIVE, WELL_ESTABLISHED).
   * - Uses ColdStartRecommendationService for NEW and LIMITED_DATA users.
   * - Uses CandidateGenerationService + HybridRankingPipeline for ACTIVE and WELL_ESTABLISHED users.
   * - Optionally accepts listening context (situation, mood, energy, tempo, genres) to adjust ranking weights.
   * - Optionally accepts listening session taste profile (or automatically retrieves active session) to adjust weights.
   * - Optionally accepts temporal taste profile (or automatically retrieves layered profile) to adjust weights.
   * Preserves existing response structures while returning the recommendation strategy used.
   */
  static async getHybridRecommendations(params: {
    userId: string;
    seedSongId?: string;
    limit?: number;
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
    useUserSpecificWeights?: boolean;
  }): Promise<HybridRecommendationServiceResult> {
    const {
      userId,
      seedSongId,
      limit = 10,
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
      useUserSpecificWeights,
    } = params;

    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }

    try {
      // 1. Detect User Profile State (NEW, LIMITED_DATA, ACTIVE, WELL_ESTABLISHED)
      const coldStartInfo = await ColdStartDetectionService.detectUserColdStartStatus(userId);
      const userClassification = coldStartInfo.classification;
      const isColdStart = coldStartInfo.isColdStart;

      // 2. Cold-Start Strategy Execution for NEW or LIMITED_DATA Users
      if (isColdStart) {
        const coldStartRes = await ColdStartRecommendationService.getColdStartRecommendations({
          userId,
          limit,
        });

        const formattedResults: HybridRankedResult[] = coldStartRes.songs.map((songDoc, idx) => ({
          song: songDoc,
          hybridScore: Number((1.0 - idx * 0.05).toFixed(4)), // Bounded score for display
          componentScores: {
            contentScore: 0,
            collaborativeScore: 0,
            userTasteAffinityScore: 0.5,
            popularityScore: Number((songDoc.playCount ? Math.min(1, songDoc.playCount / 1000) : 0.5).toFixed(4)),
            recencyScore: 0.8,
          },
          sources: coldStartRes.candidateSources || ['cold_start'],
        }));

        return {
          strategyUsed: 'COLD_START',
          userClassification,
          recommendations: formattedResults,
        };
      }

      // 3. Personalized Hybrid Engine Execution for ACTIVE and WELL_ESTABLISHED Users
      const weights: HybridScoringWeights = {
        ...getHybridConfigWeights(),
        ...customWeights,
      };

      const candidates = await CandidateGenerationService.generateHybridCandidates({
        userId,
        seedSongId,
        candidateLimit: 50,
      });

      if (candidates.length === 0) {
        // Fallback to cold start if candidates map is empty
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

        return {
          strategyUsed: 'COLD_START',
          userClassification,
          recommendations: fallbackFormatted,
        };
      }

      // 4. Resolve Listening Session Profile if requested
      let effectiveSessionProfile = sessionProfile || null;
      let activeSessionDoc: IListeningSession | null = null;

      if (!effectiveSessionProfile && useActiveSession) {
        try {
          activeSessionDoc = await ListeningSessionService.getActiveSession(userId);
          if (activeSessionDoc) {
            effectiveSessionProfile = await SessionTasteProfileService.generateSessionTasteProfile(activeSessionDoc);
          }
        } catch {
          // Safe fallback if session retrieval fails
        }
      }

      // 5. Resolve Temporal Taste Profile if requested
      let effectiveTemporalProfile = temporalProfile || null;
      if (!effectiveTemporalProfile && useTemporalProfile) {
        try {
          effectiveTemporalProfile = await LayeredTemporalTasteProfileService.generateLayeredTasteProfile(userId);
        } catch {
          // Safe fallback if temporal taste profile retrieval fails
        }
      }

      let effectiveWeights = weights;
      let effectiveTemporalInf = temporalInfluence;
      let effectiveSessionInf = sessionInfluence;

      if (useUserSpecificWeights && !customWeights) {
        try {
          const userWeights = UserSpecificSignalWeightingService.calculateUserSpecificWeights({
            userId,
            userClassification,
            temporalProfile: effectiveTemporalProfile,
            activeSession: activeSessionDoc,
            sessionProfile: effectiveSessionProfile,
          });
          effectiveWeights = userWeights.baselineWeights;
          if (temporalInfluence === undefined) {
            effectiveTemporalInf = userWeights.modulationLayers.temporalInfluence;
          }
          if (sessionInfluence === undefined) {
            effectiveSessionInf = userWeights.modulationLayers.sessionInfluence;
          }
        } catch {
          // Safe fallback to default weights
        }
      }

      let rankedResults = HybridRankingPipeline.rankCandidates(
        candidates,
        limit,
        effectiveWeights,
        context,
        contextInfluence,
        effectiveSessionProfile,
        effectiveSessionInf,
        activeSessionDoc,
        effectiveTemporalProfile,
        effectiveTemporalInf
      );

      // Score Calibration Layer based on historical feedback
      if (useScoreCalibration !== false) {
        try {
          const feedbackProfile = await RecommendationScoreCalibrationService.buildUserFeedbackProfile(userId);
          rankedResults = RecommendationScoreCalibrationService.calibrateRankedResults(
            rankedResults,
            feedbackProfile
          );
        } catch {
          // Safe fallback: proceed with uncalibrated results
        }
      }

      return {
        strategyUsed: 'HYBRID_PERSONALIZED',
        userClassification,
        recommendations: rankedResults,
      };
    } catch (error) {
      // 5. Fail-safe Resilience Fallback: Never fail recommendation API requests
      try {
        const coldStartRes = await ColdStartRecommendationService.getColdStartRecommendations({
          userId,
          limit,
        });

        const fallbackFormatted: HybridRankedResult[] = coldStartRes.songs.map((songDoc, idx) => ({
          song: songDoc,
          hybridScore: Number((0.7 - idx * 0.05).toFixed(4)),
          componentScores: {
            contentScore: 0,
            collaborativeScore: 0,
            userTasteAffinityScore: 0,
            popularityScore: 0.5,
            recencyScore: 0.5,
          },
          sources: ['failsafe_fallback'],
        }));

        return {
          strategyUsed: 'COLD_START',
          userClassification: 'NEW',
          recommendations: fallbackFormatted,
        };
      } catch (innerError) {
        return {
          strategyUsed: 'COLD_START',
          userClassification: 'NEW',
          recommendations: [],
        };
      }
    }
  }
}

export default HybridRecommendationService;
