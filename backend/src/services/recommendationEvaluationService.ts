export interface EvaluationMetricsResult {
  precisionAtK: number;
  recallAtK: number;
  f1AtK: number;
  k: number;
  hitsCount: number;
  recommendedCount: number;
  relevantCount: number;
}

export class RecommendationEvaluationService {
  /**
   * Calculates Precision@K: Ratio of relevant songs found in top-K recommendations relative to K.
   * Precision@K = |Recommended@K ∩ Relevant| / K
   */
  static calculatePrecisionAtK(
    recommendedSongIds: string[],
    relevantSongIds: string[],
    k: number
  ): number {
    if (!recommendedSongIds || !relevantSongIds || k <= 0 || recommendedSongIds.length === 0) {
      return 0.0;
    }

    const topK = recommendedSongIds.slice(0, k);
    const relevantSet = new Set(relevantSongIds);

    let hits = 0;
    for (const songId of topK) {
      if (relevantSet.has(songId)) {
        hits++;
      }
    }

    const precision = hits / Math.min(topK.length, k);
    return Number(Math.max(0, Math.min(1, precision)).toFixed(4));
  }

  /**
   * Calculates Recall@K: Ratio of relevant songs found in top-K recommendations relative to total relevant songs.
   * Recall@K = |Recommended@K ∩ Relevant| / |Relevant|
   */
  static calculateRecallAtK(
    recommendedSongIds: string[],
    relevantSongIds: string[],
    k: number
  ): number {
    if (
      !recommendedSongIds ||
      !relevantSongIds ||
      k <= 0 ||
      recommendedSongIds.length === 0 ||
      relevantSongIds.length === 0
    ) {
      return 0.0;
    }

    const topK = recommendedSongIds.slice(0, k);
    const relevantSet = new Set(relevantSongIds);

    let hits = 0;
    for (const songId of topK) {
      if (relevantSet.has(songId)) {
        hits++;
      }
    }

    const recall = hits / relevantSet.size;
    return Number(Math.max(0, Math.min(1, recall)).toFixed(4));
  }

  /**
   * Calculates F1@K: Harmonic mean of Precision@K and Recall@K.
   * F1@K = 2 * (Precision@K * Recall@K) / (Precision@K + Recall@K)
   */
  static calculateF1AtK(
    recommendedSongIds: string[],
    relevantSongIds: string[],
    k: number
  ): number {
    const precision = this.calculatePrecisionAtK(recommendedSongIds, relevantSongIds, k);
    const recall = this.calculateRecallAtK(recommendedSongIds, relevantSongIds, k);

    if (precision + recall === 0) {
      return 0.0;
    }

    const f1 = (2 * precision * recall) / (precision + recall);
    return Number(Math.max(0, Math.min(1, f1)).toFixed(4));
  }

  /**
   * Comprehensive evaluation method computing Precision@K, Recall@K, and F1@K metrics for a recommendation set.
   */
  static evaluateRecommendationSet(
    recommendedSongIds: string[],
    relevantSongIds: string[],
    k = 10
  ): EvaluationMetricsResult {
    const validRecommended = recommendedSongIds || [];
    const validRelevant = relevantSongIds || [];
    const safeK = Math.max(1, k);

    const topK = validRecommended.slice(0, safeK);
    const relevantSet = new Set(validRelevant);

    let hitsCount = 0;
    for (const id of topK) {
      if (relevantSet.has(id)) {
        hitsCount++;
      }
    }

    const precisionAtK = this.calculatePrecisionAtK(validRecommended, validRelevant, safeK);
    const recallAtK = this.calculateRecallAtK(validRecommended, validRelevant, safeK);
    const f1AtK = this.calculateF1AtK(validRecommended, validRelevant, safeK);

    return {
      precisionAtK,
      recallAtK,
      f1AtK,
      k: safeK,
      hitsCount,
      recommendedCount: topK.length,
      relevantCount: relevantSet.size,
    };
  }
}
