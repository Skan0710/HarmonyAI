import { User } from '../models/User.js';
import { Song } from '../models/Song.js';
import { ListeningHistory } from '../models/ListeningHistory.js';
import {
  RecommendationInteractionService,
  InteractionWeights,
  DEFAULT_INTERACTION_WEIGHTS,
} from './recommendationInteractionService.js';

export interface MatrixEntry {
  userIndex: number;
  songIndex: number;
  score: number;
}

export class SparseInteractionMatrix {
  public userIds: string[];
  public songIds: string[];
  public userIndexMap: Map<string, number>;
  public songIndexMap: Map<string, number>;
  // Sparse storage: Map<userIndex, Map<songIndex, score>>
  public matrixData: Map<number, Map<number, number>>;

  constructor(userIds: string[], songIds: string[]) {
    this.userIds = userIds;
    this.songIds = songIds;
    this.userIndexMap = new Map();
    this.songIndexMap = new Map();
    this.matrixData = new Map();

    userIds.forEach((id, index) => this.userIndexMap.set(id, index));
    songIds.forEach((id, index) => this.songIndexMap.set(id, index));
  }

  /**
   * Sets or updates interaction score for user index and song index
   */
  public set(userIndex: number, songIndex: number, score: number): void {
    if (userIndex < 0 || userIndex >= this.userIds.length || songIndex < 0 || songIndex >= this.songIds.length) {
      return;
    }

    if (!this.matrixData.has(userIndex)) {
      this.matrixData.set(userIndex, new Map());
    }

    this.matrixData.get(userIndex)!.set(songIndex, score);
  }

  /**
   * Returns score for (userId, songId). Returns 0 if no interactions exist safely.
   */
  public getScore(userId: string, songId: string): number {
    const uIdx = this.userIndexMap.get(userId);
    const sIdx = this.songIndexMap.get(songId);

    if (uIdx === undefined || sIdx === undefined) return 0;
    return this.matrixData.get(uIdx)?.get(sIdx) ?? 0;
  }

  /**
   * Returns sparse map of songId -> score for a given user ID
   */
  public getUserRowMap(userId: string): Map<string, number> {
    const result = new Map<string, number>();
    const uIdx = this.userIndexMap.get(userId);
    if (uIdx === undefined) return result;

    const row = this.matrixData.get(uIdx);
    if (row) {
      for (const [sIdx, score] of row.entries()) {
        const songId = this.songIds[sIdx];
        if (songId) result.set(songId, score);
      }
    }

    return result;
  }

  /**
   * Returns sparse map of userId -> score for a given song ID
   */
  public getSongColumnMap(songId: string): Map<string, number> {
    const result = new Map<string, number>();
    const sIdx = this.songIndexMap.get(songId);
    if (sIdx === undefined) return result;

    for (const [uIdx, row] of this.matrixData.entries()) {
      if (row.has(sIdx)) {
        const userId = this.userIds[uIdx];
        if (userId) result.set(userId, row.get(sIdx)!);
      }
    }

    return result;
  }

  /**
   * Returns dense array representation for a given user ID (length = total songs)
   */
  public getDenseUserRow(userId: string): number[] {
    const row = new Array<number>(this.songIds.length).fill(0);
    const uIdx = this.userIndexMap.get(userId);
    if (uIdx === undefined) return row;

    const userMap = this.matrixData.get(uIdx);
    if (userMap) {
      for (const [sIdx, score] of userMap.entries()) {
        row[sIdx] = score;
      }
    }

    return row;
  }

  /**
   * Exports non-zero entries of the matrix for external algorithms
   */
  public getEntries(): MatrixEntry[] {
    const entries: MatrixEntry[] = [];
    for (const [uIdx, row] of this.matrixData.entries()) {
      for (const [sIdx, score] of row.entries()) {
        entries.push({ userIndex: uIdx, songIndex: sIdx, score });
      }
    }
    return entries;
  }
}

