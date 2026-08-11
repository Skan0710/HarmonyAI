import { SparseInteractionMatrix } from './interactionMatrixService.js';

export interface SimilarUserResult {
  userId: string;
  similarityScore: number;
}

export class UserSimilarityService {
  /**
   * Calculates Cosine Similarity score (0.0 to 1.0) between two user interaction sparse maps.
   * Efficiently computes dot product over overlapping song interactions and norm magnitudes.
   */
  static calculateUserSimilarity(
    rowMapA: Map<string, number>,
    rowMapB: Map<string, number>
  ): number {
    if (!rowMapA || !rowMapB || rowMapA.size === 0 || rowMapB.size === 0) {
      return 0.0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    // Calculate magnitude norm for user A
    for (const scoreA of rowMapA.values()) {
      normA += scoreA * scoreA;
    }

    // Calculate magnitude norm for user B
    for (const scoreB of rowMapB.values()) {
      normB += scoreB * scoreB;
    }

    if (normA === 0 || normB === 0) {
      return 0.0;
    }

    // Compute dot product on overlapping song interactions only
    // Iterate over the smaller map for performance
    const [smallerMap, largerMap] =
      rowMapA.size < rowMapB.size ? [rowMapA, rowMapB] : [rowMapB, rowMapA];

    for (const [songId, scoreA] of smallerMap.entries()) {
      const scoreB = largerMap.get(songId);
      if (scoreB !== undefined) {
        dotProduct += scoreA * scoreB;
      }
    }

    if (dotProduct <= 0) {
      return 0.0;
    }

    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    return Math.max(0, Math.min(1, Number((isNaN(similarity) ? 0 : similarity).toFixed(4))));
  }

  /**
   * Finds the top N most similar users to a target user within a SparseInteractionMatrix.
   * Excludes comparing the user with themselves and handles non-overlapping / zero vectors safely.
   */
  static findMostSimilarUsers(
    targetUserId: string,
    matrix: SparseInteractionMatrix,
    limit = 10,
    minSimilarity = 0.001
  ): SimilarUserResult[] {
    const targetRowMap = matrix.getUserRowMap(targetUserId);

    if (targetRowMap.size === 0) {
      return [];
    }

    const results: SimilarUserResult[] = [];

    for (const otherUserId of matrix.userIds) {
      // Exclude comparing a user with themselves
      if (otherUserId === targetUserId) {
        continue;
      }

      const otherRowMap = matrix.getUserRowMap(otherUserId);
      const similarityScore = this.calculateUserSimilarity(targetRowMap, otherRowMap);

      if (similarityScore >= minSimilarity) {
        results.push({
          userId: otherUserId,
          similarityScore,
        });
      }
    }

    // Sort descending by similarity score
    results.sort((a, b) => b.similarityScore - a.similarityScore);

    return results.slice(0, Math.max(1, limit));
  }
}
