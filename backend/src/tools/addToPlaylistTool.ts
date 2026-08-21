import { AssistantTool, AssistantToolContext, ToolExecutionResult, ToolParameterSchema } from './toolTypes.js';
import { PlaylistService } from '../services/playlistService.js';
import { Types } from 'mongoose';

export interface AddToPlaylistInput {
  playlistId: string;
  songIds: string[];
}

export class AddToPlaylistTool implements AssistantTool<AddToPlaylistInput> {
  name = 'add_to_playlist';
  description = 'Add one or more songs to an existing user playlist. Requires authentication and user ownership.';

  parameters: ToolParameterSchema = {
    type: 'object',
    properties: {
      playlistId: {
        type: 'string',
        description: 'The unique ObjectId of the target playlist.',
      },
      songIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of song Object IDs to add to the playlist.',
      },
    },
    required: ['playlistId', 'songIds'],
  };

  validate(input: unknown): { valid: boolean; error?: string; data?: AddToPlaylistInput } {
    if (!input || typeof input !== 'object') {
      return { valid: false, error: 'Input must be an object' };
    }

    const raw = input as Record<string, any>;
    if (!raw.playlistId || typeof raw.playlistId !== 'string' || !Types.ObjectId.isValid(raw.playlistId.trim())) {
      return { valid: false, error: 'A valid playlistId is required' };
    }

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
        playlistId: raw.playlistId.trim(),
        songIds: validSongIds,
      },
    };
  }

  async execute(input: AddToPlaylistInput, context: AssistantToolContext): Promise<ToolExecutionResult> {
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

    const { playlistId, songIds } = validation.data;

    try {
      let updatedPlaylist: any = null;
      let addedCount = 0;

      for (const sId of songIds) {
        updatedPlaylist = await PlaylistService.addSongToPlaylist(playlistId, context.userId, sId);
        addedCount++;
      }

      return {
        success: true,
        toolName: this.name,
        data: updatedPlaylist,
        message: `Successfully added ${addedCount} song(s) to playlist "${updatedPlaylist?.name || playlistId}"`,
      };
    } catch (error: any) {
      return {
        success: false,
        toolName: this.name,
        error: error.message || 'Failed to add songs to playlist',
      };
    }
  }
}
