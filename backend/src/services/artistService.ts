import { Types } from 'mongoose';
import { Artist, IArtist, ISocialLinks } from '../models/Artist.js';

export interface CreateArtistInput {
  name: string;
  bio?: string;
  profileImage?: string;
  avatar?: string;
  bannerImage?: string;
  genres?: string[];
  socialLinks?: ISocialLinks;
  monthlyListeners?: number;
  verified?: boolean;
  tags?: string[];
  similarArtists?: string[];
  vectorEmbedding?: number[];
  recommendationMetadata?: Record<string, any>;
}

export interface UpdateArtistInput {
  name?: string;
  bio?: string;
  profileImage?: string;
  avatar?: string;
  bannerImage?: string;
  genres?: string[];
  socialLinks?: ISocialLinks;
  monthlyListeners?: number;
  verified?: boolean;
  tags?: string[];
  similarArtists?: string[];
  vectorEmbedding?: number[];
  recommendationMetadata?: Record<string, any>;
}

export interface GetArtistsFilter {
  search?: string;
  genreId?: string;
  verified?: boolean;
  sortBy?: 'monthlyListeners' | 'name' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export class ArtistService {
  static async createArtist(data: CreateArtistInput): Promise<IArtist> {
    const artist = new Artist({
      ...data,
      profileImage: data.profileImage || data.avatar || '',
      avatar: data.avatar || data.profileImage || '',
    });
    return artist.save();
  }

  static async getAllArtists(filter: GetArtistsFilter = {}): Promise<{ artists: IArtist[]; total: number }> {
    const {
      search,
      genreId,
      verified,
      sortBy = 'monthlyListeners',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
    } = filter;
    const query: Record<string, any> = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    if (genreId && Types.ObjectId.isValid(genreId)) {
      query.genres = genreId;
    }

    if (verified !== undefined) {
      query.verified = verified;
    }

    const sortOptions: Record<string, 1 | -1> = {
      [sortBy]: sortOrder === 'asc' ? 1 : -1,
    };

    const validPage = Math.max(1, page);
    const validLimit = Math.max(1, Math.min(100, limit));
    const skip = (validPage - 1) * validLimit;

    const [artists, total] = await Promise.all([
      Artist.find(query)
        .populate('genres', 'name slug')
        .populate('similarArtists', 'name profileImage monthlyListeners')
        .sort(sortOptions)
        .skip(skip)
        .limit(validLimit),
      Artist.countDocuments(query),
    ]);

    return { artists, total };
  }

  static async getArtistById(artistId: string): Promise<IArtist | null> {
    if (!Types.ObjectId.isValid(artistId)) return null;
    return Artist.findById(artistId)
      .populate('genres', 'name slug description')
      .populate('similarArtists', 'name profileImage avatar monthlyListeners verified');
  }

  static async updateArtist(artistId: string, data: UpdateArtistInput): Promise<IArtist | null> {
    if (!Types.ObjectId.isValid(artistId)) return null;

    const updateData: Record<string, any> = { ...data };
    if (data.profileImage && !data.avatar) updateData.avatar = data.profileImage;
    if (data.avatar && !data.profileImage) updateData.profileImage = data.avatar;

    return Artist.findByIdAndUpdate(artistId, { $set: updateData }, { new: true, runValidators: true })
      .populate('genres', 'name slug')
      .populate('similarArtists', 'name profileImage monthlyListeners');
  }

  static async deleteArtist(artistId: string): Promise<IArtist | null> {
    if (!Types.ObjectId.isValid(artistId)) return null;
    return Artist.findByIdAndDelete(artistId);
  }

  static async getRecommendedArtists(artistId: string, limit: number = 5): Promise<IArtist[]> {
    if (!Types.ObjectId.isValid(artistId)) return [];
    const seedArtist = await Artist.findById(artistId);
    if (!seedArtist) return [];

    const query: Record<string, any> = {
      _id: { $ne: seedArtist._id },
    };

    if (seedArtist.genres && seedArtist.genres.length > 0) {
      query.genres = { $in: seedArtist.genres };
    }

    return Artist.find(query)
      .populate('genres', 'name slug')
      .sort({ monthlyListeners: -1 })
      .limit(limit);
  }
}
