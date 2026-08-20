import { IPostRankingStage, PipelineItem, RecommendationPipelineContext } from '../recommendationPipelineTypes.js';

export class PostRankingStage implements IPostRankingStage {
  /**
   * Applies final slicing, post-processing formatting, and diagnostic recording.
   */
  async processPostRanking(
    items: PipelineItem[],
    context: RecommendationPipelineContext
  ): Promise<PipelineItem[]> {
    if (!items || items.length === 0) {
      return [];
    }

    const targetLimit = Math.max(1, context.limit || 10);
    const sliced = items.slice(0, targetLimit);

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
