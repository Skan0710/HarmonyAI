import { AssistantTool, AssistantToolContext, ToolExecutionResult, ToolParameterSchema } from './toolTypes.js';
import { HybridRecommendationService } from '../services/hybridRecommendationService.js';
import { ColdStartRecommendationService } from '../services/coldStartRecommendationService.js';
import { Song } from '../models/Song.js';
import { Types } from 'mongoose';

export interface PersonalizedRecommendationsInput {
  seedSongId?: string;
  limit?: number;
}

export interface PersonalizedRecommendationsData {
  strategyUsed: string;
  recommendations: any[];
  count: number;
}

export class PersonalizedRecommendationsTool implements AssistantTool<PersonalizedRecommendationsInput, PersonalizedRecommendationsData> {
  name = 'personalized_recommendations';
  description = 'Generates personalized music recommendations tailored to the user taste profile, listening history, and seed songs using hybrid and collaborative ranking.';

  parameters: ToolParameterSchema = {
    type: 'object',
    properties: {
      seedSongId: {
        type: 'string',
        description: 'Optional song ID to use as a seed for personalized recommendations.',
      },
      limit: {
        type: 'number',
        description: 'Number of recommendations to return (default: 10, max: 30).',
      },
    },
  };

  validate(input: unknown): { valid: boolean; error?: string; data?: PersonalizedRecommendationsInput } {
    const raw = (input && typeof input === 'object' ? input : {}) as Record<string, any>;
    const limit = typeof raw.limit === 'number' && raw.limit > 0 ? Math.min(30, raw.limit) : 10;
    const seedSongId = typeof raw.seedSongId === 'string' && raw.seedSongId.trim() ? raw.seedSongId.trim() : undefined;

    if (seedSongId && !Types.ObjectId.isValid(seedSongId)) {
      return { valid: false, error: 'Invalid seedSongId format (must be a valid ObjectId).' };
    }

    return {
      valid: true,
      data: {
        seedSongId,
        limit,
      },
    };
  }

  async execute(
    input: PersonalizedRecommendationsInput,
    context: AssistantToolContext
  ): Promise<ToolExecutionResult<PersonalizedRecommendationsData>> {
    const validation = this.validate(input);
    if (!validation.valid || !validation.data) {
      return {
        success: false,
        toolName: this.name,
        error: validation.error || 'Validation failed',
      };
    }

    try {
      const { seedSongId, limit = 10 } = validation.data;
      const safeLimit = Math.max(1, Math.min(30, limit));
      const userId = context.userId;

      if (userId && Types.ObjectId.isValid(userId)) {
        try {
          const hybridRes = await HybridRecommendationService.getHybridRecommendations({
            userId,
            seedSongId,
            limit: safeLimit,
          });

          return {
            success: true,
            toolName: this.name,
            data: {
              strategyUsed: hybridRes.strategyUsed || 'hybrid',
              recommendations: hybridRes.recommendations || [],
              count: hybridRes.recommendations.length,
            },
            message: `Retrieved ${hybridRes.recommendations.length} personalized recommendations.`,
          };
        } catch (e) {
          const coldStartRes = await ColdStartRecommendationService.getColdStartRecommendations({
            userId,
            limit: safeLimit,
          });

          return {
            success: true,
            toolName: this.name,
            data: {
              strategyUsed: 'cold_start',
              recommendations: coldStartRes.songs.map((s) => ({ song: s, score: 0.8 })),
              count: coldStartRes.songs.length,
            },
            message: `Retrieved ${coldStartRes.songs.length} personalized onboarding recommendations.`,
          };
        }
      }

      // Anonymous fallback
      const popularSongs = await Song.find({ isPublished: true })
        .sort({ playCount: -1 })
        .populate('artist', 'name profileImage avatar')
        .populate('album', 'title coverImage')
        .populate('genre', 'name slug')
        .limit(safeLimit)
        .lean();

      return {
        success: true,
        toolName: this.name,
        data: {
          strategyUsed: 'popular_catalog',
          recommendations: popularSongs.map((s) => ({ song: s, score: 0.8 })),
          count: popularSongs.length,
        },
        message: `Retrieved ${popularSongs.length} trending songs.`,
      };
    } catch (error: any) {
      return {
        success: false,
        toolName: this.name,
        error: error.message || 'Failed to fetch personalized recommendations',
      };
    }
  }
}
