import { Schema, model, Document, Types, Model } from 'mongoose';
import { ContextPreference } from '../schemas/contextPreferenceSchema.js';
import { RecommendationContextAttributes } from '../schemas/recommendationContextSchema.js';

export type SessionStatus = 'active' | 'paused' | 'ended';

export type SessionActionType = 'play' | 'skip' | 'like' | 'replay' | 'queue_add' | 'complete';

export interface ISessionPlayedSong {
  song: Types.ObjectId;
  playedAt: Date;
  playDurationSeconds?: number;
  completed?: boolean;
  metadata?: Record<string, any>;
}

export interface ISessionTrackSkip {
  song: Types.ObjectId;
  skippedAt: Date;
  playDurationBeforeSkipSeconds?: number;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface ISessionTrackComplete {
  song: Types.ObjectId;
  completedAt: Date;
  durationSeconds?: number;
  metadata?: Record<string, any>;
}

export interface ISessionEvent {
  song: Types.ObjectId;
  action: SessionActionType;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ISessionContext extends RecommendationContextAttributes {
  snapshotTakenAt?: Date;
  source?: string;
  [key: string]: any;
}

export interface IListeningSession extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  startTime: Date;
  endTime?: Date;
  lastActivityTime: Date;
  currentSong?: Types.ObjectId;
  currentTrack?: Types.ObjectId;
  songsPlayed: ISessionPlayedSong[];
  tracksPlayed: ISessionPlayedSong[];
  tracksSkipped: ISessionTrackSkip[];
  tracksCompleted: ISessionTrackComplete[];
  sessionEvents: ISessionEvent[];
  status: SessionStatus;
  sessionContext?: ISessionContext;
  contextSnapshot?: ContextPreference | ISessionContext;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const SessionPlayedSongSchema = new Schema<ISessionPlayedSong>(
  {
    song: {
      type: Schema.Types.ObjectId,
      ref: 'Song',
      required: true,
    },
    playedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    playDurationSeconds: {
      type: Number,
      min: 0,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  { _id: false }
);

const SessionTrackSkipSchema = new Schema<ISessionTrackSkip>(
  {
    song: {
      type: Schema.Types.ObjectId,
      ref: 'Song',
      required: true,
    },
    skippedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    playDurationBeforeSkipSeconds: {
      type: Number,
      min: 0,
    },
    reason: {
      type: String,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  { _id: false }
);

const SessionTrackCompleteSchema = new Schema<ISessionTrackComplete>(
  {
    song: {
      type: Schema.Types.ObjectId,
      ref: 'Song',
      required: true,
    },
    completedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    durationSeconds: {
      type: Number,
      min: 0,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  { _id: false }
);

const SessionEventSchema = new Schema<ISessionEvent>(
  {
    song: {
      type: Schema.Types.ObjectId,
      ref: 'Song',
      required: true,
    },
    action: {
      type: String,
      enum: ['play', 'skip', 'like', 'replay', 'queue_add', 'complete'],
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  { _id: false }
);

const ListeningSessionSchema = new Schema<IListeningSession>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    startTime: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },
    endTime: {
      type: Date,
      index: true,
    },
    lastActivityTime: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },
    currentSong: {
      type: Schema.Types.ObjectId,
      ref: 'Song',
    },
    currentTrack: {
      type: Schema.Types.ObjectId,
      ref: 'Song',
    },
    songsPlayed: {
      type: [SessionPlayedSongSchema],
      default: [],
    },
    tracksPlayed: {
      type: [SessionPlayedSongSchema],
      default: [],
    },
    tracksSkipped: {
      type: [SessionTrackSkipSchema],
      default: [],
    },
    tracksCompleted: {
      type: [SessionTrackCompleteSchema],
      default: [],
    },
    sessionEvents: {
      type: [SessionEventSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'ended'],
      default: 'active',
      required: true,
      index: true,
    },
    sessionContext: {
      type: Schema.Types.Mixed,
    },
    contextSnapshot: {
      type: Schema.Types.Mixed,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save synchronization hook to keep currentTrack/currentSong and songsPlayed/tracksPlayed aligned
ListeningSessionSchema.pre('save', function () {
  if (this.currentSong && !this.currentTrack) {
    this.currentTrack = this.currentSong;
  } else if (this.currentTrack && !this.currentSong) {
    this.currentSong = this.currentTrack;
  }

  if (this.songsPlayed && this.songsPlayed.length > 0 && (!this.tracksPlayed || this.tracksPlayed.length === 0)) {
    this.tracksPlayed = this.songsPlayed;
  } else if (this.tracksPlayed && this.tracksPlayed.length > 0 && (!this.songsPlayed || this.songsPlayed.length === 0)) {
    this.songsPlayed = this.tracksPlayed;
  }

  if (this.contextSnapshot && !this.sessionContext) {
    this.sessionContext = this.contextSnapshot as ISessionContext;
  } else if (this.sessionContext && !this.contextSnapshot) {
    this.contextSnapshot = this.sessionContext as ContextPreference;
  }
});

// Compound indexes for user active session lookups and historical analytics
ListeningSessionSchema.index({ user: 1, status: 1 });
ListeningSessionSchema.index({ user: 1, startTime: -1 });
ListeningSessionSchema.index({ user: 1, lastActivityTime: -1 });
ListeningSessionSchema.index({ status: 1, lastActivityTime: 1 });

export const ListeningSession: Model<IListeningSession> = model<IListeningSession>(
  'ListeningSession',
  ListeningSessionSchema
);

export default ListeningSession;
