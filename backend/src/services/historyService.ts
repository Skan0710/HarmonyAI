import { supabase } from '../config/supabase.js';
import { mapSongRow } from './songService.js';

export class HistoryService {
  static async recordPlayback(
    userId: string,
    songId: string,
    details?: { completed?: boolean; skipped?: boolean; progressPercent?: number }
  ): Promise<any> {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();

    const { data: recentRecord } = await supabase
      .from('listening_history')
      .select('*')
      .eq('user_id', userId)
      .eq('song_id', songId)
      .gte('played_at', oneMinuteAgo)
      .order('played_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const now = new Date().toISOString();
    const completed = details?.completed ?? true;
    const skipped = details?.skipped ?? false;
    const progressPercent = details?.progressPercent ?? (completed ? 100 : 50);

    if (recentRecord) {
      const { data: updated } = await supabase
        .from('listening_history')
        .update({
          played_at: now,
          completed: recentRecord.completed || completed,
          skipped: skipped,
          progress_percent: Math.max(Number(recentRecord.progress_percent || 0), progressPercent),
        })
        .eq('id', recentRecord.id)
        .select()
        .single();
      return updated;
    }

    const { data: created, error } = await supabase
      .from('listening_history')
      .insert({
        user_id: userId,
        song_id: songId,
        played_at: now,
        completed,
        skipped,
        progress_percent: progressPercent,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to record playback: ${error.message}`);
    return created;
  }

  static async getListeningHistory(userId: string, limit: number = 50): Promise<any[]> {
    const { data: history, error } = await supabase
      .from('listening_history')
      .select('*')
      .eq('user_id', userId)
      .order('played_at', { ascending: false })
      .limit(limit);

    if (error || !history || history.length === 0) return [];

    const songIds = Array.from(new Set(history.map((h: any) => h.song_id).filter(Boolean)));
    const { data: songs, error: songsErr } = await supabase
      .from('songs')
      .select('*, artists!songs_artist_id_fkey(*), albums!songs_album_id_fkey(*), genres!songs_genre_id_fkey(*)')
      .in('id', songIds);

    const songMap = new Map();
    if (!songsErr && songs) {
      for (const s of songs) {
        songMap.set(s.id, mapSongRow(s));
      }
    }

    return history.map((h: any) => {
      const s = songMap.get(h.song_id) || null;
      return {
        _id: h.id,
        id: h.id,
        playedAt: h.played_at,
        completed: h.completed,
        skipped: h.skipped,
        progressPercent: h.progress_percent,
        song: s,
      };
    });
  }

  static async getRecentlyPlayed(userId: string, limit: number = 20): Promise<any[]> {
    const history = await this.getListeningHistory(userId, limit * 2);
    const seenSongs = new Set<string>();
    const uniqueRecent: any[] = [];

    for (const entry of history) {
      if (!entry.song || seenSongs.has(entry.song.id)) continue;
      seenSongs.add(entry.song.id);
      uniqueRecent.push({
        ...entry.song,
        lastPlayedAt: entry.playedAt,
      });
      if (uniqueRecent.length >= limit) break;
    }

    return uniqueRecent;
  }
}
