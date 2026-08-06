import { Song } from '../models/Song.js';
import { Artist } from '../models/Artist.js';
import { Album } from '../models/Album.js';

export interface GroupedSearchResults {
  songs: any[];
  artists: any[];
  albums: any[];
  total: number;
}

export const searchCatalog = async (
  query: string,
  limit: number = 10
): Promise<GroupedSearchResults> => {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return {
      songs: [],
      artists: [],
      albums: [],
      total: 0,
    };
  }

  // Create case-insensitive regex for partial matching
  const searchRegex = new RegExp(trimmedQuery, 'i');

  // Execute concurrent searches across Songs, Artists, and Albums
  const [songs, artists, albums] = await Promise.all([
    Song.find({
      $or: [
        { title: searchRegex },
        { tags: searchRegex },
        { language: searchRegex },
      ],
    })
      .populate('artist', 'name profileImage avatar verified')
      .populate('album', 'title coverImage releaseYear')
      .populate('genre', 'name slug')
      .limit(limit)
      .lean(),

    Artist.find({
      $or: [
        { name: searchRegex },
        { bio: searchRegex },
        { tags: searchRegex },
      ],
    })
      .limit(limit)
      .lean(),

    Album.find({
      $or: [
        { title: searchRegex },
        { tags: searchRegex },
      ],
    })
      .populate('artist', 'name profileImage avatar verified')
      .populate('genre', 'name slug')
      .limit(limit)
      .lean(),
  ]);

  const total = songs.length + artists.length + albums.length;

  return {
    songs,
    artists,
    albums,
    total,
  };
};

/**
 * Placeholder hook for future vector embedding semantic search.
 * Can be called when semantic search parameter is enabled.
 */
export const searchCatalogSemantic = async (
  vectorQuery: number[],
  limit: number = 10
): Promise<GroupedSearchResults> => {
  // Extensible method signature for future ANN vector search integration
  return {
    songs: [],
    artists: [],
    albums: [],
    total: 0,
  };
};
