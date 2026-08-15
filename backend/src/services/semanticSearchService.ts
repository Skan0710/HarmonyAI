import { Song, ISong } from '../models/Song.js';
import { EmbeddingService } from './embeddingService.js';

export interface SemanticSearchResult {
  song: ISong;
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

    // 1. Generate Query Vector Embedding using existing EmbeddingService
    const queryVector = await EmbeddingService.generateEmbedding(query.trim());

    if (!Array.isArray(queryVector) || queryVector.length === 0) {
      return [];
    }

    // 2. Fetch Songs that HAVE Vector Embeddings (excluding songs without embeddings)
    const songsWithEmbeddings = await Song.find({
      isPublished: true,
      vectorEmbedding: { $exists: true, $not: { $size: 0 } },
    })
      .populate('artist', 'name profileImage avatar verified')
      .populate('album', 'title coverImage releaseYear')
      .populate('genre', 'name slug')
      .lean();

    if (!songsWithEmbeddings || songsWithEmbeddings.length === 0) {
      return [];
    }

    // 3. Compute Vector Cosine Similarity per song
    const rankedResults: SemanticSearchResult[] = [];

    for (const songDoc of songsWithEmbeddings) {
      const songVector = songDoc.vectorEmbedding;
      if (!Array.isArray(songVector) || songVector.length === 0) continue;

      const similarity = this.calculateVectorCosineSimilarity(queryVector, songVector);

      rankedResults.push({
        song: songDoc as any,
        similarityScore: similarity,
      });
    }

    // 4. Rank Songs by Similarity Descending
    rankedResults.sort((a, b) => b.similarityScore - a.similarityScore);

    // 5. Return Configurable Result Limit
    return rankedResults.slice(0, safeLimit);
  }
}
