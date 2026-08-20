import {
  RecommendationPipelineContext,
  PipelineExecutionResult,
  ICandidateGenerationStage,
  IFeatureScoringStage,
  IRankingStage,
  IDiversityFilteringStage,
  IPostRankingStage,
} from './recommendationPipelineTypes.js';
import { CandidateGenerationStage } from './stages/candidateGenerationStage.js';
import { FeatureScoringStage } from './stages/featureScoringStage.js';
import { RankingStage } from './stages/rankingStage.js';
import { DiversityFilteringStage } from './stages/diversityFilteringStage.js';
import { PostRankingStage } from './stages/postRankingStage.js';

export interface PipelineStagesConfig {
  candidateGenerator?: ICandidateGenerationStage;
  featureScorer?: IFeatureScoringStage;
  ranker?: IRankingStage;
  diversityFilter?: IDiversityFilteringStage;
  postRanker?: IPostRankingStage;
}

export class RecommendationPipeline {
  private candidateGenerator: ICandidateGenerationStage;
  private featureScorer: IFeatureScoringStage;
  private ranker: IRankingStage;
  private diversityFilter: IDiversityFilteringStage;
  private postRanker: IPostRankingStage;

  constructor(customStages?: PipelineStagesConfig) {
    this.candidateGenerator = customStages?.candidateGenerator || new CandidateGenerationStage();
    this.featureScorer = customStages?.featureScorer || new FeatureScoringStage();
    this.ranker = customStages?.ranker || new RankingStage();
    this.diversityFilter = customStages?.diversityFilter || new DiversityFilteringStage();
    this.postRanker = customStages?.postRanker || new PostRankingStage();
  }

  /**
   * Executes the 5 recommendation stages sequentially:
   * 1. Candidate Generation
   * 2. Feature Scoring
   * 3. Ranking
   * 4. Diversity Filtering
   * 5. Post-Ranking
   */
  async execute(context: RecommendationPipelineContext): Promise<PipelineExecutionResult> {
    // Stage 1: Candidate Generation
    const candidates = await this.candidateGenerator.generateCandidates(context);

    if (!candidates || candidates.length === 0) {
      return {
        strategyUsed: context.strategyUsed || 'COLD_START_FALLBACK',
        userClassification: context.userClassification,
        count: 0,
        items: [],
        diagnostics: context.diagnostics,
      };
    }

    // Stage 2: Feature Scoring
    const scoredItems = await this.featureScorer.scoreFeatures(candidates, context);

    // Stage 3: Ranking
    const rankedItems = await this.ranker.rank(scoredItems, context);

    // Stage 4: Diversity Filtering
    const diverseItems = await this.diversityFilter.filterDiversity(rankedItems, context);

    // Stage 5: Post-Ranking
    const finalItems = await this.postRanker.processPostRanking(diverseItems, context);

    return {
      strategyUsed: context.strategyUsed || 'PIPELINE_PERSONALIZED',
      userClassification: context.userClassification,
      count: finalItems.length,
      items: finalItems,
      diagnostics: context.diagnostics,
    };
  }
}
