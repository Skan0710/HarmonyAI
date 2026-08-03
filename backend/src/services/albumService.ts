import { Types } from 'mongoose';
import { Album, IAlbum, AlbumType } from '../models/Album.js';
import { Artist } from '../models/Artist.js';

export interface CreateAlbumInput {
  title: string;
  artist: string;
  featuredArtists?: string[];
  genre?: string;
  coverImage?: string;
  releaseYear?: number;
  releaseDate?: Date;
  albumType?: AlbumType;
  totalTracks?: number;
  tags?: string[];
}

export interface UpdateAlbumInput {
  title?: string;
  artist?: string;
  featuredArtists?: string[];
  genre?: string;
  coverImage?: string;
  releaseYear?: number;
  releaseDate?: Date;
  albumType?: AlbumType;
  totalTracks?: number;
  tags?: string[];
}

export interface GetAlbumsFilter {
  search?: string;
  artistId?: string;
  genreId?: string;
  albumType?: AlbumType;
  releaseYear?: number;
  page?: number;
  limit?: number;
}

export class AlbumService {
  static async createAlbum(data: CreateAlbumInput): Promise<IAlbum> {
    const album = new Album(data);
    return album.save();
  }

  static async getAllAlbums(filter: GetAlbumsFilter = {}): Promise<{ albums: IAlbum[]; total: number }> {
    const { search, artistId, genreId, albumType, releaseYear, page = 1, limit = 20 } = filter;
    const query: Record<string, any> = {};

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    if (artistId) {
      if (Types.ObjectId.isValid(artistId)) {
        query.artist = artistId;
      } else {
        const matchingArtists = await Artist.find({ name: { $regex: artistId, $options: 'i' } }).select('_id');
        query.artist = { $in: matchingArtists.map((a) => a._id) };
      }
    }

    if (genreId && Types.ObjectId.isValid(genreId)) {
      query.genre = genreId;
    }

    if (albumType) {
      query.albumType = albumType;
    }

    if (releaseYear) {
      query.releaseYear = releaseYear;
    }

    const validPage = Math.max(1, page);
    const validLimit = Math.max(1, Math.min(100, limit));
    const skip = (validPage - 1) * validLimit;

    const [albums, total] = await Promise.all([
      Album.find(query)
        .populate('artist', 'name profileImage avatar verified')
        .populate('featuredArtists', 'name profileImage avatar')
        .populate('genre', 'name slug')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(validLimit),
      Album.countDocuments(query),
    ]);

    return { albums, total };
  }

  static async getAlbumById(albumId: string): Promise<IAlbum | null> {
    if (!Types.ObjectId.isValid(albumId)) return null;
    return Album.findById(albumId)
      .populate('artist', 'name profileImage avatar bio verified')
      .populate('featuredArtists', 'name profileImage avatar')
      .populate('genre', 'name slug description');
  }

  static async updateAlbum(albumId: string, data: UpdateAlbumInput): Promise<IAlbum | null> {
    if (!Types.ObjectId.isValid(albumId)) return null;
    return Album.findByIdAndUpdate(albumId, { $set: data }, { new: true, runValidators: true })
      .populate('artist', 'name profileImage avatar verified')
      .populate('featuredArtists', 'name profileImage avatar')
      .populate('genre', 'name slug');
  }

  static async deleteAlbum(albumId: string): Promise<IAlbum | null> {
    if (!Types.ObjectId.isValid(albumId)) return null;
    return Album.findByIdAndDelete(albumId);
  }
}
