import { Request, Response } from 'express';
import { RecommendationInteractionTrackingService } from '../services/recommendationInteractionTrackingService.js';
import { RecommendationFeedbackLearningService } from '../services/recommendationFeedbackLearningService.js';
import { controllerWrapper, ensureAuth, ControllerError } from '../utils/controllerHelpers.js';
import { extractQueryParams, isValidObjectId } from '../utils/validators.js';

export const trackInteraction = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const { songId, action, recommendationSource = 'hybrid', metadata, listeningDurationSeconds, completionRate } = req.body;

  if (!songId || !action) {
    throw new ControllerError(400, 'songId and action are required');
  }

  if (!isValidObjectId(songId)) {
    throw new ControllerError(400, 'Invalid songId format');
  }

  const record = await RecommendationInteractionTrackingService.recordInteraction({
    userId: user._id.toString(),
    songId,
    action,
    recommendationSource,
    metadata,
  });

  // Trigger recommendation feedback learning loop
  RecommendationFeedbackLearningService.processFeedbackEvent({
    userId: user._id.toString(),
    songId,
    action,
    recommendationSource,
    listeningDurationSeconds,
    completionRate,
    metadata,
  }).catch(() => {
    // Non-blocking safe catch
  });

  res.status(201).json({ success: true, data: record });
});

export const submitFeedback = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const {
    songId,
    feedback,
    recommendationSource = 'hybrid',
    explanationContext,
  } = req.body;

  const validFeedback = [
    'helpful',
    'not_relevant',
    'too_similar',
    'not_my_style',
    'thumbs_up',
    'thumbs_down',
  ];

  if (!songId || !feedback || !validFeedback.includes(feedback)) {
    throw new ControllerError(
      400,
      'songId and valid feedback (helpful, not_relevant, too_similar, not_my_style, thumbs_up, thumbs_down) are required'
    );
  }

  if (!isValidObjectId(songId)) {
    throw new ControllerError(400, 'Invalid songId format');
  }

  const record = await RecommendationInteractionTrackingService.recordExplanationFeedback({
    userId: user._id.toString(),
    songId,
    feedback,
    recommendationSource,
    explanationContext,
  });

  // Trigger feedback learning loop
  RecommendationFeedbackLearningService.processFeedbackEvent({
    userId: user._id.toString(),
    songId,
    action: feedback === 'thumbs_up' || feedback === 'helpful' ? 'like' : feedback === 'thumbs_down' ? 'skip' : feedback,
    recommendationSource,
    metadata: explanationContext,
  }).catch(() => {
    // Non-blocking safe catch
  });

  res.status(200).json({
    success: true,
    message: 'Feedback recorded successfully',
    data: record,
  });
});

export const submitExplanationFeedback = submitFeedback;

export const processFeedbackLoop = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const {
    songId,
    action,
    recommendationSource = 'hybrid',
    listeningDurationSeconds,
    completionRate,
    metadata,
  } = req.body;

  if (!songId || !action) {
    throw new ControllerError(400, 'songId and action are required');
  }

  if (!isValidObjectId(songId)) {
    throw new ControllerError(400, 'Invalid songId format');
  }

  const result = await RecommendationFeedbackLearningService.processFeedbackEvent({
    userId: user._id.toString(),
    songId,
    action,
    recommendationSource,
    listeningDurationSeconds,
    completionRate,
    metadata,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const getUserFeedback = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const q = extractQueryParams(req, { limit: 'int' });
  const parsedLimit = isNaN(q.limit) || q.limit < 1 ? 50 : q.limit;

  const feedbackList = await RecommendationInteractionTrackingService.getUserRecommendationFeedback(
    user._id.toString(),
    parsedLimit
  );

  res.status(200).json({
    success: true,
    count: feedbackList.length,
    data: feedbackList,
  });
});

export const trackBulkImpressions = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const { songIds, recommendationSource = 'hybrid' } = req.body;

  if (!Array.isArray(songIds) || songIds.length === 0) {
    throw new ControllerError(400, 'songIds array is required');
  }

  const count = await RecommendationInteractionTrackingService.recordBulkImpressions(
    user._id.toString(),
    songIds,
    recommendationSource
  );

  res.status(201).json({
    success: true,
    message: `Recorded ${count} impressions`,
    count,
  });
});
