import { Types } from 'mongoose';
import { CandidateGenerationService } from './candidateGenerationService.js';
import { HybridRankingPipeline, HybridRankedResult } from './hybridRankingPipeline.js';
import { ColdStartDetectionService } from './coldStartDetectionService.js';
import { ColdStartRecommendationService } from './coldStartRecommendationService.js';
import {
  HybridScoringWeights,
  getHybridConfigWeights,
} from '../config/recommendationConfig.js';

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
   * Preserves existing response structures while returning the recommendation strategy used.
   */
  static async getHybridRecommendations(params: {
    userId: string;
    seedSongId?: string;
    limit?: number;
    customWeights?: Partial<HybridScoringWeights>;
  }): Promise<HybridRecommendationServiceResult> {
    const { userId, seedSongId, limit = 10, customWeights } = params;

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

      const rankedResults = HybridRankingPipeline.rankCandidates(candidates, limit, weights);

      return {
        strategyUsed: 'HYBRID_PERSONALIZED',
        userClassification,
        recommendations: rankedResults,
      };
    } catch (error) {
      // 4. Fail-safe Resilience Fallback: Never fail recommendation API requests
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
