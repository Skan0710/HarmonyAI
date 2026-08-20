import { Types } from 'mongoose';
import { RecommendationInteraction } from '../models/RecommendationInteraction.js';
import { ListeningHistory } from '../models/ListeningHistory.js';
import {
  RecommendationRepetitionConfig,
  getRepetitionConfig,
} from '../config/recommendationConfig.js';

export interface RecentRecommendationRecord {
  songId: string;
  timestamp: Date;
  count: number;
}

export interface RepetitionControlOptions<T = any> {
  items: T[];
  recentlyRecommended?: Map<string, RecentRecommendationRecord>;
  recentlySkipped?: Set<string>;
  targetLimit?: number;
  scoreExtractor?: (item: T) => number;
  songIdExtractor?: (item: T) => string;
  config?: Partial<RecommendationRepetitionConfig>;
}

export interface RepetitionControlItem<T = any> {
  item: T;
  songId: string;
  baseScore: number;
  adjustedScore: number;
  isRecentlyRecommended: boolean;
  isRecentlySkipped: boolean;
  isReappearanceAllowed: boolean;
  penaltyApplied: number;
}

export class RecommendationHistoryService {
  /**
   * Records recommendation impression events to track recently recommended songs per user.
   */
  static async recordRecommendationImpressions(
    userId: string,
    songIds: string[],
    recommendationSource = 'hybrid'
  ): Promise<number> {
    if (!Types.ObjectId.isValid(userId) || !Array.isArray(songIds) || songIds.length === 0) {
      return 0;
    }

    const userObjId = new Types.ObjectId(userId);
    const validDocs = songIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => ({
        user: userObjId,
        song: new Types.ObjectId(id),
        action: 'impression' as const,
        recommendationSource,
        timestamp: new Date(),
      }));

    if (validDocs.length === 0) return 0;

    const res = await RecommendationInteraction.insertMany(validDocs);
    return res.length;
  }

  /**
   * Retrieves songs recommended to the user within the specified cooldown time window.
   */
  static async getRecentlyRecommendedMap(
    userId: string,
    windowHours?: number
  ): Promise<Map<string, RecentRecommendationRecord>> {
    const recommendedMap = new Map<string, RecentRecommendationRecord>();
    if (!Types.ObjectId.isValid(userId)) {
      return recommendedMap;
    }

    const config = getRepetitionConfig();
    const hours = windowHours || config.cooldownWindowHours;
    const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000);

    const interactions = await RecommendationInteraction.find({
      user: new Types.ObjectId(userId),
      action: { $in: ['impression', 'click', 'play'] },
      timestamp: { $gte: cutoffDate },
    })
      .sort({ timestamp: -1 })
      .limit(config.maxRecentHistoryLookback)
      .lean();

    for (const record of interactions) {
      const sId = record.song.toString();
      const existing = recommendedMap.get(sId);
      if (!existing) {
        recommendedMap.set(sId, {
          songId: sId,
          timestamp: record.timestamp,
          count: 1,
        });
      } else {
        existing.count += 1;
      }
    }

    return recommendedMap;
  }

  /**
   * Retrieves songs recently skipped by the user within the skipped cooldown window.
   * Queries both RecommendationInteractions and ListeningHistory to ensure complete coverage.
   */
  static async getRecentlySkippedSongIds(
    userId: string,
    windowHours?: number
  ): Promise<Set<string>> {
    const skippedSet = new Set<string>();
    if (!Types.ObjectId.isValid(userId)) {
      return skippedSet;
    }

    const config = getRepetitionConfig();
    const hours = windowHours || config.skippedCooldownWindowHours;
    const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000);

    const userObjId = new Types.ObjectId(userId);

    // 1. Check recommendation skips
    const recSkips = await RecommendationInteraction.find({
      user: userObjId,
      action: 'skip',
      timestamp: { $gte: cutoffDate },
    })
      .select('song')
      .lean();

    recSkips.forEach((r) => skippedSet.add(r.song.toString()));

    // 2. Check listening history skips (preserves existing history functionality)
    const historySkips = await ListeningHistory.find({
      user: userObjId,
      skipped: true,
      playedAt: { $gte: cutoffDate },
    })
      .select('song')
      .lean();

    historySkips.forEach((h) => skippedSet.add(h.song.toString()));

    return skippedSet;
  }

  /**
   * Reusable post-ranking repetition control:
   * - Avoids repeatedly showing the same songs within the cooldown window.
   * - Avoids recommending recently skipped songs.
   * - Allows highly relevant songs to reappear after cooldown or when relevance >= threshold.
   * - Normalizes and preserves ranked quality.
   */
  static applyRepetitionControl<T = any>(
    options: RepetitionControlOptions<T>
  ): RepetitionControlItem<T>[] {
    const {
      items,
      recentlyRecommended = new Map(),
      recentlySkipped = new Set(),
      targetLimit = items?.length || 10,
      scoreExtractor = (it: any) => (typeof it.finalScore === 'number' ? it.finalScore : it.score || it.hybridScore || 0),
      songIdExtractor = (it: any) => (it.songId ?? it.song?._id?.toString() ?? it._id?.toString() ?? ''),
      config: customConfig,
    } = options;

    if (!Array.isArray(items) || items.length === 0) {
      return [];
    }

    const config: RecommendationRepetitionConfig = {
      ...getRepetitionConfig(),
      ...customConfig,
    };

    const safeLimit = Math.max(1, targetLimit);

    const evaluated: RepetitionControlItem<T>[] = items.map((item) => {
      const songId = songIdExtractor(item);
      const baseScore = scoreExtractor(item);

      const isSkipped = recentlySkipped.has(songId);
      const recRecord = recentlyRecommended.get(songId);
      const isRecentlyShown = !!recRecord;

      let penalty = 0;
      let isReappearanceAllowed = false;

      // Rule 1: Recently Skipped Tracks Penalty (heavy suppression)
      if (isSkipped) {
        penalty += 0.80;
      }

      // Rule 2: Cooldown Window Repetition Penalty
      if (isRecentlyShown) {
        // High relevance tracks can reappear with a very mild soft penalty
        if (baseScore >= config.reappearanceRelevanceThreshold) {
          isReappearanceAllowed = true;
          penalty += config.repetitionPenalty * 0.20; // 80% penalty discount for high-relevance reappearance
        } else {
          penalty += config.repetitionPenalty * (recRecord ? Math.min(2.0, 1.0 + (recRecord.count - 1) * 0.5) : 1.0);
        }
      }

      const adjustedScore = Number(Math.max(0, Math.min(1, baseScore - penalty)).toFixed(4));

      return {
        item,
        songId,
        baseScore,
        adjustedScore,
        isRecentlyRecommended: isRecentlyShown,
        isRecentlySkipped: isSkipped,
        isReappearanceAllowed,
        penaltyApplied: Number(penalty.toFixed(4)),
      };
    });

    // Sort descending by adjusted score
    evaluated.sort((a, b) => b.adjustedScore - a.adjustedScore);

    return evaluated.slice(0, safeLimit);
  }
}
