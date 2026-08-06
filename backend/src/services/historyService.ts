import { ListeningHistory } from '../models/ListeningHistory.js';
import { Song } from '../models/Song.js';
import { Types } from 'mongoose';

export class HistoryService {
  /**
   * Records a playback event for a user.
   * If the same song was recorded within the last 60 seconds, updates the timestamp
   * to avoid duplicate clutter while keeping accurate playback history.
   */
  static async recordPlayback(userId: string, songId: string): Promise<any> {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(songId)) {
      throw new Error('Invalid user or song ID');
    }

    const songExists = await Song.exists({ _id: songId });
    if (!songExists) {
      throw new Error('Song not found');
    }

    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

    const recentRecord = await ListeningHistory.findOne({
      user: userId,
      song: songId,
      playedAt: { $gte: oneMinuteAgo },
    });

    if (recentRecord) {
      recentRecord.playedAt = new Date();
      return recentRecord.save();
    }

    return ListeningHistory.create({
      user: userId,
      song: songId,
      playedAt: new Date(),
    });
  }

  /**
   * Fetches full chronological listening history sorted newest first.
   */
  static async getListeningHistory(userId: string, limit: number = 50): Promise<any[]> {
    return ListeningHistory.find({ user: userId })
      .sort({ playedAt: -1 })
      .limit(limit)
      .populate({
        path: 'song',
        populate: [
          { path: 'artist', select: 'name profileImage avatar verified' },
          { path: 'album', select: 'title coverImage releaseYear' },
          { path: 'genre', select: 'name slug' },
        ],
      })
      .lean();
  }

  /**
   * Fetches distinct recently played songs for a user.
   */
  static async getRecentlyPlayed(userId: string, limit: number = 20): Promise<any[]> {
    const userObjectId = new Types.ObjectId(userId);

    const aggregated = await ListeningHistory.aggregate([
      { $match: { user: userObjectId } },
      { $sort: { playedAt: -1 } },
      {
        $group: {
          _id: '$song',
          lastPlayedAt: { $first: '$playedAt' },
          historyId: { $first: '$_id' },
        },
      },
      { $sort: { lastPlayedAt: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'songs',
          localField: '_id',
          foreignField: '_id',
          as: 'song',
        },
      },
      { $unwind: '$song' },
      {
        $lookup: {
          from: 'artists',
          localField: 'song.artist',
          foreignField: '_id',
          as: 'song.artist',
        },
      },
      {
        $unwind: {
          path: '$song.artist',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'albums',
          localField: 'song.album',
          foreignField: '_id',
          as: 'song.album',
        },
      },
      {
        $unwind: {
          path: '$song.album',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'genres',
          localField: 'song.genre',
          foreignField: '_id',
          as: 'song.genre',
        },
      },
      {
        $unwind: {
          path: '$song.genre',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: '$song._id',
          title: '$song.title',
          audioUrl: '$song.audioUrl',
          coverImage: '$song.coverImage',
          duration: '$song.duration',
          releaseYear: '$song.releaseYear',
          playCount: '$song.playCount',
          tags: '$song.tags',
          artist: '$song.artist',
          album: '$song.album',
          genre: '$song.genre',
          lastPlayedAt: 1,
        },
      },
    ]);

    return aggregated;
  }
}
