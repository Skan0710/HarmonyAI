import { Request, Response } from 'express';
import { UnifiedMusicDNAService } from '../services/unifiedMusicDnaService.js';
import { MusicDNASnapshotService } from '../services/musicDnaSnapshotService.js';
import { MusicDNAChangeDetectionService } from '../services/musicDnaChangeDetectionService.js';
import { EmergingTasteDetectionService } from '../services/emergingTasteDetectionService.js';
import { TasteEvolutionTimelineService } from '../services/tasteEvolutionTimelineService.js';
import { TasteStabilityTransformationService } from '../services/tasteStabilityTransformationService.js';
import { controllerWrapper, ensureAuth, ControllerError, sendSuccess } from '../utils/controllerHelpers.js';
import { extractQueryParams, isValidObjectId } from '../utils/validators.js';

/**
 * Controller for retrieving comprehensive Music DNA Evolution and Taste Change Intelligence.
 * Exposes:
 * - Current Music DNA state
 * - Recent taste changes (genre, artist, mood, tendencies)
 * - Emerging taste detection (genres, artists, moods, behaviors)
 * - Fading preferences
 * - Taste stability, volatility, and transformation metrics
 * - Chronological evolution timeline
 *
 * Enforces strict authentication and user isolation.
 */
export const getEvolutionOverview = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const userId = user._id ? user._id.toString() : '';
  if (!userId || !isValidObjectId(userId)) {
    throw new ControllerError(400, 'Invalid user ID in authentication token');
  }

  // Explicit user isolation check: reject attempts to query another user's evolution
  if (req.query?.userId && req.query.userId !== userId) {
    throw new ControllerError(403, "Cannot access another user's Music DNA evolution profile");
  }

  // Parse and validate query parameters
  const q = extractQueryParams(req, { limit: 'int' });
  let limit = 10;
  if (!isNaN(q.limit)) {
    if (q.limit < 1 || q.limit > 50) {
      throw new ControllerError(400, 'Limit query parameter must be an integer between 1 and 50');
    }
    limit = q.limit;
  }

  // Fetch or generate current Music DNA profile
  const currentDna = await UnifiedMusicDNAService.getOrGenerateProfile(userId);

  // Concurrently retrieve snapshots and previous snapshot
  let snapshots = await MusicDNASnapshotService.getSnapshots(userId, { limit: 5, sortAsc: false }).catch(() => []);

  if (!snapshots || snapshots.length === 0) {
    try {
      const snap1 = await MusicDNASnapshotService.captureCurrentSnapshot(userId, {
        timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        triggerReason: 'foundational_baseline',
      });
      const snap2 = await MusicDNASnapshotService.captureCurrentSnapshot(userId, {
        timestamp: new Date(),
        triggerReason: 'current_profile',
      });
      snapshots = [snap2, snap1];
    } catch {}
  } else if (snapshots.length === 1) {
    try {
      const snap = await MusicDNASnapshotService.captureCurrentSnapshot(userId, {
        timestamp: new Date(),
        triggerReason: 'current_profile',
      });
      snapshots = [snap, ...snapshots];
    } catch {}
  }

  const previousSnapshot = snapshots && snapshots.length > 1 ? snapshots[1] : (snapshots?.[0] || null);

  // Execute taste change analysis against latest historical snapshot
  const changesReport = MusicDNAChangeDetectionService.detectTasteChanges(previousSnapshot, currentDna);

  // Concurrently retrieve emerging tastes, stability metrics, and evolution timeline
  const [emergingReport, stabilityMetrics, timelineReport] = await Promise.all([
    EmergingTasteDetectionService.detectUserEmergingTastes(userId).catch(() => null),
    TasteStabilityTransformationService.calculateUserStabilityMetrics(userId).catch(() => null),
    TasteEvolutionTimelineService.getUserEvolutionTimeline(userId, { maxEvents: limit }).catch(() => null),
  ]);

  const isDataSufficient =
    Boolean(
      currentDna &&
      (
        (currentDna.genreProfile?.topGenres?.length ?? 0) > 0 ||
        (currentDna.artistProfile?.strongestArtists?.length ?? 0) > 0 ||
        (snapshots && snapshots.length >= 1)
      )
    );

  const responseData = {
    userId,
    isDataSufficient,
    generatedAt: new Date(),
    snapshotCount: snapshots?.length || 0,

    // Current Music DNA state summary
    currentMusicDna: {
      dnaVersion: currentDna.dnaVersion,
      confidenceScore: currentDna.confidenceScore,
      topGenres: (currentDna.genreProfile?.topGenres || []).slice(0, limit),
      topArtists: (currentDna.artistProfile?.strongestArtists || []).slice(0, limit),
      preferredMoods: (currentDna.moodProfile?.preferredMoods || []).slice(0, limit),
      tendencies: currentDna.tendencies,
      listenerArchetype: currentDna.listeningBehavior?.listenerArchetype || 'Balanced Explorer',
    },

    // Recent Taste Changes
    recentChanges: {
      hasMeaningfulShift: changesReport?.hasSufficientHistory && changesReport?.overallShiftMagnitude > 0.15,
      overallChangeIntensity: changesReport?.overallShiftMagnitude ?? 0,
      tasteStabilityRating: changesReport?.tasteStabilityRating || 'unrated',
      genreChanges: (changesReport?.genreChanges || []).slice(0, limit),
      artistChanges: (changesReport?.artistChanges || []).slice(0, limit),
      moodChanges: (changesReport?.moodChanges || []).slice(0, limit),
      tendencyChanges: changesReport?.tendencyChanges,
      summary: changesReport?.summary?.primaryTasteDirection || 'No taste change detected.',
    },

    // Emerging Preferences (Momentum & Rapid Growth)
    emergingTastes: {
      hasEmergingPreferences: Boolean(emergingReport && emergingReport.summary.totalEmergingCount > 0),
      emergingGenres: (emergingReport?.emergingGenres || []).slice(0, limit),
      emergingArtists: (emergingReport?.emergingArtists || []).slice(0, limit),
      emergingMoods: (emergingReport?.emergingMoods || []).slice(0, limit),
      emergingBehaviors: emergingReport?.emergingBehaviors || [],
      summary: emergingReport?.summary?.narrative || 'No emerging preferences detected.',
    },

    // Fading Preferences (Declining Engagement)
    fadingPreferences: {
      fadingGenres: (changesReport?.summary?.fadingGenres || []).slice(0, limit),
      fadingArtists: (changesReport?.summary?.fadingArtists || []).slice(0, limit),
      fadingMoods: (changesReport?.moodChanges || [])
        .filter((m) => m.classification === 'fading')
        .map((m) => m.mood)
        .slice(0, limit),
    },

    // Taste Stability & Transformation Metrics
    stabilityMetrics: {
      tasteStabilityScore: stabilityMetrics?.tasteStability ?? 0.5,
      tasteVolatilityScore: stabilityMetrics?.tasteVolatility ?? 0.5,
      preferencePersistenceScore: stabilityMetrics?.preferencePersistence ?? 0.5,
      discoveryTendencyScore: stabilityMetrics?.discoveryTendency ?? 0.5,
      transformationIntensityScore: stabilityMetrics?.transformationIntensity ?? 0.5,
      archetype: stabilityMetrics?.archetype || 'Gradual Evolver',
      explanation: stabilityMetrics?.description || 'Taste stability within baseline expectations.',
    },

    // Chronological Evolution Timeline Summary
    evolutionTimeline: {
      totalEvents: timelineReport?.totalEvents || 0,
      events: (timelineReport?.events || []).slice(0, limit),
      milestones: timelineReport?.milestones || [],
      dominantPhases: timelineReport?.dominantPhases || [],
    },
  };

  sendSuccess(res, responseData, 200, 'Music DNA evolution overview retrieved successfully');
});

