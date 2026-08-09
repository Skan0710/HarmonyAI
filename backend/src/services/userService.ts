import { User, IUser } from '../models/User.js';
import { Song } from '../models/Song.js';
import { Artist } from '../models/Artist.js';
import { Genre } from '../models/Genre.js';
import { Types } from 'mongoose';

export class UserService {
  static async getUserById(userId: string): Promise<IUser | null> {
    return User.findById(userId)
      .select('-password')
      .populate('favoriteArtists', 'name profileImage avatar verified')
      .populate('favoriteGenres', 'name slug coverImage description');
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

  // Favorite Artists Management
  static async addFavoriteArtist(userId: string, artistId: string): Promise<any[]> {
    if (!Types.ObjectId.isValid(artistId)) {
      throw new Error('Invalid artist ID');
    }

    const artistExists = await Artist.exists({ _id: artistId });
    if (!artistExists) {
      throw new Error('Artist not found');
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $addToSet: { favoriteArtists: artistId } },
      { new: true }
    ).populate('favoriteArtists', 'name profileImage avatar verified');

    return user?.favoriteArtists || [];
  }

  static async removeFavoriteArtist(userId: string, artistId: string): Promise<any[]> {
    if (!Types.ObjectId.isValid(artistId)) {
      throw new Error('Invalid artist ID');
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $pull: { favoriteArtists: artistId } },
      { new: true }
    ).populate('favoriteArtists', 'name profileImage avatar verified');

    return user?.favoriteArtists || [];
  }

  // Favorite Genres Management
  static async addFavoriteGenre(userId: string, genreId: string): Promise<any[]> {
    if (!Types.ObjectId.isValid(genreId)) {
      throw new Error('Invalid genre ID');
    }

    const genreExists = await Genre.exists({ _id: genreId });
    if (!genreExists) {
      throw new Error('Genre not found');
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $addToSet: { favoriteGenres: genreId } },
      { new: true }
    ).populate('favoriteGenres', 'name slug coverImage description');

    return user?.favoriteGenres || [];
  }

  static async removeFavoriteGenre(userId: string, genreId: string): Promise<any[]> {
    if (!Types.ObjectId.isValid(genreId)) {
      throw new Error('Invalid genre ID');
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $pull: { favoriteGenres: genreId } },
      { new: true }
    ).populate('favoriteGenres', 'name slug coverImage description');

    return user?.favoriteGenres || [];
  }

  static async getUserPreferences(userId: string): Promise<any> {
    const user = await User.findById(userId)
      .select('favoriteArtists favoriteGenres')
      .populate('favoriteArtists', 'name profileImage avatar verified')
      .populate('favoriteGenres', 'name slug coverImage description');

    if (!user) {
      throw new Error('User not found');
    }

    return {
      favoriteArtists: user.favoriteArtists || [],
      favoriteGenres: user.favoriteGenres || [],
    };
  }
}
