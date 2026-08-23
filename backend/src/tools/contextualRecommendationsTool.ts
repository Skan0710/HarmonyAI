import { AssistantTool, AssistantToolContext, ToolExecutionResult, ToolParameterSchema } from './toolTypes.js';
import { ContextAwareRecommendationService } from '../services/contextAwareRecommendationService.js';

export interface ContextualRecommendationsInput {
  mood?: string;
  activity?: string;
  energyLevel?: number;
  limit?: number;
}

export interface ContextualRecommendationsData {
  strategyUsed: string;
  recommendations: any[];
  count: number;
  detectedContext?: Record<string, any>;
}

export class ContextualRecommendationsTool implements AssistantTool<ContextualRecommendationsInput, ContextualRecommendationsData> {
  name = 'contextual_recommendations';
  description = 'Generates context-aware music recommendations tailored to current mood, activity, or target energy level.';

  parameters: ToolParameterSchema = {
    type: 'object',
    properties: {
      mood: {
        type: 'string',
        description: 'Target mood (e.g. "Chill", "Energetic", "Melancholic", "Focus", "Calm").',
      },
      activity: {
        type: 'string',
        description: 'Target activity (e.g. "Workout", "Study", "Coding", "Commute", "Relaxing").',
      },
      energyLevel: {
        type: 'number',
        description: 'Target energy level between 0.0 (calm) and 1.0 (high energy).',
      },
      limit: {
        type: 'number',
        description: 'Number of recommendations to return (default: 10, max: 30).',
      },
    },
  };

  validate(input: unknown): { valid: boolean; error?: string; data?: ContextualRecommendationsInput } {
    const raw = (input && typeof input === 'object' ? input : {}) as Record<string, any>;
    const limit = typeof raw.limit === 'number' && raw.limit > 0 ? Math.min(30, raw.limit) : 10;
    const energyLevel = typeof raw.energyLevel === 'number' ? Math.max(0, Math.min(1, raw.energyLevel)) : undefined;

    return {
      valid: true,
      data: {
        mood: typeof raw.mood === 'string' && raw.mood.trim() ? raw.mood.trim() : undefined,
        activity: typeof raw.activity === 'string' && raw.activity.trim() ? raw.activity.trim() : undefined,
        energyLevel,
        limit,
      },
    };
  }

  async execute(
    input: ContextualRecommendationsInput,
    context: AssistantToolContext
  ): Promise<ToolExecutionResult<ContextualRecommendationsData>> {
    const validation = this.validate(input);
    if (!validation.valid || !validation.data) {
      return {
        success: false,
        toolName: this.name,
        error: validation.error || 'Validation failed',
      };
    }

    try {
      const { mood, activity, energyLevel, limit = 10 } = validation.data;
      const safeLimit = Math.max(1, Math.min(30, limit));

      const contextualRes = await ContextAwareRecommendationService.getContextualRecommendations({
        userId: context.userId,
        mood,
        activity,
        energyLevel,
        limit: safeLimit,
      });

      return {
        success: true,
        toolName: this.name,
        data: {
          strategyUsed: 'contextual',
          recommendations: contextualRes.data || [],
          count: contextualRes.count || 0,
          detectedContext: contextualRes.detectedContext,
        },
        message: `Retrieved ${contextualRes.count || 0} contextual recommendations for ${activity || mood || 'current context'}.`,
      };
    } catch (error: any) {
      return {
        success: false,
        toolName: this.name,
        error: error.message || 'Failed to fetch contextual recommendations',
      };
    }
  }
}
