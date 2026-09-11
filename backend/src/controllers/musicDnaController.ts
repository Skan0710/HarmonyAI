import { Request, Response } from 'express';
import { UnifiedMusicDNAService } from '../services/unifiedMusicDnaService.js';
import { controllerWrapper, ensureAuth, ControllerError, sendSuccess } from '../utils/controllerHelpers.js';
import { extractQueryParams, isValidObjectId } from '../utils/validators.js';

/**
 * Controller for retrieving the authenticated user's Music DNA profile.
 * Authenticated endpoint returning:
 * - top genres
 * - top artists
 * - preferred moods
 * - listening behavior (archetype, repeat, discovery, skip, stability, etc.)
 * - exploration tendency
 * - familiarity preference
 * - diversity preference
 * - established preferences
 * - emerging preferences
 *
 * Enforces strict user isolation: never exposes or queries another user's Music DNA.
 */
export const getMusicDNAProfile = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const userId = user._id ? user._id.toString() : '';
  if (!userId || !isValidObjectId(userId)) {
    throw new ControllerError(400, 'Invalid user ID in authentication token');
  }

  // Explicit user isolation check: reject attempts to query another user's profile
  if (req.query.userId && req.query.userId !== userId) {
    throw new ControllerError(403, "Cannot access another user's Music DNA profile");
  }

  // Validation of query parameters
  const q = extractQueryParams(req, { limit: 'int' });
  let limit = 10;
  if (!isNaN(q.limit)) {
    if (q.limit < 1 || q.limit > 50) {
      throw new ControllerError(400, 'Limit query parameter must be an integer between 1 and 50');
    }
    limit = q.limit;
  }

  if (req.query.forceRefresh !== undefined) {
    const rawVal = String(req.query.forceRefresh).toLowerCase();
    if (rawVal !== 'true' && rawVal !== 'false' && rawVal !== '1' && rawVal !== '0') {
      throw new ControllerError(400, 'forceRefresh query parameter must be a boolean ("true" or "false")');
    }
  }

  const forceRefresh =
    req.query.forceRefresh === 'true' || req.query.forceRefresh === '1';

  // Fetch or generate the Unified Music DNA Profile
  const profile = await UnifiedMusicDNAService.getOrGenerateProfile(userId, {
    forceRefresh,
  });

  // Format response data adhering to the required Music DNA taste & behavior dimensions
  const responseData = {
    userId,
    dnaVersion: profile.dnaVersion,
    confidenceScore: profile.confidenceScore,

    // Primary Taste Dimensions
    topGenres: (profile.genreProfile?.topGenres || []).slice(0, limit),
    topArtists: (profile.artistProfile?.strongestArtists || []).slice(0, limit),
    preferredMoods: (profile.moodProfile?.preferredMoods || []).slice(0, limit),

    // Core Tendency Metrics
    explorationTendency: profile.tendencies?.explorationPreference ?? 0.5,
    familiarityPreference: profile.tendencies?.familiarityPreference ?? 0.5,
    diversityPreference: profile.tendencies?.diversityPreference ?? 0.5,
    discoveryTendency: profile.tendencies?.discoveryTendency ?? 0.5,

    // Comprehensive Listening Behavior Profile
    listeningBehavior: {
      repeatListeningTendency: profile.listeningBehavior?.repeatListeningTendency ?? 0.5,
      discoveryTendency: profile.listeningBehavior?.discoveryTendency ?? 0.5,
      skipTendency: profile.listeningBehavior?.skipTendency ?? 0.5,
      familiarityPreference: profile.listeningBehavior?.familiarityPreference ?? 0.5,
      explorationTendency: profile.listeningBehavior?.explorationTendency ?? 0.5,
      diversityPreference: profile.listeningBehavior?.diversityPreference ?? 0.5,
      sessionListeningIntensity: profile.listeningBehavior?.sessionListeningIntensity ?? 0.5,
      preferenceStability: profile.listeningBehavior?.preferenceStability ?? 0.5,
      preferenceChangeRate: profile.listeningBehavior?.preferenceChangeRate ?? 0.5,
      listenerArchetype: profile.listeningBehavior?.listenerArchetype || 'Balanced Explorer',
      isDataSufficient: profile.listeningBehavior?.isDataSufficient ?? false,
      metricsBreakdown: profile.listeningBehavior?.metricsBreakdown,
    },

    // Established vs Emerging Preferences
    establishedPreferences: {
      genres: (profile.genreProfile?.topGenres || []).slice(0, limit),
      artists: (profile.artistProfile?.strongestArtists || []).slice(0, limit),
      moods: (profile.moodProfile?.preferredMoods || []).slice(0, limit),
    },
    emergingPreferences: {
      genres: (profile.genreProfile?.emergingGenres || []).slice(0, limit),
      artists: (profile.artistProfile?.emergingArtists || []).slice(0, limit),
    },

    // Grouped Profiles for Complete Visualization & Analysis
    genreProfile: {
      topGenres: (profile.genreProfile?.topGenres || []).slice(0, limit),
      emergingGenres: (profile.genreProfile?.emergingGenres || []).slice(0, limit),
      diversity: profile.genreProfile?.diversity ?? 0.5,
    },
    artistProfile: {
      strongestArtists: (profile.artistProfile?.strongestArtists || []).slice(0, limit),
      emergingArtists: (profile.artistProfile?.emergingArtists || []).slice(0, limit),
      diversity: profile.artistProfile?.diversity ?? 0.5,
    },
    moodProfile: {
      preferredMoods: (profile.moodProfile?.preferredMoods || []).slice(0, limit),
    },
    tendencies: profile.tendencies,
    listeningPatterns: profile.listeningPatterns,
    temporalPreferences: profile.temporalPreferences,

    lastRefreshedAt: profile.lastRefreshedAt,
    interactionsCountAtLastRefresh: profile.interactionsCountAtLastRefresh,
  };

  sendSuccess(res, responseData, 200, 'Music DNA profile retrieved successfully');
});

/**
 * Controller for explicitly triggering a refresh of the authenticated user's Music DNA profile.
 * Evaluates whether new interactions warrant a refresh or performs a forced recalculation.
 */
export const refreshMusicDNAProfile = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const userId = user._id ? user._id.toString() : '';
  if (!userId || !isValidObjectId(userId)) {
    throw new ControllerError(400, 'Invalid user ID in authentication token');
  }

  // Explicit user isolation check
  if (req.query.userId && req.query.userId !== userId) {
    throw new ControllerError(403, "Cannot access or refresh another user's Music DNA profile");
  }

  const result = await UnifiedMusicDNAService.refreshAfterInteraction(userId, { forceRefresh: true });
  sendSuccess(res, result, 200, 'Music DNA profile refreshed successfully');
});
