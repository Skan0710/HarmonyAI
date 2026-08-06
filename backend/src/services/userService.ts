import { User, IUser } from '../models/User.js';
import { Song } from '../models/Song.js';
import { Types } from 'mongoose';

export class UserService {
  static async getUserById(userId: string): Promise<IUser | null> {
    return User.findById(userId).select('-password');
  }

  static async updateProfile(
    userId: string,
    data: { name?: string; profilePicture?: string }
  ): Promise<IUser | null> {
    return User.findByIdAndUpdate(
      userId,
      { $set: data },
      { new: true, runValidators: true }
    ).select('-password');
  }

  static async getLikedSongs(userId: string): Promise<any[]> {
    const user = await User.findById(userId).populate({
      path: 'likedSongs',
      populate: [
        { path: 'artist', select: 'name profileImage avatar verified' },
        { path: 'album', select: 'title coverImage releaseYear' },
        { path: 'genre', select: 'name slug' },
      ],
    });

    if (!user) return [];
    return user.likedSongs || [];
  }

  static async likeSong(userId: string, songId: string): Promise<string[]> {
    if (!Types.ObjectId.isValid(songId)) {
      throw new Error('Invalid song ID');
    }

    const songExists = await Song.exists({ _id: songId });
    if (!songExists) {
      throw new Error('Song not found');
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $addToSet: { likedSongs: songId } },
      { new: true }
    );

    return user?.likedSongs.map((id) => id.toString()) || [];
  }

  static async unlikeSong(userId: string, songId: string): Promise<string[]> {
    if (!Types.ObjectId.isValid(songId)) {
      throw new Error('Invalid song ID');
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $pull: { likedSongs: songId } },
      { new: true }
    );

    return user?.likedSongs.map((id) => id.toString()) || [];
  }
}
