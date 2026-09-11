import { supabase } from '../config/supabase.js';
import { isValidObjectId } from '../utils/validators.js';
import { ContextPreference } from '../schemas/contextPreferenceSchema.js';
import { RecommendationContextAttributes } from '../schemas/recommendationContextSchema.js';
import { RecommendationInteractionTrackingService } from './recommendationInteractionTrackingService.js';
import { SessionPreferenceUpdateService } from './sessionPreferenceUpdateService.js';

export const SESSION_INACTIVITY_TIMEOUT_MINUTES = 30;

export type SessionStatus = 'active' | 'paused' | 'ended';

export type SessionActionType = 'play' | 'skip' | 'like' | 'replay' | 'queue_add' | 'complete';

export interface ISessionPlayedSong {
  song: string;
  playedAt: string;
  playDurationSeconds?: number;
  completed?: boolean;
  metadata?: Record<string, any>;
}

export interface ISessionTrackSkip {
  song: string;
  skippedAt: string;
  playDurationBeforeSkipSeconds?: number;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface ISessionTrackComplete {
  song: string;
  completedAt: string;
  durationSeconds?: number;
  metadata?: Record<string, any>;
}

export interface ISessionEvent {
  song: string;
  action: SessionActionType;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface ISessionContext extends RecommendationContextAttributes {
  snapshotTakenAt?: string;
  source?: string;
  [key: string]: any;
}

export interface IListeningSession {
  _id: string;
  id: string;
  user: string;
  startTime: string;
  endTime?: string;
  lastActivityTime: string;
  currentSong?: string;
  currentTrack?: string;
  songsPlayed: ISessionPlayedSong[];
  tracksPlayed: ISessionPlayedSong[];
  tracksSkipped: ISessionTrackSkip[];
  tracksCompleted: ISessionTrackComplete[];
  sessionEvents: ISessionEvent[];
  status: SessionStatus;
  sessionContext?: ISessionContext;
  contextSnapshot?: ContextPreference | ISessionContext;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

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

function mapSessionRow(row: any): IListeningSession {
  const tracksPlayed: ISessionPlayedSong[] = row.tracks_played || [];
  const sessionContext = row.session_context && Object.keys(row.session_context).length > 0
    ? row.session_context
    : undefined;

  return {
    _id: row.id,
    id: row.id,
    user: row.user_id,
    startTime: row.session_start,
    endTime: row.session_end || undefined,
    lastActivityTime: row.last_activity_time,
    currentSong: row.current_song || undefined,
    currentTrack: row.current_song || undefined,
    songsPlayed: tracksPlayed,
    tracksPlayed,
    tracksSkipped: row.tracks_skipped || [],
    tracksCompleted: row.tracks_completed || [],
    sessionEvents: row.session_events || [],
    status: row.status,
    sessionContext,
    contextSnapshot: sessionContext,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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
    if (!userId || !isValidObjectId(userId)) {
      return null;
    }

    const { data, error } = await supabase
      .from('listening_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('last_activity_time', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const session = mapSessionRow(data);
    const now = new Date();
    const elapsedMinutes = (now.getTime() - new Date(session.lastActivityTime).getTime()) / (1000 * 60);

    if (elapsedMinutes > timeoutMinutes) {
      const nowIso = now.toISOString();
      await supabase
        .from('listening_sessions')
        .update({ status: 'ended', session_end: nowIso, updated_at: nowIso })
        .eq('id', session._id);
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

    if (!userId || !isValidObjectId(userId)) {
      throw new Error('Invalid user ID provided for session creation');
    }

    const now = new Date();
    const nowIso = now.toISOString();

    // Prevent multiple active sessions: terminate any existing active or paused sessions
    await supabase
      .from('listening_sessions')
      .update({ status: 'ended', session_end: nowIso, updated_at: nowIso })
      .eq('user_id', userId)
      .in('status', ['active', 'paused']);

    const validSongId = targetSongId && isValidObjectId(targetSongId) ? targetSongId : undefined;
    const initialPlay: ISessionPlayedSong[] = validSongId
      ? [{ song: validSongId, playedAt: nowIso, completed: false }]
      : [];

    const effectiveContext = (sessionContext || contextSnapshot) as any;

    const { data, error } = await supabase
      .from('listening_sessions')
      .insert({
        user_id: userId,
        session_start: nowIso,
        last_activity_time: nowIso,
        status: 'active',
        current_song: validSongId || null,
        tracks_played: initialPlay,
        tracks_skipped: [],
        tracks_completed: [],
        session_events: validSongId
          ? [{ song: validSongId, action: 'play', timestamp: nowIso }]
          : [],
        session_context: effectiveContext || {},
        metadata: metadata || {},
      } as any)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to start listening session: ${error?.message}`);
    }

    return mapSessionRow(data);
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
    if (!userId || !isValidObjectId(userId)) {
      throw new Error('Invalid user ID');
    }
    if (!effectiveSongId || !isValidObjectId(effectiveSongId)) {
      throw new Error('Invalid song ID');
    }

    const effectiveDuration = durationSeconds ?? playDurationSeconds;
    const effectiveContext = (sessionContext || contextSnapshot) as any;

    const session = await this.getActiveSession(userId);

    if (!session) {
      return await this.startSession({
        userId,
        initialSongId: effectiveSongId,
        sessionContext: effectiveContext,
        metadata,
      });
    }

    const now = new Date();
    const nowIso = now.toISOString();

    const playRecord: ISessionPlayedSong = {
      song: effectiveSongId,
      playedAt: nowIso,
      playDurationSeconds: effectiveDuration,
      completed,
      metadata,
    };

    const tracksPlayed = [...session.songsPlayed, playRecord];
    const sessionEvents = [
      ...session.sessionEvents,
      { song: effectiveSongId, action: 'play' as SessionActionType, timestamp: nowIso, metadata },
    ];
    const tracksCompleted = completed
      ? [
          ...session.tracksCompleted,
          { song: effectiveSongId, completedAt: nowIso, durationSeconds: effectiveDuration, metadata },
        ]
      : session.tracksCompleted;

    const updatePayload: Record<string, any> = {
      last_activity_time: nowIso,
      current_song: effectiveSongId,
      tracks_played: tracksPlayed,
      session_events: sessionEvents,
      tracks_completed: tracksCompleted,
      updated_at: nowIso,
    };
    if (effectiveContext) {
      updatePayload.session_context = effectiveContext;
    }

    const { data, error } = await supabase
      .from('listening_sessions')
      .update(updatePayload as any)
      .eq('id', session._id)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to record track play: ${error?.message}`);
    }

    const saved = mapSessionRow(data);

    // Reuse existing recommendation interaction tracking (non-blocking call)
    RecommendationInteractionTrackingService.recordInteraction({
      userId,
      songId: effectiveSongId,
      action: 'play',
      recommendationSource: (metadata?.recommendationSource as any) || 'session',
    }).catch(() => {});

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
    if (!userId || !isValidObjectId(userId)) {
      throw new Error('Invalid user ID');
    }
    if (!effectiveSongId || !isValidObjectId(effectiveSongId)) {
      throw new Error('Invalid song ID');
    }

    const effectiveSkipDuration = durationBeforeSkipSeconds ?? playDurationBeforeSkipSeconds;

    const session = (await this.getActiveSession(userId)) || (await this.startSession({ userId, initialSongId: effectiveSongId }));

    const now = new Date();
    const nowIso = now.toISOString();

    const sessionEvents = [
      ...session.sessionEvents,
      { song: effectiveSongId, action: 'skip' as SessionActionType, timestamp: nowIso, metadata },
    ];
    const tracksSkipped = [
      ...session.tracksSkipped,
      {
        song: effectiveSongId,
        skippedAt: nowIso,
        playDurationBeforeSkipSeconds: effectiveSkipDuration,
        reason: reason || metadata?.reason,
        metadata,
      },
    ];

    const { data, error } = await supabase
      .from('listening_sessions')
      .update({
        last_activity_time: nowIso,
        session_events: sessionEvents,
        tracks_skipped: tracksSkipped,
        updated_at: nowIso,
      } as any)
      .eq('id', session._id)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to record track skip: ${error?.message}`);
    }

    const saved = mapSessionRow(data);

    RecommendationInteractionTrackingService.recordInteraction({
      userId,
      songId: effectiveSongId,
      action: 'skip',
      recommendationSource: (metadata?.recommendationSource as any) || 'session',
    }).catch(() => {});

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

    if (!userId || !isValidObjectId(userId)) {
      throw new Error('Invalid user ID');
    }
    if (!effectiveSongId || !isValidObjectId(effectiveSongId)) {
      throw new Error('Invalid song ID');
    }

    const session = (await this.getActiveSession(userId)) || (await this.startSession({ userId, initialSongId: effectiveSongId }));

    const now = new Date();
    const nowIso = now.toISOString();

    const sessionEvents = [
      ...session.sessionEvents,
      { song: effectiveSongId, action: 'complete' as SessionActionType, timestamp: nowIso, metadata },
    ];
    const tracksCompleted = [
      ...session.tracksCompleted,
      { song: effectiveSongId, completedAt: nowIso, durationSeconds, metadata },
    ];

    // Mark completed in the most recent matching play record
    const tracksPlayed = [...session.songsPlayed];
    for (let i = tracksPlayed.length - 1; i >= 0; i -= 1) {
      if (String(tracksPlayed[i].song) === String(effectiveSongId)) {
        tracksPlayed[i] = { ...tracksPlayed[i], completed: true };
        break;
      }
    }

    const { data, error } = await supabase
      .from('listening_sessions')
      .update({
        last_activity_time: nowIso,
        session_events: sessionEvents,
        tracks_completed: tracksCompleted,
        tracks_played: tracksPlayed,
        updated_at: nowIso,
      } as any)
      .eq('id', session._id)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to record track completion: ${error?.message}`);
    }

