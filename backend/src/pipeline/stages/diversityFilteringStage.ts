import { IDiversityFilteringStage, PipelineItem, RecommendationPipelineContext } from '../recommendationPipelineTypes.js';
import { ArtistDiversityFilteringService } from '../../services/artistDiversityFilteringService.js';

export class DiversityFilteringStage implements IDiversityFilteringStage {
  /**
   * Applies diversity filtering across artist concentration and consecutive artist suppression
   * using the reusable ArtistDiversityFilteringService.
   */
  async filterDiversity(
    items: PipelineItem[],
    context: RecommendationPipelineContext
  ): Promise<PipelineItem[]> {
    if (!items || items.length === 0) {
      return [];
    }

    return ArtistDiversityFilteringService.applyArtistDiversity<PipelineItem>({
      items,
      targetLimit: context.limit || 10,
      maxSongsPerArtist: 2,
      maxConsecutiveSameArtist: 1,
      scoreExtractor: (item) => item.finalScore || 0,
      artistExtractor: (item) => ArtistDiversityFilteringService.extractArtistId(item),
    });
  }
}
