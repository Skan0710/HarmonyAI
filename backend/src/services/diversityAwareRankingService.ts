import {
  DiversityAwareRankingConfig,
  getDiversityAwareRankingConfig,
} from '../config/recommendationSignalConfig.js';
import { HybridRankedResult } from './hybridRankingPipeline.js';

export interface DiversityRankingDiagnostics {
  originalRank: number;
  newRank: number;
  originalScore: number;
  adjustedScore: number;
  redundancyPenalty: number;
  artistPenalty: number;
  genrePenalty: number;
  similarityPenalty: number;
  maxPairwiseSimilarity: number;
}

export interface DiversityRankingOptions<T = any> {
  diversityStrength?: number; // lambda in [0, 1]
  artistRepetitionPenalty?: number;
  genreRepetitionPenalty?: number;
  similarSongPenalty?: number;
  similarityThreshold?: number;
  maxConsecutiveSameArtist?: number;
  maxConsecutiveSameGenre?: number;
  targetLimit?: number;
  scoreExtractor?: (item: T) => number;
  songExtractor?: (item: T) => any;
  customConfig?: Partial<DiversityAwareRankingConfig>;
}

export class DiversityAwareRankingService {
  /**
   * Helper: Extracts artist identifier or normalized name.
   */
  static extractArtist(song: any): string {
    if (!song) return '';
    if (song.artist) {
      if (typeof song.artist === 'object' && song.artist.name) {
        return String(song.artist.name).toLowerCase().trim();
      }
      if (typeof song.artist === 'object' && song.artist._id) {
        return String(song.artist._id).toLowerCase().trim();
      }
      return String(song.artist).toLowerCase().trim();
    }
    if (song.artistId) {
      return String(song.artistId).toLowerCase().trim();
    }
    if (song.artistName) {
      return String(song.artistName).toLowerCase().trim();
    }
    if (Array.isArray(song.artists) && song.artists.length > 0) {
      const first = song.artists[0];
      return typeof first === 'object' && first.name
        ? String(first.name).toLowerCase().trim()
        : String(first).toLowerCase().trim();
    }
    return '';
  }

  /**
   * Helper: Extracts genre identifier or normalized name.
   */
  static extractGenre(song: any): string {
    if (!song) return '';
    if (song.genre) {
      if (typeof song.genre === 'object' && song.genre.name) {
        return String(song.genre.name).toLowerCase().trim();
      }
      if (typeof song.genre === 'object' && song.genre._id) {
        return String(song.genre._id).toLowerCase().trim();
      }
      return String(song.genre).toLowerCase().trim();
    }
    if (song.genreId) {
      return String(song.genreId).toLowerCase().trim();
    }
    if (song.genreName) {
      return String(song.genreName).toLowerCase().trim();
    }
    if (Array.isArray(song.genres) && song.genres.length > 0) {
      const first = song.genres[0];
      return typeof first === 'object' && first.name
        ? String(first.name).toLowerCase().trim()
        : String(first).toLowerCase().trim();
    }
    return '';
  }

  /**
   * Helper: Calculates pairwise similarity between two songs (0.0 to 1.0)
   * using artist match, genre match, and audio feature proximity where available.
   */
  static calculateSongSimilarity(songA: any, songB: any): number {
    if (!songA || !songB) return 0.0;

    const idA = songA._id ? String(songA._id) : songA.id ? String(songA.id) : '';
    const idB = songB._id ? String(songB._id) : songB.id ? String(songB.id) : '';
    if (idA && idB && idA === idB) return 1.0;

    const artistA = this.extractArtist(songA);
    const artistB = this.extractArtist(songB);
    const sameArtist = Boolean(artistA && artistB && artistA === artistB);

    const genreA = this.extractGenre(songA);
    const genreB = this.extractGenre(songB);
    const sameGenre = Boolean(genreA && genreB && genreA === genreB);

    // Audio features similarity
    let audioSim = 0.5;
    const featA = songA.audioFeatures || {};
    const featB = songB.audioFeatures || {};

    let featuresCompared = 0;
    let featureDiffSum = 0;

    const numericFeatures = ['energy', 'tempo', 'valence', 'danceability', 'acousticness'];
    for (const key of numericFeatures) {
      const valA = featA[key];
      const valB = featB[key];
      if (typeof valA === 'number' && typeof valB === 'number') {
        const range = key === 'tempo' ? 100 : 1.0;
        featureDiffSum += Math.min(1.0, Math.abs(valA - valB) / range);
        featuresCompared++;
      }
    }

    if (featuresCompared > 0) {
      audioSim = Math.max(0, 1.0 - featureDiffSum / featuresCompared);
    }

    // Weighted composite similarity
    let totalWeight = 0;
    let accumulatedSim = 0;

    if (artistA && artistB) {
      accumulatedSim += (sameArtist ? 1.0 : 0.0) * 0.40;
      totalWeight += 0.40;
    }
    if (genreA && genreB) {
      accumulatedSim += (sameGenre ? 1.0 : 0.0) * 0.35;
      totalWeight += 0.35;
    }
    if (featuresCompared > 0) {
      accumulatedSim += audioSim * 0.25;
      totalWeight += 0.25;
    }

    if (totalWeight === 0) {
      return 0.0;
    }

    return Number((accumulatedSim / totalWeight).toFixed(4));
  }

