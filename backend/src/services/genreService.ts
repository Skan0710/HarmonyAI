import { Types } from 'mongoose';
import { Genre, IGenre } from '../models/Genre.js';
import { Song } from '../models/Song.js';

export interface CreateGenreInput {
  name: string;
  description?: string;
  coverImage?: string;
  parentGenre?: string;
  tags?: string[];
  isFeatured?: boolean;
}

export interface UpdateGenreInput {
  name?: string;
  description?: string;
  coverImage?: string;
  parentGenre?: string | null;
  tags?: string[];
  isFeatured?: boolean;
}

export class GenreService {
  static async createGenre(data: CreateGenreInput): Promise<IGenre> {
    const genre = new Genre(data);
    return genre.save();
  }

  static async getAllGenres(query: { isFeatured?: boolean; search?: string } = {}): Promise<any[]> {
    const filter: Record<string, any> = {};

    if (query.isFeatured !== undefined) {
      filter.isFeatured = query.isFeatured;
    }

    if (query.search) {
      filter.name = { $regex: query.search, $options: 'i' };
    }

    const genres = await Genre.find(filter)
      .populate('parentGenre', 'name slug')
      .sort({ name: 1 })
      .lean();

    // Attach total song counts for each genre
    const genresWithCounts = await Promise.all(
      genres.map(async (g) => {
        const songCount = await Song.countDocuments({ genre: g._id });
        return {
          ...g,
          songCount,
        };
      })
    );

    return genresWithCounts;
  }

  static async getGenreById(genreId: string): Promise<any | null> {
    if (!Types.ObjectId.isValid(genreId)) return null;
    const genre = await Genre.findById(genreId).populate('parentGenre', 'name slug').lean();
    if (!genre) return null;

    const songCount = await Song.countDocuments({ genre: genre._id });
    return {
      ...genre,
      songCount,
    };
  }

  static async getGenreBySlug(slug: string): Promise<any | null> {
    const genre = await Genre.findOne({ slug: slug.toLowerCase() }).populate('parentGenre', 'name slug').lean();
    if (!genre) return null;

    const songCount = await Song.countDocuments({ genre: genre._id });
    return {
      ...genre,
      songCount,
    };
  }

  static async updateGenre(genreId: string, data: UpdateGenreInput): Promise<IGenre | null> {
    if (!Types.ObjectId.isValid(genreId)) return null;
    return Genre.findByIdAndUpdate(genreId, { $set: data }, { new: true, runValidators: true }).populate(
      'parentGenre',
      'name slug'
    );
  }

  static async deleteGenre(genreId: string): Promise<IGenre | null> {
    if (!Types.ObjectId.isValid(genreId)) return null;
    return Genre.findByIdAndDelete(genreId);
  }
}
