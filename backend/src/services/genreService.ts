import { supabase } from '../config/supabase.js';

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

function mapGenreRow(row: any, songCount = 0) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description || '',
    coverImage: row.cover_image || '',
    parentGenre: row.parent_genre_id || null,
    tags: row.tags || [],
    isFeatured: Boolean(row.is_featured),
    songCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class GenreService {
  static async createGenre(data: CreateGenreInput): Promise<any> {
    const slug = data.name.toLowerCase().replace(/\s+/g, '-');
    const { data: inserted, error } = await supabase
      .from('genres')
      .insert({
        name: data.name,
        slug,
        description: data.description || '',
        cover_image: data.coverImage || '',
        parent_genre_id: data.parentGenre || null,
        tags: data.tags || [],
        is_featured: Boolean(data.isFeatured),
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create genre: ${error.message}`);
    return mapGenreRow(inserted);
  }

  static async getAllGenres(query: { isFeatured?: boolean; search?: string } = {}): Promise<any[]> {
    let q = supabase.from('genres').select('*').order('name', { ascending: true });

    if (query.isFeatured !== undefined) {
      q = q.eq('is_featured', query.isFeatured);
    }
    if (query.search) {
      q = q.ilike('name', `%${query.search}%`);
    }

    const { data: genres, error } = await q;
    if (error) throw new Error(`Failed to fetch genres: ${error.message}`);

    // Fetch counts from songs table
    const { data: songCounts } = await supabase.from('songs').select('genre_id');
    const countMap: Record<string, number> = {};
    if (songCounts) {
      for (const s of songCounts) {
        if (s.genre_id) countMap[s.genre_id] = (countMap[s.genre_id] || 0) + 1;
      }
    }

    return (genres || []).map((g) => mapGenreRow(g, countMap[g.id] || 0));
  }

  static async getGenreById(genreId: string): Promise<any | null> {
    const { data: genre, error } = await supabase.from('genres').select('*').eq('id', genreId).maybeSingle();
    if (error || !genre) return null;

    const { count } = await supabase.from('songs').select('*', { count: 'exact', head: true }).eq('genre_id', genre.id);
    return mapGenreRow(genre, count || 0);
  }

  static async getGenreBySlug(slug: string): Promise<any | null> {
    const { data: genre, error } = await supabase
      .from('genres')
      .select('*')
      .eq('slug', slug.toLowerCase())
      .maybeSingle();
    if (error || !genre) return null;

    const { count } = await supabase.from('songs').select('*', { count: 'exact', head: true }).eq('genre_id', genre.id);
    return mapGenreRow(genre, count || 0);
  }

  static async updateGenre(genreId: string, data: UpdateGenreInput): Promise<any | null> {
    const updatePayload: Record<string, any> = {};
    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.coverImage !== undefined) updatePayload.cover_image = data.coverImage;
    if (data.parentGenre !== undefined) updatePayload.parent_genre_id = data.parentGenre;
    if (data.tags !== undefined) updatePayload.tags = data.tags;
    if (data.isFeatured !== undefined) updatePayload.is_featured = data.isFeatured;
    updatePayload.updated_at = new Date().toISOString();

    const { data: updated, error } = await (supabase.from('genres') as any)
      .update(updatePayload as any)
      .eq('id', genreId)
      .select()
      .maybeSingle();

    if (error || !updated) return null;
    return mapGenreRow(updated);
  }

  static async deleteGenre(genreId: string): Promise<any | null> {
    const { data: existing } = await supabase.from('genres').select('*').eq('id', genreId).maybeSingle();
    if (!existing) return null;

    const { error } = await supabase.from('genres').delete().eq('id', genreId);
    if (error) throw new Error(`Failed to delete genre: ${error.message}`);
    return mapGenreRow(existing);
  }
}
