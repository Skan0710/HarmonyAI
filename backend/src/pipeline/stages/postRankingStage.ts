import { IPostRankingStage, PipelineItem, RecommendationPipelineContext } from '../recommendationPipelineTypes.js';
import { RecommendationHistoryService } from '../../services/recommendationHistoryService.js';

export class PostRankingStage implements IPostRankingStage {
  /**
   * Applies repetition control, final slicing, post-processing formatting, and diagnostic recording.
   */
  async processPostRanking(
    items: PipelineItem[],
    context: RecommendationPipelineContext
  ): Promise<PipelineItem[]> {
    if (!items || items.length === 0) {
      return [];
    }

    const targetLimit = Math.max(1, context.limit || 10);

    let repetitionControlled = items;

    // Apply Repetition Control if valid user ID is present
    if (context.userId) {
      try {
        const [recentlyRecommended, recentlySkipped] = await Promise.all([
          RecommendationHistoryService.getRecentlyRecommendedMap(context.userId),
          RecommendationHistoryService.getRecentlySkippedSongIds(context.userId),
        ]);

        const evaluated = RecommendationHistoryService.applyRepetitionControl<PipelineItem>({
          items,
          recentlyRecommended,
          recentlySkipped,
          targetLimit,
          scoreExtractor: (i) => i.finalScore,
          songIdExtractor: (i) => i.songId,
        });

        repetitionControlled = evaluated.map((e) => ({
          ...e.item,
          finalScore: e.adjustedScore,
          metadata: {
            ...e.item.metadata,
            isRecentlyRecommended: e.isRecentlyRecommended,
            isRecentlySkipped: e.isRecentlySkipped,
            isReappearanceAllowed: e.isReappearanceAllowed,
          },
        }));
      } catch (err) {
        // Fallback gracefully without breaking recommendations
        repetitionControlled = items.slice(0, targetLimit);
      }
    }

    const sliced = repetitionControlled.slice(0, targetLimit);

    if (context.isDebugMode && process.env.NODE_ENV !== 'production') {
      context.diagnostics = {
        isDebugEnabled: true,
        evaluatedCandidatesCount: items.length,
        finalCount: sliced.length,
        strategyUsed: context.strategyUsed || 'PIPELINE_PERSONALIZED',
        userClassification: context.userClassification || 'ACTIVE',
      };
    }

    return sliced;
  }
}
