import { AssistantTool, AssistantToolContext, ToolExecutionResult, ToolParameterSchema } from './toolTypes.js';
import { Types } from 'mongoose';

export interface RemoveFromQueueInput {
  songIds: string[];
}

export class RemoveFromQueueTool implements AssistantTool<RemoveFromQueueInput> {
  name = 'remove_from_queue';
  description = 'Remove one or more songs from the current playback queue.';

  parameters: ToolParameterSchema = {
    type: 'object',
    properties: {
      songIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of song Object IDs to remove from the playback queue.',
      },
    },
    required: ['songIds'],
  };

  validate(input: unknown): { valid: boolean; error?: string; data?: RemoveFromQueueInput } {
    if (!input || typeof input !== 'object') {
      return { valid: false, error: 'Input must be an object' };
    }

    const raw = input as Record<string, any>;
    if (!Array.isArray(raw.songIds) || raw.songIds.length === 0) {
      return { valid: false, error: 'At least one songId must be provided' };
    }

    const validSongIds: string[] = [];
    for (const id of raw.songIds) {
      if (typeof id === 'string' && Types.ObjectId.isValid(id.trim())) {
        validSongIds.push(id.trim());
      }
    }

    if (validSongIds.length === 0) {
      return { valid: false, error: 'No valid song ObjectIds provided' };
    }

    return {
      valid: true,
      data: {
        songIds: validSongIds,
      },
    };
  }

  async execute(input: RemoveFromQueueInput, _context: AssistantToolContext): Promise<ToolExecutionResult> {
    const validation = this.validate(input);
    if (!validation.valid || !validation.data) {
      return {
        success: false,
        toolName: this.name,
        error: validation.error || 'Validation failed',
      };
    }

    const { songIds } = validation.data;

    return {
      success: true,
      toolName: this.name,
      data: {
        removedSongIds: songIds,
        count: songIds.length,
      },
      message: `Successfully requested removal of ${songIds.length} track(s) from queue`,
    };
  }
}
