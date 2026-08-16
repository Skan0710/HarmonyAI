import { PlaylistCandidateItem } from './playlistCandidateGenerationService.js';

export interface PlaylistDiversityOptions {
  candidates: PlaylistCandidateItem[];
  targetCount: number;
  requestedGenres?: string[];
  maxSongsPerArtist?: number;
  maxGenreConcentrationRatio?: number; // e.g., 0.4 = max 40% of playlist from one genre
}

export class PlaylistDiversityFilteringService {
  /**
   * Reusable diversity selection service that selects a varied list of songs from candidate lists.
   * - Limits artist repetition (default max 2 songs per artist).
   * - Prevents single-genre over-concentration unless explicitly requested.
   * - Considers base candidate recommendation score to preserve top-quality items.
   * - Provider independent and reusable across playlist generators.
   */
  static selectDiversePlaylistSongs(options: PlaylistDiversityOptions): PlaylistCandidateItem[] {
    const {
      candidates,
      targetCount,
      requestedGenres = [],
      maxSongsPerArtist = 2,
      maxGenreConcentrationRatio = 0.4,
    } = options;

    if (!Array.isArray(candidates) || candidates.length === 0) {
      return [];
    }

    const safeTargetCount = Math.max(1, targetCount);
    const maxSongsPerGenre = Math.max(
      2,
      Math.ceil(safeTargetCount * maxGenreConcentrationRatio)
    );

    const explicitGenreSet = new Set((requestedGenres || []).map((g) => g.toLowerCase().trim()));
    const unselectedPool = [...candidates];
    const selected: PlaylistCandidateItem[] = [];

    const artistCountMap = new Map<string, number>();
    const genreCountMap = new Map<string, number>();

    while (selected.length < safeTargetCount && unselectedPool.length > 0) {
      let bestIndex = -1;
      let bestAdjustedScore = -Infinity;

      for (let i = 0; i < unselectedPool.length; i++) {
        const item = unselectedPool[i];
        const song = item.song;

        // Extract Artist & Genre names
        const artistName =
          typeof song.artist === 'object' && song.artist && 'name' in song.artist
            ? String(song.artist.name).toLowerCase()
            : String(song.artist || '').toLowerCase();

        const genreName =
          typeof song.genre === 'object' && song.genre && 'name' in song.genre
            ? String(song.genre.name).toLowerCase()
            : String(song.genre || '').toLowerCase();

        const currentArtistCount = artistCountMap.get(artistName) || 0;
        const currentGenreCount = genreCountMap.get(genreName) || 0;

        // Hard penalty for exceeding max songs per artist
        let artistPenalty = 0;
        if (currentArtistCount >= maxSongsPerArtist) {
          artistPenalty = 0.5 * (currentArtistCount - maxSongsPerArtist + 1);
        } else if (currentArtistCount > 0) {
          artistPenalty = 0.1 * currentArtistCount;
        }

        // Genre penalty (relaxed if genre was explicitly requested by user)
        let genrePenalty = 0;
        const isExplicitGenre = explicitGenreSet.has(genreName);
        if (!isExplicitGenre) {
          if (currentGenreCount >= maxSongsPerGenre) {
            genrePenalty = 0.4 * (currentGenreCount - maxSongsPerGenre + 1);
          } else if (currentGenreCount > 1) {
            genrePenalty = 0.08 * currentGenreCount;
          }
        }

        // Adjusted Score balancing recommendation quality vs diversity penalty
        const adjustedScore = item.candidateScore - artistPenalty - genrePenalty;

        if (adjustedScore > bestAdjustedScore) {
          bestAdjustedScore = adjustedScore;
          bestIndex = i;
        }
      }

      if (bestIndex === -1) {
        // Fallback: pick highest remaining candidate score if all face heavy penalties
        bestIndex = 0;
      }

      const [chosenItem] = unselectedPool.splice(bestIndex, 1);
      selected.push(chosenItem);

      // Track counts for selected artist and genre
      const chosenArtist =
        typeof chosenItem.song.artist === 'object' && chosenItem.song.artist && 'name' in chosenItem.song.artist
          ? String(chosenItem.song.artist.name).toLowerCase()
          : String(chosenItem.song.artist || '').toLowerCase();

      const chosenGenre =
        typeof chosenItem.song.genre === 'object' && chosenItem.song.genre && 'name' in chosenItem.song.genre
          ? String(chosenItem.song.genre.name).toLowerCase()
          : String(chosenItem.song.genre || '').toLowerCase();

      artistCountMap.set(chosenArtist, (artistCountMap.get(chosenArtist) || 0) + 1);
      genreCountMap.set(chosenGenre, (genreCountMap.get(chosenGenre) || 0) + 1);
    }

    return selected;
  }
}
