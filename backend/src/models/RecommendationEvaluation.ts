import { Schema, model, Document, Types, Model } from 'mongoose';

export interface IRecommendationEvaluation extends Document {
  userId: Types.ObjectId;
  user?: Types.ObjectId; // Alias for compatibility with User-centric schemas
  recommendationId?: string;
  recommendationRef?: Types.ObjectId; // Optional reference to RecommendationInteraction
  songId: Types.ObjectId;
  song?: Types.ObjectId; // Alias
  source: string; // e.g. 'hybrid', 'content', 'collaborative', 'temporal'
  signals: string[]; // List of contributing recommendation signals
  recommendationScore?: number;
  componentScores?: Record<string, number>;
  played: boolean;
  skipped: boolean;
  liked: boolean;
  saved: boolean;
  listeningDuration?: number; // In seconds
  completionRate?: number; // 0.0 to 1.0
  evaluationScore: number; // Computed quality score (e.g., 0.0 to 1.0 or normalized)
  metadata?: Record<string, any>;
  timestamp: Date;
  evaluatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRecommendationEvaluationModel extends Model<IRecommendationEvaluation> {
  computeScore(data: {
    played?: boolean;
    skipped?: boolean;
    liked?: boolean;
    saved?: boolean;
    completionRate?: number;
  }): number;
  findByUser(
    userId: string | Types.ObjectId,
    options?: { limit?: number; skip?: number; since?: Date }
  ): Promise<IRecommendationEvaluation[]>;
}

const recommendationEvaluationSchema = new Schema<IRecommendationEvaluation, IRecommendationEvaluationModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    recommendationId: {
      type: String,
      required: false,
      index: true,
    },
    recommendationRef: {
      type: Schema.Types.ObjectId,
      ref: 'RecommendationInteraction',
      required: false,
    },
    songId: {
      type: Schema.Types.ObjectId,
      ref: 'Song',
      required: true,
      index: true,
    },
    song: {
      type: Schema.Types.ObjectId,
      ref: 'Song',
      required: false,
    },
    source: {
      type: String,
      required: true,
      default: 'hybrid',
      index: true,
    },
    signals: {
      type: [String],
      default: [],
      index: true,
    },
    recommendationScore: {
      type: Number,
      default: 0,
    },
    componentScores: {
      type: Schema.Types.Mixed,
      default: {},
    },
    played: {
      type: Boolean,
      default: false,
      index: true,
    },
    skipped: {
      type: Boolean,
      default: false,
      index: true,
    },
    liked: {
      type: Boolean,
      default: false,
      index: true,
    },
    saved: {
      type: Boolean,
      default: false,
      index: true,
    },
    listeningDuration: {
      type: Number,
      required: false,
    },
    completionRate: {
      type: Number,
      required: false,
      min: 0,
      max: 1,
    },
    evaluationScore: {
      type: Number,
      default: 0,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    evaluatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for analytical queries and performance tracking
recommendationEvaluationSchema.index({ userId: 1, timestamp: -1 });
recommendationEvaluationSchema.index({ userId: 1, songId: 1 });
recommendationEvaluationSchema.index({ userId: 1, source: 1, timestamp: -1 });
recommendationEvaluationSchema.index({ userId: 1, evaluationScore: -1 });
recommendationEvaluationSchema.index({ source: 1, timestamp: -1 });

// Ensure user alias is populated if userId exists
recommendationEvaluationSchema.pre('save', function () {
  if (this.userId && !this.user) {
    this.user = this.userId;
  }
  if (this.songId && !this.song) {
    this.song = this.songId;
  }
});

/**
 * Static score computer for recommendation evaluations.
 * Normalized between 0.0 and 1.0.
 */
recommendationEvaluationSchema.statics.computeScore = function (data: {
  played?: boolean;
  skipped?: boolean;
  liked?: boolean;
  saved?: boolean;
  completionRate?: number;
}): number {
  if (data.skipped) {
    // A skip without high completion is a strong negative signal
    const completion = Math.max(0, Math.min(1, data.completionRate ?? 0));
    return Math.max(0, Math.round(completion * 0.2 * 1000) / 1000);
  }

  let score = 0;
  if (data.played) score += 0.25;
  if (data.liked) score += 0.35;
  if (data.saved) score += 0.25;

  if (typeof data.completionRate === 'number' && !isNaN(data.completionRate)) {
    const comp = Math.max(0, Math.min(1, data.completionRate));
    score += comp * 0.15;
  } else if (data.played) {
    // If completion is unavailable but played, assume default moderate completion
    score += 0.1;
  }

  return Math.min(1, Math.max(0, Math.round(score * 1000) / 1000));
};

/**
 * Static helper to find evaluations for a user
 */
recommendationEvaluationSchema.statics.findByUser = async function (
  userId: string | Types.ObjectId,
  options: { limit?: number; skip?: number; since?: Date } = {}
): Promise<IRecommendationEvaluation[]> {
  const uid = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
  const query: any = { userId: uid };
  if (options.since) {
    query.timestamp = { $gte: options.since };
  }
  let cursor = this.find(query).sort({ timestamp: -1 });
  if (options.skip) cursor = cursor.skip(options.skip);
  if (options.limit) cursor = cursor.limit(options.limit);
  return cursor.exec();
};

export const RecommendationEvaluation = model<IRecommendationEvaluation, IRecommendationEvaluationModel>(
  'RecommendationEvaluation',
  recommendationEvaluationSchema
);
