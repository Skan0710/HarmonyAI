import { IDiversityFilteringStage, PipelineItem, RecommendationPipelineContext } from '../recommendationPipelineTypes.js';
import { ArtistDiversityFilteringService } from '../../services/artistDiversityFilteringService.js';
import { GenreDiversityFilteringService } from '../../services/genreDiversityFilteringService.js';

export class DiversityFilteringStage implements IDiversityFilteringStage {
  /**
   * Applies combined post-ranking diversity filtering across both artist concentration
   * (consecutive artist suppression, max tracks per artist) and genre concentration
   * (using taste profile affinity scaling and configurable weights).
   */
  async filterDiversity(
    items: PipelineItem[],
    context: RecommendationPipelineContext
  ): Promise<PipelineItem[]> {
    if (!items || items.length === 0) {
      return [];
    }

    const targetLimit = context.limit || 10;

    // Step 1: Apply Genre Diversity Filtering (considers user taste profile and requested genres)
    const genreBalanced = GenreDiversityFilteringService.applyGenreDiversity<PipelineItem>({
      items,
      targetLimit: Math.max(targetLimit, items.length),
      scoreExtractor: (item) => item.finalScore || 0,
      genreExtractor: (item) => GenreDiversityFilteringService.extractGenre(item),
    });

    // Step 2: Apply Artist Diversity Filtering (consecutive suppression and artist caps)
    const fullyDiversified = ArtistDiversityFilteringService.applyArtistDiversity<PipelineItem>({
      items: genreBalanced,
      targetLimit,
      maxSongsPerArtist: 2,
      maxConsecutiveSameArtist: 1,
      scoreExtractor: (item) => item.finalScore || 0,
      artistExtractor: (item) => ArtistDiversityFilteringService.extractArtistId(item),
    });

    return fullyDiversified;
  }
}
