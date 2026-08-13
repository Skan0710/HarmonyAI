import { Types } from 'mongoose';
import {
  RecommendationInteraction,
  IRecommendationInteraction,
  RecommendationActionType,
  RecommendationSourceType,
} from '../models/RecommendationInteraction.js';

export interface RecordInteractionParams {
  userId: string;
  songId: string;
  action: RecommendationActionType;
  recommendationSource?: RecommendationSourceType;
}

export class RecommendationInteractionTrackingService {
  /**
   * Records a recommendation interaction event (impression, click, play, like, skip)
   * in a dedicated interaction model, completely separate from listening history logs.
   */
  static async recordInteraction(
    params: RecordInteractionParams
  ): Promise<IRecommendationInteraction> {
    const { userId, songId, action, recommendationSource = 'hybrid' } = params;

    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }
    if (!Types.ObjectId.isValid(songId)) {
      throw new Error('Invalid song ID');
    }

    const validActions: RecommendationActionType[] = ['impression', 'click', 'play', 'like', 'skip'];
    if (!validActions.includes(action)) {
      throw new Error(`Invalid interaction action: ${action}`);
    }

    const interaction = new RecommendationInteraction({
      user: new Types.ObjectId(userId),
      song: new Types.ObjectId(songId),
      action,
      recommendationSource,
      timestamp: new Date(),
    });

    return await interaction.save();
  }

  /**
   * Records multiple recommendation impressions in bulk (e.g. when a carousel of recommendations is displayed).
   */
  static async recordBulkImpressions(
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
        action: 'impression' as RecommendationActionType,
        recommendationSource,
        timestamp: new Date(),
      }));

    if (validDocs.length === 0) return 0;

    const result = await RecommendationInteraction.insertMany(validDocs);
    return result.length;
  }

  /**
   * Retrieves recorded recommendation interactions for a specific user.
   */
  static async getUserRecommendationInteractions(
    userId: string,
    limit = 50,
    actionFilter?: RecommendationActionType
  ): Promise<IRecommendationInteraction[]> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }

    const query: any = { user: new Types.ObjectId(userId) };
    if (actionFilter) {
      query.action = actionFilter;
    }

    return await RecommendationInteraction.find(query)
      .populate('song', 'title artist coverImage')
      .sort({ timestamp: -1 })
      .limit(Math.max(1, limit))
      .lean() as any;
  }
}
