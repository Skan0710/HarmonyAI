import { ISong } from '../models/Song.js';
import { supabase } from '../config/supabase.js';
import { isValidObjectId } from '../utils/validators.js';
import { mapSongRow } from './songService.js';
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
    songId: string
  ): Promise<ISong | null> {
    if (!songId || !isValidObjectId(String(songId))) {
      return null;
    }

    try {
      // 1. Fetch Song Row with Related Artist/Album/Genre
      const { data: songRow } = await supabase
        .from('songs')
        .select('*, artists!songs_artist_id_fkey(*), albums!songs_album_id_fkey(*), genres!songs_genre_id_fkey(*)')
        .eq('id', String(songId))
        .maybeSingle();

      const songDoc = mapSongRow(songRow) as any;
      if (!songDoc) {
        return null;
      }

      // 2. Generate Semantic Text Representation
      const semanticText = generateSongSemanticText({
        _id: songDoc._id,
        title: songDoc.title || 'Untitled',
        artist: songDoc.artist,
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

      // 4. Update Song Row with Embedding Vector & Metadata
      const nowIso = new Date().toISOString();
      const { data: updatedRow, error } = await supabase
        .from('songs')
        .update({
          vector_embedding: embeddingVector as any,
          embedding_generated_at: nowIso,
          embedding_provider: provider.name || 'local_deterministic',
          embedding_dimension: embeddingVector.length,
        } as any)
        .eq('id', String(songId))
        .select('*, artists!songs_artist_id_fkey(*), albums!songs_album_id_fkey(*), genres!songs_genre_id_fkey(*)')
        .single();

      if (error || !updatedRow) {
        return songDoc;
      }

      return mapSongRow(updatedRow) as any;
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
    songIds: string[]
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
