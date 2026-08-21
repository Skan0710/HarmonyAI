import { AssistantTool, AssistantToolContext, ToolExecutionResult, ToolParameterSchema } from './toolTypes.js';
import { HybridRecommendationService } from '../services/hybridRecommendationService.js';
import { ContextAwareRecommendationService } from '../services/contextAwareRecommendationService.js';
import { SessionRecommendationService } from '../services/sessionRecommendationService.js';
import { ColdStartRecommendationService } from '../services/coldStartRecommendationService.js';
import { Song } from '../models/Song.js';
import { Types } from 'mongoose';

export interface RecommendationsInput {
  strategy?: 'hybrid' | 'contextual' | 'session' | 'auto';
  seedSongId?: string;
  mood?: string;
  activity?: string;
  energyLevel?: number;
  limit?: number;
}

export interface RecommendationResultData {
  strategyUsed: string;
  recommendations: any[];
  count: number;
  detectedContext?: Record<string, any>;
  hasActiveSession?: boolean;
}

export class RecommendationsTool implements AssistantTool<RecommendationsInput, RecommendationResultData> {
  name = 'get_recommendations';
  description = 'Fetch personalized or contextual music recommendations based on user listening history, seed songs, active session, or context (mood/activity/energy). Returns verified database songs.';

  parameters: ToolParameterSchema = {
    type: 'object',
    properties: {
      strategy: {
        type: 'string',
        enum: ['hybrid', 'contextual', 'session', 'auto'],
        description: 'Recommendation strategy to use ("hybrid" = personalized history/taste, "contextual" = mood/activity, "session" = active queue vibe, "auto" = best match).',
      },
      seedSongId: {
        type: 'string',
        description: 'Optional song ID to use as a recommendation seed.',
      },
      mood: {
        type: 'string',
        description: 'Target mood (e.g. "Chill", "Energetic", "Melancholic", "Focus", "Romantic", "Calm").',
      },
      activity: {
        type: 'string',
        description: 'Target activity (e.g. "Workout", "Study", "Coding", "Commute", "Sleeping").',
      },
      energyLevel: {
        type: 'number',
        description: 'Target energy level between 0.0 (calm) and 1.0 (high energy).',
      },
      limit: {
        type: 'number',
        description: 'Number of recommendations to fetch (default: 10, max: 30).',
      },
    },
  };

  validate(input: unknown): { valid: boolean; error?: string; data?: RecommendationsInput } {
    const raw = (input && typeof input === 'object' ? input : {}) as Record<string, any>;

    const strategy = ['hybrid', 'contextual', 'session', 'auto'].includes(raw.strategy) ? raw.strategy : 'auto';
    const limit = typeof raw.limit === 'number' && raw.limit > 0 ? Math.min(30, raw.limit) : 10;
    const energyLevel = typeof raw.energyLevel === 'number' ? Math.max(0, Math.min(1, raw.energyLevel)) : undefined;

    return {
      valid: true,
      data: {
        strategy,
        seedSongId: typeof raw.seedSongId === 'string' ? raw.seedSongId.trim() : undefined,
        mood: typeof raw.mood === 'string' ? raw.mood.trim() : undefined,
        activity: typeof raw.activity === 'string' ? raw.activity.trim() : undefined,
        energyLevel,
        limit,
      },
    };
  }

  /**
   * Standalone recommendation execution method reusable outside the assistant framework.
   */
  static async getRecommendations(
    input: RecommendationsInput,
    userId?: string
  ): Promise<RecommendationResultData> {
    const {
      strategy = 'auto',
      seedSongId,
      mood,
      activity,
      energyLevel,
      limit = 10,
    } = input;

    const safeLimit = Math.max(1, Math.min(30, limit));

    // 1. Contextual Recommendation Strategy
    if (strategy === 'contextual' || mood || activity || typeof energyLevel === 'number') {
      const contextualRes = await ContextAwareRecommendationService.getContextualRecommendations({
        userId,
        mood,
        activity,
        energyLevel,
        limit: safeLimit,
      });

      return {
        strategyUsed: 'contextual',
        recommendations: contextualRes.data || [],
        count: contextualRes.count || 0,
        detectedContext: contextualRes.detectedContext,
      };
    }

    // 2. Session Recommendation Strategy
    if (strategy === 'session' && userId && Types.ObjectId.isValid(userId)) {
      const sessionRes = await SessionRecommendationService.getSessionRecommendations({
        userId,
        limit: safeLimit,
      });

      return {
        strategyUsed: 'session',
        recommendations: sessionRes.data || [],
        count: sessionRes.count || 0,
        hasActiveSession: sessionRes.hasActiveSession,
      };
    }

    // 3. Personalized Hybrid Strategy
    if (userId && Types.ObjectId.isValid(userId)) {
      try {
        const hybridRes = await HybridRecommendationService.getHybridRecommendations({
          userId,
          seedSongId,
          limit: safeLimit,
        });

        return {
          strategyUsed: hybridRes.strategyUsed || 'hybrid',
          recommendations: hybridRes.recommendations || [],
          count: hybridRes.recommendations.length,
        };
      } catch (e) {
        // Fall back to cold start if user classification indicates cold start
        const coldStartRes = await ColdStartRecommendationService.getColdStartRecommendations({
          userId,
          limit: safeLimit,
        });

        return {
          strategyUsed: 'cold_start',
          recommendations: coldStartRes.songs.map((s) => ({ song: s, score: 0.8 })),
          count: coldStartRes.songs.length,
        };
      }
    }

    // 4. Anonymous Catalog Fallback
    const popularSongs = await Song.find({ isPublished: true })
      .sort({ playCount: -1 })
      .populate('artist', 'name profileImage avatar')
      .populate('album', 'title coverImage')
      .populate('genre', 'name slug')
      .limit(safeLimit)
      .lean();

    return {
      strategyUsed: 'popular_catalog',
      recommendations: popularSongs.map((s) => ({ song: s, score: 0.8 })),
      count: popularSongs.length,
    };
  }

  async execute(input: RecommendationsInput, context: AssistantToolContext): Promise<ToolExecutionResult<RecommendationResultData>> {
    const validation = this.validate(input);
    if (!validation.valid || !validation.data) {
      return {
        success: false,
        toolName: this.name,
        error: validation.error || 'Validation failed',
      };
    }

    try {
      const results = await RecommendationsTool.getRecommendations(validation.data, context.userId);

      if (results.count === 0) {
        return {
          success: true,
          toolName: this.name,
          data: results,
          message: 'No recommendations available for the requested criteria',
        };
      }

      return {
        success: true,
        toolName: this.name,
        data: results,
        message: `Retrieved ${results.count} ${results.strategyUsed} recommendations`,
      };
    } catch (error: any) {
      return {
        success: false,
        toolName: this.name,
        error: error.message || 'Failed to fetch recommendations',
      };
    }
  }
}
