import { Types } from 'mongoose';
import { Song, ISong, IAudioFeatures } from '../models/Song.js';
import { Artist } from '../models/Artist.js';
import { Genre } from '../models/Genre.js';
import { Album } from '../models/Album.js';

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

    // Filter by Artist (support ObjectId or artist name lookup)
    if (artistId) {
      if (Types.ObjectId.isValid(artistId)) {
        query.artist = artistId;
      } else {
        const matchingArtists = await Artist.find({ name: { $regex: artistId, $options: 'i' } }).select('_id');
        query.artist = { $in: matchingArtists.map((a) => a._id) };
      }
    }

    // Filter by Album (support ObjectId or album title lookup)
    if (albumId) {
      if (Types.ObjectId.isValid(albumId)) {
        query.album = albumId;
      } else {
        const matchingAlbums = await Album.find({ title: { $regex: albumId, $options: 'i' } }).select('_id');
        query.album = { $in: matchingAlbums.map((a) => a._id) };
      }
    }

    // Filter by Genre (support ObjectId or genre slug/name lookup)
    if (genreId) {
      if (Types.ObjectId.isValid(genreId)) {
        query.genre = genreId;
      } else {
        const matchingGenres = await Genre.find({
          $or: [{ slug: genreId.toLowerCase() }, { name: { $regex: genreId, $options: 'i' } }],
        }).select('_id');
        query.genre = { $in: matchingGenres.map((g) => g._id) };
      }
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

    const validPage = Math.max(1, page);
    const validLimit = Math.max(1, Math.min(100, limit));
    const skip = (validPage - 1) * validLimit;

    const [songs, total] = await Promise.all([
      Song.find(query)
        .populate('artist', 'name avatar verified')
        .populate('featuredArtists', 'name avatar')
        .populate('album', 'title coverImage releaseYear')
        .populate('genre', 'name slug')
        .sort(sortOptions)
        .skip(skip)
        .limit(validLimit),
      Song.countDocuments(query),
    ]);

    return { songs, total };
  }

  static async getSongById(songId: string): Promise<ISong | null> {
    if (!Types.ObjectId.isValid(songId)) return null;
    return Song.findById(songId)
      .populate('artist', 'name avatar bio verified')
      .populate('featuredArtists', 'name avatar')
      .populate('album', 'title coverImage releaseYear albumType')
      .populate('genre', 'name slug description');
  }

  static async updateSong(songId: string, data: UpdateSongInput): Promise<ISong | null> {
    if (!Types.ObjectId.isValid(songId)) return null;
    return Song.findByIdAndUpdate(songId, { $set: data }, { new: true, runValidators: true })
      .populate('artist', 'name avatar verified')
      .populate('featuredArtists', 'name avatar')
      .populate('album', 'title coverImage releaseYear')
      .populate('genre', 'name slug');
  }

  static async deleteSong(songId: string): Promise<ISong | null> {
    if (!Types.ObjectId.isValid(songId)) return null;
    return Song.findByIdAndDelete(songId);
  }

  static async incrementPlayCount(songId: string): Promise<ISong | null> {
    if (!Types.ObjectId.isValid(songId)) return null;
    return Song.findByIdAndUpdate(songId, { $inc: { playCount: 1 } }, { new: true });
  }

  static async getRecommendations(params: RecommendationParams): Promise<ISong[]> {
    const { songId, genreId, targetBpm, targetEnergy, targetValence, tags, limit = 10 } = params;

    const query: Record<string, any> = { isPublished: true };

    if (songId && Types.ObjectId.isValid(songId)) {
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
      if (genreId && Types.ObjectId.isValid(genreId)) query.genre = genreId;
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
      .limit(Math.min(50, limit));
  }
}
