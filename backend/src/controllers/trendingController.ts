import { Request, Response } from 'express';
import { TrendingService } from '../services/trendingService.js';

export const getTrendingSongs = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 10;
    const windowHours = req.query.window ? parseInt(String(req.query.window), 10) : 168;

    const songs = await TrendingService.getTrendingSongs(
      isNaN(limit) ? 10 : limit,
      isNaN(windowHours) ? 168 : windowHours
    );

    res.status(200).json({
      success: true,
      data: songs,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch trending songs',
    });
  }
};
