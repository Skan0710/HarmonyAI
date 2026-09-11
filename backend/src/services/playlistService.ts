import { supabase } from '../config/supabase.js';

export interface CreatePlaylistInput {
  name: string;
  description?: string;
  coverImage?: string;
  visibility?: 'public' | 'private';
  isCollaborative?: boolean;
}

export interface UpdatePlaylistInput {
  name?: string;
  description?: string;
  coverImage?: string;
  visibility?: 'public' | 'private';
  isCollaborative?: boolean;
}

function mapPlaylistRow(row: any, songs: any[] = [], collaborators: any[] = []) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    name: row.name,
    description: row.description || '',
    coverImage: row.cover_image || '',
    owner: row.users ? {
      _id: row.users.id,
      id: row.users.id,
      name: row.users.name,
      email: row.users.email,
      profilePicture: row.users.profile_picture,
    } : row.owner_id,
    visibility: row.visibility || 'public',
    isCollaborative: Boolean(row.is_collaborative),
    songs,
    collaborators,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PlaylistService {
  static async createPlaylist(ownerId: string, data: CreatePlaylistInput): Promise<any> {
    const { data: playlist, error } = await supabase
      .from('playlists')
      .insert({
        name: data.name,
        description: data.description || '',
        cover_image: data.coverImage || '',
        owner_id: ownerId,
        visibility: data.visibility || 'public',
        is_collaborative: Boolean(data.isCollaborative),
      })
      .select('*, users(*)')
      .single();

    if (error) throw new Error(`Failed to create playlist: ${error.message}`);
    return mapPlaylistRow(playlist, [], []);
  }

  static async getUserPlaylists(userId: string): Promise<any[]> {
    const { data: ownedPlaylists } = await supabase
      .from('playlists')
      .select('*, users(*)')
      .eq('owner_id', userId)
      .order('updated_at', { ascending: false });

    const { data: collabPlaylists } = await supabase
      .from('playlist_collaborators')
      .select('playlists(*, users(*))')
      .eq('user_id', userId);

    const all = [...(ownedPlaylists || [])];
    if (collabPlaylists) {
      for (const cp of collabPlaylists) {
        if (cp.playlists && !all.some((p) => p.id === cp.playlists.id)) {
          all.push(cp.playlists);
        }
      }
    }

    return all.map((p) => mapPlaylistRow(p, []));
  }

  static async getPlaylistById(playlistId: string, userId?: string): Promise<any | null> {
    const { data: playlist, error } = await supabase
      .from('playlists')
      .select('*, users(*)')
      .eq('id', playlistId)
      .maybeSingle();

    if (error || !playlist) return null;

    // Fetch songs in playlist
    const { data: pSongs } = await supabase
      .from('playlist_songs')
      .select('position, songs(*, artists(*), albums(*), genres(*))')
      .eq('playlist_id', playlistId)
      .order('position', { ascending: true });

    const songs = (pSongs || []).map((ps: any) => {
      const s = ps.songs;
      if (!s) return null;
      return {
        _id: s.id,
        id: s.id,
        title: s.title,
        coverImage: s.cover_image,
        audioUrl: s.audio_url,
        duration: s.duration,
        artist: s.artists ? {
          _id: s.artists.id,
          id: s.artists.id,
          name: s.artists.name,
          avatar: s.artists.avatar,
          verified: s.artists.verified,
        } : null,
        album: s.albums ? {
          _id: s.albums.id,
          id: s.albums.id,
          title: s.albums.title,
          coverImage: s.albums.cover_image,
          releaseYear: s.albums.release_year,
        } : null,
        genre: s.genres ? {
          _id: s.genres.id,
          id: s.genres.id,
          name: s.genres.name,
          slug: s.genres.slug,
        } : null,
      };
    }).filter(Boolean);

    // Fetch collaborators
    const { data: collabs } = await supabase
      .from('playlist_collaborators')
      .select('users(id, name, profile_picture)')
      .eq('playlist_id', playlistId);

    const collaborators = (collabs || []).map((c: any) => ({
      _id: c.users?.id,
      id: c.users?.id,
      name: c.users?.name,
      profilePicture: c.users?.profile_picture,
    })).filter(Boolean);

    // Visibility authorization check
    if (playlist.visibility === 'private') {
      const currentUserIdStr = userId?.toString();
      const isOwner = playlist.owner_id === currentUserIdStr;
      const isCollaborator = collaborators.some((c: any) => c.id === currentUserIdStr);

      if (!isOwner && !isCollaborator) {
        throw new Error('Access denied to private playlist');
      }
    }

    return mapPlaylistRow(playlist, songs, collaborators);
  }

  static async updatePlaylist(
    playlistId: string,
    userId: string,
    data: UpdatePlaylistInput
  ): Promise<any | null> {
    const existing = await this.getPlaylistById(playlistId);
    if (!existing) return null;

    const isOwner = existing.owner?._id === userId || existing.owner === userId;
    const isCollaborator = existing.collaborators?.some((c: any) => c.id === userId);

    if (!isOwner && (!existing.isCollaborative || !isCollaborator)) {
      throw new Error('Unauthorized to update this playlist');
    }

    const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.coverImage !== undefined) updatePayload.cover_image = data.coverImage;
    if (data.visibility !== undefined) updatePayload.visibility = data.visibility;
    if (data.isCollaborative !== undefined) updatePayload.is_collaborative = data.isCollaborative;

    const { data: updated, error } = await (supabase.from('playlists') as any)
      .update(updatePayload as any)
      .eq('id', playlistId)
      .select('*, users(*)')
      .maybeSingle();

    if (error || !updated) return null;
    return this.getPlaylistById(playlistId);
  }

  static async deletePlaylist(playlistId: string, userId: string): Promise<boolean> {
    const existing = await this.getPlaylistById(playlistId);
    if (!existing) return false;

    const isOwner = existing.owner?._id === userId || existing.owner === userId;
    if (!isOwner) {
      throw new Error('Only the playlist owner can delete it');
    }

    await supabase.from('playlist_songs').delete().eq('playlist_id', playlistId);
    await supabase.from('playlist_collaborators').delete().eq('playlist_id', playlistId);
    const { error } = await supabase.from('playlists').delete().eq('id', playlistId);
    return !error;
  }

  static async addSongToPlaylist(
    playlistId: string,
    userId: string,
    songId: string
  ): Promise<any> {
    const existing = await this.getPlaylistById(playlistId);
    if (!existing) throw new Error('Playlist not found');

    const isOwner = existing.owner?._id === userId || existing.owner === userId;
    const isCollaborator = existing.collaborators?.some((c: any) => c.id === userId);

    if (!isOwner && (!existing.isCollaborative || !isCollaborator)) {
      throw new Error('Unauthorized to modify this playlist');
    }

    const { data: currentSongs } = await supabase
      .from('playlist_songs')
      .select('position')
      .eq('playlist_id', playlistId)
      .order('position', { ascending: false })
      .limit(1);

    const nextPos = (currentSongs?.[0]?.position ?? -1) + 1;

    await supabase
      .from('playlist_songs')
      .upsert({ playlist_id: playlistId, song_id: songId, position: nextPos });

    return this.getPlaylistById(playlistId);
  }

  static async removeSongFromPlaylist(
    playlistId: string,
    userId: string,
    songId: string
  ): Promise<any> {
    const existing = await this.getPlaylistById(playlistId);
    if (!existing) throw new Error('Playlist not found');

    const isOwner = existing.owner?._id === userId || existing.owner === userId;
    const isCollaborator = existing.collaborators?.some((c: any) => c.id === userId);

    if (!isOwner && (!existing.isCollaborative || !isCollaborator)) {
      throw new Error('Unauthorized to modify this playlist');
    }

    await supabase
      .from('playlist_songs')
      .delete()
      .match({ playlist_id: playlistId, song_id: songId });

    return this.getPlaylistById(playlistId);
  }
}
