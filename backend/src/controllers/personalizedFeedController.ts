import { Request, Response } from 'express';
import { PersonalizedFeedService } from '../services/personalizedFeedService.js';
import { controllerWrapper, ensureAuth } from '../utils/controllerHelpers.js';

export const getPersonalizedFeed = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const feed = await PersonalizedFeedService.getPersonalizedFeed(user._id.toString());

  res.status(200).json({
    success: true,
    data: feed,
  });
});
