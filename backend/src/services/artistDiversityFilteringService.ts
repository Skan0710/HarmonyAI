export interface ArtistDiversityOptions<T = any> {
  items: T[];
  scoreExtractor?: (item: T) => number;
  artistExtractor?: (item: T) => string;
  maxSongsPerArtist?: number;        // default: 2
  maxConsecutiveSameArtist?: number; // default: 1 (prevent consecutive tracks from same artist)
  targetLimit?: number;              // default: items.length
}

export class ArtistDiversityFilteringService {
  /**
   * Default extractor to resolve artist identifier from varied song / item models.
   */
  static extractArtistId(item: any): string {
    if (!item) return 'unknown_artist';

    // If item has a nested song object
    const song = item.song || item.songDoc || item;

    if (song.artist) {
      if (typeof song.artist === 'object' && '_id' in song.artist) {
        return String(song.artist._id);
      }
      if (typeof song.artist === 'object' && 'name' in song.artist) {
        return String(song.artist.name).toLowerCase();
      }
      return String(song.artist).toLowerCase();
    }

    if (song.artistId) {
      return String(song.artistId);
    }

    return 'unknown_artist';
  }

  /**
   * Default score extractor.
   */
  static extractScore(item: any): number {
    if (!item) return 0;
    if (typeof item.finalScore === 'number') return item.finalScore;
    if (typeof item.hybridScore === 'number') return item.hybridScore;
    if (typeof item.sessionScore === 'number') return item.sessionScore;
    if (typeof item.contextScore === 'number') return item.contextScore;
    if (typeof item.autoplayScore === 'number') return item.autoplayScore;
    if (typeof item.candidateScore === 'number') return item.candidateScore;
    if (typeof item.score === 'number') return item.score;
    return 0;
  }

  /**
   * Reusable post-ranking artist diversity filtering:
   * - Prevents too many consecutive recommendations from the same artist.
   * - Enforces configurable maximum number of songs per artist.
   * - Preserves higher-scoring songs during selection.
   * - Does not completely remove an artist when diversity filtering is applied.
   * - Backfills gracefully when necessary to satisfy target limits.
   * - Completely decoupled from the frontend.
   */
  static applyArtistDiversity<T = any>(options: ArtistDiversityOptions<T>): T[] {
    const {
      items,
      scoreExtractor = this.extractScore,
      artistExtractor = this.extractArtistId,
      maxSongsPerArtist = 2,
      maxConsecutiveSameArtist = 1,
      targetLimit = items?.length || 10,
    } = options;

    if (!Array.isArray(items) || items.length === 0) {
      return [];
    }

    const safeLimit = Math.max(1, targetLimit);

    // Ensure pool is sorted by score descending
    const pool = [...items].sort((a, b) => scoreExtractor(b) - scoreExtractor(a));

    const selected: T[] = [];
    const artistCountMap = new Map<string, number>();

    let lastArtistId = '';
    let consecutiveCount = 0;

    while (selected.length < safeLimit && pool.length > 0) {
      let eligibleIndex = -1;

      // Pass 1: Find highest scoring item satisfying both consecutive and max-per-artist limits
      for (let i = 0; i < pool.length; i++) {
        const item = pool[i];
        const artistId = artistExtractor(item);
        const currentArtistCount = artistCountMap.get(artistId) || 0;

        const isConsecutiveLimitExceeded =
          artistId === lastArtistId && consecutiveCount >= maxConsecutiveSameArtist;
        const isMaxPerArtistExceeded = currentArtistCount >= maxSongsPerArtist;

        if (!isConsecutiveLimitExceeded && !isMaxPerArtistExceeded) {
          eligibleIndex = i;
          break;
        }
      }

      // Pass 2: Relax consecutive limit if no item is eligible but max-per-artist has room
      if (eligibleIndex === -1) {
        for (let i = 0; i < pool.length; i++) {
          const item = pool[i];
          const artistId = artistExtractor(item);
          const currentArtistCount = artistCountMap.get(artistId) || 0;

          if (currentArtistCount < maxSongsPerArtist) {
            eligibleIndex = i;
            break;
          }
        }
      }

      // Pass 3: Fallback to highest scoring item remaining
      if (eligibleIndex === -1) {
        eligibleIndex = 0;
      }

      const [chosen] = pool.splice(eligibleIndex, 1);
      selected.push(chosen);

      const chosenArtistId = artistExtractor(chosen);
      const currentCount = artistCountMap.get(chosenArtistId) || 0;
      artistCountMap.set(chosenArtistId, currentCount + 1);

      if (chosenArtistId === lastArtistId) {
        consecutiveCount++;
      } else {
        lastArtistId = chosenArtistId;
        consecutiveCount = 1;
      }
    }

    return selected.slice(0, safeLimit);
  }
}
