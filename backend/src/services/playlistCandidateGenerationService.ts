import { Types } from 'mongoose';
import { Song, ISong } from '../models/Song.js';
import { AIPlaylistPreference } from '../schemas/aiPlaylistPreferenceSchema.js';
import { SemanticSearchService } from './semanticSearchService.js';
import { CandidateGenerationService } from './candidateGenerationService.js';
import { UserTasteProfileService, UserTasteProfile } from './userTasteProfileService.js';

export interface PlaylistCandidateItem {
  song: ISong;
  candidateScore: number;
  matchBreakdown: {
    genreMatch: boolean;
    artistMatch: boolean;
    moodMatch: boolean;
    audioFeatureScore: number;
    userTasteAffinityScore: number;
    semanticScore: number;
  };
  sources: string[];
}

export class PlaylistCandidateGenerationService {
  /**
   * Generates a ranked candidate song list matching AI-extracted playlist preferences.
   * Utilizes semantic search, hybrid recommendation services, and user taste profile (if authenticated),
   * applies strict exclusion filtering, ensures DB existence, and ranks candidates without creating a playlist.
   */
  static async generatePlaylistCandidates(params: {
    preference: AIPlaylistPreference;
    userId?: string;
    candidateLimit?: number;
  }): Promise<PlaylistCandidateItem[]> {
    const { preference, userId, candidateLimit = 36 } = params;

    const candidateMap = new Map<string, { song: ISong; sources: Set<string>; semanticScore: number }>();

    // 1. Candidate Sourcing: Semantic Vector Search
    const searchQuery = [
      preference.title,
      preference.requestedMood || '',
      ...(preference.genres || []),
      ...(preference.searchKeywords || []),
    ]
      .filter(Boolean)
      .join(' ');

    if (searchQuery.trim()) {
      try {
        const semanticResults = await SemanticSearchService.searchSongsBySemanticQuery(
          searchQuery,
          candidateLimit
        );

        for (const res of semanticResults) {
          const songId = res.song._id ? String(res.song._id) : String((res.song as any).id);
          if (!songId) continue;

          candidateMap.set(songId, {
            song: res.song,
            sources: new Set(['semantic_search']),
            semanticScore: res.similarityScore || 0,
          });
        }
      } catch (err: any) {
        console.warn(`[PlaylistCandidateGeneration Warning]: Semantic search candidate sourcing failed: ${err.message}`);
      }
    }

    // 2. Candidate Sourcing: User Taste Profile & Hybrid Recommendation Candidates (if authenticated)
    let userTasteProfile: UserTasteProfile | null = null;
    if (userId && Types.ObjectId.isValid(userId)) {
      try {
        userTasteProfile = await UserTasteProfileService.generateTasteProfile(userId);
        const hybridCandidates = await CandidateGenerationService.generateHybridCandidates({
          userId,
          candidateLimit: 30,
        });

        for (const cand of hybridCandidates) {
          const songId = cand.songId;
          const existing = candidateMap.get(songId);

          if (existing) {
            cand.sources.forEach((s) => existing.sources.add(s));
          } else if (cand.songDoc) {
            candidateMap.set(songId, {
              song: cand.songDoc as ISong,
              sources: new Set(cand.sources),
              semanticScore: 0,
            });
          }
        }
      } catch (err: any) {
        console.warn(`[PlaylistCandidateGeneration Warning]: User taste hybrid candidate sourcing failed: ${err.message}`);
      }
    }

    // 3. Candidate Sourcing: Direct Metadata DB Query Fallback
    try {
      const dbQuery: any = { isPublished: true };
      const orClauses: any[] = [];

      if (preference.requestedMood) {
        orClauses.push({ mood: new RegExp(preference.requestedMood, 'i') });
      }

      if (orClauses.length > 0) {
        dbQuery.$or = orClauses;
      }

      const catalogSongs = await Song.find(dbQuery)
        .populate('artist', 'name')
        .populate('featuredArtists', 'name')
        .populate('album', 'title')
        .populate('genre', 'name slug')
        .limit(candidateLimit)
        .lean();

      for (const song of catalogSongs) {
        const songId = song._id ? String(song._id) : '';
        if (!songId) continue;

        const existing = candidateMap.get(songId);
        if (existing) {
          existing.sources.add('catalog_metadata');
        } else {
          candidateMap.set(songId, {
            song: song as ISong,
            sources: new Set(['catalog_metadata']),
            semanticScore: 0,
          });
        }
      }
    } catch (err: any) {
      console.warn(`[PlaylistCandidateGeneration Warning]: Catalog metadata sourcing failed: ${err.message}`);
    }

    // 4. Hard Exclusion Filters & Scoring Pipeline
    const excludedArtistSet = new Set((preference.excludedArtists || []).map((a) => a.toLowerCase()));
    const excludedGenreSet = new Set((preference.excludedGenres || []).map((g) => g.toLowerCase()));
    const preferredGenreSet = new Set((preference.genres || []).map((g) => g.toLowerCase()));
    const preferredArtistSet = new Set((preference.artists || []).map((a) => a.toLowerCase()));

    const scoredCandidates: PlaylistCandidateItem[] = [];

    for (const [songId, item] of candidateMap.entries()) {
      const song = item.song;
      if (!song || !song._id) continue;

      // Artist & Genre Extraction
      const artistName =
        typeof song.artist === 'object' && song.artist && 'name' in song.artist
          ? String(song.artist.name).toLowerCase()
          : String(song.artist || '').toLowerCase();

      const genreName =
        typeof song.genre === 'object' && song.genre && 'name' in song.genre
          ? String(song.genre.name).toLowerCase()
          : String(song.genre || '').toLowerCase();

      // HARD EXCLUSION FILTERS
      if (excludedArtistSet.has(artistName)) continue;
      if (excludedGenreSet.has(genreName)) continue;

      // SOFT MATCH BREAKDOWN SCORING
      const genreMatch = preferredGenreSet.size === 0 || preferredGenreSet.has(genreName);
      const artistMatch = preferredArtistSet.size > 0 && preferredArtistSet.has(artistName);
      const moodMatch =
        Boolean(preference.requestedMood) &&
        Boolean(song.mood) &&
        song.mood!.toLowerCase().includes(preference.requestedMood!.toLowerCase());

      // Audio Feature Matching
      let audioFeatureScore = 0.5;
      if (song.audioFeatures) {
        const af = song.audioFeatures;
        let scoreSum = 0;
        let count = 0;

        if (typeof af.energy === 'number' && typeof preference.energyLevel === 'number') {
          scoreSum += 1.0 - Math.abs(af.energy - preference.energyLevel);
          count++;
        }

        if (typeof af.acousticness === 'number' && typeof preference.acousticPreference === 'number') {
          scoreSum += 1.0 - Math.abs(af.acousticness - preference.acousticPreference);
          count++;
        }

        if (typeof af.instrumentalness === 'number' && typeof preference.instrumentalPreference === 'number') {
          scoreSum += 1.0 - Math.abs(af.instrumentalness - preference.instrumentalPreference);
          count++;
        }

        if (count > 0) {
          audioFeatureScore = scoreSum / count;
        }
      }

      // User Taste Affinity Scoring
      let userTasteAffinityScore = 0.5;
      if (userTasteProfile) {
        const shortGenreAff =
          userTasteProfile.shortTermProfile.genres.find(
            (g) => (g.name || g.genreId).toLowerCase() === genreName
          )?.affinityScore || 0;
        const longGenreAff =
          userTasteProfile.longTermProfile.genres.find(
            (g) => (g.name || g.genreId).toLowerCase() === genreName
          )?.affinityScore || 0;

        const shortArtAff =
          userTasteProfile.shortTermProfile.artists.find(
            (a) => (a.name || a.artistId).toLowerCase() === artistName
          )?.affinityScore || 0;
        const longArtAff =
          userTasteProfile.longTermProfile.artists.find(
            (a) => (a.name || a.artistId).toLowerCase() === artistName
          )?.affinityScore || 0;

        userTasteAffinityScore =
          (0.7 * shortGenreAff + 0.3 * longGenreAff + 0.7 * shortArtAff + 0.3 * longArtAff) / 2;
      }

      // Candidate Final Weighted Fusion Score
      const genreWeight = genreMatch ? 0.25 : 0.05;
      const artistWeight = artistMatch ? 0.25 : 0.05;
      const moodWeight = moodMatch ? 0.20 : 0.05;
      const audioWeight = 0.15;
      const semanticWeight = 0.15;

      const candidateScore = Number(
        (
          genreWeight +
          artistWeight +
          moodWeight +
          audioFeatureScore * audioWeight +
          item.semanticScore * semanticWeight +
          userTasteAffinityScore * 0.1
        ).toFixed(4)
      );

      scoredCandidates.push({
        song,
        candidateScore,
        matchBreakdown: {
          genreMatch,
          artistMatch,
          moodMatch,
          audioFeatureScore: Number(audioFeatureScore.toFixed(4)),
          userTasteAffinityScore: Number(userTasteAffinityScore.toFixed(4)),
          semanticScore: Number((item.semanticScore || 0).toFixed(4)),
        },
        sources: Array.from(item.sources),
      });
    }

    // 5. Rank Candidate List Descending by Candidate Score
    scoredCandidates.sort((a, b) => b.candidateScore - a.candidateScore);

    return scoredCandidates.slice(0, candidateLimit);
  }
}
