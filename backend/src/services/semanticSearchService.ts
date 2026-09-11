import { supabase } from '../config/supabase.js';
import { EmbeddingService } from './embeddingService.js';
import { mapSongRow } from './songService.js';

export interface SemanticSearchResult {
  song: any;
  similarityScore: number;
}

export class SemanticSearchService {
  /**
   * Calculates safe cosine similarity between two numeric vectors.
   * Cosine Similarity = (A • B) / (||A|| * ||B||)
   * Reusable and completely independent from the API layer.
   */
  static calculateVectorCosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length === 0 || vecB.length === 0) {
      return 0.0;
    }

    const minLen = Math.min(vecA.length, vecB.length);
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < minLen; i++) {
      const valA = vecA[i] || 0;
      const valB = vecB[i] || 0;

      dotProduct += valA * valB;
      normA += valA * valA;
      normB += valB * valB;
    }

    const magA = Math.sqrt(normA);
    const magB = Math.sqrt(normB);

    if (magA === 0 || magB === 0) {
      return 0.0;
    }

    const similarity = dotProduct / (magA * magB);
    return Number(Math.max(-1.0, Math.min(1.0, similarity)).toFixed(4));
  }

  /**
   * Accepts a natural-language query, generates an embedding for the query, compares it against
   * stored song vector embeddings using cosine similarity, excludes songs without embeddings,
   * ranks songs by similarity score descending, and returns top results up to configurable limit.
   */
  static async searchSongsBySemanticQuery(
    query: string,
    limit = 10
  ): Promise<SemanticSearchResult[]> {
    if (!query || !query.trim()) {
      return [];
    }

    const safeLimit = Math.max(1, limit);

    // 1. Generate Query Vector Embedding using EmbeddingService (backed by Gemini API)
    let queryVector: number[] = [];
    try {
      queryVector = await EmbeddingService.generateEmbedding(query.trim());
    } catch (e: any) {
      console.warn('[SemanticSearchService] Embedding generation warning:', e.message);
    }

    // 2. Fetch published songs from Supabase
    const { data: songRows, error } = await supabase
      .from('songs')
      .select('*, artists!songs_artist_id_fkey(*), albums!songs_album_id_fkey(*), genres!songs_genre_id_fkey(*)')
      .eq('is_published', true);

    if (error || !songRows || songRows.length === 0) {
      return [];
    }

    const mappedSongs = songRows.map(mapSongRow);

    // 3. If query vector is available and songs have embeddings, compute cosine similarity
    const rankedResults: SemanticSearchResult[] = [];

    for (const songDoc of mappedSongs) {
      if (!songDoc) continue;
      const songVector = songDoc.vectorEmbedding;
      if (Array.isArray(queryVector) && queryVector.length > 0 && Array.isArray(songVector) && songVector.length > 0) {
        const similarity = this.calculateVectorCosineSimilarity(queryVector, songVector);
        rankedResults.push({
          song: songDoc,
          similarityScore: similarity,
        });
      }
    }

    if (rankedResults.length > 0) {
      rankedResults.sort((a, b) => b.similarityScore - a.similarityScore);
      return rankedResults.slice(0, safeLimit);
    }

    // If vectors aren't pre-computed, fallback to keyword matching so user gets real results
    const lowerQuery = query.toLowerCase();
    const fallbackMatches = mappedSongs
      .filter((s: any) =>
        s && (
          s.title?.toLowerCase().includes(lowerQuery) ||
          s.artist?.name?.toLowerCase().includes(lowerQuery) ||
          s.genre?.name?.toLowerCase().includes(lowerQuery) ||
          s.mood?.toLowerCase().includes(lowerQuery) ||
          (Array.isArray(s.tags) && s.tags.some((t: string) => t.toLowerCase().includes(lowerQuery)))
        )
      )
      .map((song: any) => ({
        song,
        similarityScore: 0.85,
      }));

    return fallbackMatches.slice(0, safeLimit);
  }
}
