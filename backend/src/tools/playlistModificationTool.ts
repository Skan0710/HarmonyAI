import { AssistantTool, AssistantToolContext, ToolExecutionResult, ToolParameterSchema } from './toolTypes.js';
import { Playlist } from '../models/Playlist.js';
import { PlaylistService } from '../services/playlistService.js';
import { Types } from 'mongoose';
import { validateObjectIds, isValidObjectId, sanitizeString } from '../utils/validators.js';

export interface PlaylistModificationInput {
  playlistId: string;
  action: 'add_songs' | 'remove_songs' | 'update_metadata';
  songIds?: string[];
  name?: string;
  description?: string;
}

export class PlaylistModificationTool implements AssistantTool<PlaylistModificationInput> {
  name = 'modify_playlist';
  description = 'Modify an existing playlist by adding songs, removing songs, or updating its name/description. Requires authentication and playlist ownership.';

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

    if (!isValidObjectId(raw.playlistId)) {
      return { valid: false, error: 'A valid playlistId is required' };
    }

    const validActions = ['add_songs', 'remove_songs', 'update_metadata'];
    if (!raw.action || !validActions.includes(raw.action)) {
      return { valid: false, error: `Invalid action. Must be one of: ${validActions.join(', ')}` };
    }

    const songIds = validateObjectIds(raw.songIds || []);

    if ((raw.action === 'add_songs' || raw.action === 'remove_songs') && songIds.length === 0) {
      return { valid: false, error: `At least one valid songId is required for ${raw.action}` };
    }

    return {
      valid: true,
      data: {
        playlistId: raw.playlistId.trim(),
        action: raw.action,
        songIds,
        name: sanitizeString(raw.name),
        description: sanitizeString(raw.description),
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

      if (action === 'add_songs') {
        let addedCount = 0;
        for (const sId of songIds) {
          try {
            await PlaylistService.addSongToPlaylist(playlistId, context.userId, sId);
            addedCount++;
          } catch (e) {
            // Skip invalid or duplicate songs
          }
        }
        const updated = await Playlist.findById(playlistId).populate('songs');
        return {
          success: true,
          toolName: this.name,
          data: updated,
          message: `Successfully added ${addedCount} song(s) to playlist "${playlist.name}"`,
        };
      } else if (action === 'remove_songs') {
        let removedCount = 0;
        for (const sId of songIds) {
          try {
            await PlaylistService.removeSongFromPlaylist(playlistId, context.userId, sId);
            removedCount++;
          } catch (e) {
            // Skip songs not in playlist
          }
        }
        const updated = await Playlist.findById(playlistId).populate('songs');
        return {
          success: true,
          toolName: this.name,
          data: updated,
          message: `Successfully removed ${removedCount} song(s) from playlist "${playlist.name}"`,
        };
      } else if (action === 'update_metadata') {
        if (name) playlist.name = name;
        if (description !== undefined) playlist.description = description;

        await playlist.save();
        const updated = await Playlist.findById(playlist._id).populate('songs');

        return {
          success: true,
          toolName: this.name,
          data: updated,
          message: `Playlist "${playlist.name}" successfully updated (${action})`,
        };
      }

      return {
        success: false,
        toolName: this.name,
        error: `Unhandled action: ${action}`,
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
