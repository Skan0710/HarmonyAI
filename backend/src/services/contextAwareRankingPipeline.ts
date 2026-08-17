import { ISong } from '../models/Song.js';
import { HybridCandidate } from './candidateGenerationService.js';
import { ContextPreference } from '../schemas/contextPreferenceSchema.js';
import { MoodFilteringService } from './moodFilteringService.js';
import {
  ContextScoringWeights,
  getContextConfigWeights,
} from '../config/recommendationConfig.js';

export interface ContextRankedResult {
  song: ISong;
  contextScore: number;
  componentScores: {
    contentScore: number;
    collaborativeScore: number;
    userTasteAffinityScore: number;
    popularityScore: number;
    recencyScore: number;
    moodScore: number;
    activityScore: number;
  };
  sources: string[];
}

export class ContextAwareRankingPipeline {
  /**
   * Evaluates activity alignment (0.0 to 1.0) based on context energy and song audio features.
   */
  private static calculateActivityCompatibility(songDoc: any, context?: ContextPreference): number {
    if (!context || !songDoc) return 0.5;

    let score = 0.5;
    if (songDoc.audioFeatures && typeof context.energyLevel === 'number') {
      const energyDiff = Math.abs((songDoc.audioFeatures.energy || 0.5) - context.energyLevel);
      score = 1.0 - Math.min(1, energyDiff);
    }
    return Number(score.toFixed(4));
  }

  /**
   * Separate context-aware ranking layer that fuses 7 normalized signals:
   * 1. User Taste Affinity
   * 2. Content Similarity
   * 3. Collaborative Score
   * 4. Popularity
   * 5. Recency
   * 6. Mood Compatibility
   * 7. Activity / Context Compatibility
   * All weights are configurable via ContextScoringWeights.
   * Does not change existing hybrid recommendation engine directly.
   */
  static rankCandidatesWithContext(
    candidates: HybridCandidate[],
    context?: ContextPreference,
    limit = 10,
    customWeights?: Partial<ContextScoringWeights>
  ): ContextRankedResult[] {
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return [];
    }

    const weights: ContextScoringWeights = {
      ...getContextConfigWeights(),
      ...customWeights,
    };

    const maxPopularity = candidates.reduce(
      (max, c) => Math.max(max, c.popularitySignal || 0),
      1
    );

    const scoredResults: ContextRankedResult[] = candidates.map((cand) => {
      const songDoc = cand.songDoc;

      // 1. Content Score
      const contentScore = Number((isNaN(cand.contentScore) ? 0 : Math.max(0, Math.min(1, cand.contentScore))).toFixed(4));

      // 2. Collaborative Score
      const collaborativeScore = Number((isNaN(cand.collaborativeScore) ? 0 : Math.max(0, Math.min(1, cand.collaborativeScore))).toFixed(4));

      // 3. User Taste Affinity Score
      const userTasteAffinityScore = Number((isNaN(cand.userTasteAffinityScore) ? 0 : Math.max(0, Math.min(1, cand.userTasteAffinityScore))).toFixed(4));

      // 4. Popularity Score
      const popularityScore = Number(
        (maxPopularity > 0
          ? Math.min(1, (cand.popularitySignal || 0) / maxPopularity)
          : 0.5).toFixed(4)
      );

      // 5. Recency Score
      const recencyScore = Number((isNaN(cand.recencySignal) ? 0.5 : Math.max(0, Math.min(1, cand.recencySignal))).toFixed(4));

      // 6. Mood Compatibility Score
      const moodScore = context && context.mood
        ? MoodFilteringService.calculateMoodCompatibilityScore(songDoc, context.mood)
        : 0.5;

      // 7. Activity / Context Compatibility Score
      const activityScore = this.calculateActivityCompatibility(songDoc, context);

      // Weighted Fusion Score Calculation
      const weightedSum =
        contentScore * weights.contentSimilarityWeight +
        collaborativeScore * weights.collaborativeWeight +
        userTasteAffinityScore * weights.userTasteAffinityWeight +
        popularityScore * weights.popularityWeight +
        recencyScore * weights.recencyWeight +
        moodScore * weights.moodCompatibilityWeight +
        activityScore * weights.contextActivityCompatibilityWeight;

      const totalWeight =
        weights.contentSimilarityWeight +
        weights.collaborativeWeight +
        weights.userTasteAffinityWeight +
        weights.popularityWeight +
        weights.recencyWeight +
        weights.moodCompatibilityWeight +
        weights.contextActivityCompatibilityWeight;

      const contextScore = Number(
        (totalWeight > 0 ? weightedSum / totalWeight : weightedSum).toFixed(4)
      );

      return {
        song: songDoc as ISong,
        contextScore,
        componentScores: {
          contentScore,
          collaborativeScore,
          userTasteAffinityScore,
          popularityScore,
          recencyScore,
          moodScore,
          activityScore,
        },
        sources: cand.sources || [],
      };
    });

    // Rank candidates descending by contextScore
    scoredResults.sort((a, b) => b.contextScore - a.contextScore);

    return scoredResults.slice(0, Math.max(1, limit));
  }
}
