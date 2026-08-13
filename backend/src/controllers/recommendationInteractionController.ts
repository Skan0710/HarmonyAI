import { Request, Response } from 'express';
import { RecommendationInteractionTrackingService } from '../services/recommendationInteractionTrackingService.js';

export const trackInteraction = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { songId, action, recommendationSource = 'hybrid' } = req.body;

    if (!songId || !action) {
      res.status(400).json({ success: false, message: 'songId and action are required' });
      return;
    }

    const record = await RecommendationInteractionTrackingService.recordInteraction({
      userId: req.user._id.toString(),
      songId,
      action,
      recommendationSource,
    });

    res.status(201).json({ success: true, data: record });
  } catch (error: any) {
    // Non-blocking error response
    res.status(200).json({
      success: false,
      message: error.message || 'Tracking ignored safely',
    });
  }
};

export const submitFeedback = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { songId, feedback, recommendationSource = 'hybrid' } = req.body;

    if (!songId || !['thumbs_up', 'thumbs_down'].includes(feedback)) {
      res.status(400).json({
        success: false,
        message: 'songId and valid feedback (thumbs_up or thumbs_down) are required',
      });
      return;
    }

    const record = await RecommendationInteractionTrackingService.recordFeedback(
      req.user._id.toString(),
      songId,
      feedback,
      recommendationSource
    );

    res.status(200).json({
      success: true,
      message: 'Feedback recorded successfully',
      data: record,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to submit recommendation feedback',
    });
  }
};

export const getUserFeedback = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
    const parsedLimit = isNaN(limit) || limit < 1 ? 50 : limit;

    const feedbackList = await RecommendationInteractionTrackingService.getUserRecommendationFeedback(
      req.user._id.toString(),
      parsedLimit
    );

    res.status(200).json({
      success: true,
      data: feedbackList || [],
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve recommendation feedback',
    });
  }
};

export const trackBulkImpressions = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { songIds, recommendationSource = 'hybrid' } = req.body;

    if (!Array.isArray(songIds) || songIds.length === 0) {
      res.status(400).json({ success: false, message: 'songIds array required' });
      return;
    }

    const count = await RecommendationInteractionTrackingService.recordBulkImpressions(
      req.user._id.toString(),
      songIds,
      recommendationSource
    );

    res.status(201).json({ success: true, count });
  } catch (error: any) {
    // Non-blocking error response
    res.status(200).json({
      success: false,
      message: error.message || 'Tracking ignored safely',
    });
  }
};
