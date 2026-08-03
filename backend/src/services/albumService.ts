import { Album, IAlbum, AlbumType } from '../models/Album.js';

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
      query.artist = artistId;
    }

    if (genreId) {
      query.genre = genreId;
    }

    if (albumType) {
      query.albumType = albumType;
    }

    if (releaseYear) {
      query.releaseYear = releaseYear;
    }

    const skip = (page - 1) * limit;

    const [albums, total] = await Promise.all([
      Album.find(query)
        .populate('artist', 'name avatar verified')
        .populate('featuredArtists', 'name avatar')
        .populate('genre', 'name slug')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Album.countDocuments(query),
    ]);

    return { albums, total };
  }

  static async getAlbumById(albumId: string): Promise<IAlbum | null> {
    return Album.findById(albumId)
      .populate('artist', 'name avatar bio verified')
      .populate('featuredArtists', 'name avatar')
      .populate('genre', 'name slug');
  }

  static async updateAlbum(albumId: string, data: UpdateAlbumInput): Promise<IAlbum | null> {
    return Album.findByIdAndUpdate(albumId, { $set: data }, { new: true, runValidators: true })
      .populate('artist', 'name avatar verified')
      .populate('featuredArtists', 'name avatar')
      .populate('genre', 'name slug');
  }

  static async deleteAlbum(albumId: string): Promise<IAlbum | null> {
    return Album.findByIdAndDelete(albumId);
  }
}
