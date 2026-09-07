import { Schema, model, Document, Types, Model } from 'mongoose';
import {
  PersonalMusicTwinAttributes,
  ITwinMusicalTraits,
  ITwinGenreIdentity,
  ITwinMoodIdentity,
  ITwinListeningBehavior,
  ITwinTasteStability,
  ITwinTasteEvolution,
  ITwinEmergingInterests,
  ITwinPersonalityProfile,
  ITwinCompatibilityDimensions,
  DEFAULT_MUSICAL_TRAITS,
  DEFAULT_GENRE_IDENTITY,
  DEFAULT_MOOD_IDENTITY,
  DEFAULT_TWIN_LISTENING_BEHAVIOR,
  DEFAULT_TASTE_STABILITY,
  DEFAULT_TASTE_EVOLUTION,
  DEFAULT_EMERGING_INTERESTS,
  DEFAULT_PERSONALITY_PROFILE,
  DEFAULT_COMPATIBILITY_DIMENSIONS,
  getDefaultPersonalMusicTwin,
  validateAndSanitizePersonalMusicTwin,
} from '../schemas/personalMusicTwinSchema.js';

export interface IPersonalMusicTwin extends Document, Omit<PersonalMusicTwinAttributes, 'userId'> {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPersonalMusicTwinModel extends Model<IPersonalMusicTwin> {
  findByUserId(userId: string | Types.ObjectId): Promise<IPersonalMusicTwin | null>;
  getOrCreateTwin(userId: string | Types.ObjectId): Promise<IPersonalMusicTwin>;
  updateDerivedTwin(
    userId: string | Types.ObjectId,
    updates: Partial<PersonalMusicTwinAttributes>
  ): Promise<IPersonalMusicTwin>;
}

const TwinMusicalTraitsSchema = new Schema<ITwinMusicalTraits>(
  {
    energyPreference: { type: Number, required: true, min: 0.0, max: 1.0, default: DEFAULT_MUSICAL_TRAITS.energyPreference },
    danceabilityPreference: { type: Number, required: true, min: 0.0, max: 1.0, default: DEFAULT_MUSICAL_TRAITS.danceabilityPreference },
    valencePreference: { type: Number, required: true, min: 0.0, max: 1.0, default: DEFAULT_MUSICAL_TRAITS.valencePreference },
    acousticnessPreference: { type: Number, required: true, min: 0.0, max: 1.0, default: DEFAULT_MUSICAL_TRAITS.acousticnessPreference },
    instrumentalnessPreference: { type: Number, required: true, min: 0.0, max: 1.0, default: DEFAULT_MUSICAL_TRAITS.instrumentalnessPreference },
    targetTempoBpm: { type: Number, required: true, min: 40, max: 240, default: DEFAULT_MUSICAL_TRAITS.targetTempoBpm },
    tempoRange: {
      min: { type: Number, required: true, min: 40, max: 240, default: DEFAULT_MUSICAL_TRAITS.tempoRange.min },
      max: { type: Number, required: true, min: 40, max: 240, default: DEFAULT_MUSICAL_TRAITS.tempoRange.max },
    },
    keyAcousticDescriptors: [{ type: String, trim: true }],
  },
  { _id: false }
);

const CoreGenreItemSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    affinityScore: { type: Number, required: true, min: 0.0, max: 1.0 },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: false }
);

const SecondaryGenreItemSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    affinityScore: { type: Number, required: true, min: 0.0, max: 1.0 },
  },
  { _id: false }
);

const TwinGenreIdentitySchema = new Schema<ITwinGenreIdentity>(
  {
    coreGenres: [CoreGenreItemSchema],
    secondaryGenres: [SecondaryGenreItemSchema],
    genreDiversityScore: { type: Number, required: true, min: 0.0, max: 1.0, default: 0.5 },
    signatureSound: { type: String, required: true, trim: true, default: DEFAULT_GENRE_IDENTITY.signatureSound },
  },
  { _id: false }
);

const DominantMoodItemSchema = new Schema(
  {
    mood: { type: String, required: true, trim: true },
    affinityScore: { type: Number, required: true, min: 0.0, max: 1.0 },
  },
  { _id: false }
);

const TwinMoodIdentitySchema = new Schema<ITwinMoodIdentity>(
  {
    dominantMoods: [DominantMoodItemSchema],
    emotionalBreadth: {
      type: String,
      enum: ['focused', 'moderate', 'broad', 'dynamic'],
      default: 'moderate',
    },
    contextualMoodAffinity: {
      type: Map,
      of: String,
      default: {},
    },
  },
  { _id: false }
);

