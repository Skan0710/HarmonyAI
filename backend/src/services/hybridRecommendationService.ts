import { Types } from 'mongoose';
import { CandidateGenerationService } from './candidateGenerationService.js';
import { HybridRankingPipeline, HybridRankedResult } from './hybridRankingPipeline.js';
import {
  HybridScoringWeights,
  getHybridConfigWeights,
} from '../config/recommendationConfig.js';

export { HybridRankedResult as HybridCandidateItem };

export class HybridRecommendationService {
  /**
   * Generates hybrid recommendations by generating candidates from content, collaborative, and trending sources,
   * then passing candidates through the independent HybridRankingPipeline for score fusion and ranking.
   */
  static async getHybridRecommendations(params: {
    userId: string;
    seedSongId?: string;
    limit?: number;
    customWeights?: Partial<HybridScoringWeights>;
  }): Promise<HybridRankedResult[]> {
    const { userId, seedSongId, limit = 10, customWeights } = params;

    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }

    const weights: HybridScoringWeights = {
      ...getHybridConfigWeights(),
      ...customWeights,
    };

    // 1. Candidate Generation
    const candidates = await CandidateGenerationService.generateHybridCandidates({
      userId,
      seedSongId,
      candidateLimit: 50,
    });

    if (candidates.length === 0) {
      return [];
    }

    // 2. Hybrid Ranking Pipeline
    return HybridRankingPipeline.rankCandidates(candidates, limit, weights);
  }
}
