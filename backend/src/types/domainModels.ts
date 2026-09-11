/**
 * Plain TypeScript interfaces for domain objects that used to be Mongoose documents.
 * The app is fully on Supabase/Postgres now; these types describe the shapes
 * services/controllers pass around (built by row-mappers like `mapSongRow`),
 * not a schema tied to any ORM.
 */

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

export interface ISong {
  _id: string;
  id?: string;
  title: string;
  artist: any;
  featuredArtists?: any[];
  album?: any;
  genre: any;
  duration: number; // in seconds
  coverImage?: string;
  audioUrl: string;
  releaseYear?: number;
  playCount: number;
  audioFeatures?: IAudioFeatures;
  mood?: string;
  tags: string[];
  language?: string;
  explicit: boolean;
  lyrics?: string;
  isPublished: boolean;
  vectorEmbedding?: number[];
  embeddingGeneratedAt?: Date | string;
  embeddingProvider?: string;
  embeddingDimension?: number;
  recommendationMetadata?: Record<string, any>;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export type AlbumType = 'album' | 'single' | 'ep' | 'compilation';

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

export interface IMusicDNASnapshot {
  _id: string;
  userId: string;
  snapshotVersion: string;
  timestamp: Date;
  triggerReason: string;
  topGenres: ISnapshotTasteItem[];
  topArtists: ISnapshotTasteItem[];
  preferredMoods: ISnapshotMoodItem[];
  listeningBehavior: ISnapshotListeningBehavior;
  tendencies: Record<string, number>;
  confidenceScore: number;
  interactionsCount: number;
  genreDiversity: number;
  artistDiversity: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

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

export interface IUser {
  _id: string;
  id?: string;
  clerkId?: string;
  name: string;
  email: string;
  password?: string;
  profilePicture?: string;
  role?: 'user' | 'admin';
  likedSongs?: string[];
  favoriteArtists?: string[];
  favoriteGenres?: string[];
  createdAt: Date;
  updatedAt?: Date;
}
