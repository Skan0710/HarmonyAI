import { supabase } from '../config/supabase.js';
import { isValidObjectId } from '../utils/validators.js';
import { mapSongRow } from './songService.js';
import { SongFeatureExtractionService } from './songFeatureExtractionService.js';
import { ContentSimilarityService } from './similarityService.js';

export interface RecommendedSongResult {
  song: any;
  similarityScore: number;
  explanation?: any;
}

export class ContentRecommendationService {
  /**
   * Generates content-based song recommendations for a given seed song ID.
   * Compares candidate catalog tracks using feature vectors and categorical metadata similarity.
   * 
   * @param songId Target seed song ID string
   * @param limit Maximum number of recommended songs to return (default 10)
   * @param debug Include similarity score explanation breakdown (development-only)
   */
  static async getRecommendationsForSong(
    songId: string,
    limit = 10,
    debug = false
  ): Promise<any[]> {
    if (!isValidObjectId(songId)) {
      throw new Error('Invalid song ID');
    }

    // 1. Fetch seed song from Supabase
    const { data: seedRaw, error: seedError } = await supabase
      .from('songs')
      .select('*, artists!songs_artist_id_fkey(*), albums!songs_album_id_fkey(*), genres!songs_genre_id_fkey(*)')
      .eq('id', songId)
      .maybeSingle();

    if (seedError || !seedRaw) {
      throw new Error('Seed song not found');
    }

    const seedSong = mapSongRow(seedRaw);

    // 2. Extract seed song normalized features
    const seedFeatures = SongFeatureExtractionService.extractFeatures(seedSong);

    // 3. Retrieve suitable candidate songs from Supabase (excluding seed song)
    const { data: candidateRows } = await supabase
      .from('songs')
      .select('*, artists!songs_artist_id_fkey(*), albums!songs_album_id_fkey(*), genres!songs_genre_id_fkey(*)')
      .neq('id', songId)
      .eq('is_published', true);

    const candidateSongs = (candidateRows || []).map(mapSongRow);

    if (candidateSongs.length === 0) {
      return [];
    }

    // 4. Calculate content similarity scores for candidate songs
    const scoredCandidates = candidateSongs.map((candidate) => {
      const candidateFeatures = SongFeatureExtractionService.extractFeatures(candidate);

      if (debug) {
        const { similarityScore, explanation } = ContentSimilarityService.calculateSimilarityWithExplanation(
          seedFeatures,
          candidateFeatures
        );
        return {
          ...candidate,
          similarityScore,
          explanation,
        };
      }

      const similarityScore = ContentSimilarityService.calculateSimilarity(
        seedFeatures,
        candidateFeatures
      );

      return {
        ...candidate,
        similarityScore,
      };
    });

    // 5. Sort candidates descending by similarity score
    scoredCandidates.sort((a, b) => b.similarityScore - a.similarityScore);

    // 6. Return top recommended songs
    return scoredCandidates.slice(0, Math.max(1, limit));
  }
}
