import { Types } from 'mongoose';
import { Song } from '../models/Song.js';
import { UserSongInteractionMatrixService } from './interactionMatrixService.js';
import { UserSimilarityService } from './userSimilarityService.js';

export interface CollaborativeRecommendationResult {
  song: any;
  recommendationScore: number;
}

export interface CollaborativeDiagnostics {
  totalUsersConsidered: number;
  similarUsersFound: number;
  candidateSongsEvaluated: number;
}

export class CollaborativeFilteringService {
  /**
   * Generates Collaborative Filtering song recommendations for a target user ID.
   * Finds similar users (KNN), accumulates predicted scores using user similarity & interaction strength,
   * and excludes songs the target user has already interacted with.
   * 
   * @param userId Target user ObjectId string
   * @param limit Maximum number of recommended songs to return (default 10)
   * @param neighborLimit Maximum number of similar neighbors to evaluate (default 20)
   * @param debug Return development diagnostics breakdown
   */
  static async getRecommendationsForUser(
    userId: string,
    limit = 10,
    neighborLimit = 20,
    debug = false
  ): Promise<any | { recommendations: any[]; diagnostics: CollaborativeDiagnostics }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }

    // 1. Build User-Song Interaction Matrix
    const matrix = await UserSongInteractionMatrixService.buildInteractionMatrix();
    const totalUsersConsidered = Math.max(0, matrix.userIds.length - 1); // Exclude target user

    const targetRowMap = matrix.getUserRowMap(userId);

    // 2. Find Similar Users (K-Nearest Neighbors)
    const similarUsers = UserSimilarityService.findMostSimilarUsers(
      userId,
      matrix,
      neighborLimit,
      0.001
    );

    const diagnostics: CollaborativeDiagnostics = {
      totalUsersConsidered,
      similarUsersFound: similarUsers.length,
      candidateSongsEvaluated: 0,
    };

    if (similarUsers.length === 0) {
      return debug ? { recommendations: [], diagnostics } : [];
    }

    // Map to accumulate predicted scores per candidate songId
    const candidateScoreMap = new Map<string, { totalWeightedSimScore: number; simNormSum: number }>();

    // 3. Accumulate predicted recommendation scores from similar users
    for (const neighbor of similarUsers) {
      const neighborRowMap = matrix.getUserRowMap(neighbor.userId);

      for (const [songId, interactionScore] of neighborRowMap.entries()) {
        // Exclude songs the target user has already strongly interacted with (score > 0)
        if (targetRowMap.has(songId) && targetRowMap.get(songId)! > 0) {
          continue;
        }

        // Only recommend songs that neighbor positively interacted with
        if (interactionScore <= 0) {
          continue;
        }

        // Predicted Score Formula: Sim(Target, Neighbor) * InteractionStrength(Neighbor, Song)
        const weightedScore = neighbor.similarityScore * interactionScore;

        if (candidateScoreMap.has(songId)) {
          const current = candidateScoreMap.get(songId)!;
          current.totalWeightedSimScore += weightedScore;
          current.simNormSum += neighbor.similarityScore;
        } else {
          candidateScoreMap.set(songId, {
            totalWeightedSimScore: weightedScore,
            simNormSum: neighbor.similarityScore,
          });
        }
      }
    }

    diagnostics.candidateSongsEvaluated = candidateScoreMap.size;

    if (candidateScoreMap.size === 0) {
      return debug ? { recommendations: [], diagnostics } : [];
    }

    // 4. Compute final normalized recommendation score per candidate song
    const candidateScores: { songId: string; score: number }[] = [];

    for (const [songId, agg] of candidateScoreMap.entries()) {
      // Score combining cumulative weighted neighbor score and normalized neighbor similarity
      const finalScore = Number(
        (agg.totalWeightedSimScore / (agg.simNormSum > 0 ? agg.simNormSum : 1)).toFixed(4)
      );

      candidateScores.push({ songId, score: finalScore });
    }

    // Sort candidates descending by recommendation score
    candidateScores.sort((a, b) => b.score - a.score);

    const topCandidates = candidateScores.slice(0, Math.max(1, limit));
    const topSongIds = topCandidates.map((c) => c.songId);

    // 5. Fetch populated Song documents from MongoDB
    const songs = await Song.find({ _id: { $in: topSongIds }, isPublished: true })
      .populate('artist', 'name profileImage avatar verified')
      .populate('album', 'title coverImage releaseYear')
      .populate('genre', 'name slug')
      .lean();

    const songMap = new Map<string, any>(songs.map((s) => [s._id.toString(), s]));

    // Preserve candidate score ordering and attach recommendationScore
    const results: any[] = [];
    for (const cand of topCandidates) {
      const songDoc = songMap.get(cand.songId);
      if (songDoc) {
        results.push({
          ...songDoc,
          recommendationScore: cand.score,
        });
      }
    }

    if (debug) {
      return { recommendations: results, diagnostics };
    }

    return results;
  }
}
