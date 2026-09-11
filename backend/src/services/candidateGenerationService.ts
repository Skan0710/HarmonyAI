import { supabase } from '../config/supabase.js';
import { isValidObjectId } from '../utils/validators.js';
import { mapSongRow } from './songService.js';
import { ContentRecommendationService } from './recommendationService.js';
import { CollaborativeFilteringService } from './collaborativeFilteringService.js';
import { TrendingService } from './trendingService.js';
import { UserSongInteractionMatrixService } from './interactionMatrixService.js';
import { UserTasteProfileService, UserTasteProfile } from './userTasteProfileService.js';

export interface HybridCandidate {
  songId: string;
  songDoc: any;
  contentScore: number;
  collaborativeScore: number;
  userTasteAffinityScore: number;
  popularitySignal: number;
  recencySignal: number;
  sources: string[];
}

export class CandidateGenerationService {
  /**
   * Generates a merged pool of recommendation candidates from content-based, collaborative filtering,
   * user taste profile affinities, and trending/catalog signals. Merges duplicates, preserves individual
   * component scores, and excludes songs the user has already strongly interacted with.
   */
  static async generateHybridCandidates(params: {
    userId: string;
    seedSongId?: string;
    candidateLimit?: number;
    musicDnaProfile?: any;
  }): Promise<HybridCandidate[]> {
    const { userId, seedSongId, candidateLimit = 50, musicDnaProfile } = params;

    if (!isValidObjectId(userId)) {
      throw new Error('Invalid user ID');
    }

    // 1. Identify songs target user has already strongly interacted with (to exclude)
    const { data: likedRows } = await supabase
      .from('user_liked_songs')
      .select('song_id')
      .eq('user_id', userId);
    const excludedSongIds = new Set<string>((likedRows || []).map((r) => r.song_id));

    if (seedSongId) {
      excludedSongIds.add(seedSongId);
    }

    // Include songs user interacted with in matrix
    try {
      const matrix = await UserSongInteractionMatrixService.buildInteractionMatrix();
      const targetRowMap = matrix.getUserRowMap(userId);
      for (const [sId, score] of targetRowMap.entries()) {
        if (score > 0) {
          excludedSongIds.add(sId);
        }
      }
    } catch (e) {
      // Continue safely if matrix build encounters insufficient history
    }

    // Fetch User Taste Profile to score candidate affinities
    let tasteProfile: UserTasteProfile | null = null;
    try {
      tasteProfile = await UserTasteProfileService.generateTasteProfile(userId);
    } catch (e) {
      // Fallback if user profile cannot be loaded
    }

    const candidateMap = new Map<string, HybridCandidate>();

    const mergeCandidate = (
      songDoc: any,
      source: 'content' | 'collaborative' | 'trending' | 'taste_profile' | 'music_dna',
      rawScore: number
    ) => {
      if (!songDoc || !songDoc._id) return;
      const songId = songDoc._id.toString();

      // Exclude songs the target user has already strongly interacted with
      if (excludedSongIds.has(songId)) {
        return;
      }

      let existing = candidateMap.get(songId);
      if (!existing) {
        existing = {
          songId,
          songDoc,
          contentScore: 0,
          collaborativeScore: 0,
          userTasteAffinityScore: computeSongTasteAffinity(songDoc, tasteProfile, musicDnaProfile),
          popularitySignal: songDoc.playCount || 0,
          recencySignal: calculateRecencySignal(songDoc),
          sources: [],
        };
        candidateMap.set(songId, existing);
      }

      if (!existing.sources.includes(source)) {
        existing.sources.push(source);
      }

      if (source === 'content') {
        existing.contentScore = Math.max(existing.contentScore, rawScore);
      } else if (source === 'collaborative') {
        existing.collaborativeScore = Math.max(existing.collaborativeScore, rawScore);
      } else if (source === 'trending') {
        existing.recencySignal = Math.max(existing.recencySignal, rawScore);
      } else if (source === 'music_dna') {
        existing.userTasteAffinityScore = Math.max(existing.userTasteAffinityScore, rawScore);
      }
    };

    // 2. Candidate Source 1: Content-Based Recommendations
    if (seedSongId && isValidObjectId(seedSongId)) {
      try {
        const contentResults = await ContentRecommendationService.getRecommendationsForSong(
          seedSongId,
          candidateLimit
        );
        for (const item of contentResults) {
          mergeCandidate(item, 'content', item.similarityScore || 0);
        }
      } catch (e) {
        // Safe fallback
      }
    }

    // 3. Candidate Source 2: Collaborative Filtering Recommendations
    try {
      const collabResults = await CollaborativeFilteringService.getRecommendationsForUser(
        userId,
        candidateLimit
      );
      for (const item of collabResults) {
        mergeCandidate(item, 'collaborative', item.recommendationScore || 0);
      }
    } catch (e) {
      // Safe fallback
    }

    // 4. Candidate Source 3: Trending & Catalog Popularity/Recency
    try {
      const trendingResults = await TrendingService.getTrendingSongs(candidateLimit);
      for (const item of trendingResults) {
        mergeCandidate(item, 'trending', item.trendingScore || 0);
      }
    } catch (e) {
      // Safe fallback
    }

    // 5. Candidate Source 4: Music DNA Profile Alignment (when available)
    if (musicDnaProfile) {
      try {
        const topGenres = (musicDnaProfile.genreProfile?.topGenres || musicDnaProfile.genres || [])
          .map((g: any) => g.name || '')
          .filter(Boolean);
        const topArtists = (musicDnaProfile.artistProfile?.strongestArtists || musicDnaProfile.artists || [])
          .map((a: any) => a.name || '')
          .filter(Boolean);

        const genreIds: string[] = [];
        const artistIds: string[] = [];

        // Case-insensitive EXACT name match (equivalent to the old ^name$ /i RegExp $in).
        // ilike with no wildcards performs an exact case-insensitive comparison, so an
        // .or() of `name.ilike.<value>` clauses reproduces the regex-$in match.
        if (topGenres.length > 0) {
          const orFilter = topGenres
            .slice(0, 3)
            .map((n: string) => `name.ilike.${n}`)
            .join(',');
          const { data: matchedGenreDocs } = await supabase.from('genres').select('id').or(orFilter);
          genreIds.push(...(matchedGenreDocs || []).map((g) => g.id));
        }

        if (topArtists.length > 0) {
          const orFilter = topArtists
            .slice(0, 3)
            .map((n: string) => `name.ilike.${n}`)
            .join(',');
          const { data: matchedArtistDocs } = await supabase.from('artists').select('id').or(orFilter);
          artistIds.push(...(matchedArtistDocs || []).map((a) => a.id));
        }

        const orParts: string[] = [];
        if (genreIds.length > 0) {
          orParts.push(`genre_id.in.(${genreIds.join(',')})`);
        }
        if (artistIds.length > 0) {
          orParts.push(`artist_id.in.(${artistIds.join(',')})`);
        }

        if (orParts.length > 0) {
          const dnaLimit = Math.min(candidateLimit, 15);
          const { data: dnaSongRows } = await supabase
            .from('songs')
            .select('*, artists!songs_artist_id_fkey(*), albums!songs_album_id_fkey(*), genres!songs_genre_id_fkey(*)')
            .eq('is_published', true)
            .or(orParts.join(','))
            .order('play_count', { ascending: false })
            .limit(dnaLimit);

          for (const song of (dnaSongRows || []).map(mapSongRow)) {
            mergeCandidate(song, 'music_dna', 0.85);
          }
        }
      } catch (e) {
        // Safe fallback
      }
    }

    // 6. Catalog Fallback if candidate pool is small
    if (candidateMap.size < candidateLimit) {
      const { data: catalogSongRows } = await supabase
        .from('songs')
        .select('*, artists!songs_artist_id_fkey(*), albums!songs_album_id_fkey(*), genres!songs_genre_id_fkey(*)')
        .eq('is_published', true)
        .order('play_count', { ascending: false })
        .limit(candidateLimit);

      for (const song of (catalogSongRows || []).map(mapSongRow)) {
        mergeCandidate(song, 'trending', song?.playCount || 0);
      }
    }

    return Array.from(candidateMap.values());
  }
}

