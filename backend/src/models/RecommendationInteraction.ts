import { Schema, model, Document, Types } from 'mongoose';

export type ExplanationFeedbackType =
  | 'helpful'
  | 'not_relevant'
  | 'too_similar'
  | 'not_my_style'
  | 'thumbs_up'
  | 'thumbs_down';

export type RecommendationActionType =
  | 'impression'
  | 'click'
  | 'play'
  | 'like'
  | 'skip'
  | 'thumbs_up'
  | 'thumbs_down'
  | 'explanation_feedback';

export type RecommendationSourceType =
  | 'content'
  | 'collaborative'
  | 'hybrid'
  | 'trending'
  | 'personalized_feed'
  | string;

export interface IRecommendationInteraction extends Document {
  user: Types.ObjectId;
  song: Types.ObjectId;
  recommendationSource: RecommendationSourceType;
  action: RecommendationActionType;
  explanationFeedback?: ExplanationFeedbackType | string;
  metadata?: Record<string, any>;
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
      enum: [
        'impression',
        'click',
        'play',
        'like',
        'skip',
        'thumbs_up',
        'thumbs_down',
        'explanation_feedback',
      ],
      required: true,
      index: true,
    },
    explanationFeedback: {
      type: String,
      enum: ['helpful', 'not_relevant', 'too_similar', 'not_my_style', 'thumbs_up', 'thumbs_down'],
      required: false,
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
  },
  {
    timestamps: true,
  }
);

// Compound index for fast user analytics, feedback queries, and deduplication
recommendationInteractionSchema.index({ user: 1, action: 1, timestamp: -1 });
recommendationInteractionSchema.index({ user: 1, song: 1, action: 1 });
recommendationInteractionSchema.index({ user: 1, song: 1, explanationFeedback: 1 });

export const RecommendationInteraction = model<IRecommendationInteraction>(
  'RecommendationInteraction',
  recommendationInteractionSchema
);
