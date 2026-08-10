import { NormalizedSongFeatures } from './songFeatureExtractionService.js';

export interface SimilarityWeights {
  genreWeight: number; // default: 0.35
  artistWeight: number; // default: 0.20
  moodWeight: number; // default: 0.15
  languageWeight: number; // default: 0.05
  audioVectorWeight: number; // default: 0.25
}

const DEFAULT_WEIGHTS: SimilarityWeights = {
  genreWeight: 0.35,
  artistWeight: 0.20,
  moodWeight: 0.15,
  languageWeight: 0.05,
  audioVectorWeight: 0.25,
};

export class ContentSimilarityService {
  /**
   * Calculates a normalized similarity score between 0.0 and 1.0 comparing two song feature representations.
   * Combines Cosine Similarity on numerical audio vectors with categorical metadata matching (genre, artist, mood, language).
   */
  static calculateSimilarity(
    featuresA: NormalizedSongFeatures,
    featuresB: NormalizedSongFeatures,
    customWeights: Partial<SimilarityWeights> = {}
  ): number {
    if (!featuresA || !featuresB) {
      return 0;
    }

    // 1. Identical song fast path
    if (featuresA.songId && featuresA.songId === featuresB.songId) {
      return 1.0;
    }

    const weights = { ...DEFAULT_WEIGHTS, ...customWeights };

    // 2. Categorical Metadata Matching Scores (0.0 or 1.0)
    const genreScore =
      featuresA.genreId && featuresB.genreId && featuresA.genreId === featuresB.genreId
        ? 1.0
        : 0.0;

    const artistScore =
      featuresA.artistId && featuresB.artistId && featuresA.artistId === featuresB.artistId
        ? 1.0
        : 0.0;

    const moodScore =
      featuresA.mood && featuresB.mood && featuresA.mood === featuresB.mood
        ? 1.0
        : 0.0;

    const languageScore =
      featuresA.language && featuresB.language && featuresA.language === featuresB.language
        ? 1.0
        : 0.0;

    // 3. Cosine Similarity for Numerical Audio Feature Vector
    const cosineScore = this.calculateVectorCosineSimilarity(
      featuresA.numericalFeatureVector,
      featuresB.numericalFeatureVector
    );

    // 4. Weighted Combined Score Calculation
    const rawCombinedScore =
      genreScore * weights.genreWeight +
      artistScore * weights.artistWeight +
      moodScore * weights.moodWeight +
      languageScore * weights.languageWeight +
      cosineScore * weights.audioVectorWeight;

    // Normalize weights sum in case custom weights don't equal 1.0
    const totalWeight =
      weights.genreWeight +
      weights.artistWeight +
      weights.moodWeight +
      weights.languageWeight +
      weights.audioVectorWeight;

    const normalizedScore = totalWeight > 0 ? rawCombinedScore / totalWeight : 0;

    // Guarantee score bounds [0.0, 1.0]
    return Math.max(0, Math.min(1, Number(normalizedScore.toFixed(4))));
  }

  /**
   * Safe Cosine Similarity calculation for numerical vectors.
   * Returns a score between 0.0 and 1.0. Handles zero vectors, NaNs, and unequal vector lengths.
   */
  public static calculateVectorCosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) {
      return 0.5; // Neutral fallback when vector data is missing
    }

    const minLen = Math.min(vecA.length, vecB.length);
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < minLen; i++) {
      const valA = isNaN(vecA[i]) ? 0 : vecA[i];
      const valB = isNaN(vecB[i]) ? 0 : vecB[i];

      dotProduct += valA * valB;
      normA += valA * valA;
      normB += valB * valB;
    }

    if (normA === 0 || normB === 0) {
      return 0.0; // Zero vector handling
    }

    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    return Math.max(0, Math.min(1, isNaN(similarity) ? 0 : similarity));
  }
}
