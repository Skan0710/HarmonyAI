import { Artist, IArtist, ISocialLinks } from '../models/Artist.js';

export interface CreateArtistInput {
  name: string;
  bio?: string;
  avatar?: string;
  bannerImage?: string;
  genres?: string[];
  socialLinks?: ISocialLinks;
  verified?: boolean;
  tags?: string[];
}

export interface UpdateArtistInput {
  name?: string;
  bio?: string;
  avatar?: string;
  bannerImage?: string;
  genres?: string[];
  socialLinks?: ISocialLinks;
  verified?: boolean;
  tags?: string[];
}

export interface GetArtistsFilter {
  search?: string;
  genreId?: string;
  verified?: boolean;
  page?: number;
  limit?: number;
}

export class ArtistService {
  static async createArtist(data: CreateArtistInput): Promise<IArtist> {
    const artist = new Artist(data);
    return artist.save();
  }

  static async getAllArtists(filter: GetArtistsFilter = {}): Promise<{ artists: IArtist[]; total: number }> {
    const { search, genreId, verified, page = 1, limit = 20 } = filter;
    const query: Record<string, any> = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    if (genreId) {
      query.genres = genreId;
    }

    if (verified !== undefined) {
      query.verified = verified;
    }

    const skip = (page - 1) * limit;

    const [artists, total] = await Promise.all([
      Artist.find(query).populate('genres', 'name slug').sort({ monthlyListeners: -1, name: 1 }).skip(skip).limit(limit),
      Artist.countDocuments(query),
    ]);

    return { artists, total };
  }

  static async getArtistById(artistId: string): Promise<IArtist | null> {
    return Artist.findById(artistId).populate('genres', 'name slug');
  }

  static async updateArtist(artistId: string, data: UpdateArtistInput): Promise<IArtist | null> {
    return Artist.findByIdAndUpdate(artistId, { $set: data }, { new: true, runValidators: true }).populate(
      'genres',
      'name slug'
    );
  }

  static async deleteArtist(artistId: string): Promise<IArtist | null> {
    return Artist.findByIdAndDelete(artistId);
  }
}
