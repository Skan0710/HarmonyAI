import { Types } from 'mongoose';
import { HybridCandidate } from './candidateGenerationService.js';
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
import { TasteBoundaryProfile } from './tasteBoundaryDetectionService.js';
import { ComfortDiscoveryScoreResult } from './comfortDiscoveryScoringService.js';
import { OutsideComfortZoneConfig } from '../config/outsideComfortZoneConfig.js';
import { TasteEvolutionDiscoveryConfig } from '../config/tasteEvolutionDiscoveryConfig.js';
import {
  PersonalizedDiscoveryMode,
  PersonalizedDiscoveryModeConfig,
} from '../config/personalizedDiscoveryModeConfig.js';
import {
  PersonalizedDiscoveryModeService,
  PersonalizedDiscoveryModeDiagnostics,
} from './personalizedDiscoveryModeService.js';

export { HybridRankedResult as HybridCandidateItem };

export interface HybridRecommendationServiceResult {
  strategyUsed: 'COLD_START' | 'HYBRID_PERSONALIZED' | 'OUTSIDE_COMFORT_ZONE' | 'TASTE_EVOLUTION_DISCOVERY';
  userClassification: 'NEW' | 'LIMITED_DATA' | 'ACTIVE' | 'WELL_ESTABLISHED';
  recommendations: HybridRankedResult[];
  pipelineDiagnostics?: AdaptivePipelineStageDiagnostics;
  discoveryModeDiagnostics?: PersonalizedDiscoveryModeDiagnostics;
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
    useUserSpecificWeights?: boolean;
    useAdaptiveExploration?: boolean;
    useDiversityRanking?: boolean;
    useNoveltyScoring?: boolean;
    noveltyWeights?: Partial<NoveltyScoringWeights>;
    recommendationMode?: 'STANDARD' | 'OUTSIDE_COMFORT_ZONE' | string;
    mode?: PersonalizedDiscoveryMode | string;
    discoveryMode?: PersonalizedDiscoveryMode | string;
    personalizedDiscoveryModeConfig?: Partial<PersonalizedDiscoveryModeConfig>;
    tasteBoundaries?: TasteBoundaryProfile | null;
    comfortDiscoveryScore?: ComfortDiscoveryScoreResult | null;
    outsideComfortZoneConfig?: Partial<OutsideComfortZoneConfig>;
    tasteEvolutionDiscoveryConfig?: Partial<TasteEvolutionDiscoveryConfig>;
  }): Promise<HybridRecommendationServiceResult> {
    const {
      userId,
      seedSongId,
      limit = 10,
      candidates,
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
      recommendationMode,
      mode,
      discoveryMode,
      personalizedDiscoveryModeConfig,
      tasteBoundaries,
      comfortDiscoveryScore,
      outsideComfortZoneConfig,
      tasteEvolutionDiscoveryConfig,
    } = params;

    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }

    try {
      const activeDiscoveryMode = mode || discoveryMode;
      if (activeDiscoveryMode) {
        const modeRes = await PersonalizedDiscoveryModeService.getRecommendationsForMode({
          userId,
          mode: activeDiscoveryMode,
          limit,
          seedSongId,
          candidates,
          context,
          contextInfluence,
          temporalProfile,
          comfortDiscoveryScore,
          tasteBoundaries,
          configOverride: personalizedDiscoveryModeConfig,
        });

        return {
          strategyUsed: modeRes.strategyUsed,
          userClassification: modeRes.userClassification,
          recommendations: modeRes.recommendations,
          pipelineDiagnostics: modeRes.diagnostics.pipelineDiagnostics,
          discoveryModeDiagnostics: modeRes.diagnostics,
        };
      }

      const pipelineRes = await AdaptiveRecommendationRankingPipeline.executePipeline({
        userId,
        seedSongId,
        limit,
        candidates,
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
        recommendationMode,
        tasteBoundaries,
        comfortDiscoveryScore,
        outsideComfortZoneConfig,
        tasteEvolutionDiscoveryConfig,
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
