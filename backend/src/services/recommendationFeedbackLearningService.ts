import { Types } from 'mongoose';
import {
  RecommendationEvaluation,
  IRecommendationEvaluation,
} from '../models/RecommendationEvaluation.js';
import { RecommendationInteraction } from '../models/RecommendationInteraction.js';
import { TemporalPreferenceAggregationService } from './temporalPreferenceAggregationService.js';
import { ListeningSessionService } from './listeningSessionService.js';
import { RecommendationScoreCalibrationService, UserFeedbackProfile } from './recommendationScoreCalibrationService.js';

export interface RecommendationFeedbackEvent {
  userId: string;
  songId: string;
  action: 'play' | 'skip' | 'like' | 'save' | 'replay' | 'complete' | 'thumbs_up' | 'thumbs_down' | string;
  recommendationSource?: string;
  recommendationRef?: string;
  listeningDurationSeconds?: number;
  completionRate?: number;
  metadata?: Record<string, any>;
  timestamp?: Date;
}

export interface FeedbackProcessingResult {
  success: boolean;
  evaluation: IRecommendationEvaluation;
  evaluationScore: number;
  preferencesUpdated: boolean;
  sessionUpdated: boolean;
  message: string;
}

export class RecommendationFeedbackLearningService {
  /**
   * Processes a user feedback event through the recommendation learning loop:
   * 1. Updates or creates RecommendationEvaluation record with evaluated score
   * 2. Synchronizes RecommendationInteraction log
   * 3. Triggers temporal preference aggregation and persistence
   * 4. Integrates with active listening session if present
   */
  static async processFeedbackEvent(
    event: RecommendationFeedbackEvent,
    options: {
      persistPreferences?: boolean;
      updateSession?: boolean;
    } = {}
  ): Promise<FeedbackProcessingResult> {
    const { userId, songId, action } = event;

    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }
    if (!Types.ObjectId.isValid(songId)) {
      throw new Error('Invalid song ID');
    }

    const userObjId = new Types.ObjectId(userId);
    const songObjId = new Types.ObjectId(songId);
    const source = event.recommendationSource || 'hybrid';
    const timestamp = event.timestamp || new Date();

    // 1. Locate existing recent evaluation or create new one
    let evaluation = await RecommendationEvaluation.findOne({
      userId: userObjId,
      songId: songObjId,
      timestamp: { $gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
    }).sort({ timestamp: -1 });

    if (!evaluation) {
      evaluation = new RecommendationEvaluation({
        userId: userObjId,
        songId: songObjId,
        source,
        signals: [source],
        recommendationId: event.recommendationRef,
        played: false,
        skipped: false,
        liked: false,
        saved: false,
        timestamp,
      });
    }

    // 2. Update flags based on action
    const normalizedAction = action.toLowerCase().trim();
    if (normalizedAction === 'play' || normalizedAction === 'replay') {
      evaluation.played = true;
    } else if (normalizedAction === 'skip') {
      evaluation.skipped = true;
    } else if (normalizedAction === 'like' || normalizedAction === 'thumbs_up') {
      evaluation.liked = true;
    } else if (normalizedAction === 'save') {
      evaluation.saved = true;
    } else if (normalizedAction === 'complete') {
      evaluation.played = true;
      evaluation.completionRate = 1.0;
    }

    if (typeof event.listeningDurationSeconds === 'number' && event.listeningDurationSeconds >= 0) {
      evaluation.listeningDuration = event.listeningDurationSeconds;
    }

    if (typeof event.completionRate === 'number') {
      const comp = Math.max(0, Math.min(1, event.completionRate > 1 ? event.completionRate / 100 : event.completionRate));
      evaluation.completionRate = comp;
    }

    // Compute updated composite evaluation score
    evaluation.evaluationScore = RecommendationEvaluation.computeScore({
      played: evaluation.played,
      skipped: evaluation.skipped,
      liked: evaluation.liked,
      saved: evaluation.saved,
      completionRate: evaluation.completionRate,
    });
    evaluation.evaluatedAt = new Date();

    if (event.metadata) {
      evaluation.metadata = { ...(evaluation.metadata || {}), ...event.metadata };
    }

    await evaluation.save();

    // 3. Trigger Temporal Preference Update
    let preferencesUpdated = false;
    if (options.persistPreferences !== false) {
      try {
        await TemporalPreferenceAggregationService.aggregateUserPreferences(userId, {
          persist: true,
        });
        preferencesUpdated = true;
      } catch {
        // Log or handle gracefully without throwing
      }
    }

    // 4. Trigger Session Intelligence update if user has an active session
    let sessionUpdated = false;
    if (options.updateSession !== false) {
      try {
        const activeSession = await ListeningSessionService.getActiveSession(userId);
        if (activeSession) {
          if (normalizedAction === 'skip') {
            await ListeningSessionService.recordTrackSkip({
              userId,
              songId,
              playDurationBeforeSkipSeconds: event.listeningDurationSeconds,
            });
            sessionUpdated = true;
          } else if (normalizedAction === 'play') {
            await ListeningSessionService.recordTrackPlay({
              userId,
              songId,
              playDurationSeconds: event.listeningDurationSeconds,
            });
            sessionUpdated = true;
          } else if (normalizedAction === 'complete') {
            await ListeningSessionService.recordTrackCompletion({
              userId,
              songId,
              durationSeconds: event.listeningDurationSeconds,
            });
            sessionUpdated = true;
          }
        }
      } catch {
        // Safe fallback for session intelligence
      }
    }

    return {
      success: true,
      evaluation,
      evaluationScore: evaluation.evaluationScore,
      preferencesUpdated,
      sessionUpdated,
      message: `Feedback loop successfully processed ${action} on song ${songId}`,
    };
  }

  /**
   * Helper: Pure evaluation analysis connecting an interaction to preference impact and calibration score.
   */
  static analyzeFeedbackImpact(
    event: RecommendationFeedbackEvent,
    currentFeedbackProfile: UserFeedbackProfile
  ): {
    qualityScore: number;
    calibrationDelta: number;
    impactType: 'positive' | 'negative' | 'neutral';
    recommendationAction: string;
  } {
    const qualityScore = RecommendationEvaluation.computeScore({
      played: event.action === 'play' || event.action === 'complete',
      skipped: event.action === 'skip',
      liked: event.action === 'like' || event.action === 'thumbs_up',
      saved: event.action === 'save',
      completionRate: event.completionRate,
    });

    let calibrationDelta = 0;
    let impactType: 'positive' | 'negative' | 'neutral' = 'neutral';
    let recommendationAction = 'maintain';

    if (event.action === 'like' || event.action === 'save' || (event.completionRate && event.completionRate >= 0.8)) {
      calibrationDelta = 0.15;
      impactType = 'positive';
      recommendationAction = 'strengthen_signals';
    } else if (event.action === 'skip') {
      calibrationDelta = -0.20;
      impactType = 'negative';
      recommendationAction = 'suppress_signals';
    }

    return {
      qualityScore,
      calibrationDelta,
      impactType,
      recommendationAction,
    };
  }
}
