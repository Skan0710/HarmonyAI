import { supabase } from '../config/supabase.js';

export interface CreateArtistInput {
  name: string;
  bio?: string;
  profileImage?: string;
  avatar?: string;
  bannerImage?: string;
  genres?: string[];
  socialLinks?: Record<string, any>;
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
  socialLinks?: Record<string, any>;
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

function mapArtistRow(row: any, genres: any[] = []) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    name: row.name,
    bio: row.bio || '',
    profileImage: row.profile_image || '',
    avatar: row.avatar || row.profile_image || '',
    bannerImage: row.banner_image || '',
    monthlyListeners: row.monthly_listeners || 0,
    verified: Boolean(row.verified),
    tags: row.tags || [],
    socialLinks: row.social_links || {},
    genres,
    similarArtists: row.similar_artists || [],
    vectorEmbedding: row.vector_embedding || null,
    recommendationMetadata: row.recommendation_metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ArtistService {
  static async createArtist(data: CreateArtistInput): Promise<any> {
    const { data: artist, error } = await supabase
      .from('artists')
      .insert({
        name: data.name,
        bio: data.bio || '',
        profile_image: data.profileImage || data.avatar || '',
        avatar: data.avatar || data.profileImage || '',
        banner_image: data.bannerImage || '',
        monthly_listeners: data.monthlyListeners || 0,
        verified: Boolean(data.verified),
        tags: data.tags || [],
        social_links: data.socialLinks || {},
        similar_artists: data.similarArtists || [],
        vector_embedding: (data.vectorEmbedding ? JSON.stringify(data.vectorEmbedding) : null) as any,
        recommendation_metadata: data.recommendationMetadata || {},
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create artist: ${error.message}`);

    if (Array.isArray(data.genres) && data.genres.length > 0) {
      const links = data.genres.map((gId) => ({ artist_id: artist.id, genre_id: gId }));
      await supabase.from('artist_genres').insert(links);
    }

    return mapArtistRow(artist);
  }

  static async getAllArtists(filter: GetArtistsFilter = {}): Promise<{ artists: any[]; total: number }> {
    const {
      search,
      genreId,
      verified,
      sortBy = 'monthlyListeners',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
    } = filter;

    const columnMap: Record<string, string> = {
      monthlyListeners: 'monthly_listeners',
      name: 'name',
      createdAt: 'created_at',
    };
    const sortCol = columnMap[sortBy] || 'monthly_listeners';

    let q = supabase.from('artists').select('*', { count: 'exact' });

    if (search) {
      q = q.ilike('name', `%${search}%`);
    }
    if (verified !== undefined) {
      q = q.eq('verified', verified);
    }

    if (genreId) {
      const { data: artistGenres } = await supabase
        .from('artist_genres')
        .select('artist_id')
        .eq('genre_id', genreId);
      const artistIds = (artistGenres || []).map((ag) => ag.artist_id);
      q = q.in('id', artistIds.length > 0 ? artistIds : ['00000000-0000-0000-0000-000000000000']);
    }

    const validPage = Math.max(1, page);
    const validLimit = Math.max(1, Math.min(100, limit));
    const offset = (validPage - 1) * validLimit;

    q = q.order(sortCol as any, { ascending: sortOrder === 'asc' }).range(offset, offset + validLimit - 1);

    const { data: artists, count, error } = await q;
    if (error) throw new Error(`Failed to fetch artists: ${error.message}`);

    // Fetch genre mappings
    const artistIds = (artists || []).map((a) => a.id);
    let artistGenreMap: Record<string, any[]> = {};
    if (artistIds.length > 0) {
      const { data: agData } = await supabase
        .from('artist_genres')
        .select('artist_id, genres(id, name, slug)')
        .in('artist_id', artistIds);

      if (agData) {
        for (const ag of agData as any[]) {
          if (!artistGenreMap[ag.artist_id]) artistGenreMap[ag.artist_id] = [];
          if (ag.genres) {
            artistGenreMap[ag.artist_id].push({
              _id: ag.genres.id,
              name: ag.genres.name,
              slug: ag.genres.slug,
            });
          }
        }
      }
    }

    const mapped = (artists || []).map((a) => mapArtistRow(a, artistGenreMap[a.id] || []));
    return { artists: mapped, total: count || 0 };
  }

  static async getArtistById(artistId: string): Promise<any | null> {
    const { data: artist, error } = await supabase.from('artists').select('*').eq('id', artistId).maybeSingle();
    if (error || !artist) return null;

    const { data: agData } = await supabase
      .from('artist_genres')
      .select('genres(id, name, slug, description)')
      .eq('artist_id', artist.id);

    const genres = (agData || []).map((ag: any) => ({
      _id: ag.genres?.id,
      name: ag.genres?.name,
      slug: ag.genres?.slug,
      description: ag.genres?.description,
    })).filter(Boolean);

    return mapArtistRow(artist, genres);
  }

  static async updateArtist(artistId: string, data: UpdateArtistInput): Promise<any | null> {
    const updatePayload: Record<string, any> = {};
    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.bio !== undefined) updatePayload.bio = data.bio;
    if (data.profileImage !== undefined) updatePayload.profile_image = data.profileImage;
    if (data.avatar !== undefined) updatePayload.avatar = data.avatar;
    if (data.bannerImage !== undefined) updatePayload.banner_image = data.bannerImage;
    if (data.monthlyListeners !== undefined) updatePayload.monthly_listeners = data.monthlyListeners;
    if (data.verified !== undefined) updatePayload.verified = data.verified;
    if (data.tags !== undefined) updatePayload.tags = data.tags;
    if (data.similarArtists !== undefined) updatePayload.similar_artists = data.similarArtists;
    updatePayload.updated_at = new Date().toISOString();

    const { data: updated, error } = await (supabase.from('artists') as any)
      .update(updatePayload as any)
      .eq('id', artistId)
      .select()
      .maybeSingle();

    if (error || !updated) return null;

    if (Array.isArray(data.genres)) {
      await supabase.from('artist_genres').delete().eq('artist_id', artistId);
      if (data.genres.length > 0) {
        const links = data.genres.map((gId) => ({ artist_id: artistId, genre_id: gId }));
        await supabase.from('artist_genres').insert(links);
      }
    }

    return this.getArtistById(artistId);
  }

  static async deleteArtist(artistId: string): Promise<any | null> {
    const existing = await this.getArtistById(artistId);
    if (!existing) return null;

    await supabase.from('artist_genres').delete().eq('artist_id', artistId);
    const { error } = await supabase.from('artists').delete().eq('id', artistId);
    if (error) throw new Error(`Failed to delete artist: ${error.message}`);
    return existing;
  }

  static async getRecommendedArtists(artistId: string, limit: number = 5): Promise<any[]> {
    const { data: artists } = await supabase
      .from('artists')
      .select('*')
      .neq('id', artistId)
      .order('monthly_listeners', { ascending: false })
      .limit(limit);

    return (artists || []).map((a) => mapArtistRow(a));
  }
}
