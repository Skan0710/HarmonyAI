import { AssistantTool, AssistantToolContext, ToolExecutionResult, ToolParameterSchema } from './toolTypes.js';
import { SemanticSearchService, SemanticSearchResult } from '../services/semanticSearchService.js';

export interface SemanticSearchInput {
  prompt: string;
  limit?: number;
  minSimilarity?: number;
}

export interface SemanticSearchResultData {
  results: SemanticSearchResult[];
  total: number;
  prompt: string;
}

export class SemanticSearchTool implements AssistantTool<SemanticSearchInput, SemanticSearchResultData> {
  name = 'semantic_search';
  description = 'Perform natural language semantic search to find music matching abstract vibes, feelings, acoustic qualities, or lyrical themes using vector embeddings. Returns only verified database songs.';

  parameters: ToolParameterSchema = {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: 'Natural language description of the vibe, mood, theme, or acoustic texture (e.g. "late night coding synthwave with driving bass").',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of semantic results to return (default: 10, max: 30).',
      },
      minSimilarity: {
        type: 'number',
        description: 'Minimum cosine similarity threshold between 0.0 and 1.0 (default: 0.35).',
      },
    },
    required: ['prompt'],
  };

  validate(input: unknown): { valid: boolean; error?: string; data?: SemanticSearchInput } {
    if (!input || typeof input !== 'object') {
      return { valid: false, error: 'Input must be an object' };
    }
    const raw = input as Record<string, any>;
    if (!raw.prompt || typeof raw.prompt !== 'string' || !raw.prompt.trim()) {
      return { valid: false, error: 'A non-empty prompt is required for semantic search' };
    }

    const limit = typeof raw.limit === 'number' && raw.limit > 0 ? Math.min(30, raw.limit) : 10;
    const minSimilarity = typeof raw.minSimilarity === 'number' ? Math.max(0, Math.min(1, raw.minSimilarity)) : 0.35;

    return {
      valid: true,
      data: {
        prompt: raw.prompt.trim(),
        limit,
        minSimilarity,
      },
    };
  }

  /**
   * Standalone semantic search method reusable outside the assistant framework.
   */
  static async searchSemantic(input: SemanticSearchInput): Promise<SemanticSearchResultData> {
    const { prompt, limit = 10, minSimilarity = 0.35 } = input;
    const safeLimit = Math.max(1, Math.min(30, limit));

    const rawResults = await SemanticSearchService.searchSongsBySemanticQuery(prompt, safeLimit);

    const filtered = rawResults.filter((r) => r.similarityScore >= minSimilarity);

    return {
      results: filtered,
      total: filtered.length,
      prompt,
    };
  }

  async execute(input: SemanticSearchInput, _context: AssistantToolContext): Promise<ToolExecutionResult<SemanticSearchResultData>> {
    const validation = this.validate(input);
    if (!validation.valid || !validation.data) {
      return {
        success: false,
        toolName: this.name,
        error: validation.error || 'Validation failed',
      };
    }

    try {
      const results = await SemanticSearchTool.searchSemantic(validation.data);

      if (results.total === 0) {
        return {
          success: true,
          toolName: this.name,
          data: results,
          message: `No songs found matching semantic vibe "${validation.data.prompt}"`,
        };
      }

      return {
        success: true,
        toolName: this.name,
        data: results,
        message: `Retrieved ${results.total} songs matching vibe "${validation.data.prompt}"`,
      };
    } catch (error: any) {
      return {
        success: false,
        toolName: this.name,
        error: error.message || 'Failed to perform semantic music search',
      };
    }
  }
}
