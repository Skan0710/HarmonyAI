import { Schema, model, Document, Types, Model } from 'mongoose';

export type TemporalTimeWindow = 'short_term' | 'medium_term' | 'long_term';

export const TEMPORAL_TIME_WINDOWS = ['short_term', 'medium_term', 'long_term'] as const;

export const TIME_WINDOW_DURATIONS_DAYS = {
  short_term: 14,
  medium_term: 60,
  long_term: 180,
} as const;

export const TimeWindow = {
  SHORT_TERM: 'short_term' as TemporalTimeWindow,
  MEDIUM_TERM: 'medium_term' as TemporalTimeWindow,
  LONG_TERM: 'long_term' as TemporalTimeWindow,
} as const;

/**
 * Normalizes input time window strings into the canonical values:
 * 'short_term', 'medium_term', 'long_term'.
 */
export function normalizeTimeWindow(input?: string): TemporalTimeWindow {
  if (!input) return 'medium_term';
  const clean = input.toLowerCase().trim().replace(/-/g, '_');
  if (clean === 'short' || clean === 'short_term' || clean === 'shortterm') {
    return 'short_term';
  }
  if (clean === 'medium' || clean === 'medium_term' || clean === 'mediumterm') {
    return 'medium_term';
  }
  if (clean === 'long' || clean === 'long_term' || clean === 'longterm') {
    return 'long_term';
  }
  return 'medium_term';
}

export interface ITemporalPreference extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  user?: Types.ObjectId;
  genre?: Types.ObjectId | string;
  artist?: Types.ObjectId | string;
  mood?: string;
  preferenceScore: number;
  interactionCount: number;
  lastInteractionAt: Date;
  timeWindow: TemporalTimeWindow;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITemporalPreferenceModel extends Model<ITemporalPreference> {
  normalizeTimeWindow(window?: string): TemporalTimeWindow;
  findByUserAndTimeWindow(
    userId: string | Types.ObjectId,
    timeWindow: TemporalTimeWindow | string
  ): Promise<ITemporalPreference[]>;
  getTopPreferences(
    userId: string | Types.ObjectId,
    timeWindow?: TemporalTimeWindow | string,
    limit?: number
  ): Promise<ITemporalPreference[]>;
}

const temporalPreferenceSchema = new Schema<ITemporalPreference, ITemporalPreferenceModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId is required'],
      index: true,
      alias: 'user',
    },
    genre: {
      type: Schema.Types.Mixed,
      ref: 'Genre',
      required: false,
      index: true,
    },
    artist: {
      type: Schema.Types.Mixed,
      ref: 'Artist',
      required: false,
      index: true,
    },
    mood: {
      type: String,
      trim: true,
      required: false,
      index: true,
    },
    preferenceScore: {
      type: Number,
      required: [true, 'preferenceScore is required'],
      default: 0.5,
      min: [0, 'preferenceScore must be at least 0'],
      max: [1, 'preferenceScore cannot exceed 1'],
    },
    interactionCount: {
      type: Number,
      required: [true, 'interactionCount is required'],
      default: 1,
      min: [0, 'interactionCount cannot be negative'],
    },
    lastInteractionAt: {
      type: Date,
      required: [true, 'lastInteractionAt is required'],
      default: Date.now,
      index: true,
    },
    timeWindow: {
      type: String,
      required: [true, 'timeWindow is required'],
      enum: [
        'short_term',
        'medium_term',
        'long_term',
        'short-term',
        'medium-term',
        'long-term',
        'shortTerm',
        'mediumTerm',
        'longTerm',
      ],
      set: (val: string) => normalizeTimeWindow(val),
      index: true,
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

// Compound indexes for high-performance temporal querying and ranking
temporalPreferenceSchema.index({ userId: 1, timeWindow: 1, preferenceScore: -1 });
temporalPreferenceSchema.index({ userId: 1, genre: 1, timeWindow: 1 });
temporalPreferenceSchema.index({ userId: 1, artist: 1, timeWindow: 1 });
temporalPreferenceSchema.index({ userId: 1, mood: 1, timeWindow: 1 });
temporalPreferenceSchema.index({ userId: 1, lastInteractionAt: -1 });

// Static methods
temporalPreferenceSchema.statics.normalizeTimeWindow = normalizeTimeWindow;

temporalPreferenceSchema.statics.findByUserAndTimeWindow = function (
  userId: string | Types.ObjectId,
  timeWindow: TemporalTimeWindow | string
) {
  const normalizedWindow = normalizeTimeWindow(timeWindow);
  const uid = typeof userId === 'string' && Types.ObjectId.isValid(userId)
    ? new Types.ObjectId(userId)
    : userId;

  return this.find({
    userId: uid,
    timeWindow: normalizedWindow,
  }).sort({ preferenceScore: -1 });
};

temporalPreferenceSchema.statics.getTopPreferences = function (
  userId: string | Types.ObjectId,
  timeWindow: TemporalTimeWindow | string = 'medium_term',
  limit: number = 20
) {
  const normalizedWindow = normalizeTimeWindow(timeWindow);
  const uid = typeof userId === 'string' && Types.ObjectId.isValid(userId)
    ? new Types.ObjectId(userId)
    : userId;

  return this.find({
    userId: uid,
    timeWindow: normalizedWindow,
  })
    .sort({ preferenceScore: -1 })
    .limit(limit);
};

export const TemporalPreference = model<ITemporalPreference, ITemporalPreferenceModel>(
  'TemporalPreference',
  temporalPreferenceSchema
);
