import { AssistantTool, AssistantToolContext, ToolExecutionResult, ToolParameterSchema } from './toolTypes.js';

export interface ClearQueueInput {
  preserveCurrentTrack?: boolean;
}

export class ClearQueueTool implements AssistantTool<ClearQueueInput> {
  name = 'clear_queue';
  description = 'Clear all queued songs from the player playback queue.';

  parameters: ToolParameterSchema = {
    type: 'object',
    properties: {
      preserveCurrentTrack: {
        type: 'boolean',
        description: 'Whether to keep the currently playing track and only clear upcoming queued songs (default: true).',
      },
    },
  };

  validate(input: unknown): { valid: boolean; error?: string; data?: ClearQueueInput } {
    const raw = (input && typeof input === 'object' ? input : {}) as Record<string, any>;
    const preserveCurrentTrack = raw.preserveCurrentTrack !== false;

    return {
      valid: true,
      data: {
        preserveCurrentTrack,
      },
    };
  }

  async execute(input: ClearQueueInput, _context: AssistantToolContext): Promise<ToolExecutionResult> {
    const validation = this.validate(input);

    return {
      success: true,
      toolName: this.name,
      data: {
        action: 'clear_queue',
        preserveCurrentTrack: validation.data?.preserveCurrentTrack ?? true,
      },
      message: 'Playback queue successfully cleared',
    };
  }
}
