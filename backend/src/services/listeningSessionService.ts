import { Types } from 'mongoose';
import {
  ListeningSession,
  IListeningSession,
  SessionStatus,
  SessionActionType,
  ISessionContext,
} from '../models/ListeningSession.js';
import { ContextPreference } from '../schemas/contextPreferenceSchema.js';
import { RecommendationContextAttributes } from '../schemas/recommendationContextSchema.js';
import { RecommendationInteractionTrackingService } from './recommendationInteractionTrackingService.js';
import { SessionPreferenceUpdateService } from './sessionPreferenceUpdateService.js';

export const SESSION_INACTIVITY_TIMEOUT_MINUTES = 30;

export interface StartSessionParams {
  userId: string;
  initialSongId?: string;
  initialTrackId?: string;
  contextSnapshot?: ContextPreference | ISessionContext;
  sessionContext?: ISessionContext | RecommendationContextAttributes;
  metadata?: Record<string, any>;
}

export interface RecordTrackPlayParams {
  userId: string;
  songId?: string;
  trackId?: string;
  durationSeconds?: number;
  playDurationSeconds?: number;
  completed?: boolean;
  contextSnapshot?: ContextPreference | ISessionContext;
  sessionContext?: ISessionContext | RecommendationContextAttributes;
  metadata?: Record<string, any>;
}

export interface RecordTrackSkipParams {
  userId: string;
  songId?: string;
  trackId?: string;
  durationBeforeSkipSeconds?: number;
  playDurationBeforeSkipSeconds?: number;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface RecordTrackCompletionParams {
  userId: string;
  songId?: string;
  trackId?: string;
  durationSeconds?: number;
  metadata?: Record<string, any>;
}

export interface RecordSessionEventParams {
  userId: string;
  songId?: string;
  trackId?: string;
  action: SessionActionType;
  metadata?: Record<string, any>;
}

export class ListeningSessionService {
  /**
   * Retrieves the currently active session for a user.
   * If lastActivityTime is older than timeoutMinutes (default 30 mins), automatically marks session as 'ended' and returns null.
   */
  static async getActiveSession(
    userId: string,
    timeoutMinutes: number = SESSION_INACTIVITY_TIMEOUT_MINUTES
  ): Promise<IListeningSession | null> {
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return null;
    }

    const session = await ListeningSession.findOne({
      user: new Types.ObjectId(userId),
      status: 'active',
    }).sort({ lastActivityTime: -1 });

    if (!session) {
      return null;
    }

    const now = new Date();
    const elapsedMinutes = (now.getTime() - session.lastActivityTime.getTime()) / (1000 * 60);

    if (elapsedMinutes > timeoutMinutes) {
      session.status = 'ended';
      session.endTime = now;
      await session.save();
      return null;
    }

    return session;
  }

  /**
   * Starts a new active listening session for a user.
   * Prevents multiple active sessions by automatically ending any previous active sessions.
   */
  static async startSession(params: StartSessionParams): Promise<IListeningSession> {
    const { userId, initialSongId, initialTrackId, contextSnapshot, sessionContext, metadata } = params;
    const targetSongId = initialSongId || initialTrackId;

    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID provided for session creation');
    }

    const userObjectId = new Types.ObjectId(userId);
    const now = new Date();

    // Prevent multiple active sessions: terminate any existing active or paused sessions
    await ListeningSession.updateMany(
      { user: userObjectId, status: { $in: ['active', 'paused'] } },
      { $set: { status: 'ended', endTime: now, updatedAt: now } }
    );

    const initialSongObjectId = targetSongId && Types.ObjectId.isValid(targetSongId)
      ? new Types.ObjectId(targetSongId)
      : undefined;

    const initialPlay = initialSongObjectId
      ? [{ song: initialSongObjectId, playedAt: now, completed: false }]
      : [];

    const effectiveContext = (sessionContext || contextSnapshot) as any;

    const newSession = new ListeningSession({
      user: userObjectId,
      startTime: now,
      lastActivityTime: now,
      status: 'active',
      currentSong: initialSongObjectId,
      currentTrack: initialSongObjectId,
      songsPlayed: initialPlay,
      tracksPlayed: initialPlay,
      tracksSkipped: [],
      tracksCompleted: [],
      sessionEvents: initialSongObjectId
        ? [{ song: initialSongObjectId, action: 'play', timestamp: now }]
        : [],
      contextSnapshot: effectiveContext,
      sessionContext: effectiveContext,
      metadata: metadata || {},
    });