/**
 * Controller for retrieving the user's chronological Music DNA evolution timeline.
 */
export const getEvolutionTimeline = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const userId = user._id ? user._id.toString() : '';
  if (!userId || !isValidObjectId(userId)) {
    throw new ControllerError(400, 'Invalid user ID in authentication token');
  }

  if (req.query?.userId && req.query.userId !== userId) {
    throw new ControllerError(403, "Cannot access another user's Music DNA evolution timeline");
  }

  const q = extractQueryParams(req, {
    limit: 'int',
    significanceThreshold: 'number',
    windowDays: 'int',
  });

  let limit = 20;
  if (!isNaN(q.limit)) {
    if (q.limit < 1 || q.limit > 100) {
      throw new ControllerError(400, 'Limit query parameter must be an integer between 1 and 100');
    }
    limit = q.limit;
  }

  let significanceThreshold: number | undefined;
  if (!isNaN(q.significanceThreshold)) {
    if (q.significanceThreshold < 0 || q.significanceThreshold > 1) {
      throw new ControllerError(400, 'significanceThreshold must be a number between 0 and 1');
    }
    significanceThreshold = q.significanceThreshold;
  }

  let windowDays: number | undefined;
  if (!isNaN(q.windowDays)) {
    if (q.windowDays < 1 || q.windowDays > 365) {
      throw new ControllerError(400, 'windowDays must be an integer between 1 and 365');
    }
    windowDays = q.windowDays;
  }

  const timeline = await TasteEvolutionTimelineService.getUserEvolutionTimeline(userId, {
    maxEvents: limit,
    ...(significanceThreshold !== undefined
      ? {
          thresholds: {
            significanceThreshold,
            emergenceThreshold: 0.50,
            fadingThreshold: 0.25,
            highVelocityThreshold: 0.25,
          },
        }
      : {}),
  });

  sendSuccess(res, timeline, 200, 'Music DNA evolution timeline retrieved successfully');
});

