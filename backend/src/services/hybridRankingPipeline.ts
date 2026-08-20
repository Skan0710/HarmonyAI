import { HybridCandidate } from './candidateGenerationService.js';
import {
  HybridScoringWeights,
  getHybridConfigWeights,
} from '../config/recommendationConfig.js';

export interface HybridRankedResult {
  song: any;
  hybridScore: number;
  originalScore?: number;
  finalScore?: number;
  componentScores: {
    contentScore: number;
    collaborativeScore: number;
    userTasteAffinityScore: number;
    popularityScore: number;
    recencyScore: number;
    noveltyScore?: number;
    userPreferenceScore?: number;
  };
  sources: string[];
  metadata?: Record<string, any>;
}

export class HybridRankingPipeline {
  /**
   * Evaluates a candidate pool, applies Min-Max normalization across feature components,
   * calculates final weighted hybrid recommendation scores (incorporating content, collaborative,
   * user taste profile affinity, popularity, and recency signals), ranks candidates descending,
   * and returns top items up to configurable limit.
   * 
   * @param candidates Pool of merged hybrid candidate tracks
   * @param limit Maximum number of ranked recommendations to return (default 10)
   * @param customWeights Optional custom weight overrides
   */
  static rankCandidates(
    candidates: HybridCandidate[],
    limit = 10,
    customWeights?: Partial<HybridScoringWeights>
  ): HybridRankedResult[] {
    if (!candidates || candidates.length === 0) {
      return [];
    }

    const weights: HybridScoringWeights = {
      ...getHybridConfigWeights(),
      ...customWeights,
    };

    // 1. Min-Max Normalization scale bounds across candidate pool
    const maxContent = Math.max(
      ...candidates.map((c) => (isNaN(c.contentScore) ? 0 : c.contentScore || 0)),
      0.0001
    );
    const maxCollab = Math.max(
      ...candidates.map((c) => (isNaN(c.collaborativeScore) ? 0 : c.collaborativeScore || 0)),
      0.0001
    );
    const maxTaste = Math.max(
      ...candidates.map((c) => (isNaN(c.userTasteAffinityScore) ? 0 : c.userTasteAffinityScore || 0)),
      0.0001
    );
    const maxPop = Math.max(
      ...candidates.map((c) => (isNaN(c.popularitySignal) ? 0 : c.popularitySignal || 0)),
      1
    );
    const maxRec = Math.max(
      ...candidates.map((c) => (isNaN(c.recencySignal) ? 0 : c.recencySignal || 0)),
      0.0001
    );

    const totalWeightSum =
      weights.contentSimilarityWeight +
      weights.collaborativeWeight +
      weights.userTasteAffinityWeight +
      weights.popularityWeight +
      weights.recencyWeight;

    // 2. Compute normalized component scores & weighted fusion per candidate
    const scoredItems: HybridRankedResult[] = candidates.map((cand) => {
      const rawContent = isNaN(cand.contentScore) ? 0 : cand.contentScore || 0;
      const rawCollab = isNaN(cand.collaborativeScore) ? 0 : cand.collaborativeScore || 0;
      const rawTaste = isNaN(cand.userTasteAffinityScore) ? 0 : cand.userTasteAffinityScore || 0;
      const rawPop = isNaN(cand.popularitySignal) ? 0 : cand.popularitySignal || 0;
      const rawRec = isNaN(cand.recencySignal) ? 0 : cand.recencySignal || 0;

      const normContent = rawContent / maxContent;
      const normCollab = rawCollab / maxCollab;
      const normTaste = rawTaste / maxTaste;
      const normPop = rawPop / maxPop;
      const normRec = rawRec / maxRec;

      const weightedScoreSum =
        normContent * weights.contentSimilarityWeight +
        normCollab * weights.collaborativeWeight +
        normTaste * weights.userTasteAffinityWeight +
        normPop * weights.popularityWeight +
        normRec * weights.recencyWeight;

      const rawHybrid = totalWeightSum > 0 ? weightedScoreSum / totalWeightSum : 0;
      const finalHybridScore = Number(Math.max(0, Math.min(1, rawHybrid)).toFixed(4));

      return {
        song: cand.songDoc,
        hybridScore: finalHybridScore,
        originalScore: finalHybridScore,
        finalScore: finalHybridScore,
        componentScores: {
          contentScore: Number(normContent.toFixed(4)),
          collaborativeScore: Number(normCollab.toFixed(4)),
          userTasteAffinityScore: Number(normTaste.toFixed(4)),
          popularityScore: Number(normPop.toFixed(4)),
          recencyScore: Number(normRec.toFixed(4)),
        },
        sources: cand.sources || [],
      };
    });

    // 3. Sort candidates descending by final hybrid score
    scoredItems.sort((a, b) => b.hybridScore - a.hybridScore);

    // 4. Return top limit results
    return scoredItems.slice(0, Math.max(1, limit));
  }
}
