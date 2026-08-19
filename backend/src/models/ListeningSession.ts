import { Schema, model, Document, Types } from 'mongoose';
import { ContextPreference } from '../schemas/contextPreferenceSchema.js';

export type SessionStatus = 'active' | 'paused' | 'ended';

export type SessionActionType = 'play' | 'skip' | 'like' | 'replay' | 'queue_add' | 'complete';

export interface ISessionPlayedSong {
  song: Types.ObjectId;
  playedAt: Date;
  playDurationSeconds?: number;
  completed?: boolean;
}

export interface ISessionEvent {
  song: Types.ObjectId;
  action: SessionActionType;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface IListeningSession extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  startTime: Date;
  lastActivityTime: Date;
  songsPlayed: ISessionPlayedSong[];
  sessionEvents: ISessionEvent[];
  currentSong?: Types.ObjectId;
  status: SessionStatus;
  contextSnapshot?: ContextPreference;
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
    },
    playDurationSeconds: {
      type: Number,
      min: 0,
    },
    completed: {
      type: Boolean,
      default: false,
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
    },
    lastActivityTime: {
      type: Date,
      default: Date.now,
      required: true,
    },
    songsPlayed: {
      type: [SessionPlayedSongSchema],
      default: [],
    },
    sessionEvents: {
      type: [SessionEventSchema],
      default: [],
    },
    currentSong: {
      type: Schema.Types.ObjectId,
      ref: 'Song',
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'ended'],
      default: 'active',
      required: true,
      index: true,
    },
    contextSnapshot: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to quickly locate active sessions per user
ListeningSessionSchema.index({ user: 1, status: 1 });

export const ListeningSession = model<IListeningSession>('ListeningSession', ListeningSessionSchema);
