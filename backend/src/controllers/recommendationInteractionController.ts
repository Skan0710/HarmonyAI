import { Request, Response } from 'express';
import { RecommendationInteractionTrackingService } from '../services/recommendationInteractionTrackingService.js';
import { controllerWrapper, ensureAuth, ControllerError } from '../utils/controllerHelpers.js';
import { extractQueryParams } from '../utils/validators.js';

export const trackInteraction = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const { songId, action, recommendationSource = 'hybrid' } = req.body;

  if (!songId || !action) {
    throw new ControllerError(400, 'songId and action are required');
  }

  const record = await RecommendationInteractionTrackingService.recordInteraction({
    userId: user._id.toString(),
    songId,
    action,
    recommendationSource,
  });

  res.status(201).json({ success: true, data: record });
});

export const submitFeedback = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const { songId, feedback, recommendationSource = 'hybrid' } = req.body;

  if (!songId || !['thumbs_up', 'thumbs_down'].includes(feedback)) {
    throw new ControllerError(400, 'songId and valid feedback (thumbs_up or thumbs_down) are required');
  }

  const record = await RecommendationInteractionTrackingService.recordFeedback(
    user._id.toString(),
    songId,
    feedback,
    recommendationSource
  );

  res.status(200).json({
    success: true,
    message: 'Feedback recorded successfully',
    data: record,
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
    data: feedbackList || [],
  });
});

export const trackBulkImpressions = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const { songIds, recommendationSource = 'hybrid' } = req.body;

  if (!Array.isArray(songIds) || songIds.length === 0) {
    throw new ControllerError(400, 'songIds array required');
  }

  const count = await RecommendationInteractionTrackingService.recordBulkImpressions(
    user._id.toString(),
    songIds,
    recommendationSource
  );

  res.status(201).json({ success: true, count });
});
