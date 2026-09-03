import { AssistantTool, AssistantToolContext, ToolExecutionResult, ToolParameterSchema } from './toolTypes.js';
import { Song, ISong } from '../models/Song.js';
import { searchCatalog, GroupedSearchResults } from '../services/searchService.js';

export interface MusicSearchInput {
  query: string;
  genre?: string;
  artist?: string;
  limit?: number;
}

export interface MusicSearchResultData {
  songs: ISong[];
  groupedResults?: GroupedSearchResults;
  total: number;
  query: string;
}

export class MusicSearchTool implements AssistantTool<MusicSearchInput, MusicSearchResultData> {
  name = 'music_search';
  description = 'Search catalog music, songs, artists, and albums using keywords, titles, artist names, or genres. Returns verified database songs.';

  parameters: ToolParameterSchema = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search keyword, song title, artist name, or album name.',
      },
      genre: {
        type: 'string',
        description: 'Optional genre name to filter results (e.g. "Rock", "Synthwave", "Pop").',
      },
      artist: {
        type: 'string',
        description: 'Optional artist name to filter results.',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 10, max: 50).',
      },
    },
    required: ['query'],
  };

  validate(input: unknown): { valid: boolean; error?: string; data?: MusicSearchInput } {
    if (!input || typeof input !== 'object') {
      return { valid: false, error: 'Input must be a valid object' };
    }
    const raw = input as Record<string, any>;
    if (!raw.query || typeof raw.query !== 'string' || !raw.query.trim()) {
      return { valid: false, error: 'A non-empty query string is required' };
    }

    const limit = typeof raw.limit === 'number' && raw.limit > 0 ? Math.min(50, raw.limit) : 10;

    return {
      valid: true,
      data: {
        query: raw.query.trim(),
        genre: typeof raw.genre === 'string' ? raw.genre.trim() : undefined,
        artist: typeof raw.artist === 'string' ? raw.artist.trim() : undefined,
        limit,
      },
    };
  }
  static async searchMusic(input: MusicSearchInput): Promise<MusicSearchResultData> {
    const { query, limit = 10 } = input;
    const safeLimit = Math.max(1, Math.min(50, limit));
    const catalogResults = await searchCatalog(query, safeLimit);

    let songs: ISong[] = catalogResults.songs || [];

    if (songs.length === 0) {
      const searchRegex = new RegExp(query.trim(), 'i');
      songs = await Song.find({
        isPublished: true,
        $or: [
          { title: searchRegex },
          { tags: searchRegex },
          { language: searchRegex },
          { mood: searchRegex },
        ],
      })
        .populate('artist', 'name profileImage avatar verified')
        .populate('album', 'title coverImage releaseYear')
        .populate('genre', 'name slug')
        .limit(safeLimit)
        .lean() as any;
    }

    return {
      songs,
      groupedResults: catalogResults,
      total: songs.length,
      query,
    };
  }

  async execute(input: MusicSearchInput, _context: AssistantToolContext): Promise<ToolExecutionResult<MusicSearchResultData>> {
    const validation = this.validate(input);
    if (!validation.valid || !validation.data) {
      return {
        success: false,
        toolName: this.name,
        error: validation.error || 'Validation failed',
      };
    }

    try {
      const results = await MusicSearchTool.searchMusic(validation.data);

      if (results.total === 0) {
        return {
          success: true,
          toolName: this.name,
          data: results,
          message: `No songs found matching query "${validation.data.query}"`,
        };
      }

      return {
        success: true,
        toolName: this.name,
        data: results,
        message: `Found ${results.total} matching songs for "${validation.data.query}"`,
      };
    } catch (error: any) {
      return {
        success: false,
        toolName: this.name,
        error: error.message || 'Failed to execute music search',
      };
    }
  }
}
