import { AssistantTool, AssistantToolContext, ToolExecutionResult, ToolParameterSchema } from './toolTypes.js';
import { UserTasteProfileService } from '../services/userTasteProfileService.js';
import { Types } from 'mongoose';

export interface UserPreferenceInput {
  timeframe?: 'short_term' | 'long_term' | 'combined';
}

export class UserPreferenceRetrievalTool implements AssistantTool<UserPreferenceInput> {
  name = 'get_user_preferences';
  description = 'Retrieve the active user taste profile, favorite genres, top artists, mood preferences, and listening habits.';

  parameters: ToolParameterSchema = {
    type: 'object',
    properties: {
      timeframe: {
        type: 'string',
        enum: ['short_term', 'long_term', 'combined'],
        description: 'Time window to analyze ("short_term" = last 7 days, "long_term" = last 90 days, "combined" = overall preferences).',
      },
    },
  };

  validate(input: unknown): { valid: boolean; error?: string; data?: UserPreferenceInput } {
    const raw = (input && typeof input === 'object' ? input : {}) as Record<string, any>;
    const timeframe = ['short_term', 'long_term', 'combined'].includes(raw.timeframe)
      ? raw.timeframe
      : 'combined';

    return {
      valid: true,
      data: { timeframe },
    };
  }

  async execute(input: UserPreferenceInput, context: AssistantToolContext): Promise<ToolExecutionResult> {
    const validation = this.validate(input);
    if (!validation.valid || !validation.data) {
      return {
        success: false,
        toolName: this.name,
        error: validation.error || 'Validation failed',
      };
    }

    if (!context.userId || !Types.ObjectId.isValid(context.userId)) {
      return {
        success: false,
        toolName: this.name,
        error: 'Authentication required. User must be logged in to retrieve personalized taste preferences.',
      };
    }

    try {
      const tasteProfile = await UserTasteProfileService.generateTasteProfile(context.userId);
      const timeframe = validation.data.timeframe;

      let genres = tasteProfile.combinedGenres;
      let artists = tasteProfile.combinedArtists;

      if (timeframe === 'short_term') {
        genres = tasteProfile.shortTermProfile.genres;
        artists = tasteProfile.shortTermProfile.artists;
      } else if (timeframe === 'long_term') {
        genres = tasteProfile.longTermProfile.genres;
        artists = tasteProfile.longTermProfile.artists;
      }

      return {
        success: true,
        toolName: this.name,
        data: {
          userId: context.userId,
          timeframe,
          topGenres: genres.slice(0, 10),
          topArtists: artists.slice(0, 10),
          preferredMoods: tasteProfile.preferredMoods,
          preferredLanguages: tasteProfile.preferredLanguages,
          updatedAt: tasteProfile.updatedAt,
        },
        message: `Successfully retrieved ${timeframe} taste profile preferences`,
      };
    } catch (error: any) {
      return {
        success: false,
        toolName: this.name,
        error: error.message || 'Failed to retrieve user preferences',
      };
    }
  }
}
