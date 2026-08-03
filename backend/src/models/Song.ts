import { Schema, model, Document, Types } from 'mongoose';

export interface IAudioFeatures {
  bpm?: number;
  key?: string;
  energy?: number;
  danceability?: number;
  valence?: number;
  acousticness?: number;
  instrumentalness?: number;
  liveness?: number;
  speechiness?: number;
}

export interface ISong extends Document {
  _id: Types.ObjectId;
  title: string;
  artist: Types.ObjectId;
  featuredArtists: Types.ObjectId[];
  album?: Types.ObjectId;
  genre: Types.ObjectId;
  duration: number; // in seconds
  coverImage?: string;
  audioUrl: string;
  releaseYear?: number;
  playCount: number;
  // Recommendation & AI features schema extensibility
  audioFeatures?: IAudioFeatures;
  tags: string[];
  language?: string;
  explicit: boolean;
  lyrics?: string;
  isPublished: boolean;
  vectorEmbedding?: number[];
  recommendationMetadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const audioFeaturesSchema = new Schema<IAudioFeatures>(
  {
    bpm: { type: Number, min: 0, max: 500 },
    key: { type: String, default: '' },
    energy: { type: Number, min: 0, max: 1 },
    danceability: { type: Number, min: 0, max: 1 },
    valence: { type: Number, min: 0, max: 1 },
    acousticness: { type: Number, min: 0, max: 1 },
    instrumentalness: { type: Number, min: 0, max: 1 },
    liveness: { type: Number, min: 0, max: 1 },
    speechiness: { type: Number, min: 0, max: 1 },
  },
  { _id: false }
);

const songSchema = new Schema<ISong>(
  {
    title: {
      type: String,
      required: [true, 'Song title is required'],
      trim: true,
      index: true,
    },
    artist: {
      type: Schema.Types.ObjectId,
      ref: 'Artist',
      required: [true, 'Primary artist is required'],
      index: true,
    },
    featuredArtists: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Artist',
      },
    ],
    album: {
      type: Schema.Types.ObjectId,
      ref: 'Album',
      default: null,
      index: true,
    },
    genre: {
      type: Schema.Types.ObjectId,
      ref: 'Genre',
      required: [true, 'Genre is required'],
      index: true,
    },
    duration: {
      type: Number,
      required: [true, 'Song duration (in seconds) is required'],
      min: [1, 'Duration must be at least 1 second'],
    },
    coverImage: {
      type: String,
      default: '',
    },
    audioUrl: {
      type: String,
      required: [true, 'Audio URL is required'],
      trim: true,
    },
    releaseYear: {
      type: Number,
      min: 1800,
      max: 2100,
    },
    playCount: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },
    audioFeatures: {
      type: audioFeaturesSchema,
      default: {},
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    language: {
      type: String,
      default: 'English',
    },
    explicit: {
      type: Boolean,
      default: false,
    },
    lyrics: {
      type: String,
      default: '',
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
    vectorEmbedding: {
      type: [Number],
      default: undefined,
    },
    recommendationMetadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

songSchema.index({ title: 'text', tags: 'text' });
songSchema.index({ genre: 1, playCount: -1 });

export const Song = model<ISong>('Song', songSchema);
