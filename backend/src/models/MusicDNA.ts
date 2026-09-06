import { Schema, model, Document, Types, Model } from 'mongoose';
import {
  MusicDNAGenrePreference,
  MusicDNAArtistPreference,
  MusicDNAMoodPreference,
  MusicDNAListeningPatterns,
  MusicDNATendencyDimensions,
  MusicDNATemporalTaste,
  MusicDNAProfileAttributes,
  DEFAULT_TENDENCY_DIMENSIONS,
  DEFAULT_LISTENING_PATTERNS,
  DEFAULT_TEMPORAL_TASTE,
  validateAndSanitizeMusicDNA,
  getDefaultMusicDNAProfile,
} from '../schemas/musicDnaSchema.js';

export interface IMusicDNA extends Document, Omit<MusicDNAProfileAttributes, 'userId'> {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMusicDNAModel extends Model<IMusicDNA> {
  findByUserId(userId: string | Types.ObjectId): Promise<IMusicDNA | null>;
  getOrCreateProfile(userId: string | Types.ObjectId): Promise<IMusicDNA>;
  updateTendencies(
    userId: string | Types.ObjectId,
    tendencies: Partial<MusicDNATendencyDimensions>
  ): Promise<IMusicDNA | null>;
}

const GenrePreferenceSchema = new Schema<MusicDNAGenrePreference>(
  {
    genre: {
      type: Schema.Types.Mixed,
      ref: 'Genre',
      required: false,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    affinityScore: {
      type: Number,
      required: true,
      min: 0.0,
      max: 1.0,
      default: 0.5,
    },
    playCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    lastInteractionAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const ArtistPreferenceSchema = new Schema<MusicDNAArtistPreference>(
  {
    artist: {
      type: Schema.Types.Mixed,
      ref: 'Artist',
      required: false,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    affinityScore: {
      type: Number,
      required: true,
      min: 0.0,
      max: 1.0,
      default: 0.5,
    },
    playCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    lastInteractionAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const MoodPreferenceSchema = new Schema<MusicDNAMoodPreference>(
  {
    mood: {
      type: String,
      required: true,
      trim: true,
    },
    affinityScore: {
      type: Number,
      required: true,
      min: 0.0,
      max: 1.0,
      default: 0.5,
    },
    playCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    lastInteractionAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const TendencyDimensionsSchema = new Schema<MusicDNATendencyDimensions>(
  {
    discoveryTendency: {
      type: Number,
      required: true,
      min: 0.0,
      max: 1.0,
      default: DEFAULT_TENDENCY_DIMENSIONS.discoveryTendency,
    },
    familiarityPreference: {
      type: Number,
      required: true,
      min: 0.0,
      max: 1.0,
      default: DEFAULT_TENDENCY_DIMENSIONS.familiarityPreference,
    },
    diversityPreference: {
      type: Number,
      required: true,
      min: 0.0,
      max: 1.0,
      default: DEFAULT_TENDENCY_DIMENSIONS.diversityPreference,
    },
    explorationPreference: {
      type: Number,
      required: true,
      min: 0.0,
      max: 1.0,
      default: DEFAULT_TENDENCY_DIMENSIONS.explorationPreference,
    },
  },
  { _id: false }
);

const ListeningPatternsSchema = new Schema<MusicDNAListeningPatterns>(
  {
    timeOfDayDistribution: {
      type: Map,
      of: Number,
      default: () => ({ ...DEFAULT_LISTENING_PATTERNS.timeOfDayDistribution }),
    },
    avgSessionDurationMinutes: {
      type: Number,
      min: 1,
      max: 600,
      default: DEFAULT_LISTENING_PATTERNS.avgSessionDurationMinutes,
    },
    skipRate: {
      type: Number,
      min: 0.0,
      max: 1.0,
      default: DEFAULT_LISTENING_PATTERNS.skipRate,
    },
    completionRate: {
      type: Number,
      min: 0.0,
      max: 1.0,
      default: DEFAULT_LISTENING_PATTERNS.completionRate,
    },
    replayRate: {
      type: Number,
      min: 0.0,
      max: 1.0,
      default: DEFAULT_LISTENING_PATTERNS.replayRate,
    },
    preferredSituations: {
      type: [String],
      default: () => [...(DEFAULT_LISTENING_PATTERNS.preferredSituations || [])],
    },
    audioFeaturePreferences: {
      type: Schema.Types.Mixed,
      default: () => ({ ...DEFAULT_LISTENING_PATTERNS.audioFeaturePreferences }),
    },
    preferredTempo: {
      min: { type: Number, min: 30, max: 250, default: 80 },
      max: { type: Number, min: 30, max: 250, default: 140 },
      target: { type: Number, min: 30, max: 250, default: 115 },
    },
  },
  { _id: false }
);

const TemporalWindowPreferenceSchema = new Schema(
  {
    window: {
      type: String,
      required: true,
      enum: ['short_term', 'medium_term', 'long_term'],
    },
    topGenres: {
      type: [String],
      default: [],
    },
    topArtists: {
      type: [String],
      default: [],
    },
    topMoods: {
      type: [String],
      default: [],
    },
    score: {
      type: Number,
      min: 0.0,
      max: 1.0,
      default: 0.5,
    },
  },
  { _id: false }
);

const TemporalTasteSchema = new Schema<MusicDNATemporalTaste>(
  {
    stabilityScore: {
      type: Number,
      min: 0.0,
      max: 1.0,
      default: DEFAULT_TEMPORAL_TASTE.stabilityScore,
    },
    activeTimeWindow: {
      type: String,
      enum: ['short_term', 'medium_term', 'long_term'],
      default: DEFAULT_TEMPORAL_TASTE.activeTimeWindow,
    },
    trendingGenres: {
      type: [String],
      default: [],
    },
    emergingGenres: {
      type: [String],
      default: [],
    },
    decliningGenres: {
      type: [String],
      default: [],
    },
    temporalAffinities: {
      type: [TemporalWindowPreferenceSchema],
      default: [],
    },
    lastCalculatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const MusicDNASchema = new Schema<IMusicDNA, IMusicDNAModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId is required for Music DNA profile'],
      unique: true,
      index: true,
      alias: 'user',
    },
    dnaVersion: {
      type: String,
      required: true,
      default: '1.0.0',
    },
    genres: {
      type: [GenrePreferenceSchema],
      default: [],
    },
    artists: {
      type: [ArtistPreferenceSchema],
      default: [],
    },
    moods: {
      type: [MoodPreferenceSchema],
      default: [],
    },
    listeningPatterns: {
      type: ListeningPatternsSchema,
      default: () => ({ ...DEFAULT_LISTENING_PATTERNS }),
    },
    tendencies: {
      type: TendencyDimensionsSchema,
      default: () => ({ ...DEFAULT_TENDENCY_DIMENSIONS }),
    },
    temporalTaste: {
      type: TemporalTasteSchema,
      default: () => ({ ...DEFAULT_TEMPORAL_TASTE }),
    },
    confidenceScore: {
      type: Number,
      min: 0.0,
      max: 1.0,
      default: 0.1,
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

// Indexes
MusicDNASchema.index({ 'tendencies.discoveryTendency': 1 });
MusicDNASchema.index({ 'tendencies.explorationPreference': 1 });
MusicDNASchema.index({ 'tendencies.diversityPreference': 1 });
MusicDNASchema.index({ 'tendencies.familiarityPreference': 1 });
MusicDNASchema.index({ updatedAt: -1 });

// Pre-save synchronization hook
MusicDNASchema.pre('save', function () {
  const result = validateAndSanitizeMusicDNA({
    userId: this.userId,
    dnaVersion: this.dnaVersion,
    genres: this.genres,
    artists: this.artists,
    moods: this.moods,
    listeningPatterns: this.listeningPatterns,
    tendencies: this.tendencies,
    temporalTaste: this.temporalTaste,
    confidenceScore: this.confidenceScore,
    metadata: this.metadata,
  });

  if (result.sanitized.tendencies) {
    this.tendencies = result.sanitized.tendencies;
  }
  if (result.sanitized.confidenceScore !== undefined) {
    this.confidenceScore = result.sanitized.confidenceScore;
  }
});

// Static methods
MusicDNASchema.statics.findByUserId = function (
  userId: string | Types.ObjectId
): Promise<IMusicDNA | null> {
  const uid =
    typeof userId === 'string' && Types.ObjectId.isValid(userId)
      ? new Types.ObjectId(userId)
      : userId;
  return this.findOne({ userId: uid });
};

MusicDNASchema.statics.getOrCreateProfile = async function (
  userId: string | Types.ObjectId
): Promise<IMusicDNA> {
  const existing = await (this as IMusicDNAModel).findByUserId(userId);
  if (existing) {
    return existing;
  }

  const defaultProfile = getDefaultMusicDNAProfile(userId);
  const newProfile = new this(defaultProfile);
  return await newProfile.save();
};

MusicDNASchema.statics.updateTendencies = async function (
  userId: string | Types.ObjectId,
  tendencies: Partial<MusicDNATendencyDimensions>
): Promise<IMusicDNA | null> {
  const profile = await (this as IMusicDNAModel).findByUserId(userId);
  if (!profile) return null;

  profile.tendencies = {
    ...profile.tendencies,
    ...tendencies,
  };

  return await profile.save();
};

export const MusicDNA = model<IMusicDNA, IMusicDNAModel>('MusicDNA', MusicDNASchema);
export default MusicDNA;
