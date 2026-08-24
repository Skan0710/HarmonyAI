import { AssistantTool, AssistantToolContext, ToolExecutionResult, ToolParameterSchema } from './toolTypes.js';
import { Song } from '../models/Song.js';
import { Types } from 'mongoose';
import { validateObjectIds } from '../utils/validators.js';

export interface QueueManagementInput {
  action: 'add' | 'add_next' | 'remove' | 'clear' | 'list';
  songIds?: string[];
  preserveCurrentTrack?: boolean;
}

export class QueueManagementTool implements AssistantTool<QueueManagementInput> {
  name = 'queue_management';
  description = 'Manage the player playback queue: queue songs up next, add songs to the end, remove songs, or clear queued tracks.';

  parameters: ToolParameterSchema = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['add', 'add_next', 'remove', 'clear', 'list'],
        description: 'Queue action to perform ("add" appends, "add_next" plays next, "remove" removes songs, "clear" empties queue, "list" shows current queue).',
      },
      songIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of song Object IDs to add to or remove from the queue.',
      },
      preserveCurrentTrack: {
        type: 'boolean',
        description: 'Whether to keep the currently playing track when clearing (default: true).',
      },
    },
    required: ['action'],
  };

  validate(input: unknown): { valid: boolean; error?: string; data?: QueueManagementInput } {
    if (!input || typeof input !== 'object') {
      return { valid: false, error: 'Input must be an object' };
    }

    const raw = input as Record<string, any>;
    const validActions = ['add', 'add_next', 'remove', 'clear', 'list'];
    if (!raw.action || !validActions.includes(raw.action)) {
      return { valid: false, error: `Invalid queue action. Must be one of: ${validActions.join(', ')}` };
    }

    const songIds = validateObjectIds(raw.songIds || []);

    if ((raw.action === 'add' || raw.action === 'add_next' || raw.action === 'remove') && songIds.length === 0) {
      return { valid: false, error: `At least one valid songId is required for action "${raw.action}"` };
    }

    return {
      valid: true,
      data: {
        action: raw.action,
        songIds,
        preserveCurrentTrack: raw.preserveCurrentTrack !== false,
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

    const { action, songIds = [], preserveCurrentTrack } = validation.data;

    try {
      if (action === 'clear') {
        return {
          success: true,
          toolName: this.name,
          data: { action: 'clear', preserveCurrentTrack },
          message: 'Playback queue cleared',
        };
      }

      if (action === 'list') {
        return {
          success: true,
          toolName: this.name,
          data: { action: 'list', count: 0, songs: [] },
          message: 'Current queue retrieved (client-side queue management)',
        };
      }

      if ((action === 'add' || action === 'add_next') && songIds.length > 0) {
        const objectIds = songIds.map((id) => new Types.ObjectId(id));
        const foundSongs = await Song.find({ _id: { $in: objectIds } })
          .populate('artist', 'name profileImage avatar')
          .populate('album', 'title coverImage releaseYear')
          .populate('genre', 'name slug')
          .lean();

        return {
          success: true,
          toolName: this.name,
          data: {
            action,
            count: foundSongs.length,
            songs: foundSongs,
          },
          message: `Queued ${foundSongs.length} track(s) (${action === 'add_next' ? 'play next' : 'added to end of queue'})`,
        };
      }

      if (action === 'remove' && songIds.length > 0) {
        return {
          success: true,
          toolName: this.name,
          data: {
            action: 'remove',
            removedSongIds: songIds,
            count: songIds.length,
          },
          message: `Requested removal of ${songIds.length} track(s) from queue`,
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