/**
 * Controller for retrieving taste stability, volatility, and transformation metrics.
 */
export const getTasteStability = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const userId = user._id ? user._id.toString() : '';
  if (!userId || !isValidObjectId(userId)) {
    throw new ControllerError(400, 'Invalid user ID in authentication token');
  }

  if (req.query?.userId && req.query.userId !== userId) {
    throw new ControllerError(403, "Cannot access another user's taste stability metrics");
  }

  const stabilityMetrics = await TasteStabilityTransformationService.calculateUserStabilityMetrics(userId);
  sendSuccess(res, stabilityMetrics, 200, 'Taste stability and transformation metrics retrieved successfully');
});

/**
 * Controller for retrieving emerging taste detection analysis.
 */
export const getEmergingTastes = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const userId = user._id ? user._id.toString() : '';
  if (!userId || !isValidObjectId(userId)) {
    throw new ControllerError(400, 'Invalid user ID in authentication token');
  }

  if (req.query?.userId && req.query.userId !== userId) {
    throw new ControllerError(403, "Cannot access another user's emerging tastes");
  }

  const emergingReport = await EmergingTasteDetectionService.detectUserEmergingTastes(userId);
  sendSuccess(res, emergingReport, 200, 'Emerging tastes retrieved successfully');
});

/**
 * Controller for retrieving taste change detection analysis against previous snapshots.
 */
export const getTasteChanges = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const userId = user._id ? user._id.toString() : '';
  if (!userId || !isValidObjectId(userId)) {
    throw new ControllerError(400, 'Invalid user ID in authentication token');
  }

  if (req.query?.userId && req.query.userId !== userId) {
    throw new ControllerError(403, "Cannot access another user's taste changes");
  }

  const currentDna = await UnifiedMusicDNAService.getOrGenerateProfile(userId);
  const previousSnapshot = await MusicDNASnapshotService.getLatestSnapshot(userId);
  const changesReport = MusicDNAChangeDetectionService.detectTasteChanges(previousSnapshot, currentDna);

  sendSuccess(res, changesReport, 200, 'Taste changes retrieved successfully');
});

/**
 * Controller for retrieving historical Music DNA snapshots.
 */
export const getSnapshots = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const userId = user._id ? user._id.toString() : '';
  if (!userId || !isValidObjectId(userId)) {
    throw new ControllerError(400, 'Invalid user ID in authentication token');
  }

  if (req.query?.userId && req.query.userId !== userId) {
    throw new ControllerError(403, "Cannot access another user's Music DNA snapshots");
  }

  const q = extractQueryParams(req, { limit: 'int' });
  let limit = 20;
  if (!isNaN(q.limit)) {
    if (q.limit < 1 || q.limit > 100) {
      throw new ControllerError(400, 'Limit query parameter must be an integer between 1 and 100');
    }
    limit = q.limit;
  }

  const snapshots = await MusicDNASnapshotService.getSnapshots(userId, { limit, sortAsc: false });
  sendSuccess(res, snapshots, 200, 'Music DNA snapshots retrieved successfully');
});

/**
 * Controller for manually creating a Music DNA snapshot.
 */
export const createSnapshot = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const userId = user._id ? user._id.toString() : '';
  if (!userId || !isValidObjectId(userId)) {
    throw new ControllerError(400, 'Invalid user ID in authentication token');
  }

  if (req.query?.userId && req.query.userId !== userId) {
    throw new ControllerError(403, "Cannot create a snapshot for another user");
  }

  const triggerReason =
    typeof req.body?.triggerReason === 'string' && req.body.triggerReason.trim()
      ? req.body.triggerReason.trim()
      : 'manual_api_request';

  const snapshot = await MusicDNASnapshotService.captureCurrentSnapshot(userId, {
    triggerReason,
  });

  sendSuccess(res, snapshot, 201, 'Music DNA snapshot created successfully');
});
