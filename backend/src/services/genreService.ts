import { Genre, IGenre } from '../models/Genre.js';

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

  static async getAllGenres(query: { isFeatured?: boolean; search?: string } = {}): Promise<IGenre[]> {
    const filter: Record<string, any> = {};

    if (query.isFeatured !== undefined) {
      filter.isFeatured = query.isFeatured;
    }

    if (query.search) {
      filter.name = { $regex: query.search, $options: 'i' };
    }

    return Genre.find(filter).populate('parentGenre', 'name slug').sort({ name: 1 });
  }

  static async getGenreById(genreId: string): Promise<IGenre | null> {
    return Genre.findById(genreId).populate('parentGenre', 'name slug');
  }

  static async getGenreBySlug(slug: string): Promise<IGenre | null> {
    return Genre.findOne({ slug }).populate('parentGenre', 'name slug');
  }

  static async updateGenre(genreId: string, data: UpdateGenreInput): Promise<IGenre | null> {
    return Genre.findByIdAndUpdate(genreId, { $set: data }, { new: true, runValidators: true }).populate(
      'parentGenre',
      'name slug'
    );
  }

  static async deleteGenre(genreId: string): Promise<IGenre | null> {
    return Genre.findByIdAndDelete(genreId);
  }
}
