import { Schema, model, Document, Types } from 'mongoose';

export type RecommendationActionType = 'impression' | 'click' | 'play' | 'like' | 'skip';

export type RecommendationSourceType = 'content' | 'collaborative' | 'hybrid' | 'trending' | 'personalized_feed' | string;

export interface IRecommendationInteraction extends Document {
  user: Types.ObjectId;
  song: Types.ObjectId;
  recommendationSource: RecommendationSourceType;
  action: RecommendationActionType;
  timestamp: Date;
}

const recommendationInteractionSchema = new Schema<IRecommendationInteraction>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    song: {
      type: Schema.Types.ObjectId,
      ref: 'Song',
      required: true,
      index: true,
    },
    recommendationSource: {
      type: String,
      required: true,
      default: 'hybrid',
      index: true,
    },
    action: {
      type: String,
      enum: ['impression', 'click', 'play', 'like', 'skip'],
      required: true,
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast user analytics and action tracking
recommendationInteractionSchema.index({ user: 1, action: 1, timestamp: -1 });
recommendationInteractionSchema.index({ user: 1, song: 1, action: 1 });

export const RecommendationInteraction = model<IRecommendationInteraction>(
  'RecommendationInteraction',
  recommendationInteractionSchema
);
