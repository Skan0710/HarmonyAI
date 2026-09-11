import { supabase } from '../config/supabase.js';

export class HistoryService {
  static async recordPlayback(userId: string, songId: string): Promise<any> {
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

    if (recentRecord) {
      const { data: updated } = await supabase
        .from('listening_history')
        .update({ played_at: now })
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
        completed: true,
        skipped: false,
        progress_percent: 100,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to record playback: ${error.message}`);
    return created;
  }

  static async getListeningHistory(userId: string, limit: number = 50): Promise<any[]> {
    const { data: history, error } = await supabase
      .from('listening_history')
      .select('*, songs(*, artists(*), albums(*), genres(*))')
      .eq('user_id', userId)
      .order('played_at', { ascending: false })
      .limit(limit);

    if (error || !history) return [];

    return history.map((h: any) => {
      const s = h.songs;
      return {
        _id: h.id,
        id: h.id,
        playedAt: h.played_at,
        completed: h.completed,
        skipped: h.skipped,
        progressPercent: h.progress_percent,
        song: s ? {
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
        } : null,
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
