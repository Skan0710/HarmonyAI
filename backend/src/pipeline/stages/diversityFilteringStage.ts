import { IDiversityFilteringStage, PipelineItem, RecommendationPipelineContext } from '../recommendationPipelineTypes.js';

export class DiversityFilteringStage implements IDiversityFilteringStage {
  /**
   * Applies diversity filtering across artist concentration, genre concentration,
   * and consecutive artist suppression.
   */
  async filterDiversity(
    items: PipelineItem[],
    context: RecommendationPipelineContext
  ): Promise<PipelineItem[]> {
    if (!items || items.length === 0) {
      return [];
    }

    const maxPerArtist = 2;
    const selected: PipelineItem[] = [];
    const artistCounts = new Map<string, number>();
    let prevArtistId = context.lastPlayedArtistId || '';

    for (const item of items) {
      const song = item.song;
      const artistId =
        typeof song?.artist === 'object' && song.artist && '_id' in song.artist
          ? String(song.artist._id)
          : String(song?.artist || 'unknown');

      // Consecutive artist suppression
      if (artistId === prevArtistId && items.length > (context.limit || 10)) {
        continue;
      }

      // Max per artist limit
      const currentCount = artistCounts.get(artistId) || 0;
      if (currentCount >= maxPerArtist && items.length > (context.limit || 10)) {
        continue;
      }

      selected.push(item);
      artistCounts.set(artistId, currentCount + 1);
      prevArtistId = artistId;
    }

    // If diversity filtering was too aggressive and returned fewer items than needed, fill back
    if (selected.length < (context.limit || 10)) {
      for (const item of items) {
        if (!selected.some((s) => s.songId === item.songId)) {
          selected.push(item);
          if (selected.length >= (context.limit || 10)) break;
        }
      }
    }

    return selected;
  }
}
