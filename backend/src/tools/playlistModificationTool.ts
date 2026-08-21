import { AssistantTool, AssistantToolContext, ToolExecutionResult, ToolParameterSchema } from './toolTypes.js';
import { Playlist } from '../models/Playlist.js';
import { Types } from 'mongoose';

export interface PlaylistModificationInput {
  playlistId: string;
  action: 'add_songs' | 'remove_songs' | 'update_metadata';
  songIds?: string[];
  name?: string;
  description?: string;
}

export class PlaylistModificationTool implements AssistantTool<PlaylistModificationInput> {
  name = 'modify_playlist';
  description = 'Modify an existing playlist by adding songs, removing songs, or updating its name/description.';

  parameters: ToolParameterSchema = {
    type: 'object',
    properties: {
      playlistId: {
        type: 'string',
        description: 'The unique ObjectId of the target playlist.',
      },
      action: {
        type: 'string',
        enum: ['add_songs', 'remove_songs', 'update_metadata'],
        description: 'The modification action to perform.',
      },
      songIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of song Object IDs to add or remove.',
      },
      name: {
        type: 'string',
        description: 'New playlist title (when action is update_metadata).',
      },
      description: {
        type: 'string',
        description: 'New playlist description (when action is update_metadata).',
      },
    },
    required: ['playlistId', 'action'],
  };

  validate(input: unknown): { valid: boolean; error?: string; data?: PlaylistModificationInput } {
    if (!input || typeof input !== 'object') {
      return { valid: false, error: 'Input must be an object' };
    }

    const raw = input as Record<string, any>;
    if (!raw.playlistId || typeof raw.playlistId !== 'string' || !Types.ObjectId.isValid(raw.playlistId.trim())) {
      return { valid: false, error: 'A valid playlistId is required' };
    }

    const validActions = ['add_songs', 'remove_songs', 'update_metadata'];
    if (!raw.action || !validActions.includes(raw.action)) {
      return { valid: false, error: `Invalid action. Must be one of: ${validActions.join(', ')}` };
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
        playlistId: raw.playlistId.trim(),
        action: raw.action,
        songIds,
        name: typeof raw.name === 'string' ? raw.name.trim() : undefined,
        description: typeof raw.description === 'string' ? raw.description.trim() : undefined,
      },
    };
  }

  async execute(input: PlaylistModificationInput, context: AssistantToolContext): Promise<ToolExecutionResult> {
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
        error: 'Authentication required. User must be logged in to modify playlists.',
      };
    }

    const { playlistId, action, songIds = [], name, description } = validation.data;

    try {
      const playlist = await Playlist.findById(playlistId);
      if (!playlist) {
        return {
          success: false,
          toolName: this.name,
          error: 'Playlist not found',
        };
      }

      // Authorization check: User must be playlist owner or admin
      if (playlist.owner.toString() !== context.userId && context.userRole !== 'admin') {
        return {
          success: false,
          toolName: this.name,
          error: 'Forbidden. You do not have permission to modify this playlist.',
        };
      }

      if (action === 'add_songs' && songIds.length > 0) {
        const existingIds = new Set(playlist.songs.map((id) => id.toString()));
        for (const sId of songIds) {
          if (!existingIds.has(sId)) {
            playlist.songs.push(new Types.ObjectId(sId));
          }
        }
      } else if (action === 'remove_songs' && songIds.length > 0) {
        const removeSet = new Set(songIds);
        playlist.songs = playlist.songs.filter((id) => !removeSet.has(id.toString()));
      } else if (action === 'update_metadata') {
        if (name) playlist.name = name;
        if (description !== undefined) playlist.description = description;
      }

      await playlist.save();
      const updated = await Playlist.findById(playlist._id).populate('songs');

      return {
        success: true,
        toolName: this.name,
        data: updated,
        message: `Playlist "${playlist.name}" successfully updated (${action})`,
      };
    } catch (error: any) {
      return {
        success: false,
        toolName: this.name,
        error: error.message || 'Failed to modify playlist',
      };
    }
  }
}
