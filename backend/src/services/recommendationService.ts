import { Types } from 'mongoose';
import { Song } from '../models/Song.js';
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
   * @param songId Target seed song ObjectId string
   * @param limit Maximum number of recommended songs to return (default 10)
   * @param debug Include similarity score explanation breakdown (development-only)
   */
  static async getRecommendationsForSong(
    songId: string,
    limit = 10,
    debug = false
  ): Promise<any[]> {
    if (!Types.ObjectId.isValid(songId)) {
      throw new Error('Invalid song ID');
    }

    const seedObjectId = new Types.ObjectId(songId);

    // 1. Fetch seed song with full population
    const seedSong = await Song.findById(seedObjectId)
      .populate('artist', 'name profileImage avatar verified')
      .populate('album', 'title coverImage releaseYear')
      .populate('genre', 'name slug')
      .lean();

    if (!seedSong) {
      throw new Error('Seed song not found');
    }

    // 2. Extract seed song normalized features
    const seedFeatures = SongFeatureExtractionService.extractFeatures(seedSong);

    // 3. Retrieve suitable candidate songs from MongoDB (excluding seed song)
    const candidateSongs = await Song.find({
      _id: { $ne: seedObjectId },
      isPublished: true,
    })
      .populate('artist', 'name profileImage avatar verified')
      .populate('album', 'title coverImage releaseYear')
      .populate('genre', 'name slug')
      .lean();

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
