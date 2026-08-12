import { Types } from 'mongoose';
import { CandidateGenerationService } from './candidateGenerationService.js';
import {
  HybridScoringWeights,
  getHybridConfigWeights,
} from '../config/recommendationConfig.js';

export interface HybridCandidateItem {
  song: any;
  hybridScore: number;
  componentScores: {
    contentScore: number;
    collaborativeScore: number;
    popularityScore: number;
    recencyScore: number;
  };
}

export class HybridRecommendationService {
  /**
   * Combines content-based, collaborative filtering, popularity, and recency scores into a unified
   * normalized hybrid recommendation score between 0.0 and 1.0.
   */
  static async getHybridRecommendations(params: {
    userId: string;
    seedSongId?: string;
    limit?: number;
    customWeights?: Partial<HybridScoringWeights>;
  }): Promise<HybridCandidateItem[]> {
    const { userId, seedSongId, limit = 10, customWeights } = params;

    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }

    const weights: HybridScoringWeights = {
      ...getHybridConfigWeights(),
      ...customWeights,
    };

    // 1. Generate Merged Candidates Pool from Content, Collaborative, and Trending Sources
    const candidates = await CandidateGenerationService.generateHybridCandidates({
      userId,
      seedSongId,
      candidateLimit: 50,
    });

    if (candidates.length === 0) {
      return [];
    }

    // 2. Min-Max Normalization to Common [0.0, 1.0] Range
    const maxContent = Math.max(...candidates.map((c) => c.contentScore), 0.0001);
    const maxCollab = Math.max(...candidates.map((c) => c.collaborativeScore), 0.0001);
    const maxPop = Math.max(...candidates.map((c) => c.popularitySignal), 1);
    const maxRec = Math.max(...candidates.map((c) => c.recencySignal), 0.0001);

    const totalWeightSum =
      weights.contentSimilarityWeight +
      weights.collaborativeWeight +
      weights.popularityWeight +
      weights.recencyWeight;

    // 3. Compute Final Hybrid Score & Component Breakdown per Candidate
    const scoredItems: HybridCandidateItem[] = candidates.map((cand) => {
      const normContent = cand.contentScore / maxContent;
      const normCollab = cand.collaborativeScore / maxCollab;
      const normPop = cand.popularitySignal / maxPop;
      const normRec = cand.recencySignal / maxRec;

      const weightedScoreSum =
        normContent * weights.contentSimilarityWeight +
        normCollab * weights.collaborativeWeight +
        normPop * weights.popularityWeight +
        normRec * weights.recencyWeight;

      const rawHybrid = totalWeightSum > 0 ? weightedScoreSum / totalWeightSum : 0;
      const finalHybridScore = Number(Math.max(0, Math.min(1, rawHybrid)).toFixed(4));

      return {
        song: cand.songDoc,
        hybridScore: finalHybridScore,
        componentScores: {
          contentScore: Number(normContent.toFixed(4)),
          collaborativeScore: Number(normCollab.toFixed(4)),
          popularityScore: Number(normPop.toFixed(4)),
          recencyScore: Number(normRec.toFixed(4)),
        },
      };
    });

    // 4. Sort Descending by Hybrid Score
    scoredItems.sort((a, b) => b.hybridScore - a.hybridScore);

    return scoredItems.slice(0, Math.max(1, limit));
  }
}
