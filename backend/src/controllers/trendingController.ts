import { Request, Response } from 'express';
import { TrendingService } from '../services/trendingService.js';
import { controllerWrapper } from '../utils/controllerHelpers.js';
import { extractQueryParams, clampLimit } from '../utils/validators.js';

export const getTrendingSongs = controllerWrapper(async (req: Request, res: Response) => {
  const q = extractQueryParams(req, { limit: 'int', window: 'int' });

  const limit = clampLimit(q.limit, 10);
  const windowHours = clampLimit(q.window, 168, 2160); // cap at 90 days

  const songs = await TrendingService.getTrendingSongs(limit, windowHours);

  res.status(200).json({
    success: true,
    data: songs,
  });
});