const TwinListeningBehaviorSchema = new Schema<ITwinListeningBehavior>(
  {
    repeatListeningTendency: { type: Number, required: true, min: 0.0, max: 1.0, default: 0.5 },
    discoveryTendency: { type: Number, required: true, min: 0.0, max: 1.0, default: 0.5 },
    skipTendency: { type: Number, required: true, min: 0.0, max: 1.0, default: 0.3 },
    sessionListeningIntensity: { type: Number, required: true, min: 0.0, max: 1.0, default: 0.5 },
    completionRate: { type: Number, required: true, min: 0.0, max: 1.0, default: 0.75 },
    avgSessionDurationMinutes: { type: Number, required: true, min: 1, default: 25 },
    peakListeningTime: { type: String, required: true, default: 'evening' },
    isDataSufficient: { type: Boolean, default: false },
  },
  { _id: false }
);

const TwinTasteStabilitySchema = new Schema<ITwinTasteStability>(
  {
    stabilityScore: { type: Number, required: true, min: 0.0, max: 1.0, default: 0.5 },
    volatilityScore: { type: Number, required: true, min: 0.0, max: 1.0, default: 0.5 },
    preferencePersistence: { type: Number, required: true, min: 0.0, max: 1.0, default: 0.5 },
    stabilityRating: {
      type: String,
      enum: ['highly_stable', 'moderate_drift', 'rapid_transformation', 'unrated'],
      default: 'unrated',
    },
    description: { type: String, required: true, default: DEFAULT_TASTE_STABILITY.description },
  },
  { _id: false }
);

const TwinTasteEvolutionSchema = new Schema<ITwinTasteEvolution>(
  {
    transformationIntensity: { type: Number, required: true, min: 0.0, max: 1.0, default: 0.0 },
    evolutionArchetype: { type: String, required: true, default: DEFAULT_TASTE_EVOLUTION.evolutionArchetype },
    primaryTasteDirection: { type: String, required: true, default: DEFAULT_TASTE_EVOLUTION.primaryTasteDirection },
    activePhase: { type: String, required: true, default: DEFAULT_TASTE_EVOLUTION.activePhase },
    velocity: {
      type: String,
      enum: ['rapid', 'moderate', 'gradual', 'static'],
      default: 'static',
    },
  },
  { _id: false }
);

const EmergingTasteItemSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    confidence: { type: Number, required: true, min: 0.0, max: 1.0 },
    momentumVelocity: { type: Number, default: 0 },
  },
  { _id: false }
);

const TwinEmergingInterestsSchema = new Schema<ITwinEmergingInterests>(
  {
    genres: [EmergingTasteItemSchema],
    artists: [EmergingTasteItemSchema],
    moods: [{ type: String, trim: true }],
    narrative: { type: String, default: DEFAULT_EMERGING_INTERESTS.narrative },
  },
  { _id: false }
);

const TwinPersonalityProfileSchema = new Schema<ITwinPersonalityProfile>(
  {
    personaName: { type: String, required: true, trim: true, default: DEFAULT_PERSONALITY_PROFILE.personaName },
    tagline: { type: String, required: true, trim: true, default: DEFAULT_PERSONALITY_PROFILE.tagline },
    bio: { type: String, required: true, default: DEFAULT_PERSONALITY_PROFILE.bio },
    vibeKeywords: [{ type: String, trim: true }],
    rarityScore: { type: Number, required: true, min: 0.0, max: 1.0, default: 0.5 },
  },
  { _id: false }
);

const TwinCompatibilityDimensionsSchema = new Schema<ITwinCompatibilityDimensions>(
  {
    opennessScore: { type: Number, required: true, min: 0.0, max: 1.0, default: 0.5 },
    intensityScore: { type: Number, required: true, min: 0.0, max: 1.0, default: 0.5 },
    eclecticismScore: { type: Number, required: true, min: 0.0, max: 1.0, default: 0.5 },
    tasteVector: [{ type: Number, min: 0.0, max: 1.0 }],
  },
  { _id: false }
);

