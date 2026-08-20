import {
  NoveltyScoringWeights,
  getNoveltyConfigWeights,
} from '../config/recommendationConfig.js';

export interface NoveltyScoredItem<T = any> {
  item: T;
  baseScore: number;
  rawNoveltyScore: number;
  gatedNoveltyScore: number;
  finalScore: number;
}

export interface NoveltyScoringOptions<T = any> {
  items: T[];
  userEncounteredSongIds?: Set<string> | Map<string, number>;
  scoreExtractor?: (item: T) => number;
  playCountExtractor?: (item: T) => number;
  songIdExtractor?: (item: T) => string;
  customWeights?: Partial<NoveltyScoringWeights>;
}

export class NoveltyScoringService {
  /**
   * Calculates catalog-level novelty (0.0 to 1.0) based on total play counts across all users.
   * Less played / long-tail songs yield higher novelty.
   */
  static calculateCatalogNovelty(playCount = 0, maxPlayCount = 1000): number {
    const safeMax = Math.max(1, maxPlayCount);
    const clampedPlayCount = Math.max(0, playCount);
    const normalizedPopularity = Math.min(1.0, clampedPlayCount / safeMax);
    return Number((1.0 - normalizedPopularity).toFixed(4));
  }

  /**
   * Calculates user-level encounter novelty (0.0 to 1.0).
   * Songs never encountered by the user yield 1.0; repeated encounters decay towards 0.05.
   */
  static calculateUserExposureNovelty(
    userPlayCount = 0,
    decayFactor = 0.20
  ): number {
    const clampedCount = Math.max(0, userPlayCount);
    const novelty = Math.max(0.05, 1.0 - clampedCount * decayFactor);
    return Number(novelty.toFixed(4));
  }

  /**
   * Computes the composite raw novelty score fusing catalog novelty (60%) and user encounter novelty (40%).
   */
  static computeCompositeNovelty(params: {
    catalogPlayCount?: number;
    userPlayCount?: number;
    weights?: NoveltyScoringWeights;
  }): number {
    const weights = params.weights || getNoveltyConfigWeights();
    const catalogNovelty = this.calculateCatalogNovelty(
      params.catalogPlayCount || 0,
      weights.maxCatalogPlayCount
    );
    const userNovelty = this.calculateUserExposureNovelty(
      params.userPlayCount || 0,
      weights.userExposureDecayFactor
    );

    // Weighted combination: 60% catalog rarity, 40% user novelty
    const composite = 0.60 * catalogNovelty + 0.40 * userNovelty;
    return Number(Math.max(0, Math.min(1, composite)).toFixed(4));
  }

  /**
   * Calculates relevance-gated novelty boost:
   * Prevents obscure or rarely played songs from being boosted if their underlying recommendation relevance is low.
   * Gating Factor G = 0 if baseScore <= minRelevanceThreshold; scales linearly to 1.0 at baseScore = 1.0.
   */
  static calculateGatedNoveltyBoost(
    baseRelevanceScore: number,
    rawNoveltyScore: number,
    minRelevanceThreshold = 0.35
  ): number {
    const clampedBase = Math.max(0, Math.min(1, baseRelevanceScore));
    const clampedNovelty = Math.max(0, Math.min(1, rawNoveltyScore));

    if (clampedBase <= minRelevanceThreshold) {
      return 0.0;
    }

    const spread = Math.max(0.01, 1.0 - minRelevanceThreshold);
    const gatingFactor = Math.min(1.0, (clampedBase - minRelevanceThreshold) / spread);

    const gatedNovelty = clampedNovelty * gatingFactor;
    return Number(gatedNovelty.toFixed(4));
  }

  /**
   * Combines base recommendation relevance score with gated novelty score:
   * S_final = (1 - w_novelty) * S_base + w_novelty * GatedNovelty
   * Guaranteed to be normalized between 0.0 and 1.0.
   */
  static combineNoveltyWithBaseScore(
    baseScore: number,
    rawNoveltyScore: number,
    customWeights?: Partial<NoveltyScoringWeights>
  ): {
    finalScore: number;
    gatedNoveltyScore: number;
    rawNoveltyScore: number;
  } {
    const weights: NoveltyScoringWeights = {
      ...getNoveltyConfigWeights(),
      ...customWeights,
    };

    const clampedBase = Math.max(0, Math.min(1, isNaN(baseScore) ? 0 : baseScore));
    const clampedRawNovelty = Math.max(0, Math.min(1, isNaN(rawNoveltyScore) ? 0 : rawNoveltyScore));

    const gatedNovelty = this.calculateGatedNoveltyBoost(
      clampedBase,
      clampedRawNovelty,
      weights.minRelevanceThreshold
    );

    const noveltyWeight = Math.max(0, Math.min(1, weights.noveltyWeight));
    const baseWeight = 1.0 - noveltyWeight;

    const finalScore = baseWeight * clampedBase + noveltyWeight * gatedNovelty;
    const normalizedFinalScore = Number(Math.max(0, Math.min(1, finalScore)).toFixed(4));

    return {
      finalScore: normalizedFinalScore,
      gatedNoveltyScore: gatedNovelty,
      rawNoveltyScore: clampedRawNovelty,
    };
  }

  /**
   * Batch scores candidate items with novelty awareness, returning items with their scores and rank.
   */
  static scoreItemsWithNovelty<T = any>(
    options: NoveltyScoringOptions<T>
  ): NoveltyScoredItem<T>[] {
    const {
      items,
      userEncounteredSongIds,
      scoreExtractor = (it: any) => (typeof it.finalScore === 'number' ? it.finalScore : it.score || it.hybridScore || 0),
      playCountExtractor = (it: any) => (it.song?.playCount ?? it.playCount ?? 0),
      songIdExtractor = (it: any) => (it.songId ?? it.song?._id?.toString() ?? it._id?.toString() ?? ''),
      customWeights,
    } = options;

    if (!Array.isArray(items) || items.length === 0) {
      return [];
    }

    const weights: NoveltyScoringWeights = {
      ...getNoveltyConfigWeights(),
      ...customWeights,
    };

    const scoredList: NoveltyScoredItem<T>[] = items.map((item) => {
      const baseScore = scoreExtractor(item);
      const catalogPlayCount = playCountExtractor(item);
      const songId = songIdExtractor(item);

      let userPlayCount = 0;
      if (userEncounteredSongIds instanceof Map) {
        userPlayCount = userEncounteredSongIds.get(songId) || 0;
      } else if (userEncounteredSongIds instanceof Set) {
        userPlayCount = userEncounteredSongIds.has(songId) ? 3 : 0;
      }

      const rawNovelty = this.computeCompositeNovelty({
        catalogPlayCount,
        userPlayCount,
        weights,
      });

      const { finalScore, gatedNoveltyScore } = this.combineNoveltyWithBaseScore(
        baseScore,
        rawNovelty,
        weights
      );

      return {
        item,
        baseScore,
        rawNoveltyScore: rawNovelty,
        gatedNoveltyScore,
        finalScore,
      };
    });

    return scoredList;
  }
}
