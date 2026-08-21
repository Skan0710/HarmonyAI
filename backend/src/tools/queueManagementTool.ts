import { AssistantTool, AssistantToolContext, ToolExecutionResult, ToolParameterSchema } from './toolTypes.js';
import { Song } from '../models/Song.js';
import { Types } from 'mongoose';

export interface QueueManagementInput {
  action: 'add' | 'add_next' | 'clear' | 'list';
  songIds?: string[];
}

export class QueueManagementTool implements AssistantTool<QueueManagementInput> {
  name = 'queue_management';
  description = 'Manage the player playback queue: queue songs up next, add songs to the end of the queue, or clear queued tracks.';

  parameters: ToolParameterSchema = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['add', 'add_next', 'clear', 'list'],
        description: 'Queue action to perform ("add" appends, "add_next" inserts immediately after current track, "clear" empties the queue).',
      },
      songIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of song Object IDs to add to queue.',
      },
    },
    required: ['action'],
  };

  validate(input: unknown): { valid: boolean; error?: string; data?: QueueManagementInput } {
    if (!input || typeof input !== 'object') {
      return { valid: false, error: 'Input must be an object' };
    }

    const raw = input as Record<string, any>;
    const validActions = ['add', 'add_next', 'clear', 'list'];
    if (!raw.action || !validActions.includes(raw.action)) {
      return { valid: false, error: `Invalid queue action. Must be one of: ${validActions.join(', ')}` };
    }

    const songIds: string[] = [];
    if (Array.isArray(raw.songIds)) {
      for (const id of raw.songIds) {
        if (typeof id === 'string' && Types.ObjectId.isValid(id.trim())) {
          songIds.push(id.trim());
        }
      }
    }

    return {
      valid: true,
      data: {
        action: raw.action,
        songIds,
      },
    };
  }

  async execute(input: QueueManagementInput, _context: AssistantToolContext): Promise<ToolExecutionResult> {
    const validation = this.validate(input);
    if (!validation.valid || !validation.data) {
      return {
        success: false,
        toolName: this.name,
        error: validation.error || 'Validation failed',
      };
    }

    const { action, songIds = [] } = validation.data;

    try {
      if (action === 'clear') {
        return {
          success: true,
          toolName: this.name,
          data: { action: 'clear', count: 0, songs: [] },
          message: 'Playback queue cleared',
        };
      }

      if ((action === 'add' || action === 'add_next') && songIds.length > 0) {
        const objectIds = songIds.map((id) => new Types.ObjectId(id));
        const foundSongs = await Song.find({ _id: { $in: objectIds } })
          .populate('artist', 'name')
          .populate('genre', 'name')
          .lean();

        return {
          success: true,
          toolName: this.name,
          data: {
            action,
            count: foundSongs.length,
            songs: foundSongs,
          },
          message: `Queued ${foundSongs.length} tracks (${action === 'add_next' ? 'play next' : 'added to end'})`,
        };
      }

      return {
        success: true,
        toolName: this.name,
        data: { action, count: 0, songs: [] },
        message: `Queue action "${action}" executed`,
      };
    } catch (error: any) {
      return {
        success: false,
        toolName: this.name,
        error: error.message || 'Failed to manage queue',
      };
    }
  }
}
