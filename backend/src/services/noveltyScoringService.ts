import { Types } from 'mongoose';
import {
  NoveltyScoringWeights,
  getNoveltyConfigWeights,
} from '../config/recommendationConfig.js';
import { ListeningHistory } from '../models/ListeningHistory.js';
import { RecommendationInteraction } from '../models/RecommendationInteraction.js';
import { HybridRankedResult } from './hybridRankingPipeline.js';

export type UserFamiliarityCategory =
  | 'COMPLETELY_UNFAMILIAR'
  | 'RARELY_HEARD'
  | 'PREVIOUSLY_HEARD'
  | 'FREQUENTLY_HEARD';

export interface UserFamiliarityProfile {
  userId: string;
  songEncounterCounts: Map<string, number>;
  songCategories: Map<string, UserFamiliarityCategory>;
  frequentlyHeardSongIds: Set<string>;
  previouslyHeardSongIds: Set<string>;
  rarelyHeardSongIds: Set<string>;
  totalHistoryCount: number;
}

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
   * Classifies a song's familiarity for a user based on exposure/play count:
   * - COMPLETELY_UNFAMILIAR: 0 plays/encounters
   * - RARELY_HEARD: 1 to 2 plays/encounters
   * - PREVIOUSLY_HEARD: 3 to 5 plays/encounters
   * - FREQUENTLY_HEARD: > 5 plays/encounters
   */
  static classifyUserFamiliarity(playCount = 0): UserFamiliarityCategory {
    if (playCount <= 0) {
      return 'COMPLETELY_UNFAMILIAR';
    }
    if (playCount <= 2) {
      return 'RARELY_HEARD';
    }
    if (playCount <= 5) {
      return 'PREVIOUSLY_HEARD';
    }
    return 'FREQUENTLY_HEARD';
  }

  /**
   * Returns a baseline familiarity score for each category.
   * Completely unfamiliar yields 1.0; frequently heard yields 0.10.
   */
  static getFamiliarityScoreForCategory(category: UserFamiliarityCategory): number {
    switch (category) {
      case 'COMPLETELY_UNFAMILIAR':
        return 1.0;
      case 'RARELY_HEARD':
        return 0.75;
      case 'PREVIOUSLY_HEARD':
        return 0.40;
      case 'FREQUENTLY_HEARD':
      default:
        return 0.10;
    }
  }

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
   * Frequently consumed songs have lower novelty, unfamiliar songs have higher novelty.
   */
  static calculateUserExposureNovelty(
    userPlayCount = 0,
    decayFactor = 0.20
  ): number {
    const clampedCount = Math.max(0, userPlayCount);
    const category = this.classifyUserFamiliarity(clampedCount);

    switch (category) {
      case 'COMPLETELY_UNFAMILIAR':
        return 1.0;
      case 'RARELY_HEARD':
        return Number(Math.max(0.60, 1.0 - clampedCount * decayFactor).toFixed(4));
      case 'PREVIOUSLY_HEARD':
        return Number(Math.max(0.20, 1.0 - clampedCount * decayFactor).toFixed(4));
      case 'FREQUENTLY_HEARD':
      default:
        return Number(Math.max(0.05, 1.0 - clampedCount * decayFactor).toFixed(4));
    }
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
   * Aggregates user listening history and recommendation interaction data
   * to build a comprehensive user familiarity profile.
   */
  static async buildUserFamiliarityProfile(userId: string): Promise<UserFamiliarityProfile> {
    const encounterCounts = new Map<string, number>();
    let totalCount = 0;

    if (!userId || !Types.ObjectId.isValid(userId)) {
      return {
        userId: userId || '',
        songEncounterCounts: encounterCounts,
        songCategories: new Map(),
        frequentlyHeardSongIds: new Set(),
        previouslyHeardSongIds: new Set(),
        rarelyHeardSongIds: new Set(),
        totalHistoryCount: 0,
      };
    }

    try {
      // 1. Query listening history
      const historyRecords = await ListeningHistory.find({ user: userId })
        .select('song completed skipped progressPercent')
        .lean()
        .exec();

      for (const record of historyRecords) {
        if (!record.song) continue;
        const songId = record.song.toString();
        const current = encounterCounts.get(songId) || 0;
        encounterCounts.set(songId, current + 1);
        totalCount++;
      }

      // 2. Query recommendation interaction data
      const interactions = await RecommendationInteraction.find({ user: userId })
        .select('song action')
        .lean()
        .exec();

      for (const inter of interactions) {
        if (!inter.song) continue;
        const songId = inter.song.toString();
        const current = encounterCounts.get(songId) || 0;
        const weight = inter.action === 'play' || inter.action === 'like' ? 1 : 0.5;
        encounterCounts.set(songId, current + weight);
      }
    } catch {
      // Safe fallback on database query failure
    }

    const songCategories = new Map<string, UserFamiliarityCategory>();
    const frequentlyHeardSongIds = new Set<string>();
    const previouslyHeardSongIds = new Set<string>();
    const rarelyHeardSongIds = new Set<string>();

    for (const [songId, count] of encounterCounts.entries()) {
      const category = this.classifyUserFamiliarity(count);
      songCategories.set(songId, category);
      if (category === 'FREQUENTLY_HEARD') {
        frequentlyHeardSongIds.add(songId);
      } else if (category === 'PREVIOUSLY_HEARD') {
        previouslyHeardSongIds.add(songId);
      } else if (category === 'RARELY_HEARD') {
        rarelyHeardSongIds.add(songId);
      }
    }

    return {
      userId,
      songEncounterCounts: encounterCounts,
      songCategories,
      frequentlyHeardSongIds,
      previouslyHeardSongIds,
      rarelyHeardSongIds,
      totalHistoryCount: totalCount,
    };
  }

  /**
   * Applies novelty scoring to a list of HybridRankedResult candidates:
   * - Evaluates familiarity category (unfamiliar, rarely, previously, frequently)
   * - Gates novelty boost by base relevance to prevent irrelevant obscure items from being pushed
   * - Re-ranks results by final score
   */
  static applyNoveltyScoringToRankedResults(
    rankedResults: HybridRankedResult[],
    userProfile?: UserFamiliarityProfile | {
      songEncounterCounts?: Map<string, number>;
      songCategories?: Map<string, UserFamiliarityCategory>;
    } | null,
    customWeights?: Partial<NoveltyScoringWeights>
  ): {
    results: HybridRankedResult[];
    diagnostics: {
      totalCandidates: number;
      completelyUnfamiliarCount: number;
      rarelyHeardCount: number;
      previouslyHeardCount: number;
      frequentlyHeardCount: number;
      averageNoveltyScore: number;
      noveltyWeightUsed: number;
    };
  } {
    if (!Array.isArray(rankedResults) || rankedResults.length === 0) {
      return {
        results: [],
        diagnostics: {
          totalCandidates: 0,
          completelyUnfamiliarCount: 0,
          rarelyHeardCount: 0,
          previouslyHeardCount: 0,
          frequentlyHeardCount: 0,
          averageNoveltyScore: 0,
          noveltyWeightUsed: 0,
        },
      };
    }

    const weights: NoveltyScoringWeights = {
      ...getNoveltyConfigWeights(),
      ...customWeights,
    };

    let completelyUnfamiliarCount = 0;
    let rarelyHeardCount = 0;
    let previouslyHeardCount = 0;
    let frequentlyHeardCount = 0;
    let totalNovelty = 0;

    const scoredResults: HybridRankedResult[] = rankedResults.map((candidate) => {
      const songId =
        candidate.song?._id?.toString() ||
        candidate.song?.id?.toString() ||
        candidate.song?.songId ||
        '';

      const userPlayCount = userProfile?.songEncounterCounts?.get(songId) || 0;
      const category =
        userProfile?.songCategories?.get(songId) ||
        this.classifyUserFamiliarity(userPlayCount);

      switch (category) {
        case 'COMPLETELY_UNFAMILIAR':
          completelyUnfamiliarCount++;
          break;
        case 'RARELY_HEARD':
          rarelyHeardCount++;
          break;
        case 'PREVIOUSLY_HEARD':
          previouslyHeardCount++;
          break;
        case 'FREQUENTLY_HEARD':
          frequentlyHeardCount++;
          break;
      }

      const catalogPlayCount = candidate.song?.playCount || 0;
      const rawNovelty = this.computeCompositeNovelty({
        catalogPlayCount,
        userPlayCount,
        weights,
      });
      totalNovelty += rawNovelty;

      const baseScore = candidate.finalScore ?? candidate.hybridScore;
      const { finalScore, gatedNoveltyScore } = this.combineNoveltyWithBaseScore(
        baseScore,
        rawNovelty,
        weights
      );

      return {
        ...candidate,
        originalScore: candidate.originalScore ?? candidate.hybridScore,
        hybridScore: candidate.hybridScore,
        finalScore,
        componentScores: {
          ...candidate.componentScores,
          noveltyScore: rawNovelty,
        },
        metadata: {
          ...candidate.metadata,
          familiarityCategory: category,
          rawNoveltyScore: rawNovelty,
          gatedNoveltyScore,
          userEncounterCount: userPlayCount,
          noveltyBoostApplied: Number((finalScore - baseScore).toFixed(4)),
        },
      };
    });

    // Re-rank candidates by finalScore descending
    scoredResults.sort((a, b) => (b.finalScore ?? b.hybridScore) - (a.finalScore ?? a.hybridScore));

    const totalCandidates = scoredResults.length;
    const averageNoveltyScore = totalCandidates > 0 ? Number((totalNovelty / totalCandidates).toFixed(4)) : 0;

    return {
      results: scoredResults,
      diagnostics: {
        totalCandidates,
        completelyUnfamiliarCount,
        rarelyHeardCount,
        previouslyHeardCount,
        frequentlyHeardCount,
        averageNoveltyScore,
        noveltyWeightUsed: weights.noveltyWeight,
      },
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
