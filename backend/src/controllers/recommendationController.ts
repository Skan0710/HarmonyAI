import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { ContentRecommendationService } from '../services/recommendationService.js';
import { CollaborativeFilteringService } from '../services/collaborativeFilteringService.js';
import { HybridRecommendationService } from '../services/hybridRecommendationService.js';
import { ContextAwareRecommendationService } from '../services/contextAwareRecommendationService.js';
import { ContextualAssistantService } from '../services/contextualAssistantService.js';
import { SessionRecommendationService } from '../services/sessionRecommendationService.js';
import { SmartAutoplayService } from '../services/smartAutoplayService.js';
import { controllerWrapper, ensureAuth, ControllerError } from '../utils/controllerHelpers.js';
import { extractQueryParams, isValidObjectId } from '../utils/validators.js';

export const getSimilarSongs = controllerWrapper(async (req: Request, res: Response) => {
  const { songId } = req.params;

  if (!songId || !Types.ObjectId.isValid(songId)) {
    throw new ControllerError(400, 'Invalid song ID format');
  }

  const q = extractQueryParams(req, { limit: 'int' });
  const parsedLimit = isNaN(q.limit) || q.limit < 1 ? 10 : q.limit;

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
});

export const getCollaborativeRecommendations = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const q = extractQueryParams(req, { limit: 'int' });
  const parsedLimit = isNaN(q.limit) || q.limit < 1 ? 10 : q.limit;

  const isDebugMode =
    req.query.debug === 'true' && process.env.NODE_ENV !== 'production';

  try {
    const result = await CollaborativeFilteringService.getRecommendationsForUser(
      user._id.toString(),
      parsedLimit,
      20,
      isDebugMode
    );

    if (isDebugMode && result && typeof result === 'object' && 'diagnostics' in result) {
      res.status(200).json({
        success: true,
        data: result.recommendations,
        debug: { isDebugEnabled: true, diagnostics: result.diagnostics },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: Array.isArray(result) ? result : [],
    });
  } catch (error: any) {
    // Cold start / insufficient history → return empty array (not an error)
    res.status(200).json({
      success: true,
      data: [],
      message: error.message || 'Insufficient listening history for collaborative recommendations',
    });
  }
});

export const getHybridRecommendations = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const q = extractQueryParams(req, { limit: 'int' });
  const parsedLimit = isNaN(q.limit) || q.limit < 1 ? 10 : q.limit;

  const seedSongId = req.query.seedSongId ? String(req.query.seedSongId) : undefined;
  if (seedSongId && !Types.ObjectId.isValid(seedSongId)) {
    throw new ControllerError(400, 'Invalid seed song ID format');
  }

  try {
    const result = await HybridRecommendationService.getHybridRecommendations({
      userId: user._id.toString(),
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
    // Cold start fallback → return empty array (not an error)
    res.status(200).json({
      success: true,
      strategyUsed: 'COLD_START',
      userClassification: 'NEW',
      count: 0,
      data: [],
      message: error.message || 'Failed to fetch hybrid recommendations safely',
    });
  }
});

export const getContextualRecommendations = controllerWrapper(async (req: Request, res: Response) => {
  const q = extractQueryParams(req, { limit: 'int' });
  const parsedLimit = isNaN(q.limit) || q.limit < 1 ? 10 : Math.min(50, q.limit);

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

  try {
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
    // Fallback → return empty array (not an error)
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
});

export const processContextualAssistantRequest = controllerWrapper(async (req: Request, res: Response) => {
  const { prompt, limit } = req.body;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    throw new ControllerError(400, 'Prompt string is required');
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
});

export const getSessionRecommendations = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const q = extractQueryParams(req, { limit: 'int' });
  const parsedLimit = isNaN(q.limit) || q.limit < 1 ? 10 : Math.min(50, q.limit);

  const isDebugMode =
    req.query.debug === 'true' && process.env.NODE_ENV !== 'production';

  try {
    const result = await SessionRecommendationService.getSessionRecommendations({
      userId: user._id.toString(),
      limit: parsedLimit,
      isDebugMode,
    });

    res.status(200).json({
      success: true,
      hasActiveSession: result.hasActiveSession,
      strategyUsed: result.strategyUsed,
      sessionId: result.sessionId,
      songCountInSession: result.songCountInSession,
      count: result.count,
      data: result.data || [],
      ...(isDebugMode && result.diagnostics ? { diagnostics: result.diagnostics } : {}),
    });
  } catch (error: any) {
    // Fallback → return empty array (not an error)
    res.status(200).json({
      success: true,
      hasActiveSession: false,
      strategyUsed: 'COLD_START_FALLBACK',
      count: 0,
      data: [],
      message: error.message || 'Session recommendations generated fallback response',
    });
  }
});

export const getSmartAutoplayCandidates = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const q = extractQueryParams(req, { limit: 'int' });
  const parsedLimit = isNaN(q.limit) || q.limit < 1 ? 5 : Math.min(25, q.limit);

  const lastPlayedArtistId = req.query.lastPlayedArtistId ? String(req.query.lastPlayedArtistId) : undefined;
  const excludeQueueParam = req.query.excludeQueue ? String(req.query.excludeQueue).split(',') : [];

  const isDebugMode =
    req.query.debug === 'true' && process.env.NODE_ENV !== 'production';

  try {
    const result = await SmartAutoplayService.generateAutoplayCandidates({
      userId: user._id.toString(),
      limit: parsedLimit,
      lastPlayedArtistId,
      currentQueueSongIds: excludeQueueParam,
      isDebugMode,
    });

    res.status(200).json({
      success: true,
      strategyUsed: 'SMART_AUTOPLAY',
      count: result.candidates.length,
      data: result.candidates,
      ...(isDebugMode && result.diagnostics ? { diagnostics: result.diagnostics } : {}),
    });
  } catch (error: any) {
    // Fallback → return empty array (not an error)
    res.status(200).json({
      success: true,
      strategyUsed: 'SMART_AUTOPLAY_FALLBACK',
      count: 0,
      data: [],
      message: error.message || 'Smart autoplay generated fallback response',
    });
  }
});
