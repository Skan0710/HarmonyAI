import { supabase } from '../config/supabase.js';
import { isValidObjectId } from '../utils/validators.js';

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
   * @param userId Target user id
   * @param customWeights Optional custom interaction weight overrides
   */
  static async getUserWeightedInteractions(
    userId: string,
    customWeights?: Partial<InteractionWeights>
  ): Promise<Map<string, SongInteractionScore>> {
    if (!isValidObjectId(userId)) {
      throw new Error('Invalid user ID');
    }

    const activeWeights = { ...this.weights, ...customWeights };

    // 1. Fetch User Liked Songs
    const { data: likedRows } = await supabase
      .from('user_liked_songs')
      .select('song_id')
      .eq('user_id', userId);
    const likedSongIds = new Set<string>((likedRows || []).map((r: any) => r.song_id));

    // 2. Fetch User Listening History Records
    const { data: historyRecords } = await supabase
      .from('listening_history')
      .select('song_id, played_at, completed, skipped, progress_percent')
      .eq('user_id', userId)
      .order('played_at', { ascending: false });

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
    for (const record of historyRecords || []) {
      if (!record.song_id) continue;
      const songId = record.song_id;
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
      } else if (
        record.completed !== false &&
        (record.progress_percent === undefined || record.progress_percent === null || record.progress_percent >= 80)
      ) {
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
