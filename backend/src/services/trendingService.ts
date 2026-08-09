import { ListeningHistory } from '../models/ListeningHistory.js';
import { Song } from '../models/Song.js';

export interface TrendingSongResult {
  song: any;
  trendingScore: number;
  recentPlaysCount: number;
}

export class TrendingService {
  /**
   * Calculates dynamic trending score based on play recency and play counts.
   * Uses exponential time decay scoring: score = sum(exp(-lambda * ageInHours)) + 0.05 * totalPlayCount
   * 
   * @param limit Number of top trending songs to return (default 10)
   * @param windowHours Time window in hours to consider for recent activity (default 168h = 7 days)
   * @param halfLifeHours Half-life decay in hours (default 24h)
   */
  static async getTrendingSongs(
    limit = 10,
    windowHours = 168,
    halfLifeHours = 24
  ): Promise<any[]> {
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - windowHours * 60 * 60 * 1000);
    const lambda = Math.LN2 / halfLifeHours;

    // 1. Fetch recent history records within the window
    const recentHistory = await ListeningHistory.find({
      playedAt: { $gte: cutoffDate },
    })
      .select('song playedAt')
      .lean();

    const songScores = new Map<string, { score: number; count: number }>();

    // 2. Compute time-decay recency weights for recent plays
    for (const record of recentHistory) {
      if (!record.song) continue;
      const songId = record.song.toString();
      const ageInHours = (now.getTime() - new Date(record.playedAt).getTime()) / (1000 * 60 * 60);

      // Exponential decay weight: 1.0 for now, 0.5 for 24h ago, 0.25 for 48h ago
      const recencyWeight = Math.exp(-lambda * Math.max(0, ageInHours));

      if (songScores.has(songId)) {
        const existing = songScores.get(songId)!;
        existing.score += recencyWeight;
        existing.count += 1;
      } else {
        songScores.set(songId, { score: recencyWeight, count: 1 });
      }
    }

    // 3. Fetch all catalog songs to ensure full catalog coverage
    const allSongs = await Song.find({})
      .populate('artist', 'name profileImage avatar verified')
      .populate('album', 'title coverImage releaseYear')
      .populate('genre', 'name slug')
      .lean();

    // 4. Calculate final score combining recency score and overall playCount
    const scoredSongs = allSongs.map((song) => {
      const songId = song._id.toString();
      const historyStats = songScores.get(songId);

      const recentScore = historyStats ? historyStats.score : 0;
      const recentCount = historyStats ? historyStats.count : 0;
      const catalogPlayCount = song.playCount || 0;

      // Final Trending Score Formula
      const totalTrendingScore = Number((recentScore * 10 + catalogPlayCount * 0.2).toFixed(2));

      return {
        ...song,
        trendingScore: totalTrendingScore,
        recentPlaysCount: recentCount,
      };
    });

    // 5. Sort descending by trending score
    scoredSongs.sort((a, b) => b.trendingScore - a.trendingScore);

    return scoredSongs.slice(0, limit);
  }
}
