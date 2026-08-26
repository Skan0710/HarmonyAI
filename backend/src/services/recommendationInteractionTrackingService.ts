import { Types } from 'mongoose';
import {
  RecommendationInteraction,
  IRecommendationInteraction,
  RecommendationActionType,
  RecommendationSourceType,
  ExplanationFeedbackType,
} from '../models/RecommendationInteraction.js';

export interface RecordInteractionParams {
  userId: string;
  songId: string;
  action: RecommendationActionType;
  recommendationSource?: RecommendationSourceType;
  explanationFeedback?: ExplanationFeedbackType | string;
  metadata?: Record<string, any>;
}

export interface RecordExplanationFeedbackParams {
  userId: string;
  songId: string;
  feedback: ExplanationFeedbackType | string;
  recommendationSource?: RecommendationSourceType;
  explanationContext?: Record<string, any>;
}

export class RecommendationInteractionTrackingService {
  /**
   * Records a recommendation interaction event (impression, click, play, like, skip, thumbs_up, thumbs_down, explanation_feedback).
   */
  static async recordInteraction(
    params: RecordInteractionParams
  ): Promise<IRecommendationInteraction> {
    const { userId, songId, action, recommendationSource = 'hybrid', explanationFeedback, metadata } = params;

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
      'explanation_feedback',
    ];
    if (!validActions.includes(action)) {
      throw new Error(`Invalid interaction action: ${action}`);
    }

    const interaction = new RecommendationInteraction({
      user: new Types.ObjectId(userId),
      song: new Types.ObjectId(songId),
      action,
      explanationFeedback,
      metadata: metadata || {},
      recommendationSource,
      timestamp: new Date(),
    });

    return await interaction.save();
  }

  /**
   * Records specific explanation feedback ('helpful', 'not_relevant', 'too_similar', 'not_my_style', 'thumbs_up', 'thumbs_down').
   * Prevents duplicate feedback and stores rich contextual metadata for future Music DNA learning.
   */
  static async recordExplanationFeedback(
    params: RecordExplanationFeedbackParams
  ): Promise<IRecommendationInteraction> {
    const { userId, songId, feedback, recommendationSource = 'hybrid', explanationContext = {} } = params;

    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }
    if (!Types.ObjectId.isValid(songId)) {
      throw new Error('Invalid song ID');
    }

    const validFeedbackTypes: string[] = [
      'helpful',
      'not_relevant',
      'too_similar',
      'not_my_style',
      'thumbs_up',
      'thumbs_down',
    ];

    if (!validFeedbackTypes.includes(feedback)) {
      throw new Error(`Invalid explanation feedback: ${feedback}`);
    }

    const userObjId = new Types.ObjectId(userId);
    const songObjId = new Types.ObjectId(songId);

    // 1. Remove previous explanation feedback for this song by this user to avoid stale duplicates
    await RecommendationInteraction.deleteMany({
      user: userObjId,
      song: songObjId,
      action: 'explanation_feedback',
    });

    // 2. Map high-level thumbs actions if user supplied legacy feedback
    let actionType: RecommendationActionType = 'explanation_feedback';
    if (feedback === 'thumbs_up' || feedback === 'thumbs_down') {
      actionType = feedback;
    }

    // 3. Save new explanation feedback interaction with extensible metadata
    const interaction = new RecommendationInteraction({
      user: userObjId,
      song: songObjId,
      action: actionType,
      explanationFeedback: feedback,
      recommendationSource,
      metadata: {
        ...explanationContext,
        feedbackRecordedAt: new Date(),
      },
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
      explanationFeedback: feedback,
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
      return [];
    }

    const query: Record<string, any> = {
      user: new Types.ObjectId(userId),
    };

    if (actionFilter) {
      query.action = actionFilter;
    }

    return await RecommendationInteraction.find(query)
      .sort({ timestamp: -1 })
      .limit(Math.min(200, Math.max(1, limit)))
      .populate('song', 'title artist genre coverImage duration audioUrl audioFeatures mood playCount')
      .lean();
  }

  /**
   * Retrieves user feedback history (thumbs_up, thumbs_down, explanation_feedback) for a user.
   */
  static async getUserRecommendationFeedback(
    userId: string,
    limit = 50
  ): Promise<IRecommendationInteraction[]> {
    if (!Types.ObjectId.isValid(userId)) {
      return [];
    }

    return await RecommendationInteraction.find({
      user: new Types.ObjectId(userId),
      action: { $in: ['thumbs_up', 'thumbs_down', 'explanation_feedback'] },
    })
      .sort({ timestamp: -1 })
      .limit(Math.min(200, Math.max(1, limit)))
      .populate('song', 'title artist genre coverImage duration audioUrl')
      .lean();
  }
}