    return await newSession.save();
  }

  /**
   * Alias for startSession to maintain backward compatibility.
   */
  static async createSession(params: StartSessionParams): Promise<IListeningSession> {
    return this.startSession(params);
  }

  /**
   * Records a track playback event in the user's active session.
   * Automatically associates with active session, or starts a new session if none is active.
   */
  static async recordTrackPlay(params: RecordTrackPlayParams): Promise<IListeningSession> {
    const {
      userId,
      songId,
      trackId,
      durationSeconds,
      playDurationSeconds,
      completed = false,
      contextSnapshot,
      sessionContext,
      metadata,
    } = params;

    const effectiveSongId = songId || trackId;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }
    if (!effectiveSongId || !Types.ObjectId.isValid(effectiveSongId)) {
      throw new Error('Invalid song ID');
    }

    const effectiveDuration = durationSeconds ?? playDurationSeconds;
    const effectiveContext = (sessionContext || contextSnapshot) as any;

    let session = await this.getActiveSession(userId);

    if (!session) {
      session = await this.startSession({
        userId,
        initialSongId: effectiveSongId,
        sessionContext: effectiveContext,
        metadata,
      });
      return session;
    }

    const songObjectId = new Types.ObjectId(effectiveSongId);
    const now = new Date();

    session.lastActivityTime = now;
    session.currentSong = songObjectId;
    session.currentTrack = songObjectId;

    const playRecord = {
      song: songObjectId,
      playedAt: now,
      playDurationSeconds: effectiveDuration,
      completed,
      metadata,
    };

    session.songsPlayed.push(playRecord);
    if (!session.tracksPlayed) session.tracksPlayed = [];
    session.tracksPlayed.push(playRecord);

    session.sessionEvents.push({
      song: songObjectId,
      action: 'play',
      timestamp: now,
      metadata,
    });

    if (completed) {
      if (!session.tracksCompleted) session.tracksCompleted = [];
      session.tracksCompleted.push({
        song: songObjectId,
        completedAt: now,
        durationSeconds: effectiveDuration,
        metadata,
      });
    }

    if (effectiveContext) {
      session.contextSnapshot = effectiveContext;
      session.sessionContext = effectiveContext;
    }

    // Reuse existing recommendation interaction tracking (non-blocking call)
    RecommendationInteractionTrackingService.recordInteraction({
      userId,
      songId: effectiveSongId,
      action: 'play',
      recommendationSource: (metadata?.recommendationSource as any) || 'session',
    }).catch(() => {});

    const saved = await session.save();

    // Trigger non-blocking real-time session profile update
    SessionPreferenceUpdateService.updateSessionProfileFromInteractions(saved).catch((err) => {
      console.warn(`[ListeningSessionService Warning]: Session preference update failed: ${err.message}`);
    });

    return saved;
  }

  /**
   * Alias for recordTrackPlay to preserve backward compatibility.
   */
  static async recordSongPlayInSession(params: RecordTrackPlayParams): Promise<IListeningSession> {
    return this.recordTrackPlay(params);
  }

  /**
   * Records a track skip in the active user session.
   */
  static async recordTrackSkip(params: RecordTrackSkipParams): Promise<IListeningSession> {
    const {
      userId,
      songId,
      trackId,
      durationBeforeSkipSeconds,
      playDurationBeforeSkipSeconds,
      reason,
      metadata,
    } = params;

    const effectiveSongId = songId || trackId;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }
    if (!effectiveSongId || !Types.ObjectId.isValid(effectiveSongId)) {
      throw new Error('Invalid song ID');
    }

    const effectiveSkipDuration = durationBeforeSkipSeconds ?? playDurationBeforeSkipSeconds;

    let session = await this.getActiveSession(userId);
    if (!session) {
      session = await this.startSession({ userId, initialSongId: effectiveSongId });
    }

    const songObjectId = new Types.ObjectId(effectiveSongId);
    const now = new Date();

    session.lastActivityTime = now;

    session.sessionEvents.push({
      song: songObjectId,
      action: 'skip',
      timestamp: now,
      metadata,
    });

    if (!session.tracksSkipped) session.tracksSkipped = [];
    session.tracksSkipped.push({
      song: songObjectId,
      skippedAt: now,
      playDurationBeforeSkipSeconds: effectiveSkipDuration,
      reason: reason || metadata?.reason,
      metadata,
    });

    // Reuse existing recommendation interaction tracking (non-blocking call)
    RecommendationInteractionTrackingService.recordInteraction({
      userId,
      songId: effectiveSongId,
      action: 'skip',
      recommendationSource: (metadata?.recommendationSource as any) || 'session',
    }).catch(() => {});

    const saved = await session.save();

    SessionPreferenceUpdateService.updateSessionProfileFromInteractions(saved).catch((err) => {
      console.warn(`[ListeningSessionService Warning]: Session preference update failed: ${err.message}`);
    });

    return saved;
  }

  /**
   * Records a track completion in the active user session.
   */
  static async recordTrackCompletion(params: RecordTrackCompletionParams): Promise<IListeningSession> {
    const { userId, songId, trackId, durationSeconds, metadata } = params;
    const effectiveSongId = songId || trackId;

    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }
    if (!effectiveSongId || !Types.ObjectId.isValid(effectiveSongId)) {
      throw new Error('Invalid song ID');
    }

    let session = await this.getActiveSession(userId);
    if (!session) {
      session = await this.startSession({ userId, initialSongId: effectiveSongId });
    }

    const songObjectId = new Types.ObjectId(effectiveSongId);
    const now = new Date();

    session.lastActivityTime = now;

    session.sessionEvents.push({
      song: songObjectId,
      action: 'complete',
      timestamp: now,
      metadata,
    });

    if (!session.tracksCompleted) session.tracksCompleted = [];
    session.tracksCompleted.push({
      song: songObjectId,
      completedAt: now,
      durationSeconds,
      metadata,
    });

    // Mark completed in songsPlayed/tracksPlayed
    const lastPlay = [...session.songsPlayed].reverse().find(
      (p) => p.song.toString() === songObjectId.toString()
    );
    if (lastPlay) {
      lastPlay.completed = true;
    }

    const saved = await session.save();

    SessionPreferenceUpdateService.updateSessionProfileFromInteractions(saved).catch((err) => {
      console.warn(`[ListeningSessionService Warning]: Session preference update failed: ${err.message}`);
    });

    return saved;
  }

  /**
   * Records a generalized real-time session interaction event (play, skip, like, replay, queue_add, complete).
   */
  static async recordSessionEvent(params: RecordSessionEventParams): Promise<IListeningSession> {
    const { userId, songId, trackId, action, metadata } = params;
    const effectiveSongId = songId || trackId;

    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }
    if (!effectiveSongId || !Types.ObjectId.isValid(effectiveSongId)) {
      throw new Error('Invalid song ID');
    }

    const validActions: SessionActionType[] = [
      'play',
      'skip',
      'like',
      'replay',
      'queue_add',
      'complete',
    ];
    if (!validActions.includes(action)) {
      throw new Error(`Invalid session action: ${action}`);
    }

    if (action === 'skip') {
      return this.recordTrackSkip({
        userId,
        songId: effectiveSongId,
        durationBeforeSkipSeconds: metadata?.durationBeforeSkipSeconds || metadata?.playDurationSeconds,
        reason: metadata?.reason,
        metadata,
      });
    }

    if (action === 'complete') {
      return this.recordTrackCompletion({
        userId,
        songId: effectiveSongId,
        durationSeconds: metadata?.durationSeconds || metadata?.playDurationSeconds,
        metadata,
      });
    }

    let session = await this.getActiveSession(userId);
    if (!session) {
      session = await this.startSession({ userId, initialSongId: effectiveSongId });
    }

    const songObjectId = new Types.ObjectId(effectiveSongId);
    const now = new Date();

    session.lastActivityTime = now;
    if (action === 'play' || action === 'replay') {
      session.currentSong = songObjectId;
      session.currentTrack = songObjectId;
    }

    session.sessionEvents.push({
      song: songObjectId,
      action,
      timestamp: now,
      metadata,
    });

    // Reuse existing recommendation interaction tracking where appropriate (non-blocking call)
    if (action === 'play' || action === 'like') {
      RecommendationInteractionTrackingService.recordInteraction({
        userId,
        songId: effectiveSongId,
        action: action === 'play' ? 'play' : 'like',
        recommendationSource: (metadata?.recommendationSource as any) || 'session',
      }).catch(() => {});
    }

    const savedSession = await session.save();

    // Trigger non-blocking real-time session profile update
    SessionPreferenceUpdateService.updateSessionProfileFromInteractions(savedSession).catch((err) => {
      console.warn(`[ListeningSessionService Warning]: Session preference update failed: ${err.message}`);
    });

    return savedSession;
  }

  /**
   * Updates session status ('active', 'paused', 'ended').
   */
  static async updateSessionStatus(
    sessionId: string,
    userId: string,
    status: SessionStatus
  ): Promise<IListeningSession | null> {
    if (!sessionId || !Types.ObjectId.isValid(sessionId)) return null;
    if (!userId || !Types.ObjectId.isValid(userId)) return null;

    const session = await ListeningSession.findOne({
      _id: new Types.ObjectId(sessionId),
      user: new Types.ObjectId(userId),
    });

    if (!session) return null;

    session.status = status;
    session.lastActivityTime = new Date();
    if (status === 'ended') {
      session.endTime = new Date();
    }

    return await session.save();
  }

  /**
   * Ends the active listening session for a user.
   */
  static async endActiveSession(userId: string): Promise<boolean> {
    if (!userId || !Types.ObjectId.isValid(userId)) return false;

    const now = new Date();
    const result = await ListeningSession.updateMany(
      { user: new Types.ObjectId(userId), status: { $in: ['active', 'paused'] } },
      { $set: { status: 'ended', endTime: now, updatedAt: now } }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Alias for endActiveSession.
   */
  static async endSession(userId: string): Promise<boolean> {
    return this.endActiveSession(userId);
  }

  /**
   * Periodically cleans up stale inactive sessions across the database.
   */
  static async cleanExpiredSessions(
    timeoutMinutes: number = SESSION_INACTIVITY_TIMEOUT_MINUTES
  ): Promise<number> {
    const cutoffTime = new Date(Date.now() - timeoutMinutes * 60 * 1000);
    const now = new Date();

    const result = await ListeningSession.updateMany(
      { status: 'active', lastActivityTime: { $lt: cutoffTime } },
      { $set: { status: 'ended', endTime: now, updatedAt: now } }
    );

    return result.modifiedCount;
  }
}

export default ListeningSessionService;
