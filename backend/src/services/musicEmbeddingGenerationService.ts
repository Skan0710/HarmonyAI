import { Types } from 'mongoose';
import { Song, ISong } from '../models/Song.js';
import { generateSongSemanticText } from '../utils/semanticSearchUtils.js';
import { EmbeddingService } from './embeddingService.js';

export interface BatchEmbeddingResult {
  processed: number;
  succeeded: number;
  failed: number;
  errors?: Array<{ songId: string; error: string }>;
}

export class MusicEmbeddingGenerationService {
  /**
   * Generates the semantic text representation for a single song, generates vector embeddings
   * using EmbeddingService, stores the embedding vector and metadata on the Song document, and returns it.
   * Handles missing metadata safely and fails gracefully without crashing.
   */
  static async generateAndSaveSongEmbedding(
    songId: string | Types.ObjectId
  ): Promise<ISong | null> {
    if (!songId || !Types.ObjectId.isValid(String(songId))) {
      return null;
    }

    try {
      const songObjId = new Types.ObjectId(String(songId));

      // 1. Fetch Song Document with Populated Relations
      const songDoc = await Song.findById(songObjId)
        .populate('artist', 'name')
        .populate('featuredArtists', 'name')
        .populate('album', 'title')
        .populate('genre', 'name slug');

      if (!songDoc) {
        return null;
      }

      // 2. Generate Semantic Text Representation
      const semanticText = generateSongSemanticText({
        _id: songDoc._id,
        title: songDoc.title || 'Untitled',
        artist: songDoc.artist,
        featuredArtists: songDoc.featuredArtists,
        album: songDoc.album,
        genre: songDoc.genre,
        mood: songDoc.mood,
        language: songDoc.language,
        tags: songDoc.tags || [],
        releaseYear: songDoc.releaseYear,
        audioFeatures: songDoc.audioFeatures,
      });

      if (!semanticText || !semanticText.trim()) {
        return songDoc;
      }

      // 3. Generate Vector Embedding
      const provider = EmbeddingService.getProvider();
      const embeddingVector = await EmbeddingService.generateEmbedding(semanticText);

      if (!Array.isArray(embeddingVector) || embeddingVector.length === 0) {
        return songDoc;
      }

      // 4. Update Song Document with Embedding Vector & Metadata
      songDoc.vectorEmbedding = embeddingVector;
      songDoc.embeddingGeneratedAt = new Date();
      songDoc.embeddingProvider = provider.name || 'local_deterministic';
      songDoc.embeddingDimension = embeddingVector.length;

      // 5. Save and Return Document
      await songDoc.save();
      return songDoc;
    } catch (error: any) {
      console.warn(`[MusicEmbeddingGenerationService Warning]: Failed to generate embedding for song ${songId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Reusable batch processing service for generating and storing embeddings for multiple songs.
   * Does not block application execution if an individual song fails.
   */
  static async generateAndSaveBatchEmbeddings(
    songIds: (string | Types.ObjectId)[]
  ): Promise<BatchEmbeddingResult> {
    if (!Array.isArray(songIds) || songIds.length === 0) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    let succeeded = 0;
    let failed = 0;
    const errors: Array<{ songId: string; error: string }> = [];

    for (const id of songIds) {
      const idStr = String(id);
      try {
        const result = await this.generateAndSaveSongEmbedding(id);
        if (result && result.vectorEmbedding && result.vectorEmbedding.length > 0) {
          succeeded++;
        } else {
          failed++;
          errors.push({ songId: idStr, error: 'Song missing or embedding generation failed' });
        }
      } catch (err: any) {
        failed++;
        errors.push({ songId: idStr, error: err.message || 'Unknown processing error' });
      }
    }

    return {
      processed: songIds.length,
      succeeded,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}
