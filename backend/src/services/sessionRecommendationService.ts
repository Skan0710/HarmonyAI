import { Types } from 'mongoose';
import { ListeningSessionService } from './listeningSessionService.js';
import { SessionCandidateGenerationService, SessionCandidateResult } from './sessionCandidateGenerationService.js';
import { ColdStartRecommendationService } from './coldStartRecommendationService.js';
import { ISong } from '../models/Song.js';

export interface SessionRankedItem {
  song: ISong;
  sessionScore: number;
  contributingFactors: {
    contentSimilarityScore: number;
    sessionProfileAffinity: number;
    seedSongId?: string;
  };
  source: string;
}

export interface SessionRecommendationResponse {
  hasActiveSession: boolean;
  strategyUsed: 'SESSION_REALTIME' | 'COLD_START_FALLBACK';
  sessionId?: string;
  songCountInSession?: number;
  count: number;
  data: SessionRankedItem[];
}

export class SessionRecommendationService {
  /**
   * Fetches session-based real-time recommendations for an authenticated user:
   * - Uses active listening session behavior if present.
   * - Gracefully falls back to cold-start / popular recommendations if user has no active session.
   * - Returns session relevance score and contributing factors for each song.
   */
  static async getSessionRecommendations(params: {
    userId: string;
    limit?: number;
  }): Promise<SessionRecommendationResponse> {
    const { userId, limit = 10 } = params;

    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID provided for session recommendations');
    }

    const activeSession = await ListeningSessionService.getActiveSession(userId);

    // If user has no active session or 0 songs played, fallback gracefully
    if (!activeSession || !activeSession.songsPlayed || activeSession.songsPlayed.length === 0) {
      const fallbackRes = await ColdStartRecommendationService.getColdStartRecommendations({ userId, limit });

      const fallbackData: SessionRankedItem[] = fallbackRes.songs.map((songDoc, idx) => ({
        song: songDoc,
        sessionScore: Number((0.85 - idx * 0.05).toFixed(4)),
        contributingFactors: {
          contentSimilarityScore: 0.5,
          sessionProfileAffinity: 0.5,
        },
        source: 'cold_start_fallback',
      }));

      return {
        hasActiveSession: false,
        strategyUsed: 'COLD_START_FALLBACK',
        count: fallbackData.length,
        data: fallbackData,
      };
    }

    // Generate candidates based on active session
    const candidates: SessionCandidateResult[] =
      await SessionCandidateGenerationService.generateSessionCandidates({
        userId,
        sessionDoc: activeSession,
        limit,
      });

    if (candidates.length === 0) {
      const fallbackRes = await ColdStartRecommendationService.getColdStartRecommendations({ userId, limit });
      const fallbackData: SessionRankedItem[] = fallbackRes.songs.map((songDoc, idx) => ({
        song: songDoc,
        sessionScore: Number((0.75 - idx * 0.05).toFixed(4)),
        contributingFactors: {
          contentSimilarityScore: 0.4,
          sessionProfileAffinity: 0.4,
        },
        source: 'catalog_fallback',
      }));

      return {
        hasActiveSession: true,
        strategyUsed: 'COLD_START_FALLBACK',
        sessionId: activeSession._id.toString(),
        songCountInSession: activeSession.songsPlayed.length,
        count: fallbackData.length,
        data: fallbackData,
      };
    }

    const formattedData: SessionRankedItem[] = candidates.map((c) => ({
      song: c.song,
      sessionScore: c.sessionRelevanceScore,
      contributingFactors: {
        contentSimilarityScore: c.contentSimilarityScore,
        sessionProfileAffinity: c.sessionProfileAffinity,
        seedSongId: c.seedSongId,
      },
      source: c.source,
    }));

    return {
      hasActiveSession: true,
      strategyUsed: 'SESSION_REALTIME',
      sessionId: activeSession._id.toString(),
      songCountInSession: activeSession.songsPlayed.length,
      count: formattedData.length,
      data: formattedData,
    };
  }
}
