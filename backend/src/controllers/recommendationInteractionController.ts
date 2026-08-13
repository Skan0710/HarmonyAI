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
