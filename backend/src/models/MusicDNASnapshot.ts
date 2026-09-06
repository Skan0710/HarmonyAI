import { Schema, model, Document, Types, Model } from 'mongoose';
import {
  DEFAULT_TENDENCY_DIMENSIONS,
  MusicDNATendencyDimensions,
} from '../schemas/musicDnaSchema.js';

export interface ISnapshotTasteItem {
  name: string;
  affinityScore: number;
  playCount?: number;
  momentumDelta?: number;
}

export interface ISnapshotMoodItem {
  mood: string;
  affinityScore: number;
  playCount?: number;
}

export interface ISnapshotListeningBehavior {
  repeatListeningTendency: number;
  discoveryTendency: number;
  skipTendency: number;
  familiarityPreference: number;
  explorationTendency: number;
  diversityPreference: number;
  sessionListeningIntensity: number;
  preferenceStability: number;
  preferenceChangeRate: number;
  listenerArchetype: string;
  isDataSufficient: boolean;
}

export interface IMusicDNASnapshot extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  snapshotVersion: string;
  timestamp: Date;
  triggerReason: string;
  topGenres: ISnapshotTasteItem[];
  topArtists: ISnapshotTasteItem[];
  preferredMoods: ISnapshotMoodItem[];
  listeningBehavior: ISnapshotListeningBehavior;
  tendencies: MusicDNATendencyDimensions;
  confidenceScore: number;
  interactionsCount: number;
  genreDiversity: number;
  artistDiversity: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMusicDNASnapshotModel extends Model<IMusicDNASnapshot> {
  findByUserId(
    userId: string | Types.ObjectId,
    options?: { limit?: number; sortAsc?: boolean }
  ): Promise<IMusicDNASnapshot[]>;
  findLatestByUserId(userId: string | Types.ObjectId): Promise<IMusicDNASnapshot | null>;
}

const SnapshotTasteItemSchema = new Schema<ISnapshotTasteItem>(
  {
    name: { type: String, required: true, trim: true },
    affinityScore: { type: Number, required: true, min: 0.0, max: 1.0 },
    playCount: { type: Number, default: 0, min: 0 },
    momentumDelta: { type: Number, default: 0 },
  },
  { _id: false }
);

const SnapshotMoodItemSchema = new Schema<ISnapshotMoodItem>(
  {
    mood: { type: String, required: true, trim: true },
    affinityScore: { type: Number, required: true, min: 0.0, max: 1.0 },
    playCount: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const SnapshotListeningBehaviorSchema = new Schema<ISnapshotListeningBehavior>(
  {
    repeatListeningTendency: { type: Number, required: true, min: 0.0, max: 1.0, default: 0.5 },
    discoveryTendency: { type: Number, required: true, min: 0.0, max: 1.0, default: 0.5 },
    skipTendency: { type: Number, required: true, min: 0.0, max: 1.0, default: 0.5 },
    familiarityPreference: { type: Number, required: true, min: 0.0, max: 1.0, default: 0.5 },
    explorationTendency: { type: Number, required: true, min: 0.0, max: 1.0, default: 0.5 },
    diversityPreference: { type: Number, required: true, min: 0.0, max: 1.0, default: 0.5 },
    sessionListeningIntensity: { type: Number, required: true, min: 0.0, max: 1.0, default: 0.5 },
    preferenceStability: { type: Number, required: true, min: 0.0, max: 1.0, default: 0.5 },
    preferenceChangeRate: { type: Number, required: true, min: 0.0, max: 1.0, default: 0.5 },
    listenerArchetype: { type: String, required: true, default: 'Balanced Listener' },
    isDataSufficient: { type: Boolean, default: false },
  },
  { _id: false }
);

const SnapshotTendenciesSchema = new Schema<MusicDNATendencyDimensions>(
  {
    discoveryTendency: { type: Number, required: true, min: 0.0, max: 1.0, default: DEFAULT_TENDENCY_DIMENSIONS.discoveryTendency },
    familiarityPreference: { type: Number, required: true, min: 0.0, max: 1.0, default: DEFAULT_TENDENCY_DIMENSIONS.familiarityPreference },
    diversityPreference: { type: Number, required: true, min: 0.0, max: 1.0, default: DEFAULT_TENDENCY_DIMENSIONS.diversityPreference },
    explorationPreference: { type: Number, required: true, min: 0.0, max: 1.0, default: DEFAULT_TENDENCY_DIMENSIONS.explorationPreference },
  },
  { _id: false }
);

const MusicDNASnapshotSchema = new Schema<IMusicDNASnapshot, IMusicDNASnapshotModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId is required for a Music DNA snapshot'],
      index: true,
    },
    snapshotVersion: {
      type: String,
      required: true,
      default: '1.0.0',
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    triggerReason: {
      type: String,
      required: true,
      default: 'interaction_update',
    },
    topGenres: {
      type: [SnapshotTasteItemSchema],
      default: [],
    },
    topArtists: {
      type: [SnapshotTasteItemSchema],
      default: [],
    },
    preferredMoods: {
      type: [SnapshotMoodItemSchema],
      default: [],
    },
    listeningBehavior: {
      type: SnapshotListeningBehaviorSchema,
      required: true,
      default: () => ({}),
    },
    tendencies: {
      type: SnapshotTendenciesSchema,
      required: true,
      default: () => ({ ...DEFAULT_TENDENCY_DIMENSIONS }),
    },
    confidenceScore: {
      type: Number,
      required: true,
      min: 0.0,
      max: 1.0,
      default: 0.1,
    },
    interactionsCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    genreDiversity: {
      type: Number,
      min: 0.0,
      max: 1.0,
      default: 0.5,
    },
    artistDiversity: {
      type: Number,
      min: 0.0,
      max: 1.0,
      default: 0.5,
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

// Compound indexes for high-speed chronological snapshot queries
MusicDNASnapshotSchema.index({ userId: 1, timestamp: -1 });
MusicDNASnapshotSchema.index({ userId: 1, timestamp: 1 });

MusicDNASnapshotSchema.statics.findByUserId = function (
  userId: string | Types.ObjectId,
  options: { limit?: number; sortAsc?: boolean } = {}
): Promise<IMusicDNASnapshot[]> {
  const uid = typeof userId === 'string' && Types.ObjectId.isValid(userId)
    ? new Types.ObjectId(userId)
    : userId;
  const sortDirection = options.sortAsc ? 1 : -1;
  const query = this.find({ userId: uid }).sort({ timestamp: sortDirection });
  if (options.limit && options.limit > 0) {
    query.limit(options.limit);
  }
  return query.exec();
};

MusicDNASnapshotSchema.statics.findLatestByUserId = function (
  userId: string | Types.ObjectId
): Promise<IMusicDNASnapshot | null> {
  const uid = typeof userId === 'string' && Types.ObjectId.isValid(userId)
    ? new Types.ObjectId(userId)
    : userId;
  return this.findOne({ userId: uid }).sort({ timestamp: -1 }).exec();
};

export const MusicDNASnapshot = model<IMusicDNASnapshot, IMusicDNASnapshotModel>(
  'MusicDNASnapshot',
  MusicDNASnapshotSchema
);

export default MusicDNASnapshot;
