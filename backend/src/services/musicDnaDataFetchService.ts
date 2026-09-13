import { supabase } from '../config/supabase.js';
import { mapSongRow } from './songService.js';

/**
 * Shared Supabase fetch for all Music DNA raw inputs.
 *
 * `musicDnaProfilingService.ts`, `musicDnaExtractionService.ts`, and
 * `musicDnaBehaviorProfilingService.ts` previously each ran their own
 * near-identical query for the user's liked songs / favorite genres /
 * favorite artists / listening history (the first two), with
 * `musicDnaBehaviorProfilingService.ts` additionally fetching recent
 * listening sessions and recommendation interactions. This module
 * consolidates that into a single fetch so the three services stay in sync
 * and there is exactly one place that knows how to join these tables.
 *
 * The extraction/profiling services only use `{ userId, user, history }`
 * (structurally compatible with `ExtractionRawInputs`); the behavior
 * profiling service additionally uses `sessions` and `feedback`
 * (compatible with `BehaviorProfilingRawInputs`). Types are intentionally
 * not imported from those service files here to avoid a circular import —
 * the shapes below are kept in sync with `RawUserData` / `RawHistoryRecord`
 * (musicDnaExtractionService.ts) and `RawSessionInput` / `RawFeedbackInput`
 * (musicDnaBehaviorProfilingService.ts).
 */

export interface MusicDnaFetchOptions {
  referenceDate?: Date;
  sessionLimit?: number;
  interactionLimit?: number;
}

export interface MusicDnaRawFetchResult {
  userId: string;
  user: {
    _id: string;
    likedSongs: any[];
    favoriteGenres: { _id: string; name: string }[];
    favoriteArtists: { _id: string; name: string }[];
  };
  history: {
    song: any | null;
    playedAt?: Date;
    completed?: boolean;
    skipped?: boolean;
    progressPercent?: number;
  }[];
  sessions: {
    _id?: string;
    startTime: Date;
    endTime?: Date;
    songsPlayed?: any[];
    tracksPlayed?: any[];
    tracksSkipped?: any[];
    tracksCompleted?: any[];
  }[];
  feedback: {
    action: string;
    explanationFeedback?: string;
    timestamp?: Date;
  }[];
  referenceDate?: Date;
}

/**
 * Fetches the user's liked songs (with genre/artist), favorite genres,
 * favorite artists, listening history (with genre/artist), recent listening
 * sessions, and recent recommendation interactions — everything the Music
 * DNA extraction / profiling / behavior-profiling pure functions need.
 */
export async function fetchMusicDnaRawInputs(
  userId: string,
  options: MusicDnaFetchOptions = {}
): Promise<MusicDnaRawFetchResult> {
  const sessionLimit = options.sessionLimit ?? 50;
  const interactionLimit = options.interactionLimit ?? 100;

  const [likedRowsRes, favGenresRes, favArtistsRes, historyRowsRes, sessionsRes, interactionsRes] =
    await Promise.all([
      supabase
        .from('user_liked_songs')
        .select('song_id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('user_favorite_genres')
        .select('genres(id, name)')
        .eq('user_id', userId),
      supabase
        .from('user_favorite_artists')
        .select('artists(id, name)')
        .eq('user_id', userId),
      supabase
        .from('listening_history')
        .select('song_id, played_at, completed, skipped, progress_percent')
        .eq('user_id', userId)
        .order('played_at', { ascending: false }),
      supabase
        .from('listening_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('session_start', { ascending: false })
        .limit(sessionLimit),
      supabase
        .from('recommendation_interactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(interactionLimit),
    ]);

  const likedRows = likedRowsRes.data || [];
  const historyRows = historyRowsRes.data || [];

  const allSongIds = Array.from(
    new Set([
      ...likedRows.map((r: any) => r.song_id),
      ...historyRows.map((r: any) => r.song_id),
    ].filter(Boolean))
  );

  const songMap = new Map<string, any>();
  if (allSongIds.length > 0) {
    const { data: songsData } = await supabase
      .from('songs')
      .select('*, artists!songs_artist_id_fkey(*), albums!songs_album_id_fkey(*), genres!songs_genre_id_fkey(*)')
      .in('id', allSongIds);
    if (songsData) {
      for (const s of songsData) {
        songMap.set(s.id, mapSongRow(s));
      }
    }
  }

  const likedSongs = likedRows
    .map((row: any) => songMap.get(row.song_id))
    .filter(Boolean);

  const favoriteGenres = ((favGenresRes.data || []) as any[])
    .map((row) => (row.genres ? { _id: row.genres.id, name: row.genres.name } : null))
    .filter((v): v is { _id: string; name: string } => Boolean(v));

  const favoriteArtists = ((favArtistsRes.data || []) as any[])
    .map((row) => (row.artists ? { _id: row.artists.id, name: row.artists.name } : null))
    .filter((v): v is { _id: string; name: string } => Boolean(v));

  const history = historyRows.map((row: any) => ({
    song: songMap.get(row.song_id) || null,
    playedAt: row.played_at ? new Date(row.played_at) : undefined,
    completed: row.completed ?? undefined,
    skipped: row.skipped ?? undefined,
    progressPercent: row.progress_percent ?? undefined,
  }));

  const sessions = ((sessionsRes.data || []) as any[]).map((row) => ({
    _id: row.id as string,
    startTime: row.session_start ? new Date(row.session_start) : new Date(row.created_at || Date.now()),
    endTime: row.session_end ? new Date(row.session_end) : undefined,
    songsPlayed: Array.isArray(row.tracks_played) ? row.tracks_played : [],
    tracksPlayed: Array.isArray(row.tracks_played) ? row.tracks_played : [],
    tracksSkipped: Array.isArray(row.tracks_skipped) ? row.tracks_skipped : [],
    tracksCompleted: Array.isArray(row.tracks_completed) ? row.tracks_completed : [],
  }));

  const feedback = ((interactionsRes.data || []) as any[]).map((row) => ({
    action: row.action as string,
    explanationFeedback: (row.metadata as any)?.explanationFeedback,
    timestamp: row.created_at ? new Date(row.created_at) : undefined,
  }));

  return {
    userId,
    user: {
      _id: userId,
      likedSongs,
      favoriteGenres,
      favoriteArtists,
    },
    history,
    sessions,
    feedback,
    referenceDate: options.referenceDate,
  };
}

export default fetchMusicDnaRawInputs;
