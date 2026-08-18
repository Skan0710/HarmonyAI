import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { ContentRecommendationService } from '../services/recommendationService.js';
import { CollaborativeFilteringService } from '../services/collaborativeFilteringService.js';
import { HybridRecommendationService } from '../services/hybridRecommendationService.js';
import { ContextAwareRecommendationService } from '../services/contextAwareRecommendationService.js';
import { ContextualAssistantService } from '../services/contextualAssistantService.js';
import { SessionRecommendationService } from '../services/sessionRecommendationService.js';

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

    const result = await HybridRecommendationService.getHybridRecommendations({
      userId: req.user._id.toString(),
      seedSongId,
      limit: parsedLimit,
    });

    res.status(200).json({
      success: true,
      strategyUsed: result.strategyUsed,
      userClassification: result.userClassification,
      count: result.recommendations.length,
      data: result.recommendations || [],
    });
  } catch (error: any) {
    // Never crash recommendation API for users with insufficient data
    res.status(200).json({
      success: true,
      strategyUsed: 'COLD_START',
      userClassification: 'NEW',
      count: 0,
      data: [],
      message: error.message || 'Failed to fetch hybrid recommendations safely',
    });
  }
};

export const getContextualRecommendations = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 10;
    const parsedLimit = isNaN(limit) || limit < 1 ? 10 : Math.min(50, limit);

    const mood = req.query.mood ? String(req.query.mood) : undefined;
    const activity = req.query.activity ? String(req.query.activity) : undefined;

    const energyParam = req.query.energy || req.query.energyLevel;
    const energyLevel =
      energyParam && !isNaN(parseFloat(String(energyParam)))
        ? parseFloat(String(energyParam))
        : undefined;

    const durationParam =
      req.query.duration || req.query.durationMinutes || req.query.preferredDurationMinutes;
    const durationMinutes =
      durationParam && !isNaN(parseInt(String(durationParam), 10))
        ? parseInt(String(durationParam), 10)
        : undefined;

    const userId = req.user?._id?.toString();

    const result = await ContextAwareRecommendationService.getContextualRecommendations({
      userId,
      mood,
      activity,
      energyLevel,
      durationMinutes,
      limit: parsedLimit,
    });

    res.status(200).json({
      success: true,
      strategyUsed: result.strategyUsed,
      userClassification: result.userClassification,
      detectedContext: result.detectedContext,
      count: result.count,
      data: result.data || [],
    });
  } catch (error: any) {
    res.status(200).json({
      success: true,
      strategyUsed: 'COLD_START',
      userClassification: 'NEW',
      detectedContext: {},
      count: 0,
      data: [],
      message: error.message || 'Contextual recommendations generated fallback response',
    });
  }
};

export const processContextualAssistantRequest = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { prompt, limit } = req.body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({
        success: false,
        message: 'Prompt string is required',
      });
      return;
    }

    const parsedLimit = limit && !isNaN(parseInt(String(limit), 10)) ? parseInt(String(limit), 10) : 10;
    const userId = req.user?._id?.toString();

    const result = await ContextualAssistantService.processAssistantRequest({
      userPrompt: prompt.trim(),
      userId,
      limit: parsedLimit,
    });

    res.status(200).json({
      success: true,
      message: 'Contextual assistant request processed successfully',
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to process contextual assistant request',
    });
  }
};

export const getSessionRecommendations = async (
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
    const parsedLimit = isNaN(limit) || limit < 1 ? 10 : Math.min(50, limit);

    const result = await SessionRecommendationService.getSessionRecommendations({
      userId: req.user._id.toString(),
      limit: parsedLimit,
    });

    res.status(200).json({
      success: true,
      hasActiveSession: result.hasActiveSession,
      strategyUsed: result.strategyUsed,
      sessionId: result.sessionId,
      songCountInSession: result.songCountInSession,
      count: result.count,
      data: result.data || [],
    });
  } catch (error: any) {
    res.status(200).json({
      success: true,
      hasActiveSession: false,
      strategyUsed: 'COLD_START_FALLBACK',
      count: 0,
      data: [],
      message: error.message || 'Session recommendations generated fallback response',
    });
  }
};
