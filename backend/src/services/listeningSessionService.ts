import { Types } from 'mongoose';
import {
  ListeningSession,
  IListeningSession,
  SessionStatus,
  SessionActionType,
} from '../models/ListeningSession.js';
import { ContextPreference } from '../schemas/contextPreferenceSchema.js';
import { RecommendationInteractionTrackingService } from './recommendationInteractionTrackingService.js';
import { SessionPreferenceUpdateService } from './sessionPreferenceUpdateService.js';

export const SESSION_INACTIVITY_TIMEOUT_MINUTES = 30;

export class ListeningSessionService {
  /**
   * Retrieves active session for user.
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
      await session.save();
      return null;
    }

    return session;
  }

  /**
   * Creates a new active listening session for a user.
   * Automatically ends any existing active session before creating the new one.
   */
  static async createSession(params: {
    userId: string;
    initialSongId?: string;
    contextSnapshot?: ContextPreference;
  }): Promise<IListeningSession> {
    const { userId, initialSongId, contextSnapshot } = params;

    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID provided for session creation');
    }

    const userObjectId = new Types.ObjectId(userId);

    // End any existing active sessions
    await ListeningSession.updateMany(
      { user: userObjectId, status: 'active' },
      { $set: { status: 'ended', updatedAt: new Date() } }
    );

    const initialSongObjectId = initialSongId && Types.ObjectId.isValid(initialSongId)
      ? new Types.ObjectId(initialSongId)
      : undefined;

    const songsPlayed = initialSongObjectId
      ? [{ song: initialSongObjectId, playedAt: new Date(), completed: false }]
      : [];

    const newSession = new ListeningSession({
      user: userObjectId,
      startTime: new Date(),
      lastActivityTime: new Date(),
      status: 'active',
      currentSong: initialSongObjectId,
      songsPlayed,
      contextSnapshot,
    });

    return await newSession.save();
  }

  /**
   * Records a song playback event in the user's active session.
   * Gets or creates an active session if none exists.
   */
  static async recordSongPlayInSession(params: {
    userId: string;
    songId: string;
    durationSeconds?: number;
    completed?: boolean;
    contextSnapshot?: ContextPreference;
  }): Promise<IListeningSession> {
    const { userId, songId, durationSeconds, completed = false, contextSnapshot } = params;

    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }
    if (!songId || !Types.ObjectId.isValid(songId)) {
      throw new Error('Invalid song ID');
    }

    let session = await this.getActiveSession(userId);

    if (!session) {
      session = await this.createSession({
        userId,
        initialSongId: songId,
        contextSnapshot,
      });
      return session;
    }

    const songObjectId = new Types.ObjectId(songId);
    const now = new Date();

    session.lastActivityTime = now;
    session.currentSong = songObjectId;
    session.songsPlayed.push({
      song: songObjectId,
      playedAt: now,
      playDurationSeconds: durationSeconds,
      completed,
    });

    if (contextSnapshot) {
      session.contextSnapshot = contextSnapshot;
    }

    return await session.save();
  }

  /**
   * Records a real-time session interaction event (play, skip, like, replay, queue_add, complete)
   * for an active listening session. Creates a new active session if none exists.
   * Reuses recommendation interaction tracking where appropriate in a non-blocking call.
   * Triggers real-time session preference profile updates.
   */
  static async recordSessionEvent(params: {
    userId: string;
    songId: string;
    action: SessionActionType;
    metadata?: Record<string, any>;
  }): Promise<IListeningSession> {
    const { userId, songId, action, metadata } = params;

    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }
    if (!songId || !Types.ObjectId.isValid(songId)) {
      throw new Error('Invalid song ID');
    }

    const validActions: SessionActionType[] = ['play', 'skip', 'like', 'replay', 'queue_add', 'complete'];
    if (!validActions.includes(action)) {
      throw new Error(`Invalid session action: ${action}`);
    }

    let session = await this.getActiveSession(userId);
    if (!session) {
      session = await this.createSession({ userId, initialSongId: songId });
    }

    const songObjectId = new Types.ObjectId(songId);
    const now = new Date();

    session.lastActivityTime = now;
    if (action === 'play' || action === 'replay') {
      session.currentSong = songObjectId;
    }

    session.sessionEvents.push({
      song: songObjectId,
      action,
      timestamp: now,
      metadata,
    });

    // Reuse existing recommendation interaction tracking where appropriate (non-blocking call)
    if (action === 'play' || action === 'skip' || action === 'like') {
      RecommendationInteractionTrackingService.recordInteraction({
        userId,
        songId,
        action: action === 'play' ? 'play' : action === 'skip' ? 'skip' : 'like',
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
    return await session.save();
  }

  /**
   * Explicitly terminates active listening session for a user.
   */
  static async endActiveSession(userId: string): Promise<boolean> {
    if (!userId || !Types.ObjectId.isValid(userId)) return false;

    const result = await ListeningSession.updateMany(
      { user: new Types.ObjectId(userId), status: { $in: ['active', 'paused'] } },
      { $set: { status: 'ended', updatedAt: new Date() } }
    );

    return result.modifiedCount > 0;
  }
}