    const saved = mapSessionRow(data);

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

    if (!userId || !isValidObjectId(userId)) {
      throw new Error('Invalid user ID');
    }
    if (!effectiveSongId || !isValidObjectId(effectiveSongId)) {
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

    const session = (await this.getActiveSession(userId)) || (await this.startSession({ userId, initialSongId: effectiveSongId }));

    const now = new Date();
    const nowIso = now.toISOString();

    const sessionEvents = [
      ...session.sessionEvents,
      { song: effectiveSongId, action, timestamp: nowIso, metadata },
    ];

    const updatePayload: Record<string, any> = {
      last_activity_time: nowIso,
      session_events: sessionEvents,
      updated_at: nowIso,
    };
    if (action === 'play' || action === 'replay') {
      updatePayload.current_song = effectiveSongId;
    }

    const { data, error } = await supabase
      .from('listening_sessions')
      .update(updatePayload as any)
      .eq('id', session._id)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to record session event: ${error?.message}`);
    }

    const savedSession = mapSessionRow(data);

    // Reuse existing recommendation interaction tracking where appropriate (non-blocking call)
    if (action === 'play' || action === 'like') {
      RecommendationInteractionTrackingService.recordInteraction({
        userId,
        songId: effectiveSongId,
        action: action === 'play' ? 'play' : 'like',
        recommendationSource: (metadata?.recommendationSource as any) || 'session',
      }).catch(() => {});
    }

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
    if (!sessionId || !isValidObjectId(sessionId)) return null;
    if (!userId || !isValidObjectId(userId)) return null;

    const nowIso = new Date().toISOString();
    const updatePayload: Record<string, any> = { status, last_activity_time: nowIso, updated_at: nowIso };
    if (status === 'ended') {
      updatePayload.session_end = nowIso;
    }

    const { data, error } = await supabase
      .from('listening_sessions')
      .update(updatePayload as any)
      .eq('id', sessionId)
      .eq('user_id', userId)
      .select()
      .maybeSingle();

    if (error || !data) return null;

    return mapSessionRow(data);
  }

  /**
   * Ends the active listening session for a user.
   */
  static async endActiveSession(userId: string): Promise<boolean> {
    if (!userId || !isValidObjectId(userId)) return false;

    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('listening_sessions')
      .update({ status: 'ended', session_end: nowIso, updated_at: nowIso })
      .eq('user_id', userId)
      .in('status', ['active', 'paused'])
      .select('id');

    if (error) return false;
    return (data?.length || 0) > 0;
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
    const cutoffIso = new Date(Date.now() - timeoutMinutes * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
      .from('listening_sessions')
      .update({ status: 'ended', session_end: nowIso, updated_at: nowIso })
      .eq('status', 'active')
      .lt('last_activity_time', cutoffIso)
      .select('id');

    if (error) return 0;
    return data?.length || 0;
  }
}

export default ListeningSessionService;
