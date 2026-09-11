import { supabase } from '../config/supabase.js';
import { mapSongRow } from './songService.js';

export interface TrendingSongResult {
  song: any;
  trendingScore: number;
  recentPlaysCount: number;
}

export class TrendingService {
  /**
   * Calculates dynamic trending score based on play recency and play counts from Supabase.
   */
  static async getTrendingSongs(
    limit = 10,
    windowHours = 168,
    halfLifeHours = 24
  ): Promise<any[]> {
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - windowHours * 60 * 60 * 1000);
    const lambda = Math.LN2 / halfLifeHours;

    // 1. Fetch recent history records from Supabase
    const { data: recentHistory } = await supabase
      .from('listening_history')
      .select('song_id, played_at')
      .gte('played_at', cutoffDate.toISOString());

    const songScores = new Map<string, { score: number; count: number }>();

    // 2. Compute time-decay recency weights for recent plays
    if (Array.isArray(recentHistory)) {
      for (const record of recentHistory) {
        if (!record.song_id) continue;
        const songId = record.song_id;
        const ageInHours = (now.getTime() - new Date(record.played_at).getTime()) / (1000 * 60 * 60);

        const recencyWeight = Math.exp(-lambda * Math.max(0, ageInHours));

        if (songScores.has(songId)) {
          const existing = songScores.get(songId)!;
          existing.score += recencyWeight;
          existing.count += 1;
        } else {
          songScores.set(songId, { score: recencyWeight, count: 1 });
        }
      }
    }

    // 3. Fetch candidate songs from Supabase
    const candidateLimit = Math.max(limit * 5, 50);
    const { data: songsRaw } = await supabase
      .from('songs')
      .select('*, artists!songs_artist_id_fkey(*), albums!songs_album_id_fkey(*), genres!songs_genre_id_fkey(*)')
      .eq('is_published', true)
      .order('play_count', { ascending: false })
      .limit(candidateLimit);

    const allSongs = (songsRaw || []).map(mapSongRow);

    // 4. Calculate final score combining recency score and overall playCount
    const scoredSongs = allSongs.map((song: any) => {
      const songId = song.id || song._id;
      const historyStats = songScores.get(songId);

      const recentScore = historyStats ? historyStats.score : 0;
      const recentCount = historyStats ? historyStats.count : 0;
      const catalogPlayCount = song.playCount || 0;

      const totalTrendingScore = Number((recentScore * 10 + catalogPlayCount * 0.2).toFixed(2));

      return {
        ...song,
        trendingScore: totalTrendingScore,
        recentPlaysCount: recentCount,
      };
    });

    // 5. Sort descending by trending score
    scoredSongs.sort((a: any, b: any) => b.trendingScore - a.trendingScore);

    return scoredSongs.slice(0, Math.max(1, limit));
  }
}
