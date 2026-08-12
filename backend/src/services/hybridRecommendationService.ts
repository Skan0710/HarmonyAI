import { Types } from 'mongoose';
import { Song } from '../models/Song.js';
import { User } from '../models/User.js';
import { ContentRecommendationService } from './recommendationService.js';
import { CollaborativeFilteringService } from './collaborativeFilteringService.js';
import { TrendingService } from './trendingService.js';
import {
  HybridScoringWeights,
  getHybridConfigWeights,
} from '../config/recommendationConfig.js';

export interface HybridCandidateItem {
  song: any;
  hybridScore: number;
  componentScores: {
    contentScore: number;
    collaborativeScore: number;
    popularityScore: number;
    recencyScore: number;
  };
}

export class HybridRecommendationService {
  /**
   * Combines content-based, collaborative filtering, popularity, and recency scores into a unified
   * normalized hybrid recommendation score between 0.0 and 1.0.
   */
  static async getHybridRecommendations(params: {
    userId: string;
    seedSongId?: string;
    limit?: number;
    customWeights?: Partial<HybridScoringWeights>;
  }): Promise<HybridCandidateItem[]> {
    const { userId, seedSongId, limit = 10, customWeights } = params;

    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }

    const weights: HybridScoringWeights = {
      ...getHybridConfigWeights(),
      ...customWeights,
    };

    // 1. Fetch User Liked Songs & History to Exclude Already Interacted Songs
    const userDoc = await User.findById(userId).select('likedSongs').lean();
    const userLikedSet = new Set<string>((userDoc?.likedSongs || []).map((id) => id.toString()));

    const candidateMap = new Map<
      string,
      {
        songDoc: any;
        rawContentScore: number;
        rawCollaborativeScore: number;
        rawPopularityScore: number;
        rawRecencyScore: number;
      }
    >();

    const getOrCreateCandidate = (songDoc: any) => {
      const songId = songDoc._id.toString();
      if (!candidateMap.has(songId)) {
        candidateMap.set(songId, {
          songDoc,
          rawContentScore: 0,
          rawCollaborativeScore: 0,
          rawPopularityScore: songDoc.playCount || 0,
          rawRecencyScore: calculateRecencyRawScore(songDoc),
        });
      }
      return candidateMap.get(songId)!;
    };

    // 2. Fetch Content-Based Recommendation Scores
    if (seedSongId && Types.ObjectId.isValid(seedSongId)) {
      const contentResults = await ContentRecommendationService.getRecommendationsForSong(
        seedSongId,
        40
      );
      for (const item of contentResults) {
        const cand = getOrCreateCandidate(item);
        cand.rawContentScore = item.similarityScore || 0;
      }
    }

    // 3. Fetch Collaborative Filtering Recommendation Scores
    const collabResults = await CollaborativeFilteringService.getRecommendationsForUser(
      userId,
      40
    );
    for (const item of collabResults) {
      const cand = getOrCreateCandidate(item);
      cand.rawCollaborativeScore = item.recommendationScore || 0;
    }

    // 4. Fetch Trending & Catalog Songs for Popularity / Recency Coverage
    const trendingResults = await TrendingService.getTrendingSongs(40);
    for (const item of trendingResults) {
      const cand = getOrCreateCandidate(item);
      if (item.trendingScore) {
        cand.rawRecencyScore = Math.max(cand.rawRecencyScore, item.trendingScore);
      }
    }

    // Exclude seedSongId and songs user has already liked
    if (seedSongId) {
      candidateMap.delete(seedSongId);
    }
    for (const likedId of userLikedSet) {
      candidateMap.delete(likedId);
    }

    if (candidateMap.size === 0) {
      // Fallback: Fetch general catalog songs if candidate map is empty
      const catalogSongs = await Song.find({ isPublished: true })
        .populate('artist', 'name profileImage avatar verified')
        .populate('album', 'title coverImage releaseYear')
        .populate('genre', 'name slug')
        .sort({ playCount: -1 })
        .limit(20)
        .lean();

      for (const song of catalogSongs) {
        const idStr = song._id.toString();
        if (idStr !== seedSongId && !userLikedSet.has(idStr)) {
          getOrCreateCandidate(song);
        }
      }
    }

    const candidates = Array.from(candidateMap.values());
    if (candidates.length === 0) {
      return [];
    }

    // 5. Min-Max Normalization to Common [0.0, 1.0] Range
    const maxContent = Math.max(...candidates.map((c) => c.rawContentScore), 0.0001);
    const maxCollab = Math.max(...candidates.map((c) => c.rawCollaborativeScore), 0.0001);
    const maxPop = Math.max(...candidates.map((c) => c.rawPopularityScore), 1);
    const maxRec = Math.max(...candidates.map((c) => c.rawRecencyScore), 0.0001);

    const totalWeightSum =
      weights.contentSimilarityWeight +
      weights.collaborativeWeight +
      weights.popularityWeight +
      weights.recencyWeight;

    // 6. Compute Final Hybrid Score & Component Breakdown
    const scoredItems: HybridCandidateItem[] = candidates.map((cand) => {
      const normContent = cand.rawContentScore / maxContent;
      const normCollab = cand.rawCollaborativeScore / maxCollab;
      const normPop = cand.rawPopularityScore / maxPop;
      const normRec = cand.rawRecencyScore / maxRec;

      const weightedScoreSum =
        normContent * weights.contentSimilarityWeight +
        normCollab * weights.collaborativeWeight +
        normPop * weights.popularityWeight +
        normRec * weights.recencyWeight;

      const rawHybrid = totalWeightSum > 0 ? weightedScoreSum / totalWeightSum : 0;
      const finalHybridScore = Number(Math.max(0, Math.min(1, rawHybrid)).toFixed(4));

      return {
        song: cand.songDoc,
        hybridScore: finalHybridScore,
        componentScores: {
          contentScore: Number(normContent.toFixed(4)),
          collaborativeScore: Number(normCollab.toFixed(4)),
          popularityScore: Number(normPop.toFixed(4)),
          recencyScore: Number(normRec.toFixed(4)),
        },
      };
    });

    // 7. Sort Descending by Hybrid Score
    scoredItems.sort((a, b) => b.hybridScore - a.hybridScore);

    return scoredItems.slice(0, Math.max(1, limit));
  }
}

function calculateRecencyRawScore(songDoc: any): number {
  if (!songDoc) return 0;
  const currentYear = new Date().getFullYear();
  const releaseYear = songDoc.releaseYear || currentYear - 5;
  const yearsOld = Math.max(0, currentYear - releaseYear);
  // Recency score decays as track grows older
  return Math.max(0.1, 1 / (1 + 0.3 * yearsOld));
}
