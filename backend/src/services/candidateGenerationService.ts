import { Types } from 'mongoose';
import { Song } from '../models/Song.js';
import { User } from '../models/User.js';
import { ContentRecommendationService } from './recommendationService.js';
import { CollaborativeFilteringService } from './collaborativeFilteringService.js';
import { TrendingService } from './trendingService.js';
import { UserSongInteractionMatrixService } from './interactionMatrixService.js';
import { UserTasteProfileService, UserTasteProfile } from './userTasteProfileService.js';

export interface HybridCandidate {
  songId: string;
  songDoc: any;
  contentScore: number;
  collaborativeScore: number;
  userTasteAffinityScore: number;
  popularitySignal: number;
  recencySignal: number;
  sources: string[];
}

export class CandidateGenerationService {
  /**
   * Generates a merged pool of recommendation candidates from content-based, collaborative filtering,
   * user taste profile affinities, and trending/catalog signals. Merges duplicates, preserves individual
   * component scores, and excludes songs the user has already strongly interacted with.
   */
  static async generateHybridCandidates(params: {
    userId: string;
    seedSongId?: string;
    candidateLimit?: number;
  }): Promise<HybridCandidate[]> {
    const { userId, seedSongId, candidateLimit = 50 } = params;

    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }

    // 1. Identify songs target user has already strongly interacted with (to exclude)
    const userDoc = await User.findById(userId).select('likedSongs').lean();
    const excludedSongIds = new Set<string>((userDoc?.likedSongs || []).map((id) => id.toString()));

    if (seedSongId) {
      excludedSongIds.add(seedSongId);
    }

    // Include songs user interacted with in matrix
    try {
      const matrix = await UserSongInteractionMatrixService.buildInteractionMatrix();
      const targetRowMap = matrix.getUserRowMap(userId);
      for (const [sId, score] of targetRowMap.entries()) {
        if (score > 0) {
          excludedSongIds.add(sId);
        }
      }
    } catch (e) {
      // Continue safely if matrix build encounters insufficient history
    }

    // Fetch User Taste Profile to score candidate affinities
    let tasteProfile: UserTasteProfile | null = null;
    try {
      tasteProfile = await UserTasteProfileService.generateTasteProfile(userId);
    } catch (e) {
      // Fallback if user profile cannot be loaded
    }

    const candidateMap = new Map<string, HybridCandidate>();

    const mergeCandidate = (
      songDoc: any,
      source: 'content' | 'collaborative' | 'trending' | 'taste_profile',
      rawScore: number
    ) => {
      if (!songDoc || !songDoc._id) return;
      const songId = songDoc._id.toString();

      // Exclude songs the target user has already strongly interacted with
      if (excludedSongIds.has(songId)) {
        return;
      }

      let existing = candidateMap.get(songId);
      if (!existing) {
        existing = {
          songId,
          songDoc,
          contentScore: 0,
          collaborativeScore: 0,
          userTasteAffinityScore: computeSongTasteAffinity(songDoc, tasteProfile),
          popularitySignal: songDoc.playCount || 0,
          recencySignal: calculateRecencySignal(songDoc),
          sources: [],
        };
        candidateMap.set(songId, existing);
      }

      if (!existing.sources.includes(source)) {
        existing.sources.push(source);
      }

      if (source === 'content') {
        existing.contentScore = Math.max(existing.contentScore, rawScore);
      } else if (source === 'collaborative') {
        existing.collaborativeScore = Math.max(existing.collaborativeScore, rawScore);
      } else if (source === 'trending') {
        existing.recencySignal = Math.max(existing.recencySignal, rawScore);
      }
    };

    // 2. Candidate Source 1: Content-Based Recommendations
    if (seedSongId && Types.ObjectId.isValid(seedSongId)) {
      try {
        const contentResults = await ContentRecommendationService.getRecommendationsForSong(
          seedSongId,
          candidateLimit
        );
        for (const item of contentResults) {
          mergeCandidate(item, 'content', item.similarityScore || 0);
        }
      } catch (e) {
        // Safe fallback
      }
    }

    // 3. Candidate Source 2: Collaborative Filtering Recommendations
    try {
      const collabResults = await CollaborativeFilteringService.getRecommendationsForUser(
        userId,
        candidateLimit
      );
      for (const item of collabResults) {
        mergeCandidate(item, 'collaborative', item.recommendationScore || 0);
      }
    } catch (e) {
      // Safe fallback
    }

    // 4. Candidate Source 3: Trending & Catalog Popularity/Recency
    try {
      const trendingResults = await TrendingService.getTrendingSongs(candidateLimit);
      for (const item of trendingResults) {
        mergeCandidate(item, 'trending', item.trendingScore || 0);
      }
    } catch (e) {
      // Safe fallback
    }

    // 5. Catalog Fallback if candidate pool is small
    if (candidateMap.size < candidateLimit) {
      const catalogSongs = await Song.find({ isPublished: true })
        .populate('artist', 'name profileImage avatar verified')
        .populate('album', 'title coverImage releaseYear')
        .populate('genre', 'name slug')
        .sort({ playCount: -1 })
        .limit(candidateLimit)
        .lean();

      for (const song of catalogSongs) {
        mergeCandidate(song, 'trending', song.playCount || 0);
      }
    }

    return Array.from(candidateMap.values());
  }
}

/**
 * Computes a candidate song's user taste affinity score by checking genre and artist affinities
 * in short-term (70% weight) and long-term (30% weight) profiles.
 */
export function computeSongTasteAffinity(songDoc: any, profile: UserTasteProfile | null): number {
  if (!songDoc || !profile) return 0;

  const songGenreId =
    typeof songDoc.genre === 'object' && songDoc.genre?._id
      ? songDoc.genre._id.toString()
      : String(songDoc.genre || '');

  const songArtistId =
    typeof songDoc.artist === 'object' && songDoc.artist?._id
      ? songDoc.artist._id.toString()
      : String(songDoc.artist || '');

  // Genre affinity lookup
  const shortTermGenre = profile.shortTermProfile?.genres.find((g) => g.genreId === songGenreId)?.affinityScore || 0;
  const longTermGenre = profile.longTermProfile?.genres.find((g) => g.genreId === songGenreId)?.affinityScore || 0;
  // Short-term preference acts as stronger signal (70%), long-term as stabilizing foundation (30%)
  const genreAffinity = 0.7 * shortTermGenre + 0.3 * longTermGenre;

  // Artist affinity lookup
  const shortTermArtist = profile.shortTermProfile?.artists.find((a) => a.artistId === songArtistId)?.affinityScore || 0;
  const longTermArtist = profile.longTermProfile?.artists.find((a) => a.artistId === songArtistId)?.affinityScore || 0;
  const artistAffinity = 0.7 * shortTermArtist + 0.3 * longTermArtist;

  const combinedAffinity = 0.5 * genreAffinity + 0.5 * artistAffinity;
  return Number(Math.max(0, Math.min(1, combinedAffinity)).toFixed(4));
}

function calculateRecencySignal(songDoc: any): number {
  if (!songDoc) return 0;
  const currentYear = new Date().getFullYear();
  const releaseYear = songDoc.releaseYear || currentYear - 5;
  const yearsOld = Math.max(0, currentYear - releaseYear);
  return Math.max(0.1, 1 / (1 + 0.3 * yearsOld));
}
