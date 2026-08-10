import { ISong } from '../models/Song.js';

export interface NormalizedSongFeatures {
  songId: string;
  artistId: string;
  genreId: string;
  language: string;
  mood: string;
  normalizedBpm: number; // 0.0 - 1.0 (scaled from 60-200 BPM)
  normalizedEnergy: number; // 0.0 - 1.0
  normalizedDanceability: number; // 0.0 - 1.0
  normalizedAcousticness: number; // 0.0 - 1.0
  normalizedValence: number; // 0.0 - 1.0
  numericalFeatureVector: number[];
}

export class SongFeatureExtractionService {
  /**
   * Converts a Song document into a normalized feature representation
   * suitable for content-based similarity and recommendation algorithms.
   */
  static extractFeatures(song: any): NormalizedSongFeatures {
    if (!song) {
      throw new Error('Song document is required for feature extraction');
    }

    const songId = _idToStr(song._id);

    // Handle populated artist or raw ObjectId
    const artistId = song.artist
      ? typeof song.artist === 'object'
        ? _idToStr(song.artist._id)
        : String(song.artist)
      : '';

    // Handle populated genre or raw ObjectId
    const genreId = song.genre
      ? typeof song.genre === 'object'
        ? _idToStr(song.genre._id)
        : String(song.genre)
      : '';

    const language = (song.language || 'English').toLowerCase().trim();
    const mood = (song.mood || 'Chill').toLowerCase().trim();

    const audio = song.audioFeatures || {};

    // 1. Normalize BPM (typical music range: 60 - 200 BPM)
    const rawBpm = typeof audio.bpm === 'number' ? audio.bpm : 120;
    const normalizedBpm = clamp((rawBpm - 60) / 140, 0, 1);

    // 2. Normalize Energy, Danceability, Acousticness, Valence (0.0 - 1.0)
    const normalizedEnergy = clamp(typeof audio.energy === 'number' ? audio.energy : 0.5, 0, 1);
    const normalizedDanceability = clamp(
      typeof audio.danceability === 'number' ? audio.danceability : 0.5,
      0,
      1
    );
    const normalizedAcousticness = clamp(
      typeof audio.acousticness === 'number' ? audio.acousticness : 0.5,
      0,
      1
    );
    const normalizedValence = clamp(
      typeof audio.valence === 'number' ? audio.valence : 0.5,
      0,
      1
    );

    const numericalFeatureVector = [
      normalizedBpm,
      normalizedEnergy,
      normalizedDanceability,
      normalizedAcousticness,
      normalizedValence,
    ];

    return {
      songId,
      artistId,
      genreId,
      language,
      mood,
      normalizedBpm,
      normalizedEnergy,
      normalizedDanceability,
      normalizedAcousticness,
      normalizedValence,
      numericalFeatureVector,
    };
  }

  /**
   * Calculates Euclidean distance between two normalized feature vectors.
   * Lower distance values indicate higher acoustic feature similarity (0.0 = identical).
   */
  static calculateEuclideanDistance(
    featuresA: NormalizedSongFeatures,
    featuresB: NormalizedSongFeatures
  ): number {
    const vecA = featuresA.numericalFeatureVector;
    const vecB = featuresB.numericalFeatureVector;

    let sumSq = 0;
    for (let i = 0; i < vecA.length; i++) {
      const diff = vecA[i] - vecB[i];
      sumSq += diff * diff;
    }

    return Math.sqrt(sumSq);
  }

  /**
   * Calculates Cosine Similarity between two normalized feature vectors.
   * Returns a score between 0.0 (orthogonal) and 1.0 (identical direction).
   */
  static calculateCosineSimilarity(
    featuresA: NormalizedSongFeatures,
    featuresB: NormalizedSongFeatures
  ): number {
    const vecA = featuresA.numericalFeatureVector;
    const vecB = featuresB.numericalFeatureVector;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

function _idToStr(id: any): string {
  if (!id) return '';
  return typeof id === 'object' ? id.toString() : String(id);
}

function clamp(value: number, min: number, max: number): number {
  if (isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}
