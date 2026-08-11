import { Types } from 'mongoose';
import { User } from '../models/User.js';
import { ListeningHistory } from '../models/ListeningHistory.js';

export interface InteractionWeights {
  LIKE: number; // 5
  COMPLETED_PLAYBACK: number; // 4
  PARTIAL_PLAYBACK: number; // 2
  REPEATED_PLAYBACK: number; // 3
  SKIP: number; // -2
}

export const DEFAULT_INTERACTION_WEIGHTS: InteractionWeights = {
  LIKE: 5,
  COMPLETED_PLAYBACK: 4,
  PARTIAL_PLAYBACK: 2,
  REPEATED_PLAYBACK: 3,
  SKIP: -2,
};

export interface SongInteractionScore {
  songId: string;
  weightedScore: number;
  playCount: number;
  isLiked: boolean;
  repeatCount: number;
  completedPlays: number;
  partialPlays: number;
  skips: number;
}

export class RecommendationInteractionService {
  private static weights: InteractionWeights = { ...DEFAULT_INTERACTION_WEIGHTS };

  /**
   * Retrieves current configurable interaction weights.
   */
  static getWeights(): InteractionWeights {
    return { ...this.weights };
  }

  /**
   * Updates global interaction weights in one central place.
   */
  static setWeights(newWeights: Partial<InteractionWeights>): InteractionWeights {
    this.weights = { ...this.weights, ...newWeights };
    return { ...this.weights };
  }

  /**
   * Resets interaction weights back to system defaults.
   */
  static resetWeights(): InteractionWeights {
    this.weights = { ...DEFAULT_INTERACTION_WEIGHTS };
    return { ...this.weights };
  }

  /**
   * Calculates the weighted interaction score for a single activity event.
   */
  static calculateSingleEventWeight(
    eventType: keyof InteractionWeights,
    customWeights?: Partial<InteractionWeights>
  ): number {
    const activeWeights = { ...this.weights, ...customWeights };
    return activeWeights[eventType] ?? 0;
  }

  /**
   * Aggregates user activity (liked songs and listening history) into weighted song interaction scores.
   * 
   * @param userId Target user ObjectId string
   * @param customWeights Optional custom interaction weight overrides
   */
  static async getUserWeightedInteractions(
    userId: string,
    customWeights?: Partial<InteractionWeights>
  ): Promise<Map<string, SongInteractionScore>> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }

    const userObjectId = new Types.ObjectId(userId);
    const activeWeights = { ...this.weights, ...customWeights };

    // 1. Fetch User Liked Songs
    const user = await User.findById(userObjectId).select('likedSongs').lean();
    const likedSongIds = new Set<string>((user?.likedSongs || []).map((id) => id.toString()));

    // 2. Fetch User Listening History Records
    const historyRecords = await ListeningHistory.find({ user: userObjectId })
      .select('song playedAt completed skipped progressPercent')
      .sort({ playedAt: -1 })
      .lean();

    const scoreMap = new Map<string, SongInteractionScore>();

    // Seed liked songs into interaction map
    for (const songId of likedSongIds) {
      scoreMap.set(songId, {
        songId,
        weightedScore: activeWeights.LIKE,
        playCount: 0,
        isLiked: true,
        repeatCount: 0,
        completedPlays: 0,
        partialPlays: 0,
        skips: 0,
      });
    }

    // Process listening history events
    for (const record of historyRecords) {
      if (!record.song) continue;
      const songId = record.song.toString();
      const isLiked = likedSongIds.has(songId);

      let item = scoreMap.get(songId);
      if (!item) {
        item = {
          songId,
          weightedScore: isLiked ? activeWeights.LIKE : 0,
          playCount: 0,
          isLiked,
          repeatCount: 0,
          completedPlays: 0,
          partialPlays: 0,
          skips: 0,
        };
        scoreMap.set(songId, item);
      }

      item.playCount += 1;

      if (record.skipped) {
        item.skips += 1;
        item.weightedScore += activeWeights.SKIP;
      } else if (record.completed !== false && (record.progressPercent === undefined || record.progressPercent >= 80)) {
        item.completedPlays += 1;
        item.weightedScore += activeWeights.COMPLETED_PLAYBACK;
      } else {
        item.partialPlays += 1;
        item.weightedScore += activeWeights.PARTIAL_PLAYBACK;
      }

      // Repeated playback bonus (plays beyond the first count)
      if (item.playCount > 1) {
        item.repeatCount = item.playCount - 1;
        item.weightedScore += activeWeights.REPEATED_PLAYBACK;
      }
    }

    return scoreMap;
  }

  /**
   * Returns a sorted array of user interacted songs ordered by weighted interaction score descending.
   */
  static async getUserTopInteractedSongs(
    userId: string,
    limit = 20,
    customWeights?: Partial<InteractionWeights>
  ): Promise<SongInteractionScore[]> {
    const scoreMap = await this.getUserWeightedInteractions(userId, customWeights);
    const sorted = Array.from(scoreMap.values()).sort((a, b) => b.weightedScore - a.weightedScore);
    return sorted.slice(0, Math.max(1, limit));
  }
}
