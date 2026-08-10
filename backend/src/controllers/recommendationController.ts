import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { ContentRecommendationService } from '../services/recommendationService.js';

export const getSimilarSongs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { songId } = req.params;

    if (!songId || !Types.ObjectId.isValid(songId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid song ID format',
      });
      return;
    }

    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 10;
    const parsedLimit = isNaN(limit) || limit < 1 ? 10 : limit;

    // Enable debugging only when debug=true query parameter is passed AND not in production
    const isDebugMode =
      req.query.debug === 'true' && process.env.NODE_ENV !== 'production';

    const recommendations = await ContentRecommendationService.getRecommendationsForSong(
      songId,
      parsedLimit,
      isDebugMode
    );

    res.status(200).json({
      success: true,
      data: recommendations,
      ...(isDebugMode ? { debug: { isDebugEnabled: true, evaluatedCandidates: recommendations.length } } : {}),
    });
  } catch (error: any) {
    if (error.message === 'Seed song not found' || error.message === 'Song not found') {
      res.status(404).json({
        success: false,
        message: 'Seed song not found',
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch similar song recommendations',
    });
  }
};