const PersonalMusicTwinSchema = new Schema<IPersonalMusicTwin, IPersonalMusicTwinModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    twinVersion: {
      type: String,
      required: true,
      default: '1.0.0',
    },
    listenerArchetype: {
      type: String,
      required: true,
      default: 'Balanced Explorer',
      index: true,
    },
    archetypeDescription: {
      type: String,
      required: true,
      default: 'A versatile listener who appreciates a balanced mix of familiar favorites and intriguing discoveries.',
    },
    dominantMusicalTraits: {
      type: TwinMusicalTraitsSchema,
      required: true,
      default: () => ({ ...DEFAULT_MUSICAL_TRAITS }),
    },
    genreIdentity: {
      type: TwinGenreIdentitySchema,
      required: true,
      default: () => ({ ...DEFAULT_GENRE_IDENTITY }),
    },
    moodIdentity: {
      type: TwinMoodIdentitySchema,
      required: true,
      default: () => ({ ...DEFAULT_MOOD_IDENTITY }),
    },
    explorationTendency: {
      type: Number,
      required: true,
      min: 0.0,
      max: 1.0,
      default: 0.5,
    },
    familiarityTendency: {
      type: Number,
      required: true,
      min: 0.0,
      max: 1.0,
      default: 0.5,
    },
    diversityPreference: {
      type: Number,
      required: true,
      min: 0.0,
      max: 1.0,
      default: 0.5,
    },
    listeningBehavior: {
      type: TwinListeningBehaviorSchema,
      required: true,
      default: () => ({ ...DEFAULT_TWIN_LISTENING_BEHAVIOR }),
    },
    tasteStability: {
      type: TwinTasteStabilitySchema,
      required: true,
      default: () => ({ ...DEFAULT_TASTE_STABILITY }),
    },
    tasteEvolution: {
      type: TwinTasteEvolutionSchema,
      required: true,
      default: () => ({ ...DEFAULT_TASTE_EVOLUTION }),
    },
    currentEmergingInterests: {
      type: TwinEmergingInterestsSchema,
      required: true,
      default: () => ({ ...DEFAULT_EMERGING_INTERESTS }),
    },
    personalityProfile: {
      type: TwinPersonalityProfileSchema,
      required: true,
      default: () => ({ ...DEFAULT_PERSONALITY_PROFILE }),
    },
    compatibilityDimensions: {
      type: TwinCompatibilityDimensionsSchema,
      required: true,
      default: () => ({ ...DEFAULT_COMPATIBILITY_DIMENSIONS }),
    },
    confidenceScore: {
      type: Number,
      required: true,
      min: 0.0,
      max: 1.0,
      default: 0.1,
      index: true,
    },
    lastUpdatedTimestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    isDataSufficient: {
      type: Boolean,
      required: true,
      default: false,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound indexes for analytical queries and twin discovery
PersonalMusicTwinSchema.index({ listenerArchetype: 1, confidenceScore: -1 });
PersonalMusicTwinSchema.index({ lastUpdatedTimestamp: -1 });

/**
 * Static method: Find twin by user ID.
 */
PersonalMusicTwinSchema.statics.findByUserId = async function (
  userId: string | Types.ObjectId
): Promise<IPersonalMusicTwin | null> {
  if (!Types.ObjectId.isValid(userId)) {
    return null;
  }
  return this.findOne({ userId: new Types.ObjectId(userId) }).exec();
};

/**
 * Static method: Get or create twin for a user.
 */
PersonalMusicTwinSchema.statics.getOrCreateTwin = async function (
  userId: string | Types.ObjectId
): Promise<IPersonalMusicTwin> {
  if (!Types.ObjectId.isValid(userId)) {
    throw new Error(`Invalid userId provided for Personal Music Twin: ${userId}`);
  }

  const existing = await this.findOne({ userId: new Types.ObjectId(userId) }).exec();
  if (existing) {
    return existing;
  }

  const defaultTwin = getDefaultPersonalMusicTwin(new Types.ObjectId(userId));
  try {
    return await this.create(defaultTwin);
  } catch (err: any) {
    if (err?.code === 11000) {
      const raceWinner = await this.findOne({ userId: new Types.ObjectId(userId) }).exec();
      if (raceWinner) return raceWinner;
    }
    throw err;
  }
};

/**
 * Static method: Update derived twin properties from analytical intelligence.
 */
PersonalMusicTwinSchema.statics.updateDerivedTwin = async function (
  userId: string | Types.ObjectId,
  updates: Partial<PersonalMusicTwinAttributes>
): Promise<IPersonalMusicTwin> {
  if (!Types.ObjectId.isValid(userId)) {
    throw new Error(`Invalid userId provided for Personal Music Twin update: ${userId}`);
  }

  const sanitized = validateAndSanitizePersonalMusicTwin({
    ...updates,
    userId: new Types.ObjectId(userId),
    lastUpdatedTimestamp: new Date(),
  });

  const updated = await this.findOneAndUpdate(
    { userId: new Types.ObjectId(userId) },
    { $set: sanitized },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).exec();

  return updated;
};

export const PersonalMusicTwin = model<IPersonalMusicTwin, IPersonalMusicTwinModel>(
  'PersonalMusicTwin',
  PersonalMusicTwinSchema
);

export default PersonalMusicTwin;
