import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { LayeredTemporalTasteProfileService } from '../services/layeredTemporalTasteProfileService.js';
import { controllerWrapper, ensureAuth, ControllerError, sendSuccess } from '../utils/controllerHelpers.js';
import { extractQueryParams } from '../utils/validators.js';

/**
 * Controller for retrieving the user's temporal taste profile.
 * Authenticated endpoint returning:
 * - short-term preferences (immediate momentum)
 * - medium-term preferences (rotational habits)
 * - long-term preferences (foundational taste)
 * - strongest changing preferences (rising, emerging, and cooling taste signals)
 */
export const getTemporalTasteProfile = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const userId = user._id ? user._id.toString() : '';
  if (!userId || !Types.ObjectId.isValid(userId)) {
    throw new ControllerError(400, 'Invalid user ID in authentication token');
  }

  // Query parameter extraction & validation
  const q = extractQueryParams(req, { limit: 'int' });
  let limit = 10;
  if (!isNaN(q.limit)) {
    if (q.limit < 1 || q.limit > 50) {
      throw new ControllerError(400, 'Limit query parameter must be an integer between 1 and 50');
    }
    limit = q.limit;
  }

  const persist = req.query.persist === 'true';

  // Generate layered temporal taste profile
  const profile = await LayeredTemporalTasteProfileService.generateLayeredTasteProfile(userId, {
    persist,
  });

  // Format response with explicit short, medium, long, and changing preference sections
  const formatLayer = (layer: any) => ({
    timeWindow: layer.layerName,
    timeframeDays: layer.timeframeDays,
    role: layer.role,
    topGenre: layer.topGenre,
    topArtist: layer.topArtist,
    topMood: layer.topMood,
    genres: (layer.genres || []).slice(0, limit),
    artists: (layer.artists || []).slice(0, limit),
    moods: (layer.moods || []).slice(0, limit),
    acousticTargets: layer.acousticTargets,
    totalInteractions: layer.totalInteractions,
    lastUpdated: layer.lastUpdated,
  });

  const responseData = {
    userId,
    shortTermPreferences: formatLayer(profile.shortTerm),
    mediumTermPreferences: formatLayer(profile.mediumTerm),
    longTermPreferences: formatLayer(profile.longTerm),
    strongestChangingPreferences: profile.strongestChangingPreferences || {
      topRising: [],
      topDeclining: [],
      topEmerging: [],
      overallChanges: [],
      tasteShiftSummary: 'Insufficient interaction history to detect taste divergence.',
    },
    unifiedProfile: {
      dominantTasteCategory: profile.dominantTasteCategory,
      tasteStabilityScore: profile.tasteStabilityScore,
      layerWeights: profile.layerWeights,
      unifiedGenres: (profile.unifiedGenres || []).slice(0, limit),
      unifiedArtists: (profile.unifiedArtists || []).slice(0, limit),
      unifiedMoods: (profile.unifiedMoods || []).slice(0, limit),
      unifiedAcousticTargets: profile.unifiedAcousticTargets,
    },
    totalInteractionsAnalyzed: profile.totalInteractionsAnalyzed,
    calculatedAt: profile.updatedAt,
  };

  sendSuccess(res, responseData, 200, 'Temporal taste profile retrieved successfully');
});
