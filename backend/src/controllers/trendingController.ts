import { Request, Response } from 'express';
import { TrendingService } from '../services/trendingService.js';
import { controllerWrapper } from '../utils/controllerHelpers.js';
import { extractQueryParams } from '../utils/validators.js';

export const getTrendingSongs = controllerWrapper(async (req: Request, res: Response) => {
  const q = extractQueryParams(req, { limit: 'int', window: 'int' });

  const limit = isNaN(q.limit) ? 10 : q.limit;
  const windowHours = isNaN(q.window) ? 168 : q.window;

  const songs = await TrendingService.getTrendingSongs(limit, windowHours);

  res.status(200).json({
    success: true,
    data: songs,
  });
});
