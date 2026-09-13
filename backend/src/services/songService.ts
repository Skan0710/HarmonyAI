import { supabase } from '../config/supabase.js';
import { searchYoutubeVideoId } from './youtubeService.js';

export interface IAudioFeatures {
  bpm?: number;
  key?: string;
  energy?: number;
  danceability?: number;
  valence?: number;
  acousticness?: number;
  instrumentalness?: number;
  liveness?: number;
  speechiness?: number;
}

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

export function mapSongRow(row: any): any {
  if (!row) return null;
  const artistObj = row.artists || row['artists!songs_artist_id_fkey'] || null;
  const albumObj = row.albums || row['albums!songs_album_id_fkey'] || null;
  const genreObj = row.genres || row['genres!songs_genre_id_fkey'] || null;

  return {
    _id: row.id,
    id: row.id,
    title: row.title,
    artist: artistObj ? {
      _id: artistObj.id,
      id: artistObj.id,
      name: artistObj.name,
      avatar: artistObj.avatar || artistObj.profile_image || '',
      profileImage: artistObj.profile_image || '',
      verified: Boolean(artistObj.verified),
    } : row.artist_id,
    album: albumObj ? {
      _id: albumObj.id,
      id: albumObj.id,
      title: albumObj.title,
      coverImage: albumObj.cover_image,
      releaseYear: albumObj.release_year,
    } : row.album_id,
    genre: genreObj ? {
      _id: genreObj.id,
      id: genreObj.id,
      name: genreObj.name,
      slug: genreObj.slug,
    } : row.genre_id,
    duration: row.duration,
    coverImage: row.cover_image || '',
    audioUrl: row.audio_url || '',
    releaseYear: row.release_year,
    playCount: row.play_count || 0,
    audioFeatures: row.audio_features || {},
    mood: row.mood || 'Chill',
    tags: row.tags || [],
    language: row.language || 'English',
    explicit: Boolean(row.explicit),
    lyrics: row.lyrics || '',
    isPublished: row.is_published !== false,
    youtubeVideoId: row.youtube_video_id || null,
    vectorEmbedding: row.vector_embedding,
    recommendationMetadata: row.recommendation_metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SongService {
  static async createSong(data: CreateSongInput): Promise<any> {
    const { data: song, error } = await supabase
      .from('songs')
      .insert({
        title: data.title,
        artist_id: data.artist,
        album_id: data.album || null,
        genre_id: data.genre,
        duration: data.duration,
        cover_image: data.coverImage || '',
        audio_url: data.audioUrl,
        release_year: data.releaseYear || null,
        audio_features: (data.audioFeatures || {}) as any,
        tags: data.tags || [],
        language: data.language || 'English',
        explicit: Boolean(data.explicit),
        lyrics: data.lyrics || '',
        vector_embedding: (data.vectorEmbedding ? JSON.stringify(data.vectorEmbedding) : null) as any,
        recommendation_metadata: (data.recommendationMetadata || {}) as any,
      })
      .select('*, artists!songs_artist_id_fkey(*), albums!songs_album_id_fkey(*), genres!songs_genre_id_fkey(*)')
      .single();

    if (error) throw new Error(`Failed to create song: ${error.message}`);
    return mapSongRow(song);
  }

  static async getAllSongs(filter: GetSongsFilter = {}): Promise<{ songs: any[]; total: number }> {
    const {
      search,
      artistId,
      albumId,
      genreId,
      tag,
      releaseYear,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
    } = filter;

    const columnMap: Record<string, string> = {
      playCount: 'play_count',
      releaseYear: 'release_year',
      createdAt: 'created_at',
      title: 'title',
    };
    const sortCol = columnMap[sortBy] || 'created_at';

    let q = supabase
      .from('songs')
      .select('*, artists!songs_artist_id_fkey(*), albums!songs_album_id_fkey(*), genres!songs_genre_id_fkey(*)', { count: 'exact' })
      .eq('is_published', true);

    if (search) {
      q = q.ilike('title', `%${search}%`);
    }
    if (artistId) {
      q = q.eq('artist_id', artistId);
    }
    if (albumId) {
      q = q.eq('album_id', albumId);
    }
    if (genreId) {
      q = q.eq('genre_id', genreId);
    }
    if (tag) {
      q = q.contains('tags', [tag]);
    }
    if (releaseYear) {
      q = q.eq('release_year', releaseYear);
    }

    const validPage = Math.max(1, page);
    const validLimit = Math.max(1, Math.min(100, limit));
    const offset = (validPage - 1) * validLimit;

    q = q.order(sortCol as any, { ascending: sortOrder === 'asc' }).range(offset, offset + validLimit - 1);

    const { data: songs, count, error } = await q;
    if (error) throw new Error(`Failed to fetch songs: ${error.message}`);

    return {
      songs: (songs || []).map(mapSongRow),
      total: count || 0,
    };
  }

  static async getSongById(songId: string): Promise<any | null> {
    const { data: song, error } = await supabase
      .from('songs')
      .select('*, artists!songs_artist_id_fkey(*), albums!songs_album_id_fkey(*), genres!songs_genre_id_fkey(*)')
      .eq('id', songId)
      .maybeSingle();

    if (error || !song) return null;
    return mapSongRow(song);
  }

  static async updateSong(songId: string, data: UpdateSongInput): Promise<any | null> {
    const updatePayload: Record<string, any> = {};
    if (data.title !== undefined) updatePayload.title = data.title;
    if (data.artist !== undefined) updatePayload.artist_id = data.artist;
    if (data.album !== undefined) updatePayload.album_id = data.album;
    if (data.genre !== undefined) updatePayload.genre_id = data.genre;
    if (data.duration !== undefined) updatePayload.duration = data.duration;
    if (data.coverImage !== undefined) updatePayload.cover_image = data.coverImage;
    if (data.audioUrl !== undefined) updatePayload.audio_url = data.audioUrl;
    if (data.releaseYear !== undefined) updatePayload.release_year = data.releaseYear;
    if (data.audioFeatures !== undefined) updatePayload.audio_features = data.audioFeatures;
    if (data.tags !== undefined) updatePayload.tags = data.tags;
    if (data.language !== undefined) updatePayload.language = data.language;
    if (data.explicit !== undefined) updatePayload.explicit = data.explicit;
    if (data.lyrics !== undefined) updatePayload.lyrics = data.lyrics;
    if (data.isPublished !== undefined) updatePayload.is_published = data.isPublished;
    updatePayload.updated_at = new Date().toISOString();

    const { data: updated, error } = await (supabase.from('songs') as any)
      .update(updatePayload as any)
      .eq('id', songId)
      .select('*, artists!songs_artist_id_fkey(*), albums!songs_album_id_fkey(*), genres!songs_genre_id_fkey(*)')
      .maybeSingle();

    if (error || !updated) return null;
    return mapSongRow(updated);
  }

  static async deleteSong(songId: string): Promise<any | null> {
    const existing = await this.getSongById(songId);
    if (!existing) return null;

    const { error } = await supabase.from('songs').delete().eq('id', songId);
    if (error) throw new Error(`Failed to delete song: ${error.message}`);
    return existing;
  }

  static async incrementPlayCount(songId: string): Promise<any | null> {
    const { data: song } = await supabase.from('songs').select('play_count').eq('id', songId).maybeSingle();
    if (!song) return null;

    const newCount = (song.play_count || 0) + 1;
    const { data: updated } = await supabase
      .from('songs')
      .update({ play_count: newCount, updated_at: new Date().toISOString() })
      .eq('id', songId)
      .select('*, artists!songs_artist_id_fkey(*), albums!songs_album_id_fkey(*), genres!songs_genre_id_fkey(*)')
      .maybeSingle();

    return mapSongRow(updated);
  }

  /**
   * Resolves and caches the YouTube video ID used for full-length playback.
   * Reads the cached column first — only calls the (quota-limited) YouTube
   * search API on a cache miss, then persists the result so it's free on
   * every subsequent play.
   */
  static async resolveYoutubeVideoId(songId: string): Promise<string | null> {
    const { data: song, error } = await supabase
      .from('songs')
      .select('youtube_video_id, title, artists!songs_artist_id_fkey(name)')
      .eq('id', songId)
      .maybeSingle();

    if (error || !song) return null;
    if (song.youtube_video_id) return song.youtube_video_id;

    const artistName = (song as any).artists?.name || '';
    const videoId = await searchYoutubeVideoId(song.title, artistName);
    if (!videoId) return null;

    await supabase
      .from('songs')
      .update({ youtube_video_id: videoId, updated_at: new Date().toISOString() } as any)
      .eq('id', songId);

    return videoId;
  }

  static async getRecommendations(params: RecommendationParams): Promise<any[]> {
    const { genreId, limit = 10 } = params;

    let q = supabase
      .from('songs')
      .select('*, artists!songs_artist_id_fkey(*), albums!songs_album_id_fkey(*), genres!songs_genre_id_fkey(*)')
      .eq('is_published', true);

    if (genreId) {
      q = q.eq('genre_id', genreId);
    }

    q = q.order('play_count', { ascending: false }).limit(Math.min(50, limit));

    const { data: songs, error } = await q;
    if (error) throw new Error(`Failed to fetch recommendations: ${error.message}`);
    return (songs || []).map(mapSongRow);
  }
}
