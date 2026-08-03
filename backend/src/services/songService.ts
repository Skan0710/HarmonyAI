import { Song, ISong, IAudioFeatures } from '../models/Song.js';

export interface CreateSongInput {
  title: string;
  artist: string;
  featuredArtists?: string[];
  album?: string;
  genre: string;
  duration: number;
  coverImage?: string;
  audioUrl: string;
  releaseYear?: number;
  audioFeatures?: IAudioFeatures;
  tags?: string[];
  language?: string;
  explicit?: boolean;
  lyrics?: string;
  vectorEmbedding?: number[];
  recommendationMetadata?: Record<string, any>;
}

export interface UpdateSongInput {
  title?: string;
  artist?: string;
  featuredArtists?: string[];
  album?: string | null;
  genre?: string;
  duration?: number;
  coverImage?: string;
  audioUrl?: string;
  releaseYear?: number;
  audioFeatures?: IAudioFeatures;
  tags?: string[];
  language?: string;
  explicit?: boolean;
  lyrics?: string;
  isPublished?: boolean;
  vectorEmbedding?: number[];
  recommendationMetadata?: Record<string, any>;
}

export interface GetSongsFilter {
  search?: string;
  artistId?: string;
  albumId?: string;
  genreId?: string;
  tag?: string;
  releaseYear?: number;
  minBpm?: number;
  maxBpm?: number;
  minEnergy?: number;
  maxEnergy?: number;
  minValence?: number;
  maxValence?: number;
  sortBy?: 'playCount' | 'releaseYear' | 'createdAt' | 'title';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface RecommendationParams {
  songId?: string;
  genreId?: string;
  targetBpm?: number;
  targetEnergy?: number;
  targetValence?: number;
  tags?: string[];
  limit?: number;
}

export class SongService {
  static async createSong(data: CreateSongInput): Promise<ISong> {
    const song = new Song(data);
    return song.save();
  }

  static async getAllSongs(filter: GetSongsFilter = {}): Promise<{ songs: ISong[]; total: number }> {
    const {
      search,
      artistId,
      albumId,
      genreId,
      tag,
      releaseYear,
      minBpm,
      maxBpm,
      minEnergy,
      maxEnergy,
      minValence,
      maxValence,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
    } = filter;

    const query: Record<string, any> = { isPublished: true };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    if (artistId) {
      query.artist = artistId;
    }

    if (albumId) {
      query.album = albumId;
    }

    if (genreId) {
      query.genre = genreId;
    }

    if (tag) {
      query.tags = tag;
    }

    if (releaseYear) {
      query.releaseYear = releaseYear;
    }

    if (minBpm !== undefined || maxBpm !== undefined) {
      query['audioFeatures.bpm'] = {};
      if (minBpm !== undefined) query['audioFeatures.bpm'].$gte = minBpm;
      if (maxBpm !== undefined) query['audioFeatures.bpm'].$lte = maxBpm;
    }

    if (minEnergy !== undefined || maxEnergy !== undefined) {
      query['audioFeatures.energy'] = {};
      if (minEnergy !== undefined) query['audioFeatures.energy'].$gte = minEnergy;
      if (maxEnergy !== undefined) query['audioFeatures.energy'].$lte = maxEnergy;
    }

    if (minValence !== undefined || maxValence !== undefined) {
      query['audioFeatures.valence'] = {};
      if (minValence !== undefined) query['audioFeatures.valence'].$gte = minValence;
      if (maxValence !== undefined) query['audioFeatures.valence'].$lte = maxValence;
    }

    const sortOptions: Record<string, 1 | -1> = {
      [sortBy]: sortOrder === 'asc' ? 1 : -1,
    };

    const skip = (page - 1) * limit;

    const [songs, total] = await Promise.all([
      Song.find(query)
        .populate('artist', 'name avatar verified')
        .populate('featuredArtists', 'name avatar')
        .populate('album', 'title coverImage releaseYear')
        .populate('genre', 'name slug')
        .sort(sortOptions)
        .skip(skip)
        .limit(limit),
      Song.countDocuments(query),
    ]);

    return { songs, total };
  }

  static async getSongById(songId: string): Promise<ISong | null> {
    return Song.findById(songId)
      .populate('artist', 'name avatar bio verified')
      .populate('featuredArtists', 'name avatar')
      .populate('album', 'title coverImage releaseYear albumType')
      .populate('genre', 'name slug description');
  }

  static async updateSong(songId: string, data: UpdateSongInput): Promise<ISong | null> {
    return Song.findByIdAndUpdate(songId, { $set: data }, { new: true, runValidators: true })
      .populate('artist', 'name avatar verified')
      .populate('featuredArtists', 'name avatar')
      .populate('album', 'title coverImage releaseYear')
      .populate('genre', 'name slug');
  }

  static async deleteSong(songId: string): Promise<ISong | null> {
    return Song.findByIdAndDelete(songId);
  }

  static async incrementPlayCount(songId: string): Promise<ISong | null> {
    return Song.findByIdAndUpdate(songId, { $inc: { playCount: 1 } }, { new: true });
  }

  static async getRecommendations(params: RecommendationParams): Promise<ISong[]> {
    const { songId, genreId, targetBpm, targetEnergy, targetValence, tags, limit = 10 } = params;

    const query: Record<string, any> = { isPublished: true };

    if (songId) {
      const seedSong = await Song.findById(songId);
      if (seedSong) {
        query._id = { $ne: seedSong._id };
        const genreToMatch = genreId || seedSong.genre;
        query.genre = genreToMatch;

        if (seedSong.tags && seedSong.tags.length > 0) {
          query.$or = [{ tags: { $in: seedSong.tags } }, { genre: genreToMatch }];
        }

        if (seedSong.audioFeatures?.bpm) {
          const bpm = seedSong.audioFeatures.bpm;
          query['audioFeatures.bpm'] = { $gte: bpm - 20, $lte: bpm + 20 };
        }
      }
    } else {
      if (genreId) query.genre = genreId;
      if (tags && tags.length > 0) query.tags = { $in: tags };

      if (targetBpm !== undefined) {
        query['audioFeatures.bpm'] = { $gte: targetBpm - 15, $lte: targetBpm + 15 };
      }

      if (targetEnergy !== undefined) {
        query['audioFeatures.energy'] = { $gte: Math.max(0, targetEnergy - 0.2), $lte: Math.min(1, targetEnergy + 0.2) };
      }

      if (targetValence !== undefined) {
        query['audioFeatures.valence'] = { $gte: Math.max(0, targetValence - 0.2), $lte: Math.min(1, targetValence + 0.2) };
      }
    }

    return Song.find(query)
      .populate('artist', 'name avatar verified')
      .populate('album', 'title coverImage')
      .populate('genre', 'name slug')
      .sort({ playCount: -1, createdAt: -1 })
      .limit(limit);
  }
}
