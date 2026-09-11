import { Request, Response } from 'express';
import { PersonalMusicTwinService } from '../services/personalMusicTwinService.js';
import { controllerWrapper, ensureAuth, ControllerError, sendSuccess } from '../utils/controllerHelpers.js';
import { extractQueryParams, isValidObjectId } from '../utils/validators.js';
import { PersonalMusicTwinAttributes } from '../schemas/personalMusicTwinSchema.js';

/**
 * Helper: Formats a raw PersonalMusicTwinAttributes or IPersonalMusicTwin into
 * the standardized client-facing structured API representation.
 */
export function formatPersonalMusicTwinResponse(
  twin: PersonalMusicTwinAttributes | any,
  limit: number = 10
) {
  const metadata = twin.metadata || {};
  const dominantGenres = [
    ...(twin.genreIdentity?.coreGenres || []),
    ...(twin.genreIdentity?.secondaryGenres || []),
  ];

  const importantArtists =
    metadata.establishedPreferences?.artists?.length > 0
      ? metadata.establishedPreferences.artists
      : (twin.currentEmergingInterests?.artists || []).map((a: any) => a.name);

  return {
    userId: twin.userId ? twin.userId.toString() : '',
    twinVersion: twin.twinVersion || '1.0.0',
    lastUpdatedTimestamp: twin.lastUpdatedTimestamp,
    isDataSufficient: Boolean(twin.isDataSufficient),

    // Required Core High-Level Dimensions
    listenerArchetype: twin.listenerArchetype || 'Balanced Explorer',
    archetypeDescription: twin.archetypeDescription || '',
    confidence: typeof twin.confidenceScore === 'number' ? twin.confidenceScore : 0.5,

    // Personality Traits
    personalityTraits: metadata.personalityTraits || (
      (twin.personalityProfile?.vibeKeywords || []).map((k: string) => ({
        id: k.toLowerCase().replace(/\s+/g, '_'),
        trait: k,
        category: 'vibe',
        confidence: 0.75,
      }))
    ),

    // Dominant Dimensions
    dominantGenres: dominantGenres.slice(0, limit),
    dominantMoods: (twin.moodIdentity?.dominantMoods || []).slice(0, limit),
    importantArtists: importantArtists.slice(0, limit),

    // Behavioral Tendencies & Preferences
    explorationTendency: typeof twin.explorationTendency === 'number' ? twin.explorationTendency : 0.5,
    familiarityPreference: typeof twin.familiarityTendency === 'number' ? twin.familiarityTendency : 0.5,
    diversityPreference: typeof twin.diversityPreference === 'number' ? twin.diversityPreference : 0.5,

    // Established Preferences
    establishedPreferences: {
      genres: (
        metadata.establishedPreferences?.genres ||
        (twin.genreIdentity?.coreGenres || []).map((g: any) => g.name)
      ).slice(0, limit),
      artists: (
        metadata.establishedPreferences?.artists ||
        (twin.metadata?.topArtists || [])
      ).slice(0, limit),
      moods: (twin.moodIdentity?.dominantMoods || []).slice(0, limit).map((m: any) => m.mood),
    },

    // Emerging Preferences (High Momentum)
    emergingPreferences: {
      genres: (twin.currentEmergingInterests?.genres || []).slice(0, limit),
      artists: (twin.currentEmergingInterests?.artists || []).slice(0, limit),
      moods: (twin.currentEmergingInterests?.moods || []).slice(0, limit),
      narrative: twin.currentEmergingInterests?.narrative || '',
    },

    // Fading Preferences
    fadingPreferences: {
      genres: (metadata.fadingPreferences?.genres || []).slice(0, limit),
      artists: (metadata.fadingPreferences?.artists || []).slice(0, limit),
    },

    // Taste Stability Intelligence
    tasteStability: {
      stabilityScore: twin.tasteStability?.stabilityScore ?? 0.5,
      volatilityScore: twin.tasteStability?.volatilityScore ?? 0.5,
      preferencePersistence: twin.tasteStability?.preferencePersistence ?? 0.5,
      stabilityRating: twin.tasteStability?.stabilityRating || 'unrated',
      description: twin.tasteStability?.description || '',
    },

    // Taste Evolution Trajectory
    tasteEvolution: {
      transformationIntensity: twin.tasteEvolution?.transformationIntensity ?? 0.0,
      evolutionArchetype: twin.tasteEvolution?.evolutionArchetype || 'Gradual Evolver',
      primaryTasteDirection: twin.tasteEvolution?.primaryTasteDirection || '',
      activePhase: twin.tasteEvolution?.activePhase || '',
      velocity: twin.tasteEvolution?.velocity || 'static',
    },

    // Current Musical Identity (USP Persona & Sound Signature)
    currentMusicalIdentity: {
      personaName: twin.personalityProfile?.personaName || 'The Open Explorer',
      tagline: twin.personalityProfile?.tagline || '',
      bio: twin.personalityProfile?.bio || '',
      signatureSound: twin.genreIdentity?.signatureSound || 'Eclectic Palette',
      vibeKeywords: twin.personalityProfile?.vibeKeywords || [],
      rarityScore: twin.personalityProfile?.rarityScore ?? 0.5,
      dominantTraits: twin.dominantMusicalTraits,
      compatibilityDimensions: twin.compatibilityDimensions,
    },

    // Underlying Listening Behavior Metrics
    listeningBehavior: twin.listeningBehavior,
  };
}

