import { AssistantTool, AssistantToolContext, ToolExecutionResult, ToolParameterSchema } from './toolTypes.js';
import { SemanticSearchService } from '../services/semanticSearchService.js';

export interface SemanticSearchInput {
  prompt: string;
  limit?: number;
}

export class SemanticSearchTool implements AssistantTool<SemanticSearchInput> {
  name = 'semantic_search';
  description = 'Perform natural language semantic search to find music matching abstract vibes, feelings, acoustic qualities, or lyrical themes using vector embeddings.';

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

    return {
      valid: true,
      data: {
        prompt: raw.prompt.trim(),
        limit,
      },
    };
  }

  async execute(input: SemanticSearchInput, _context: AssistantToolContext): Promise<ToolExecutionResult> {
    const validation = this.validate(input);
    if (!validation.valid || !validation.data) {
      return {
        success: false,
        toolName: this.name,
        error: validation.error || 'Validation failed',
      };
    }

    try {
      const results = await SemanticSearchService.searchSongsBySemanticQuery(
        validation.data.prompt,
        validation.data.limit
      );

      return {
        success: true,
        toolName: this.name,
        data: results,
        message: `Semantic search retrieved ${results.length} songs matching "${validation.data.prompt}"`,
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
