import { supabase } from '../config/supabase.js';
import { isValidObjectId } from '../utils/validators.js';
import { mapSongRow } from './songService.js';

import { UserService } from './userService.js';

export interface ColdStartRecommendationParams {
  userId?: string;
  limit?: number;
  excludeSongIds?: string[];
}

export interface ColdStartRecommendationResult {
  songs: any[];
  strategy: 'COLD_START';
  classification: string;
  candidateSources: string[];
}

export class ColdStartRecommendationService {
  /**
   * Generates high-quality recommendations for NEW, LIMITED_DATA, and ANONYMOUS users by pooling popular,
   * trending, and new-release songs from Supabase while enforcing artist/genre diversity.
   */
  static async getColdStartRecommendations(
    params: ColdStartRecommendationParams
  ): Promise<ColdStartRecommendationResult> {
    const { userId, limit = 10, excludeSongIds = [] } = params;

    let favoriteGenreIds = new Set<string>();
    let favoriteArtistIds = new Set<string>();
    let userLikedSongIds = new Set<string>();
    let historySongIds = new Set<string>();
    let classification = 'NEW';

    // 1. If valid authenticated user ID is provided, query user taste signals from Supabase
    if (userId && isValidObjectId(userId)) {
      try {
        const user = await UserService.getUserById(userId);
        if (user) {
          if (Array.isArray(user.favoriteGenres)) {
            user.favoriteGenres.forEach((g: any) => favoriteGenreIds.add(String(g.id || g._id || g)));
          }
          if (Array.isArray(user.favoriteArtists)) {
            user.favoriteArtists.forEach((a: any) => favoriteArtistIds.add(String(a.id || a._id || a)));
          }
        }

        const { data: historyDocs } = await supabase
          .from('listening_history')
          .select('song_id')
          .eq('user_id', userId)
          .limit(100);

        if (Array.isArray(historyDocs)) {
          historyDocs.forEach((h: any) => {
            if (h.song_id) historySongIds.add(String(h.song_id));
          });
          if (historyDocs.length > 5) {
            classification = 'LIMITED_DATA';
          }
        }
      } catch (err: any) {
        console.warn('[ColdStartRecommendationService] Non-critical user signal fetch failure:', err.message);
      }
    }

    const fullExcludeSet = new Set<string>([
      ...userLikedSongIds,
      ...historySongIds,
      ...excludeSongIds,
    ]);

    // 2. Concurrently fetch candidate pools from Supabase
    const [popularRes, newReleasesRes] = await Promise.all([
      supabase
        .from('songs')
        .select('*, artists!songs_artist_id_fkey(*), albums!songs_album_id_fkey(*), genres!songs_genre_id_fkey(*)')
        .eq('is_published', true)
        .order('play_count', { ascending: false })
        .limit(30),

      supabase
        .from('songs')
        .select('*, artists!songs_artist_id_fkey(*), albums!songs_album_id_fkey(*), genres!songs_genre_id_fkey(*)')
        .eq('is_published', true)
        .order('release_year', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(30),
    ]);

    const popularCandidates = (popularRes.data || []).map(mapSongRow);
    const newReleaseCandidates = (newReleasesRes.data || []).map(mapSongRow);

    // 3. Score and rank candidate songs
    const candidateMap = new Map<string, { song: any; score: number; sources: Set<string> }>();

    const addOrUpdateCandidate = (songDoc: any, baseScore: number, sourceTag: string) => {
      if (!songDoc) return;
      const sId = String(songDoc.id || songDoc._id);
      if (fullExcludeSet.has(sId)) return;

      if (!candidateMap.has(sId)) {
        candidateMap.set(sId, {
          song: songDoc,
          score: baseScore,
          sources: new Set([sourceTag]),
        });
      } else {
        const item = candidateMap.get(sId)!;
        item.score += baseScore * 0.5;
        item.sources.add(sourceTag);
      }
    };

    popularCandidates.forEach((s: any, idx: number) => {
      const rankDecay = Math.max(0, 1 - idx * 0.02);
      addOrUpdateCandidate(s, 1.0 * rankDecay, 'popular');
    });

    newReleaseCandidates.forEach((s: any, idx: number) => {
      const rankDecay = Math.max(0, 1 - idx * 0.02);
      addOrUpdateCandidate(s, 0.85 * rankDecay, 'new_releases');
    });

    // 4. Fallback if exclusions cleared everything
    if (candidateMap.size === 0) {
      popularCandidates.forEach((s: any) => addOrUpdateCandidate(s, 0.5, 'popular_fallback'));
    }

    const rankedList = Array.from(candidateMap.values()).sort((a, b) => b.score - a.score);

    // 5. Apply artist and genre diversity caps (max 2 songs per artist)
    const selectedSongs: any[] = [];
    const artistCounts = new Map<string, number>();
    const allCandidateSources = new Set<string>();

    for (const item of rankedList) {
      if (selectedSongs.length >= limit) break;

      const artistKey = item.song.artist?.id || item.song.artist?._id || item.song.artist || 'unknown';
      const currentCount = artistCounts.get(artistKey) || 0;

      if (currentCount < 2) {
        selectedSongs.push(item.song);
        artistCounts.set(artistKey, currentCount + 1);
        item.sources.forEach((src) => allCandidateSources.add(src));
      }
    }

    // Fill remaining up to limit if diversity filters were too strict
    if (selectedSongs.length < limit) {
      const currentSelectedIds = new Set(selectedSongs.map((s) => String(s.id || s._id)));
      for (const item of rankedList) {
        if (selectedSongs.length >= limit) break;
        const sId = String(item.song.id || item.song._id);
        if (!currentSelectedIds.has(sId)) {
          selectedSongs.push(item.song);
          currentSelectedIds.add(sId);
          item.sources.forEach((src) => allCandidateSources.add(src));
        }
      }
    }

    return {
      songs: selectedSongs,
      strategy: 'COLD_START',
      classification,
      candidateSources: Array.from(allCandidateSources),
    };
  }
}
