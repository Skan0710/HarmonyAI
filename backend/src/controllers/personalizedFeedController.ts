import { Request, Response } from 'express';
import { PersonalizedFeedService } from '../services/personalizedFeedService.js';

export const getPersonalizedFeed = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized access. Authentication token required.',
      });
      return;
    }

    const feed = await PersonalizedFeedService.getPersonalizedFeed(req.user._id.toString());

    res.status(200).json({
      success: true,
      data: feed,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate personalized Home feed',
    });
  }
};