/**
 * Computes a candidate song's user taste affinity score by checking genre and artist affinities
 * in short-term (70% weight) and long-term (30% weight) profiles, augmented by Music DNA when available.
 */
export function computeSongTasteAffinity(
  songDoc: any,
  profile: UserTasteProfile | null,
  musicDna?: any
): number {
  if (!songDoc) return 0;
  let baseAffinity = 0;

  if (profile) {
    const songGenreId =
      typeof songDoc.genre === 'object' && songDoc.genre?._id
        ? songDoc.genre._id.toString()
        : String(songDoc.genre || '');

    const songArtistId =
      typeof songDoc.artist === 'object' && songDoc.artist?._id
        ? songDoc.artist._id.toString()
        : String(songDoc.artist || '');

    // Genre affinity lookup
    const shortTermGenre = profile.shortTermProfile?.genres.find((g) => g.genreId === songGenreId)?.affinityScore || 0;
    const longTermGenre = profile.longTermProfile?.genres.find((g) => g.genreId === songGenreId)?.affinityScore || 0;
    // Short-term preference acts as stronger signal (70%), long-term as stabilizing foundation (30%)
    const genreAffinity = 0.7 * shortTermGenre + 0.3 * longTermGenre;

    // Artist affinity lookup
    const shortTermArtist = profile.shortTermProfile?.artists.find((a) => a.artistId === songArtistId)?.affinityScore || 0;
    const longTermArtist = profile.longTermProfile?.artists.find((a) => a.artistId === songArtistId)?.affinityScore || 0;
    const artistAffinity = 0.7 * shortTermArtist + 0.3 * longTermArtist;

    const combinedAffinity = 0.5 * genreAffinity + 0.5 * artistAffinity;
    baseAffinity = Number(Math.max(0, Math.min(1, combinedAffinity)).toFixed(4));
  }

  // Augment with Music DNA preferences if available
  if (musicDna) {
    const songGenreName = (
      typeof songDoc.genre === 'object' && songDoc.genre?.name
        ? songDoc.genre.name
        : typeof songDoc.genre === 'string'
        ? songDoc.genre
        : ''
    ).toLowerCase().trim();

    const songArtistName = (
      typeof songDoc.artist === 'object' && songDoc.artist?.name
        ? songDoc.artist.name
        : typeof songDoc.artist === 'string'
        ? songDoc.artist
        : ''
    ).toLowerCase().trim();

    const topGenres = (musicDna.genreProfile?.topGenres || musicDna.genres || []);
    const matchedGenre = topGenres.find(
      (g: any) => (g.name || '').toLowerCase().trim() === songGenreName
    );
    const genreScore = matchedGenre ? (matchedGenre.score ?? matchedGenre.affinityScore ?? 0.5) : 0;

    const strongestArtists = (musicDna.artistProfile?.strongestArtists || musicDna.artists || []);
    const matchedArtist = strongestArtists.find(
      (a: any) => (a.name || '').toLowerCase().trim() === songArtistName
    );
    const artistScore = matchedArtist ? (matchedArtist.score ?? matchedArtist.affinityScore ?? 0.5) : 0;

    const dnaAffinity = 0.5 * genreScore + 0.5 * artistScore;
    if (dnaAffinity > 0) {
      baseAffinity = Math.max(baseAffinity, Number(dnaAffinity.toFixed(4)));
    }
  }

  return baseAffinity;
}

function calculateRecencySignal(songDoc: any): number {
  if (!songDoc) return 0;
  const currentYear = new Date().getFullYear();
  const releaseYear = songDoc.releaseYear || currentYear - 5;
  const yearsOld = Math.max(0, currentYear - releaseYear);
  return Math.max(0.1, 1 / (1 + 0.3 * yearsOld));
}
