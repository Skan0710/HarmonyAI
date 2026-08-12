import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { ContentRecommendationService } from '../services/recommendationService.js';
import { CollaborativeFilteringService } from '../services/collaborativeFilteringService.js';
import { HybridRecommendationService } from '../services/hybridRecommendationService.js';

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

export const getCollaborativeRecommendations = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized access. Authentication token required.',
      });
      return;
    }

    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 10;
    const parsedLimit = isNaN(limit) || limit < 1 ? 10 : limit;

    // Enable debugging only when debug=true query parameter is passed AND not in production
    const isDebugMode =
      req.query.debug === 'true' && process.env.NODE_ENV !== 'production';

    const result = await CollaborativeFilteringService.getRecommendationsForUser(
      req.user._id.toString(),
      parsedLimit,
      20,
      isDebugMode
    );

    if (isDebugMode && result && typeof result === 'object' && 'diagnostics' in result) {
      res.status(200).json({
        success: true,
        data: result.recommendations,
        debug: {
          isDebugEnabled: true,
          diagnostics: result.diagnostics,
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: Array.isArray(result) ? result : [],
    });
  } catch (error: any) {
    // Handle cold start users or insufficient history gracefully by returning empty array
    res.status(200).json({
      success: true,
      data: [],
      message: error.message || 'Insufficient listening history for collaborative recommendations',
    });
  }
};

export const getHybridRecommendations = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized access. Authentication token required.',
      });
      return;
    }

    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 10;
    const parsedLimit = isNaN(limit) || limit < 1 ? 10 : limit;

    const seedSongId = req.query.seedSongId ? String(req.query.seedSongId) : undefined;
    if (seedSongId && !Types.ObjectId.isValid(seedSongId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid seed song ID format',
      });
      return;
    }

    const recommendations = await HybridRecommendationService.getHybridRecommendations({
      userId: req.user._id.toString(),
      seedSongId,
      limit: parsedLimit,
    });

    res.status(200).json({
      success: true,
      data: recommendations || [],
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch hybrid recommendations',
    });
  }
};
