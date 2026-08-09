import { Song } from '../models/Song.js';
import { Album } from '../models/Album.js';

export interface NewReleasesResult {
  songs: any[];
  albums: any[];
  pagination: {
    page: number;
    limit: number;
    totalSongs: number;
    totalAlbums: number;
  };
}

export class NewReleasesService {
  /**
   * Fetches recently released songs and albums sorted by releaseYear and createdAt descending.
   */
  static async getNewReleases(page = 1, limit = 10): Promise<NewReleasesResult> {
    const skip = (page - 1) * limit;

    const [songs, totalSongs, albums, totalAlbums] = await Promise.all([
      Song.find({})
        .populate('artist', 'name profileImage avatar verified')
        .populate('album', 'title coverImage releaseYear')
        .populate('genre', 'name slug')
        .sort({ releaseYear: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Song.countDocuments(),
      Album.find({})
        .populate('artist', 'name profileImage avatar verified')
        .sort({ releaseYear: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Album.countDocuments(),
    ]);

    return {
      songs,
      albums,
      pagination: {
        page,
        limit,
        totalSongs,
        totalAlbums,
      },
    };
  }
}
