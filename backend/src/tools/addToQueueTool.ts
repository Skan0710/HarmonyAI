import { AssistantTool, AssistantToolContext, ToolExecutionResult, ToolParameterSchema } from './toolTypes.js';
import { Song } from '../models/Song.js';
import { Types } from 'mongoose';

export interface AddToQueueInput {
  songIds: string[];
  position?: 'end' | 'next';
}

export class AddToQueueTool implements AssistantTool<AddToQueueInput> {
  name = 'add_to_queue';
  description = 'Add one or more songs to the current playback queue, either appended to the end or played next.';

  parameters: ToolParameterSchema = {
    type: 'object',
    properties: {
      songIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of song Object IDs to add to the queue.',
      },
      position: {
        type: 'string',
        enum: ['end', 'next'],
        description: 'Where to insert the songs in the queue ("end" = append to queue end, "next" = play immediately after current track).',
      },
    },
    required: ['songIds'],
  };

  validate(input: unknown): { valid: boolean; error?: string; data?: AddToQueueInput } {
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

    const position = raw.position === 'next' ? 'next' : 'end';

    return {
      valid: true,
      data: {
        songIds: validSongIds,
        position,
      },
    };
  }

  async execute(input: AddToQueueInput, _context: AssistantToolContext): Promise<ToolExecutionResult> {
    const validation = this.validate(input);
    if (!validation.valid || !validation.data) {
      return {
        success: false,
        toolName: this.name,
        error: validation.error || 'Validation failed',
      };
    }

    const { songIds, position } = validation.data;

    try {
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
          position,
          count: foundSongs.length,
          songs: foundSongs,
        },
        message: `Successfully queued ${foundSongs.length} track(s) (${position === 'next' ? 'play next' : 'added to end of queue'})`,
      };
    } catch (error: any) {
      return {
        success: false,
        toolName: this.name,
        error: error.message || 'Failed to add songs to queue',
      };
    }
  }
}
