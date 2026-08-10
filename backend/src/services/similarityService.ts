import { NormalizedSongFeatures } from './songFeatureExtractionService.js';

export interface SimilarityWeights {
  genreWeight: number; // default: 0.35
  artistWeight: number; // default: 0.20
  moodWeight: number; // default: 0.15
  languageWeight: number; // default: 0.05
  audioVectorWeight: number; // default: 0.25
}

export interface SimilarityExplanation {
  isIdentical: boolean;
  matchingMetadata: {
    genreMatch: boolean;
    artistMatch: boolean;
    moodMatch: boolean;
    languageMatch: boolean;
  };
  featureBreakdown: {
    genreScore: number;
    artistScore: number;
    moodScore: number;
    languageScore: number;
    cosineAudioScore: number;
  };
  weightedContributions: {
    genreContribution: number;
    artistContribution: number;
    moodContribution: number;
    languageContribution: number;
    audioVectorContribution: number;
  };
  majorContributors: string[];
}

export interface SimilarityDetailResult {
  similarityScore: number;
  explanation: SimilarityExplanation;
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
   */
  static calculateSimilarity(
    featuresA: NormalizedSongFeatures,
    featuresB: NormalizedSongFeatures,
    customWeights: Partial<SimilarityWeights> = {}
  ): number {
    return this.calculateSimilarityWithExplanation(featuresA, featuresB, customWeights).similarityScore;
  }

  /**
   * Development-oriented method returning similarity score along with an in-depth breakdown explanation
   * of major matching features and feature score contributions.
   */
  static calculateSimilarityWithExplanation(
    featuresA: NormalizedSongFeatures,
    featuresB: NormalizedSongFeatures,
    customWeights: Partial<SimilarityWeights> = {}
  ): SimilarityDetailResult {
    if (!featuresA || !featuresB) {
      return {
        similarityScore: 0,
        explanation: {
          isIdentical: false,
          matchingMetadata: { genreMatch: false, artistMatch: false, moodMatch: false, languageMatch: false },
          featureBreakdown: { genreScore: 0, artistScore: 0, moodScore: 0, languageScore: 0, cosineAudioScore: 0 },
          weightedContributions: {
            genreContribution: 0,
            artistContribution: 0,
            moodContribution: 0,
            languageContribution: 0,
            audioVectorContribution: 0,
          },
          majorContributors: ['Missing or null song features'],
        },
      };
    }

    const weights = { ...DEFAULT_WEIGHTS, ...customWeights };

    // 1. Identical song check
    const isIdentical = Boolean(featuresA.songId && featuresA.songId === featuresB.songId);
    if (isIdentical) {
      return {
        similarityScore: 1.0,
        explanation: {
          isIdentical: true,
          matchingMetadata: { genreMatch: true, artistMatch: true, moodMatch: true, languageMatch: true },
          featureBreakdown: { genreScore: 1, artistScore: 1, moodScore: 1, languageScore: 1, cosineAudioScore: 1 },
          weightedContributions: {
            genreContribution: weights.genreWeight,
            artistContribution: weights.artistWeight,
            moodContribution: weights.moodWeight,
            languageContribution: weights.languageWeight,
            audioVectorContribution: weights.audioVectorWeight,
          },
          majorContributors: ['Identical Track Match (100%)'],
        },
      };
    }

    // 2. Categorical Metadata Matching
    const genreMatch = Boolean(
      featuresA.genreId && featuresB.genreId && featuresA.genreId === featuresB.genreId
    );
    const artistMatch = Boolean(
      featuresA.artistId && featuresB.artistId && featuresA.artistId === featuresB.artistId
    );
    const moodMatch = Boolean(
      featuresA.mood && featuresB.mood && featuresA.mood === featuresB.mood
    );
    const languageMatch = Boolean(
      featuresA.language && featuresB.language && featuresA.language === featuresB.language
    );

    const genreScore = genreMatch ? 1.0 : 0.0;
    const artistScore = artistMatch ? 1.0 : 0.0;
    const moodScore = moodMatch ? 1.0 : 0.0;
    const languageScore = languageMatch ? 1.0 : 0.0;

    // 3. Numerical Audio Feature Cosine Similarity
    const cosineAudioScore = this.calculateVectorCosineSimilarity(
      featuresA.numericalFeatureVector,
      featuresB.numericalFeatureVector
    );

    // 4. Weighted Contributions
    const genreContribution = genreScore * weights.genreWeight;
    const artistContribution = artistScore * weights.artistWeight;
    const moodContribution = moodScore * weights.moodWeight;
    const languageContribution = languageScore * weights.languageWeight;
    const audioVectorContribution = cosineAudioScore * weights.audioVectorWeight;

    const totalWeight =
      weights.genreWeight +
      weights.artistWeight +
      weights.moodWeight +
      weights.languageWeight +
      weights.audioVectorWeight;

    const rawCombinedScore =
      genreContribution +
      artistContribution +
      moodContribution +
      languageContribution +
      audioVectorContribution;

    const normalizedScore = totalWeight > 0 ? rawCombinedScore / totalWeight : 0;
    const finalScore = Math.max(0, Math.min(1, Number(normalizedScore.toFixed(4))));

    // 5. Build Major Contributors List
    const majorContributors: string[] = [];
    if (genreMatch) majorContributors.push(`Matching Genre (${featuresA.genreId})`);
    if (artistMatch) majorContributors.push(`Matching Artist (${featuresA.artistId})`);
    if (moodMatch) majorContributors.push(`Matching Mood (${featuresA.mood})`);
    if (languageMatch) majorContributors.push(`Matching Language (${featuresA.language})`);
    if (cosineAudioScore > 0.7) {
      majorContributors.push(`High Audio Feature Similarity (${(cosineAudioScore * 100).toFixed(1)}%)`);
    }

    if (majorContributors.length === 0) {
      majorContributors.push('Low overall feature similarity');
    }

    return {
      similarityScore: finalScore,
      explanation: {
        isIdentical: false,
        matchingMetadata: { genreMatch, artistMatch, moodMatch, languageMatch },
        featureBreakdown: { genreScore, artistScore, moodScore, languageScore, cosineAudioScore },
        weightedContributions: {
          genreContribution,
          artistContribution,
          moodContribution,
          languageContribution,
          audioVectorContribution,
        },
        majorContributors,
      },
    };
  }

  /**
   * Safe Cosine Similarity calculation for numerical vectors.
   * Handles zero vectors, NaNs, missing data, and unequal lengths.
   */
  public static calculateVectorCosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) {
      return 0.0;
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
