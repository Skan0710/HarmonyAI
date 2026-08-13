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
   * Records a recommendation interaction event (impression, click, play, like, skip, thumbs_up, thumbs_down).
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

    const validActions: RecommendationActionType[] = [
      'impression',
      'click',
      'play',
      'like',
      'skip',
      'thumbs_up',
      'thumbs_down',
    ];
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
   * Records user feedback (thumbs_up or thumbs_down) for a recommended song.
   * Prevents duplicate feedback for the same recommendation event by checking existing feedback records.
   */
  static async recordFeedback(
    userId: string,
    songId: string,
    feedback: 'thumbs_up' | 'thumbs_down',
    recommendationSource = 'hybrid'
  ): Promise<IRecommendationInteraction> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }
    if (!Types.ObjectId.isValid(songId)) {
      throw new Error('Invalid song ID');
    }

    const userObjId = new Types.ObjectId(userId);
    const songObjId = new Types.ObjectId(songId);

    // 1. Check if identical feedback action already exists to prevent duplicates
    const existingFeedback = await RecommendationInteraction.findOne({
      user: userObjId,
      song: songObjId,
      action: feedback,
    }).sort({ timestamp: -1 });

    if (existingFeedback) {
      return existingFeedback;
    }

    // 2. Remove opposite feedback if user toggled (e.g. thumbs_down to thumbs_up)
    const oppositeAction = feedback === 'thumbs_up' ? 'thumbs_down' : 'thumbs_up';
    await RecommendationInteraction.deleteMany({
      user: userObjId,
      song: songObjId,
      action: oppositeAction,
    });

    // 3. Save new feedback interaction
    return await this.recordInteraction({
      userId,
      songId,
      action: feedback,
      recommendationSource,
    });
  }

  /**
   * Records multiple recommendation impressions in bulk.
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

    return (await RecommendationInteraction.find(query)
      .populate('song', 'title artist coverImage genre releaseYear playCount')
      .sort({ timestamp: -1 })
      .limit(Math.max(1, limit))
      .lean()) as any;
  }

  /**
   * Retrieves all recommendation feedback (thumbs_up and thumbs_down) for a specific user.
   */
  static async getUserRecommendationFeedback(
    userId: string,
    limit = 50
  ): Promise<IRecommendationInteraction[]> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }

    return (await RecommendationInteraction.find({
      user: new Types.ObjectId(userId),
      action: { $in: ['thumbs_up', 'thumbs_down'] },
    })
      .populate('song', 'title artist coverImage genre releaseYear playCount')
      .sort({ timestamp: -1 })
      .limit(Math.max(1, limit))
      .lean()) as any;
  }
}