/**
 * GET /api/users/me/personal-music-twin
 * GET /api/users/personal-music-twin
 * GET /api/recommendations/personal-music-twin
 *
 * Retrieves the authenticated user's Personal Music Twin.
 * Strict user isolation: users can only access their own twin.
 */
export const getPersonalMusicTwin = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const userId = user._id ? user._id.toString() : '';
  if (!userId || !isValidObjectId(userId)) {
    throw new ControllerError(400, 'Invalid user ID in authentication token');
  }

  // Explicit user isolation check: reject attempts to query another user's Personal Music Twin
  if (req.query?.userId && req.query.userId !== userId) {
    throw new ControllerError(403, "Cannot access another user's Personal Music Twin");
  }

  // Query parameter extraction and validation
  const q = extractQueryParams(req, { limit: 'int' });
  let limit = 10;
  if (!isNaN(q.limit)) {
    if (q.limit < 1 || q.limit > 50) {
      throw new ControllerError(400, 'Limit query parameter must be an integer between 1 and 50');
    }
    limit = q.limit;
  }

  if (req.query?.forceRefresh !== undefined) {
    const rawVal = String(req.query.forceRefresh).toLowerCase();
    if (rawVal !== 'true' && rawVal !== 'false' && rawVal !== '1' && rawVal !== '0') {
      throw new ControllerError(400, 'forceRefresh query parameter must be a boolean ("true" or "false")');
    }
  }

  const forceRefresh =
    req.query?.forceRefresh === 'true' || req.query?.forceRefresh === '1';

  // Fetch or synthesize user's Personal Music Twin
  const twinDoc = await PersonalMusicTwinService.getOrGenerateTwin(userId, {
    forceRefresh,
  });

  const responseData = formatPersonalMusicTwinResponse(twinDoc, limit);
  return sendSuccess(res, responseData, 200, 'Personal Music Twin retrieved successfully');
});

/**
 * POST /api/users/me/personal-music-twin/refresh
 * POST /api/users/personal-music-twin/refresh
 * POST /api/recommendations/personal-music-twin/refresh
 *
 * Forces recalculation and refresh of the authenticated user's Personal Music Twin.
 * Strict user isolation: users can only refresh their own twin.
 */
export const refreshPersonalMusicTwin = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const userId = user._id ? user._id.toString() : '';
  if (!userId || !isValidObjectId(userId)) {
    throw new ControllerError(400, 'Invalid user ID in authentication token');
  }

  // User isolation check across query and body
  if (
    (req.query?.userId && req.query.userId !== userId) ||
    (req.body?.userId && req.body.userId !== userId)
  ) {
    throw new ControllerError(403, "Cannot refresh another user's Personal Music Twin");
  }

  // Extract optional options from body
  const { metadataOverride, maxAgeMinutes } = req.body || {};
  let validatedMaxAge: number | undefined = undefined;
  if (maxAgeMinutes !== undefined) {
    const parsed = Number(maxAgeMinutes);
    if (isNaN(parsed) || parsed < 0) {
      throw new ControllerError(400, 'maxAgeMinutes must be a non-negative number');
    }
    validatedMaxAge = parsed;
  }

  const refreshedTwinDoc = await PersonalMusicTwinService.refreshMusicTwin(userId, {
    forceRefresh: true,
    metadataOverride,
    maxAgeMinutes: validatedMaxAge,
  });

  const responseData = formatPersonalMusicTwinResponse(refreshedTwinDoc, 10);
  return sendSuccess(res, responseData, 200, 'Personal Music Twin refreshed successfully');
});