  /**
   * Applies diversity-aware re-ranking over a list of recommendation candidates.
   *
   * Formulations:
   * MarginalScore(c) = BaseScore(c) - lambda * [ ArtistPenalty(c) + GenrePenalty(c) + SimilarityPenalty(c) ]
   *
   * Key Properties:
   * 1. Highly relevant candidates retain higher marginal scores and are preserved.
   * 2. Consecutive songs from the same artist/genre are tolerated up to configurable thresholds.
   * 3. Highly similar or near-duplicate songs receive progressive redundancy penalties.
   * 4. Already-diverse candidate lists retain their exact original order.
   */
  static applyDiversityAwareRanking<T extends HybridRankedResult = HybridRankedResult>(
    candidates: T[],
    options: DiversityRankingOptions<T> = {}
  ): {
    results: T[];
    diagnostics: {
      diversityStrength: number;
      appliedAdjustmentsCount: number;
      items: DiversityRankingDiagnostics[];
    };
  } {
    if (!candidates || candidates.length <= 1) {
      return {
        results: candidates ? [...candidates] : [],
        diagnostics: {
          diversityStrength: options.diversityStrength ?? 0.30,
          appliedAdjustmentsCount: 0,
          items: [],
        },
      };
    }

    const config: DiversityAwareRankingConfig = {
      ...getDiversityAwareRankingConfig(),
      ...options.customConfig,
    };

    const lambda =
      options.diversityStrength !== undefined
        ? Math.max(0, Math.min(1, options.diversityStrength))
        : config.diversityStrength;

    const artistRepetitionPenalty = options.artistRepetitionPenalty ?? config.artistRepetitionPenalty;
    const genreRepetitionPenalty = options.genreRepetitionPenalty ?? config.genreRepetitionPenalty;
    const similarSongPenalty = options.similarSongPenalty ?? config.similarSongPenalty;
    const similarityThreshold = options.similarityThreshold ?? config.similarityThreshold;
    const maxConsecutiveSameArtist = options.maxConsecutiveSameArtist ?? config.maxConsecutiveSameArtist;
    const maxConsecutiveSameGenre = options.maxConsecutiveSameGenre ?? config.maxConsecutiveSameGenre;

    const scoreExtractor =
      options.scoreExtractor ||
      ((item: T) =>
        typeof item.finalScore === 'number'
          ? item.finalScore
          : typeof item.hybridScore === 'number'
          ? item.hybridScore
          : 0.5);

    const songExtractor =
      options.songExtractor ||
      ((item: T) => item.song || (item as any).songDoc || item);

    const targetLimit = options.targetLimit ?? candidates.length;

    // Fast-path: If diversity strength is 0 or disabled, return original list unmodified
    if (lambda === 0 || config.enabled === false) {
      return {
        results: [...candidates],
        diagnostics: {
          diversityStrength: lambda,
          appliedAdjustmentsCount: 0,
          items: candidates.map((item, idx) => ({
            originalRank: idx,
            newRank: idx,
            originalScore: scoreExtractor(item),
            adjustedScore: scoreExtractor(item),
            redundancyPenalty: 0,
            artistPenalty: 0,
            genrePenalty: 0,
            similarityPenalty: 0,
            maxPairwiseSimilarity: 0,
          })),
        },
      };
    }

    // Tag candidates with original index and song documents
    const remaining = candidates.map((cand, originalIndex) => ({
      item: cand,
      song: songExtractor(cand),
      baseScore: scoreExtractor(cand),
      originalIndex,
    }));

    const selected: {
      item: T;
      song: any;
      baseScore: number;
      marginalScore: number;
      originalIndex: number;
      diagnostics: DiversityRankingDiagnostics;
    }[] = [];

    const numToSelect = Math.min(targetLimit, candidates.length);

    // Iterative Marginal Utility (MMR with progressive consecutive & pairwise penalties)
    for (let step = 0; step < numToSelect; step++) {
      let bestCandidateIndex = -1;
      let highestMarginalScore = -Infinity;
      let bestDiagnostics: DiversityRankingDiagnostics | null = null;

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];
        const candArtist = this.extractArtist(candidate.song);
        const candGenre = this.extractGenre(candidate.song);

        let artistPenalty = 0;
        let genrePenalty = 0;
        let similarityPenalty = 0;
        let maxPairwiseSim = 0;

        if (selected.length > 0) {
          // 1. Consecutive Artist Penalty
          let consecutiveArtistCount = 0;
          for (let k = selected.length - 1; k >= 0; k--) {
            const prevArtist = this.extractArtist(selected[k].song);
            if (candArtist && prevArtist && candArtist === prevArtist) {
              consecutiveArtistCount++;
            } else {
              break;
            }
          }

          if (consecutiveArtistCount >= maxConsecutiveSameArtist) {
            // Escalating penalty for violating consecutive limit
            artistPenalty =
              artistRepetitionPenalty * (1.0 + (consecutiveArtistCount - maxConsecutiveSameArtist) * 0.5);
          }

          // 2. Consecutive Genre Penalty
          let consecutiveGenreCount = 0;
          for (let k = selected.length - 1; k >= 0; k--) {
            const prevGenre = this.extractGenre(selected[k].song);
            if (candGenre && prevGenre && candGenre === prevGenre) {
              consecutiveGenreCount++;
            } else {
              break;
            }
          }

          if (consecutiveGenreCount >= maxConsecutiveSameGenre) {
            // Escalating penalty for violating consecutive genre limit
            genrePenalty =
              genreRepetitionPenalty * (1.0 + (consecutiveGenreCount - maxConsecutiveSameGenre) * 0.5);
          }

          // 3. Pairwise Song Similarity Penalty against all previously selected items
          for (const sel of selected) {
            const sim = this.calculateSongSimilarity(candidate.song, sel.song);
            if (sim > maxPairwiseSim) {
              maxPairwiseSim = sim;
            }
          }

          if (maxPairwiseSim > similarityThreshold) {
            const spread = Math.max(0.01, 1.0 - similarityThreshold);
            const excess = (maxPairwiseSim - similarityThreshold) / spread;
            similarityPenalty = similarSongPenalty * excess;
          }
        }

        const totalRedundancy = artistPenalty + genrePenalty + similarityPenalty;
        const marginalScore = Number(
          (candidate.baseScore - lambda * totalRedundancy).toFixed(4)
        );

        if (marginalScore > highestMarginalScore) {
          highestMarginalScore = marginalScore;
          bestCandidateIndex = i;
          bestDiagnostics = {
            originalRank: candidate.originalIndex,
            newRank: selected.length,
            originalScore: candidate.baseScore,
            adjustedScore: marginalScore,
            redundancyPenalty: Number((lambda * totalRedundancy).toFixed(4)),
            artistPenalty: Number(artistPenalty.toFixed(4)),
            genrePenalty: Number(genrePenalty.toFixed(4)),
            similarityPenalty: Number(similarityPenalty.toFixed(4)),
            maxPairwiseSimilarity: Number(maxPairwiseSim.toFixed(4)),
          };
        }
      }

