import { AssistantTool, AssistantToolContext, ToolExecutionResult, ToolParameterSchema } from './toolTypes.js';
import { PlaylistService } from '../services/playlistService.js';
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
        description: 'The unique ID of the target playlist.',
      },
      action: {
        type: 'string',
        enum: ['add_songs', 'remove_songs', 'update_metadata'],
        description: 'The modification action to perform.',
      },
      songIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of song IDs to add or remove.',
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
      return {
        valid: false,
        error: `Invalid action "${raw.action}". Must be one of: ${validActions.join(', ')}`,
      };
    }

    let songIds: string[] | undefined;
    if (raw.action === 'add_songs' || raw.action === 'remove_songs') {
      if (!Array.isArray(raw.songIds) || raw.songIds.length === 0) {
        return {
          valid: false,
          error: `Action "${raw.action}" requires a non-empty array of songIds`,
        };
      }
      songIds = validateObjectIds(raw.songIds);
      if (songIds.length === 0) {
        return { valid: false, error: 'At least one valid song ID is required' };
      }
    }

    const name = sanitizeString(raw.name);
    const description = sanitizeString(raw.description);

    if (raw.action === 'update_metadata' && !name && description === undefined) {
      return {
        valid: false,
        error: 'Action "update_metadata" requires at least name or description to be provided',
      };
    }

    return {
      valid: true,
      data: {
        playlistId: raw.playlistId.trim(),
        action: raw.action,
        songIds,
        name,
        description,
      },
    };
  }

  async execute(
    input: PlaylistModificationInput,
    context: AssistantToolContext
  ): Promise<ToolExecutionResult> {
    const validation = this.validate(input);
    if (!validation.valid || !validation.data) {
      return {
        success: false,
        toolName: this.name,
        error: validation.error || 'Invalid modification parameters',
      };
    }

    if (!context.userId || !isValidObjectId(context.userId)) {
      return {
        success: false,
        toolName: this.name,
        error: 'Authentication required. User must be logged in to modify playlists.',
      };
    }

    const { playlistId, action, songIds = [], name, description } = validation.data;

    try {
      const playlist = await PlaylistService.getPlaylistById(playlistId);
      if (!playlist) {
        return {
          success: false,
          toolName: this.name,
          error: 'Playlist not found',
        };
      }

      // Authorization check: User must be playlist owner or admin
      const ownerId = playlist.owner?._id || playlist.owner?.id || playlist.owner;
      if (ownerId !== context.userId && context.userRole !== 'admin') {
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
        const updated = await PlaylistService.getPlaylistById(playlistId);
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
        const updated = await PlaylistService.getPlaylistById(playlistId);
        return {
          success: true,
          toolName: this.name,
          data: updated,
          message: `Successfully removed ${removedCount} song(s) from playlist "${playlist.name}"`,
        };
      } else if (action === 'update_metadata') {
        const updatePayload: any = {};
        if (name) updatePayload.name = name;
        if (description !== undefined) updatePayload.description = description;

        const updated = await PlaylistService.updatePlaylist(playlistId, context.userId, updatePayload);

        return {
          success: true,
          toolName: this.name,
          data: updated,
          message: `Playlist "${name || playlist.name}" successfully updated (${action})`,
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
