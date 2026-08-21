import { AssistantTool, AssistantToolContext, ToolExecutionResult, ToolParameterSchema } from './toolTypes.js';
import { searchCatalog } from '../services/searchService.js';

export interface MusicSearchInput {
  query: string;
  limit?: number;
}

export class MusicSearchTool implements AssistantTool<MusicSearchInput> {
  name = 'music_search';
  description = 'Search catalog music, songs, artists, and albums using keywords, titles, or artist names.';

  parameters: ToolParameterSchema = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search keyword, song title, artist name, or album name.',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 10, max: 50).',
      },
    },
    required: ['query'],
  };

  validate(input: unknown): { valid: boolean; error?: string; data?: MusicSearchInput } {
    if (!input || typeof input !== 'object') {
      return { valid: false, error: 'Input must be a valid object' };
    }
    const raw = input as Record<string, any>;
    if (!raw.query || typeof raw.query !== 'string' || !raw.query.trim()) {
      return { valid: false, error: 'A non-empty query string is required' };
    }

    const limit = typeof raw.limit === 'number' && raw.limit > 0 ? Math.min(50, raw.limit) : 10;

    return {
      valid: true,
      data: {
        query: raw.query.trim(),
        limit,
      },
    };
  }

  async execute(input: MusicSearchInput, _context: AssistantToolContext): Promise<ToolExecutionResult> {
    const validation = this.validate(input);
    if (!validation.valid || !validation.data) {
      return {
        success: false,
        toolName: this.name,
        error: validation.error || 'Validation failed',
      };
    }

    try {
      const results = await searchCatalog(
        validation.data.query,
        validation.data.limit
      );

      return {
        success: true,
        toolName: this.name,
        data: results,
        message: `Found ${results.total} matching items for query "${validation.data.query}"`,
      };
    } catch (error: any) {
      return {
        success: false,
        toolName: this.name,
        error: error.message || 'Failed to perform music search',
      };
    }
  }
}