export class UserSongInteractionMatrixService {
  /**
   * Builds an efficient sparse User-Song Interaction Matrix from MongoDB user activity and catalog data.
   */
  static async buildInteractionMatrix(options: {
    userIds?: string[];
    songIds?: string[];
    customWeights?: Partial<InteractionWeights>;
  } = {}): Promise<SparseInteractionMatrix> {
    const weights = {
      ...RecommendationInteractionService.getWeights(),
      ...options.customWeights,
    };

    // 1. Fetch user IDs and song IDs if not explicitly provided
    let userIds = options.userIds;
    if (!userIds || userIds.length === 0) {
      const users = await User.find({}).select('_id').lean();
      userIds = users.map((u) => u._id.toString());
    }

    let songIds = options.songIds;
    if (!songIds || songIds.length === 0) {
      const songs = await Song.find({}).select('_id').lean();
      songIds = songs.map((s) => s._id.toString());
    }

    const sparseMatrix = new SparseInteractionMatrix(userIds, songIds);

    // 2. Fetch User Liked Songs in bulk
    const usersWithLikes = await User.find({ _id: { $in: userIds } })
      .select('_id likedSongs')
      .lean();

    // Intermediate tracking map: userIndex -> Map<songIndex, { count, isLiked, completed, partial, skips }>
    const rawAggregates = new Map<
      number,
      Map<number, { count: number; isLiked: boolean; completed: number; partial: number; skips: number }>
    >();

    const getOrCreateAgg = (uIdx: number, sIdx: number) => {
      if (!rawAggregates.has(uIdx)) {
        rawAggregates.set(uIdx, new Map());
      }
      const uMap = rawAggregates.get(uIdx)!;
      if (!uMap.has(sIdx)) {
        uMap.set(sIdx, { count: 0, isLiked: false, completed: 0, partial: 0, skips: 0 });
      }
      return uMap.get(sIdx)!;
    };

    // Process liked songs
    for (const uDoc of usersWithLikes) {
      const uIdx = sparseMatrix.userIndexMap.get(uDoc._id.toString());
      if (uIdx === undefined) continue;

      for (const songObjId of uDoc.likedSongs || []) {
        const sIdx = sparseMatrix.songIndexMap.get(songObjId.toString());
        if (sIdx !== undefined) {
          const agg = getOrCreateAgg(uIdx, sIdx);
          agg.isLiked = true;
        }
      }
    }

    // 3. Fetch Listening History in bulk
    const historyRecords = await ListeningHistory.find({ user: { $in: userIds } })
      .select('user song completed skipped progressPercent')
      .lean();

    for (const record of historyRecords) {
      if (!record.user || !record.song) continue;
      const uIdx = sparseMatrix.userIndexMap.get(record.user.toString());
      const sIdx = sparseMatrix.songIndexMap.get(record.song.toString());

      if (uIdx !== undefined && sIdx !== undefined) {
        const agg = getOrCreateAgg(uIdx, sIdx);
        agg.count += 1;

        if (record.skipped) {
          agg.skips += 1;
        } else if (record.completed !== false && (record.progressPercent === undefined || record.progressPercent >= 80)) {
          agg.completed += 1;
        } else {
          agg.partial += 1;
        }
      }
    }

    // 4. Compute final weighted interaction score per (userIndex, songIndex)
    for (const [uIdx, uMap] of rawAggregates.entries()) {
      for (const [sIdx, agg] of uMap.entries()) {
        let score = 0;

        if (agg.isLiked) {
          score += weights.LIKE;
        }

        score += agg.completed * weights.COMPLETED_PLAYBACK;
        score += agg.partial * weights.PARTIAL_PLAYBACK;
        score += agg.skips * weights.SKIP;

        if (agg.count > 1) {
          score += (agg.count - 1) * weights.REPEATED_PLAYBACK;
        }

        if (score !== 0) {
          sparseMatrix.set(uIdx, sIdx, score);
        }
      }
    }

    return sparseMatrix;
  }
}
