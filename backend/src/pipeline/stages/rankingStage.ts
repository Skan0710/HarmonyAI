import { IRankingStage, PipelineItem, RecommendationPipelineContext } from '../recommendationPipelineTypes.js';
import { getHybridConfigWeights } from '../../config/recommendationConfig.js';

export class RankingStage implements IRankingStage {
  /**
   * Fuses normalized component scores using weights and ranks items in descending order.
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

      const finalScore = Number(
        (totalWeight > 0 ? weightedSum / totalWeight : weightedSum).toFixed(4)
      );

      return {
        ...item,
        finalScore: Math.max(0, Math.min(1, finalScore)),
      };
    });

    ranked.sort((a, b) => b.finalScore - a.finalScore);
    return ranked;
  }
}
