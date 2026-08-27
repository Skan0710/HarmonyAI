import { Schema, model, Document, Types, Model } from 'mongoose';
import {
  RecommendationContextAttributes,
  validateAndSanitizeRecommendationContext,
  normalizeListeningSituation,
  StandardListeningSituation,
} from '../schemas/recommendationContextSchema.js';

export interface IRecommendationContext extends Document, RecommendationContextAttributes {
  _id: Types.ObjectId;
  user?: Types.ObjectId;
  name?: string;
  isPreset: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRecommendationContextModel extends Model<IRecommendationContext> {
  getStandardPresets(): Promise<IRecommendationContext[]>;
  createValidatedContext(
    attributes: RecommendationContextAttributes & { name?: string; isPreset?: boolean },
    userId?: string
  ): Promise<IRecommendationContext>;
}

const recommendationContextSchema = new Schema<IRecommendationContext>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true,
    },
    name: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    situation: {
      type: String,
      required: true,
      trim: true,
      index: true,
      set: (val: string) => normalizeListeningSituation(val) || val,
    },
    mood: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    desiredEnergy: {
      type: Number,
      min: 0.0,
      max: 1.0,
    },
    desiredTempo: {
      type: Number,
      min: 30,
      max: 250,
    },
    preferredGenres: {
      type: [String],
      default: [],
    },
    discoveryLevel: {
      type: Number,
      min: 0.0,
      max: 1.0,
    },
    timeOfDay: {
      type: String,
      enum: ['morning', 'afternoon', 'evening', 'night', 'late_night', 'any'],
      default: 'any',
    },
    targetDurationMinutes: {
      type: Number,
      min: 1,
      max: 480,
    },
    isPreset: {
      type: Boolean,
      default: false,
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

// Compound indexes for user context lookups
recommendationContextSchema.index({ user: 1, situation: 1 });
recommendationContextSchema.index({ user: 1, createdAt: -1 });

// Pre-save validation hook
recommendationContextSchema.pre('save', function () {
  const result = validateAndSanitizeRecommendationContext({
    situation: this.situation,
    mood: this.mood,
    desiredEnergy: this.desiredEnergy,
    desiredTempo: this.desiredTempo,
    preferredGenres: this.preferredGenres,
    discoveryLevel: this.discoveryLevel,
    timeOfDay: this.timeOfDay,
    targetDurationMinutes: this.targetDurationMinutes,
    metadata: this.metadata,
  });

  if (result.sanitized.situation) {
    this.situation = result.sanitized.situation;
  }
  if (result.sanitized.desiredEnergy !== undefined) {
    this.desiredEnergy = result.sanitized.desiredEnergy;
  }
  if (result.sanitized.desiredTempo !== undefined) {
    this.desiredTempo = result.sanitized.desiredTempo;
  }
  if (result.sanitized.discoveryLevel !== undefined) {
    this.discoveryLevel = result.sanitized.discoveryLevel;
  }
  if (result.sanitized.preferredGenres) {
    this.preferredGenres = result.sanitized.preferredGenres;
  }
});

// Static helper to get standard presets
recommendationContextSchema.statics.getStandardPresets = async function (): Promise<
  IRecommendationContext[]
> {
  return await this.find({ isPreset: true }).sort({ name: 1 }).lean();
};

// Static helper to create a validated context
recommendationContextSchema.statics.createValidatedContext = async function (
  attributes: RecommendationContextAttributes & { name?: string; isPreset?: boolean },
  userId?: string
): Promise<IRecommendationContext> {
  const validation = validateAndSanitizeRecommendationContext(attributes);

  const docData: any = {
    ...validation.sanitized,
    name: attributes.name || validation.sanitized.situation || 'Custom Context',
    isPreset: Boolean(attributes.isPreset),
  };

  if (userId && Types.ObjectId.isValid(userId)) {
    docData.user = new Types.ObjectId(userId);
  }

  const contextDoc = new this(docData);
  return await contextDoc.save();
};

export const RecommendationContext = model<IRecommendationContext, IRecommendationContextModel>(
  'RecommendationContext',
  recommendationContextSchema
);
