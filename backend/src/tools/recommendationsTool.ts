import { AssistantTool, AssistantToolContext, ToolExecutionResult, ToolParameterSchema } from './toolTypes.js';
import { HybridRecommendationService } from '../services/hybridRecommendationService.js';
import { ContextAwareRecommendationService } from '../services/contextAwareRecommendationService.js';
import { SessionRecommendationService } from '../services/sessionRecommendationService.js';

export interface RecommendationsInput {
  strategy?: 'hybrid' | 'contextual' | 'session';
  seedSongId?: string;
  mood?: string;
  activity?: string;
  energyLevel?: number;
  limit?: number;
}

export class RecommendationsTool implements AssistantTool<RecommendationsInput> {
  name = 'get_recommendations';
  description = 'Fetch personalized music recommendations using hybrid collaborative filtering, contextual awareness (mood/activity), or active listening session vibes.';

  parameters: ToolParameterSchema = {
    type: 'object',
    properties: {
      strategy: {
        type: 'string',
        enum: ['hybrid', 'contextual', 'session'],
        description: 'Recommendation strategy to use (default: "hybrid").',
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
        description: 'Target activity (e.g. "Workout", "Study", "Coding", "Commute", "Sleeping", "Relaxation").',
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

    const strategy = ['hybrid', 'contextual', 'session'].includes(raw.strategy) ? raw.strategy : 'hybrid';
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

  async execute(input: RecommendationsInput, context: AssistantToolContext): Promise<ToolExecutionResult> {
    const validation = this.validate(input);
    if (!validation.valid || !validation.data) {
      return {
        success: false,
        toolName: this.name,
        error: validation.error || 'Validation failed',
      };
    }

    const { strategy, seedSongId, mood, activity, energyLevel, limit } = validation.data;
    const userId = context.userId;

    try {
      if (strategy === 'contextual' || mood || activity || typeof energyLevel === 'number') {
        const contextualResult = await ContextAwareRecommendationService.getContextualRecommendations({
          userId,
          mood,
          activity,
          energyLevel,
          limit,
        });

        return {
          success: true,
          toolName: this.name,
          data: {
            strategyUsed: 'contextual',
            recommendations: contextualResult.data,
            detectedContext: contextualResult.detectedContext,
            count: contextualResult.count,
          },
          message: `Retrieved ${contextualResult.count} contextual recommendations`,
        };
      }

      if (strategy === 'session' && userId) {
        const sessionResult = await SessionRecommendationService.getSessionRecommendations({
          userId,
          limit,
        });

        return {
          success: true,
          toolName: this.name,
          data: {
            strategyUsed: 'session',
            recommendations: sessionResult.data,
            hasActiveSession: sessionResult.hasActiveSession,
            count: sessionResult.count,
          },
          message: `Retrieved ${sessionResult.count} session-based recommendations`,
        };
      }

      if (userId) {
        const hybridResult = await HybridRecommendationService.getHybridRecommendations({
          userId,
          seedSongId,
          limit,
        });

        return {
          success: true,
          toolName: this.name,
          data: {
            strategyUsed: hybridResult.strategyUsed,
            userClassification: hybridResult.userClassification,
            recommendations: hybridResult.recommendations,
            count: hybridResult.recommendations.length,
          },
          message: `Retrieved ${hybridResult.recommendations.length} personalized hybrid recommendations`,
        };
      }

      // Anonymous fallback contextual recommendations
      const anonResult = await ContextAwareRecommendationService.getContextualRecommendations({
        limit,
      });

      return {
        success: true,
        toolName: this.name,
        data: {
          strategyUsed: 'cold_start',
          recommendations: anonResult.data,
          count: anonResult.count,
        },
        message: `Retrieved ${anonResult.count} catalog recommendations`,
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
