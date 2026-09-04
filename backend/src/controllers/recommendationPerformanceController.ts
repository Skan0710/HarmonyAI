import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { RecommendationQualityMetricsService } from '../services/recommendationQualityMetricsService.js';
import { controllerWrapper, ensureAuth, ControllerError, sendSuccess } from '../utils/controllerHelpers.js';
import { extractQueryParams } from '../utils/validators.js';

/**
 * Helper to safely extract and validate windowDays query parameter.
 */
function extractWindowDays(req: Request): number | undefined {
  const q = extractQueryParams(req, { windowDays: 'int' });
  if (!isNaN(q.windowDays)) {
    if (q.windowDays < 1 || q.windowDays > 365) {
      throw new ControllerError(400, 'windowDays query parameter must be an integer between 1 and 365');
    }
    return q.windowDays;
  }
  return undefined;
}

/**
 * GET /api/recommendations/performance
 * Returns comprehensive recommendation performance and quality metrics for the authenticated user.
 */
export const getRecommendationPerformance = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const userId = user._id ? user._id.toString() : '';
  if (!userId || !Types.ObjectId.isValid(userId)) {
    throw new ControllerError(400, 'Invalid user ID in authentication token');
  }

  const windowDays = extractWindowDays(req);
  const metrics = await RecommendationQualityMetricsService.calculateMetricsForUser(userId, {
    windowDays,
  });

  const { strongest, weakest } = RecommendationQualityMetricsService.getStrongestAndWeakestSignals(
    metrics.signalPerformance
  );

  sendSuccess(res, {
    userId,
    windowDays: metrics.windowDays ?? null,
    dataAvailable: metrics.dataAvailable,
    overall: {
      totalRecommendations: metrics.totalRecommendations,
      totalInteractions: metrics.totalInteractions,
      engagementScore: metrics.engagementScore,
    },
    rates: {
      playRate: metrics.playRate,
      skipRate: metrics.skipRate,
      likeRate: metrics.likeRate,
      saveRate: metrics.saveRate,
      completionRate: metrics.completionRate,
    },
    feedbackMetrics: {
      positiveFeedbackRate: metrics.positiveFeedbackRate,
      negativeFeedbackRate: metrics.negativeFeedbackRate,
    },
    signals: {
      strongestSignals: strongest,
      weakestSignals: weakest,
      allSignals: metrics.signalPerformance,
    },
  });
});

/**
 * GET /api/recommendations/performance/signals
 * Returns granular performance breakdown per recommendation signal/source.
 */
export const getSignalPerformance = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const userId = user._id ? user._id.toString() : '';
  if (!userId || !Types.ObjectId.isValid(userId)) {
    throw new ControllerError(400, 'Invalid user ID in authentication token');
  }

  const windowDays = extractWindowDays(req);
  const metrics = await RecommendationQualityMetricsService.calculateMetricsForUser(userId, {
    windowDays,
  });

  const { strongest, weakest } = RecommendationQualityMetricsService.getStrongestAndWeakestSignals(
    metrics.signalPerformance
  );

  sendSuccess(res, {
    userId,
    windowDays: metrics.windowDays ?? null,
    dataAvailable: metrics.dataAvailable,
    strongestSignals: strongest,
    weakestSignals: weakest,
    signals: metrics.signalPerformance,
  });
});

/**
 * GET /api/recommendations/performance/engagement
 * Returns focused engagement, positive feedback, and negative feedback rates.
 */
export const getEngagementMetrics = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const userId = user._id ? user._id.toString() : '';
  if (!userId || !Types.ObjectId.isValid(userId)) {
    throw new ControllerError(400, 'Invalid user ID in authentication token');
  }

  const windowDays = extractWindowDays(req);
  const metrics = await RecommendationQualityMetricsService.calculateMetricsForUser(userId, {
    windowDays,
  });

  sendSuccess(res, {
    userId,
    windowDays: metrics.windowDays ?? null,
    dataAvailable: metrics.dataAvailable,
    engagementScore: metrics.engagementScore,
    positiveFeedbackRate: metrics.positiveFeedbackRate,
    negativeFeedbackRate: metrics.negativeFeedbackRate,
    breakdown: {
      playRate: metrics.playRate.rate,
      skipRate: metrics.skipRate.rate,
      likeRate: metrics.likeRate.rate,
      saveRate: metrics.saveRate.rate,
      averageCompletionRate: metrics.completionRate.averageRate,
    },
  });
});
