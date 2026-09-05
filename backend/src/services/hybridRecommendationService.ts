import { Types } from 'mongoose';
import { HybridRankedResult } from './hybridRankingPipeline.js';
import { ColdStartRecommendationService } from './coldStartRecommendationService.js';
import {
  HybridScoringWeights,
  NoveltyScoringWeights,
} from '../config/recommendationConfig.js';
import { RecommendationContextAttributes } from '../schemas/recommendationContextSchema.js';
import { SessionTasteProfile } from './sessionTasteProfileService.js';
import { UnifiedLayeredTasteProfile } from './layeredTemporalTasteProfileService.js';
import {
  AdaptiveRecommendationRankingPipeline,
  AdaptivePipelineStageDiagnostics,
} from './adaptiveRecommendationRankingPipeline.js';

export { HybridRankedResult as HybridCandidateItem };

export interface HybridRecommendationServiceResult {
  strategyUsed: 'COLD_START' | 'HYBRID_PERSONALIZED';
  userClassification: 'NEW' | 'LIMITED_DATA' | 'ACTIVE' | 'WELL_ESTABLISHED';
  recommendations: HybridRankedResult[];
  pipelineDiagnostics?: AdaptivePipelineStageDiagnostics;
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
    useAdaptiveExploration?: boolean;
    useDiversityRanking?: boolean;
    useNoveltyScoring?: boolean;
    noveltyWeights?: Partial<NoveltyScoringWeights>;
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
      sessionId,
      useActiveSession,
      temporalProfile,
      temporalInfluence,
      useTemporalProfile,
      useScoreCalibration,
      useUserSpecificWeights,
      useAdaptiveExploration,
      useDiversityRanking,
      useNoveltyScoring,
      noveltyWeights,
    } = params;

    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }

    try {
      const pipelineRes = await AdaptiveRecommendationRankingPipeline.executePipeline({
        userId,
        seedSongId,
        limit,
        customWeights,
        context,
        contextInfluence,
        sessionProfile,
        sessionInfluence,
        sessionId,
        useActiveSession,
        temporalProfile,
        temporalInfluence,
        useTemporalProfile,
        useScoreCalibration,
        useUserSpecificWeights,
        useAdaptiveExploration,
        useDiversityRanking,
        useNoveltyScoring,
        noveltyWeights,
      });

      return {
        strategyUsed: pipelineRes.strategyUsed,
        userClassification: pipelineRes.userClassification,
        recommendations: pipelineRes.recommendations,
        pipelineDiagnostics: pipelineRes.diagnostics,
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
