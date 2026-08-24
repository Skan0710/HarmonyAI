import { Playlist, IPlaylist } from '../models/Playlist.js';
import { Song } from '../models/Song.js';
import { Types } from 'mongoose';

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

/**
 * Shared population config for songs inside playlists.
 * Avoids repeating the same populate chain across multiple queries.
 */
const SONG_POPULATE_OPTIONS = {
  path: 'songs',
  populate: [
    { path: 'artist', select: 'name profileImage avatar verified' },
    { path: 'album', select: 'title coverImage releaseYear' },
    { path: 'genre', select: 'name slug' },
  ],
};

export class PlaylistService {
  static async createPlaylist(ownerId: string, data: CreatePlaylistInput): Promise<IPlaylist> {
    const playlist = new Playlist({
      ...data,
      owner: new Types.ObjectId(ownerId),
      songs: [],
    });

    return playlist.save();
  }

  static async getUserPlaylists(userId: string): Promise<any[]> {
    const userObjectId = new Types.ObjectId(userId);

    return Playlist.find({
      $or: [{ owner: userObjectId }, { collaborators: userObjectId }],
    })
      .populate('owner', 'name profilePicture')
      .populate(SONG_POPULATE_OPTIONS)
      .sort({ updatedAt: -1 })
      .lean();
  }

  static async getPlaylistById(playlistId: string, userId?: string): Promise<any | null> {
    if (!Types.ObjectId.isValid(playlistId)) return null;

    const playlist = await Playlist.findById(playlistId)
      .populate('owner', 'name profilePicture email')
      .populate('collaborators', 'name profilePicture')
      .populate(SONG_POPULATE_OPTIONS)
      .lean();

    if (!playlist) return null;

    // Visibility authorization check
    if (playlist.visibility === 'private') {
      const currentUserIdStr = userId?.toString();
      const isOwner = playlist.owner?._id?.toString() === currentUserIdStr;
      const isCollaborator = playlist.collaborators?.some(
        (c: any) => c._id?.toString() === currentUserIdStr
      );

      if (!isOwner && !isCollaborator) {
        throw new Error('Access denied to private playlist');
      }
    }

    return playlist;
  }

  static async updatePlaylist(
    playlistId: string,
    userId: string,
    data: UpdatePlaylistInput
  ): Promise<IPlaylist | null> {
    if (!Types.ObjectId.isValid(playlistId)) return null;

    const playlist = await Playlist.findById(playlistId);
    if (!playlist) return null;

    const isOwner = playlist.owner.toString() === userId;
    const isCollaborator = playlist.collaborators?.some((c) => c.toString() === userId);

    if (!isOwner && (!playlist.isCollaborative || !isCollaborator)) {
      throw new Error('Unauthorized to update this playlist');
    }

    Object.assign(playlist, data);
    return playlist.save();
  }

  static async deletePlaylist(playlistId: string, userId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(playlistId)) return false;

    const playlist = await Playlist.findById(playlistId);
    if (!playlist) return false;

    if (playlist.owner.toString() !== userId) {
      throw new Error('Only the playlist owner can delete it');
    }

    await Playlist.findByIdAndDelete(playlistId);
    return true;
  }

  static async addSongToPlaylist(
    playlistId: string,
    userId: string,
    songId: string
  ): Promise<any> {
    if (!Types.ObjectId.isValid(playlistId) || !Types.ObjectId.isValid(songId)) {
      throw new Error('Invalid playlist or song ID');
    }

    const songExists = await Song.exists({ _id: songId });
    if (!songExists) {
      throw new Error('Song not found');
    }

    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      throw new Error('Playlist not found');
    }

    const isOwner = playlist.owner.toString() === userId;
    const isCollaborator = playlist.collaborators?.some((c) => c.toString() === userId);

    if (!isOwner && (!playlist.isCollaborative || !isCollaborator)) {
      throw new Error('Unauthorized to modify this playlist');
    }

    // $addToSet guarantees duplicate songs are prevented atomically
    const updated = await Playlist.findByIdAndUpdate(
      playlistId,
      { $addToSet: { songs: songId } },
      { new: true }
    )
      .populate('owner', 'name profilePicture')
      .populate(SONG_POPULATE_OPTIONS)
      .lean();

    return updated;
  }

  static async removeSongFromPlaylist(
    playlistId: string,
    userId: string,
    songId: string
  ): Promise<any> {
    if (!Types.ObjectId.isValid(playlistId) || !Types.ObjectId.isValid(songId)) {
      throw new Error('Invalid playlist or song ID');
    }

    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      throw new Error('Playlist not found');
    }

    const isOwner = playlist.owner.toString() === userId;
    const isCollaborator = playlist.collaborators?.some((c) => c.toString() === userId);

    if (!isOwner && (!playlist.isCollaborative || !isCollaborator)) {
      throw new Error('Unauthorized to modify this playlist');
    }

    const updated = await Playlist.findByIdAndUpdate(
      playlistId,
      { $pull: { songs: songId } },
      { new: true }
    )
      .populate('owner', 'name profilePicture')
      .populate(SONG_POPULATE_OPTIONS)
      .lean();

    return updated;
  }
}