      if (bestCandidateIndex >= 0 && bestDiagnostics) {
        const [chosen] = remaining.splice(bestCandidateIndex, 1);
        selected.push({
          ...chosen,
          marginalScore: highestMarginalScore,
          diagnostics: bestDiagnostics,
        });
      }
    }

    // Append any unselected remaining candidates
    for (const rem of remaining) {
      selected.push({
        ...rem,
        marginalScore: rem.baseScore,
        diagnostics: {
          originalRank: rem.originalIndex,
          newRank: selected.length,
          originalScore: rem.baseScore,
          adjustedScore: rem.baseScore,
          redundancyPenalty: 0,
          artistPenalty: 0,
          genrePenalty: 0,
          similarityPenalty: 0,
          maxPairwiseSimilarity: 0,
        },
      });
    }

    let appliedAdjustmentsCount = 0;

    // Attach metadata and return results
    const results: T[] = selected.map((sel, newRank) => {
      const resItem = { ...sel.item };
      sel.diagnostics.newRank = newRank;

      if (sel.diagnostics.redundancyPenalty > 0) {
        appliedAdjustmentsCount++;
      }

      resItem.metadata = {
        ...resItem.metadata,
        diversityRanking: {
          ...sel.diagnostics,
          diversityStrength: lambda,
        },
      };

      if (resItem.componentScores) {
        resItem.componentScores = {
          ...resItem.componentScores,
          diversityAdjustment: -sel.diagnostics.redundancyPenalty,
        };
      }

      return resItem;
    });

    return {
      results,
      diagnostics: {
        diversityStrength: lambda,
        appliedAdjustmentsCount,
        items: selected.map((s) => s.diagnostics),
      },
    };
  }
}
