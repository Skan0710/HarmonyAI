import { Types } from 'mongoose';
import { ListeningHistory } from '../models/ListeningHistory.js';
import { User } from '../models/User.js';

export interface GenreStat {
  genre: {
    _id: string;
    name: string;
    slug?: string;
    coverImage?: string;
  };
  playCount: number;
  percentage: number;
}

export interface ArtistStat {
  artist: {
    _id: string;
    name: string;
    profileImage?: string;
    avatar?: string;
    verified?: boolean;
  };
  playCount: number;
}

export interface SongStat {
  song: any;
  playCount: number;
}

export interface UserListeningProfile {
  totalPlays: number;
  totalListeningTimeSecs: number;
  totalLikedSongs: number;
  topGenres: GenreStat[];
  topArtists: ArtistStat[];
  frequentlyPlayedSongs: SongStat[];
}

export class ListeningProfileService {
  static async getUserListeningProfile(userId: string): Promise<UserListeningProfile> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }

    const userObjectId = new Types.ObjectId(userId);

    // 1. Fetch Listening History with full population
    const historyEntries = await ListeningHistory.find({ user: userObjectId })
      .populate({
        path: 'song',
        populate: [
          { path: 'artist', select: 'name profileImage avatar verified' },
          { path: 'album', select: 'title coverImage releaseYear' },
          { path: 'genre', select: 'name slug coverImage' },
        ],
      })
      .sort({ playedAt: -1 })
      .lean();

    // 2. Fetch User Liked Songs
    const userDoc = await User.findById(userObjectId)
      .populate({
        path: 'likedSongs',
        populate: [
          { path: 'artist', select: 'name profileImage avatar verified' },
          { path: 'album', select: 'title coverImage releaseYear' },
          { path: 'genre', select: 'name slug coverImage' },
        ],
      })
      .lean();

    const likedSongs = userDoc?.likedSongs || [];

    // 3. Basic Listening Statistics
    const totalPlays = historyEntries.length;
    let totalListeningTimeSecs = 0;

    const songPlayMap = new Map<string, { song: any; count: number }>();
    const artistPlayMap = new Map<string, { artist: any; count: number }>();
    const genrePlayMap = new Map<string, { genre: any; count: number }>();

    // Process history entries
    for (const entry of historyEntries) {
      const song = entry.song as any;
      if (!song || !_idToStr(song._id)) continue;

      totalListeningTimeSecs += song.duration || 0;

      // Track Frequently Played Songs
      const songId = _idToStr(song._id);
      if (songPlayMap.has(songId)) {
        songPlayMap.get(songId)!.count += 1;
      } else {
        songPlayMap.set(songId, { song, count: 1 });
      }

      // Track Artist Stats
      if (song.artist && typeof song.artist === 'object' && song.artist._id) {
        const artistId = _idToStr(song.artist._id);
        if (artistPlayMap.has(artistId)) {
          artistPlayMap.get(artistId)!.count += 1;
        } else {
          artistPlayMap.set(artistId, { artist: song.artist, count: 1 });
        }
      }

      // Track Genre Stats
      if (song.genre && typeof song.genre === 'object' && song.genre._id) {
        const genreId = _idToStr(song.genre._id);
        if (genrePlayMap.has(genreId)) {
          genrePlayMap.get(genreId)!.count += 1;
        } else {
          genrePlayMap.set(genreId, { genre: song.genre, count: 1 });
        }
      }
    }

    // Process liked songs to give additional weight to user preferences
    for (const song of likedSongs as any[]) {
      if (!song || !_idToStr(song._id)) continue;

      // Add artist weight from liked songs
      if (song.artist && typeof song.artist === 'object' && song.artist._id) {
        const artistId = _idToStr(song.artist._id);
        if (artistPlayMap.has(artistId)) {
          artistPlayMap.get(artistId)!.count += 1;
        } else {
          artistPlayMap.set(artistId, { artist: song.artist, count: 1 });
        }
      }

      // Add genre weight from liked songs
      if (song.genre && typeof song.genre === 'object' && song.genre._id) {
        const genreId = _idToStr(song.genre._id);
        if (genrePlayMap.has(genreId)) {
          genrePlayMap.get(genreId)!.count += 1;
        } else {
          genrePlayMap.set(genreId, { genre: song.genre, count: 1 });
        }
      }
    }

    // 4. Calculate Top Genres with Percentages
    const genreArray = Array.from(genrePlayMap.values());
    const totalGenreOccurrences = genreArray.reduce((acc, curr) => acc + curr.count, 0);

    const topGenres: GenreStat[] = genreArray
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((item) => ({
        genre: {
          _id: _idToStr(item.genre._id),
          name: item.genre.name || 'Unknown',
          slug: item.genre.slug,
          coverImage: item.genre.coverImage,
        },
        playCount: item.count,
        percentage: totalGenreOccurrences > 0 ? Math.round((item.count / totalGenreOccurrences) * 100) : 0,
      }));

    // 5. Calculate Top Artists
    const topArtists: ArtistStat[] = Array.from(artistPlayMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((item) => ({
        artist: {
          _id: _idToStr(item.artist._id),
          name: item.artist.name || 'Unknown Artist',
          profileImage: item.artist.profileImage,
          avatar: item.artist.avatar,
          verified: item.artist.verified,
        },
        playCount: item.count,
      }));

    // 6. Calculate Frequently Played Songs
    const frequentlyPlayedSongs: SongStat[] = Array.from(songPlayMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((item) => ({
        song: item.song,
        playCount: item.count,
      }));

    return {
      totalPlays,
      totalListeningTimeSecs,
      totalLikedSongs: likedSongs.length,
      topGenres,
      topArtists,
      frequentlyPlayedSongs,
    };
  }
}

function _idToStr(id: any): string {
  if (!id) return '';
  return typeof id === 'object' ? id.toString() : String(id);
}
