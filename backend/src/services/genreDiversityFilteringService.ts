import { UserTasteProfile } from './userTasteProfileService.js';
import {
  GenreDiversityWeights,
  getGenreDiversityWeights,
} from '../config/recommendationConfig.js';

export interface GenreDiversityOptions<T = any> {
  items: T[];
  tasteProfile?: UserTasteProfile | null;
  requestedGenres?: string[];
  scoreExtractor?: (item: T) => number;
  genreExtractor?: (item: T) => string;
  customWeights?: Partial<GenreDiversityWeights>;
  targetLimit?: number;
}

export class GenreDiversityFilteringService {
  /**
   * Default extractor to resolve genre identifier or name from varied item formats.
   */
  static extractGenre(item: any): string {
    if (!item) return 'unknown_genre';

    const song = item.song || item.songDoc || item;

    if (song.genre) {
      if (typeof song.genre === 'object' && 'name' in song.genre) {
        return String(song.genre.name).toLowerCase().trim();
      }
      if (typeof song.genre === 'object' && '_id' in song.genre) {
        return String(song.genre._id).toLowerCase().trim();
      }
      return String(song.genre).toLowerCase().trim();
    }

    if (song.genreId) {
      return String(song.genreId).toLowerCase().trim();
    }

    return 'unknown_genre';
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
   * Builds a map of user's genre affinities from their UserTasteProfile.
   */
  static buildUserGenreAffinityMap(tasteProfile?: UserTasteProfile | null): Map<string, number> {
    const affinityMap = new Map<string, number>();
    if (!tasteProfile) return affinityMap;

    const allGenres = [
      ...(tasteProfile.combinedGenres || []),
      ...(tasteProfile.shortTermProfile?.genres || []),
      ...(tasteProfile.longTermProfile?.genres || []),
    ];

    for (const g of allGenres) {
      const gName = (g.name || g.genreId || '').toLowerCase().trim();
      if (!gName) continue;
      const currentMax = affinityMap.get(gName) || 0;
      if (g.affinityScore > currentMax) {
        affinityMap.set(gName, g.affinityScore);
      }
    }

    return affinityMap;
  }

  /**
   * Computes the maximum allowed songs for a specific genre based on:
   * - Base max concentration ratio (default 40%)
   * - Whether the genre was explicitly requested by user (allows up to 100%)
   * - User taste profile affinity (scales up to 70% if strongly preferred)
   */
  static calculateMaxAllowedForGenre(
    genreName: string,
    targetLimit: number,
    tasteAffinityMap: Map<string, number>,
    explicitGenresSet: Set<string>,
    weights: GenreDiversityWeights
  ): number {
    const safeTarget = Math.max(1, targetLimit);

    // If genre was explicitly requested, allow full concentration
    if (explicitGenresSet.has(genreName)) {
      return safeTarget;
    }

    const userAffinity = tasteAffinityMap.get(genreName) || 0;

    let allowedRatio = weights.defaultMaxGenreConcentration;

    // If user's taste profile demonstrates strong preference for this genre, dynamically increase concentration
    if (userAffinity >= weights.userPreferredGenreThreshold) {
      const affinitySpread = Math.max(0.01, 1.0 - weights.userPreferredGenreThreshold);
      const ratioProgress = Math.min(1.0, (userAffinity - weights.userPreferredGenreThreshold) / affinitySpread);
      allowedRatio =
        weights.defaultMaxGenreConcentration +
        ratioProgress * (weights.userPreferredMaxConcentration - weights.defaultMaxGenreConcentration);
    }

    return Math.max(2, Math.ceil(safeTarget * allowedRatio));
  }

  /**
   * Reusable post-ranking genre diversity filtering:
   * - Evaluates genre concentration across candidate pool.
   * - Prevents recommendations from being dominated by a single genre unless the user explicitly prefers it.
   * - Dynamically incorporates the user's taste profile.
   * - Preserves recommendation relevance with weighted diversity balancing.
   * - Keeps diversity weights configurable.
   */
  static applyGenreDiversity<T = any>(options: GenreDiversityOptions<T>): T[] {
    const {
      items,
      tasteProfile,
      requestedGenres = [],
      scoreExtractor = this.extractScore,
      genreExtractor = this.extractGenre,
      customWeights,
      targetLimit = items?.length || 10,
    } = options;

    if (!Array.isArray(items) || items.length === 0) {
      return [];
    }

    const safeLimit = Math.max(1, targetLimit);
    const weights: GenreDiversityWeights = {
      ...getGenreDiversityWeights(),
      ...customWeights,
    };

    const tasteAffinityMap = this.buildUserGenreAffinityMap(tasteProfile);
    const explicitGenresSet = new Set(requestedGenres.map((g) => g.toLowerCase().trim()));

    // Pool of remaining items
    const unselectedPool = [...items];
    const selected: T[] = [];
    const genreCountMap = new Map<string, number>();

    while (selected.length < safeLimit && unselectedPool.length > 0) {
      let bestIndex = -1;
      let bestAdjustedScore = -Infinity;

      for (let i = 0; i < unselectedPool.length; i++) {
        const item = unselectedPool[i];
        const genreName = genreExtractor(item);
        const currentCount = genreCountMap.get(genreName) || 0;

        const maxAllowed = this.calculateMaxAllowedForGenre(
          genreName,
          safeLimit,
          tasteAffinityMap,
          explicitGenresSet,
          weights
        );

        let genrePenalty = 0;
        if (currentCount >= maxAllowed) {
          genrePenalty = weights.diversityPenaltyWeight * (currentCount - maxAllowed + 1);
        } else if (currentCount > 1 && !explicitGenresSet.has(genreName)) {
          // Subtle soft penalty for non-preferred multi-genre concentration
          const affinity = tasteAffinityMap.get(genreName) || 0;
          if (affinity < weights.userPreferredGenreThreshold) {
            genrePenalty = (weights.diversityPenaltyWeight * 0.3) * (currentCount / maxAllowed);
          }
        }

        const rawScore = scoreExtractor(item);
        const adjustedScore = rawScore - genrePenalty;

        if (adjustedScore > bestAdjustedScore) {
          bestAdjustedScore = adjustedScore;
          bestIndex = i;
        }
      }

      if (bestIndex === -1) {
        bestIndex = 0;
      }

      const [chosen] = unselectedPool.splice(bestIndex, 1);
      selected.push(chosen);

      const chosenGenre = genreExtractor(chosen);
      genreCountMap.set(chosenGenre, (genreCountMap.get(chosenGenre) || 0) + 1);
    }

    return selected.slice(0, safeLimit);
  }
}
