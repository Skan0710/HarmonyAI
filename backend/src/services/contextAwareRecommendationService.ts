import { Types } from 'mongoose';
import { ContextDetectionService } from './contextDetectionService.js';
import { ContextPreference } from '../schemas/contextPreferenceSchema.js';
import { ColdStartDetectionService } from './coldStartDetectionService.js';
import { ColdStartRecommendationService } from './coldStartRecommendationService.js';
import { CandidateGenerationService } from './candidateGenerationService.js';
import { ContextAwareRankingPipeline, ContextRankedResult } from './contextAwareRankingPipeline.js';

export interface ContextualRecommendationResult {
  strategyUsed: 'CONTEXTUAL_HYBRID_PERSONALIZED' | 'COLD_START';
  userClassification: 'NEW' | 'LIMITED_DATA' | 'ACTIVE' | 'WELL_ESTABLISHED';
  detectedContext: ContextPreference;
  count: number;
  data: ContextRankedResult[];
}

export class ContextAwareRecommendationService {
  /**
   * Generates context-aware recommendations:
   * - Automatically detects time-of-day category from server time.
   * - Accepts optional explicit context parameters (mood, activity, energyLevel, preferredDurationMinutes).
   * - Uses cold-start strategy for NEW/LIMITED_DATA or unauthenticated users.
   * - Uses personalized hybrid candidates + ContextAwareRankingPipeline for ACTIVE/WELL_ESTABLISHED users.
   * - Handles missing context parameters gracefully.
   */
  static async getContextualRecommendations(params: {
    userId?: string;
    mood?: string;
    activity?: string;
    energyLevel?: number;
    durationMinutes?: number;
    limit?: number;
  }): Promise<ContextualRecommendationResult> {
    const { userId, mood, activity, energyLevel, durationMinutes, limit = 10 } = params;

    // 1. Detect Context (automatically determines time-of-day, merges optional parameters)
    const detectedContext = ContextDetectionService.detectCurrentContext({
      explicitContext: {
        mood: mood as any,
        activity: activity as any,
        energyLevel,
        preferredDurationMinutes: durationMinutes,
      },
    });

    // 2. Unauthenticated / Anonymous User -> Cold Start
    if (!userId || !Types.ObjectId.isValid(userId)) {
      const coldStartRes = await ColdStartRecommendationService.getColdStartRecommendations({
        userId: 'anonymous',
        limit,
      });
      const formattedData: ContextRankedResult[] = coldStartRes.songs.map((songDoc, idx) => ({
        song: songDoc,
        contextScore: Number((0.9 - idx * 0.05).toFixed(4)),
        componentScores: {
          contentScore: 0,
          collaborativeScore: 0,
          userTasteAffinityScore: 0.5,
          popularityScore: 0.8,
          recencyScore: 0.8,
          moodScore: 0.5,
          activityScore: 0.5,
        },
        sources: coldStartRes.candidateSources || ['cold_start'],
      }));

      return {
        strategyUsed: 'COLD_START',
        userClassification: 'NEW',
        detectedContext,
        count: formattedData.length,
        data: formattedData,
      };
    }

    try {
      // 3. Authenticated User State Classification Detection
      const coldStartInfo = await ColdStartDetectionService.detectUserColdStartStatus(userId);
      const userClassification = coldStartInfo.classification;

      if (coldStartInfo.isColdStart) {
        const coldStartRes = await ColdStartRecommendationService.getColdStartRecommendations({ userId, limit });
        const formattedData: ContextRankedResult[] = coldStartRes.songs.map((songDoc, idx) => ({
          song: songDoc,
          contextScore: Number((0.95 - idx * 0.05).toFixed(4)),
          componentScores: {
            contentScore: 0,
            collaborativeScore: 0,
            userTasteAffinityScore: 0.5,
            popularityScore: 0.8,
            recencyScore: 0.8,
            moodScore: 0.5,
            activityScore: 0.5,
          },
          sources: coldStartRes.candidateSources || ['cold_start'],
        }));

        return {
          strategyUsed: 'COLD_START',
          userClassification,
          detectedContext,
          count: formattedData.length,
          data: formattedData,
        };
      }

      // 4. Personalized Context-Aware Hybrid Pipeline Execution for ACTIVE/WELL_ESTABLISHED Users
      const candidates = await CandidateGenerationService.generateHybridCandidates({
        userId,
        candidateLimit: 50,
      });

      if (candidates.length === 0) {
        const fallbackRes = await ColdStartRecommendationService.getColdStartRecommendations({ userId, limit });
        const formattedFallback: ContextRankedResult[] = fallbackRes.songs.map((songDoc, idx) => ({
          song: songDoc,
          contextScore: Number((0.8 - idx * 0.05).toFixed(4)),
          componentScores: {
            contentScore: 0,
            collaborativeScore: 0,
            userTasteAffinityScore: 0.3,
            popularityScore: 0.5,
            recencyScore: 0.5,
            moodScore: 0.5,
            activityScore: 0.5,
          },
          sources: ['catalog_fallback'],
        }));

        return {
          strategyUsed: 'COLD_START',
          userClassification,
          detectedContext,
          count: formattedFallback.length,
          data: formattedFallback,
        };
      }

      const rankedResults = ContextAwareRankingPipeline.rankCandidatesWithContext(
        candidates,
        detectedContext,
        limit
      );

      return {
        strategyUsed: 'CONTEXTUAL_HYBRID_PERSONALIZED',
        userClassification,
        detectedContext,
        count: rankedResults.length,
        data: rankedResults,
      };
    } catch (error: any) {
      console.warn(`[ContextAwareRecommendationService Warning]: Pipeline execution failed gracefully: ${error.message}`);
      // Fallback safely to cold start
      const coldStartRes = await ColdStartRecommendationService.getColdStartRecommendations({
        userId: userId || 'anonymous',
        limit,
      });
      const fallbackData: ContextRankedResult[] = coldStartRes.songs.map((songDoc, idx) => ({
        song: songDoc,
        contextScore: Number((0.7 - idx * 0.05).toFixed(4)),
        componentScores: {
          contentScore: 0,
          collaborativeScore: 0,
          userTasteAffinityScore: 0.3,
          popularityScore: 0.5,
          recencyScore: 0.5,
          moodScore: 0.5,
          activityScore: 0.5,
        },
        sources: ['failsafe_fallback'],
      }));

      return {
        strategyUsed: 'COLD_START',
        userClassification: 'NEW',
        detectedContext,
        count: fallbackData.length,
        data: fallbackData,
      };
    }
  }
}
