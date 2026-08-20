import { IRankingStage, PipelineItem, RecommendationPipelineContext } from '../recommendationPipelineTypes.js';
import { getHybridConfigWeights } from '../../config/recommendationConfig.js';
import { NoveltyScoringService } from '../../services/noveltyScoringService.js';

export class RankingStage implements IRankingStage {
  /**
   * Fuses normalized component scores with novelty-aware ranking and ranks items in descending order.
   */
  async rank(
    items: PipelineItem[],
    context: RecommendationPipelineContext
  ): Promise<PipelineItem[]> {
    if (!items || items.length === 0) {
      return [];
    }

    const defaultWeights = getHybridConfigWeights();
    const weights = {
      contentWeight: context.customWeights?.contentSimilarityWeight ?? defaultWeights.contentSimilarityWeight,
      collabWeight: context.customWeights?.collaborativeWeight ?? defaultWeights.collaborativeWeight,
      tasteWeight: context.customWeights?.userTasteAffinityWeight ?? defaultWeights.userTasteAffinityWeight,
      popWeight: context.customWeights?.popularityWeight ?? defaultWeights.popularityWeight,
      recWeight: context.customWeights?.recencyWeight ?? defaultWeights.recencyWeight,
    };

    const totalWeight =
      weights.contentWeight +
      weights.collabWeight +
      weights.tasteWeight +
      weights.popWeight +
      weights.recWeight;

    const ranked = items.map((item) => {
      const scores = item.normalizedScores;

      const weightedSum =
        (scores.contentScore || 0) * weights.contentWeight +
        (scores.collaborativeScore || 0) * weights.collabWeight +
        (scores.userTasteAffinityScore || 0) * weights.tasteWeight +
        (scores.popularityScore || 0) * weights.popWeight +
        (scores.recencyScore || 0) * weights.recWeight;

      const baseScore = Number(
        (totalWeight > 0 ? weightedSum / totalWeight : weightedSum).toFixed(4)
      );

      // Compute Novelty Score
      const catalogPlayCount = item.rawFeatures.popularitySignal || item.song?.playCount || 0;
      const userEncountered = context.excludedSongIds?.has(item.songId) ? 3 : 0;

      const rawNovelty = NoveltyScoringService.computeCompositeNovelty({
        catalogPlayCount,
        userPlayCount: userEncountered,
      });

      const { finalScore, gatedNoveltyScore } = NoveltyScoringService.combineNoveltyWithBaseScore(
        baseScore,
        rawNovelty,
        context.customWeights
      );

      return {
        ...item,
        finalScore,
        normalizedScores: {
          ...item.normalizedScores,
          noveltyScore: gatedNoveltyScore,
        },
      };
    });

    ranked.sort((a, b) => b.finalScore - a.finalScore);
    return ranked;
  }
}
