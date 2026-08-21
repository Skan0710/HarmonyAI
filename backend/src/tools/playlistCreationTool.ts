import { AssistantTool, AssistantToolContext, ToolExecutionResult, ToolParameterSchema } from './toolTypes.js';
import { PlaylistService } from '../services/playlistService.js';
import { Types } from 'mongoose';

export interface PlaylistCreationInput {
  name: string;
  description?: string;
  songIds?: string[];
  visibility?: 'public' | 'private';
}

export class PlaylistCreationTool implements AssistantTool<PlaylistCreationInput> {
  name = 'create_playlist';
  description = 'Create a new user playlist with a given name, description, and optional initial list of song IDs.';

  parameters: ToolParameterSchema = {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'The name or title of the new playlist.',
      },
      description: {
        type: 'string',
        description: 'Optional description of the playlist theme or mood.',
      },
      songIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of song Object IDs to add to the playlist.',
      },
      visibility: {
        type: 'string',
        enum: ['public', 'private'],
        description: 'Visibility of the playlist (default: "public").',
      },
    },
    required: ['name'],
  };

  validate(input: unknown): { valid: boolean; error?: string; data?: PlaylistCreationInput } {
    if (!input || typeof input !== 'object') {
      return { valid: false, error: 'Input must be a valid object' };
    }

    const raw = input as Record<string, any>;
    if (!raw.name || typeof raw.name !== 'string' || !raw.name.trim()) {
      return { valid: false, error: 'A valid playlist name is required' };
    }

    const validSongIds: string[] = [];
    if (Array.isArray(raw.songIds)) {
      for (const id of raw.songIds) {
        if (typeof id === 'string' && Types.ObjectId.isValid(id.trim())) {
          validSongIds.push(id.trim());
        }
      }
    }

    const visibility = raw.visibility === 'private' ? 'private' : 'public';

    return {
      valid: true,
      data: {
        name: raw.name.trim(),
        description: typeof raw.description === 'string' ? raw.description.trim() : undefined,
        songIds: validSongIds,
        visibility,
      },
    };
  }

  async execute(input: PlaylistCreationInput, context: AssistantToolContext): Promise<ToolExecutionResult> {
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
        error: 'Authentication required. User must be logged in to create playlists.',
      };
    }

    try {
      const created = await PlaylistService.createPlaylist(context.userId, {
        name: validation.data.name,
        description: validation.data.description || 'Curated with HarmonyAI Assistant',
        visibility: validation.data.visibility,
      });

      // Add initial songs if provided
      let finalPlaylist: any = created;
      if (validation.data.songIds && validation.data.songIds.length > 0) {
        for (const sId of validation.data.songIds) {
          try {
            finalPlaylist = await PlaylistService.addSongToPlaylist(
              created._id.toString(),
              context.userId,
              sId
            );
          } catch (e) {
            // Continue adding remaining songs if individual song fails
          }
        }
      }

      return {
        success: true,
        toolName: this.name,
        data: finalPlaylist,
        message: `Successfully created playlist "${validation.data.name}" with ${validation.data.songIds?.length || 0} songs`,
      };
    } catch (error: any) {
      return {
        success: false,
        toolName: this.name,
        error: error.message || 'Failed to create playlist',
      };
    }
  }
}
