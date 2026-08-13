export interface DiversitySongItem {
  songId: string;
  genreId?: string;
  artistId?: string;
  playCount?: number;
}

export interface DiversityMetricsResult {
  diversityScore: number; // Combined genre & artist diversity (0-1)
  genreDiversity: number;  // Unique genres / total items (0-1)
  artistDiversity: number; // Unique artists / total items (0-1)
  catalogCoverage: number; // Unique recommended songs / total catalog songs (0-1)
  noveltyScore: number;    // Inverse popularity / hidden gem score (0-1)
  uniqueGenresCount: number;
  uniqueArtistsCount: number;
  recommendedCount: number;
  catalogCount: number;
}

export class RecommendationDiversityService {
  /**
   * Calculates recommendation diversity score (0.0 to 1.0) based on differences in genres and artists.
   * Higher values indicate a broader variety of genres and artists in recommendations.
   */
  static calculateDiversity(songs: DiversitySongItem[]): {
    diversityScore: number;
    genreDiversity: number;
    artistDiversity: number;
    uniqueGenresCount: number;
    uniqueArtistsCount: number;
  } {
    if (!songs || songs.length === 0) {
      return {
        diversityScore: 0.0,
        genreDiversity: 0.0,
        artistDiversity: 0.0,
        uniqueGenresCount: 0,
        uniqueArtistsCount: 0,
      };
    }

    const totalCount = songs.length;
    const uniqueGenres = new Set<string>();
    const uniqueArtists = new Set<string>();

    for (const song of songs) {
      if (song.genreId) uniqueGenres.add(song.genreId);
      if (song.artistId) uniqueArtists.add(song.artistId);
    }

    const genreDiversity = Number((uniqueGenres.size / totalCount).toFixed(4));
    const artistDiversity = Number((uniqueArtists.size / totalCount).toFixed(4));
    const combined = Number(((genreDiversity + artistDiversity) / 2).toFixed(4));

    return {
      diversityScore: Math.max(0, Math.min(1, combined)),
      genreDiversity: Math.max(0, Math.min(1, genreDiversity)),
      artistDiversity: Math.max(0, Math.min(1, artistDiversity)),
      uniqueGenresCount: uniqueGenres.size,
      uniqueArtistsCount: uniqueArtists.size,
    };
  }

  /**
   * Calculates catalog coverage score (0.0 to 1.0) based on the number of unique songs
   * recommended compared with the available catalog song count.
   */
  static calculateCatalogCoverage(
    recommendedSongIds: string[],
    totalCatalogSongCount: number
  ): number {
    if (
      !recommendedSongIds ||
      recommendedSongIds.length === 0 ||
      !totalCatalogSongCount ||
      totalCatalogSongCount <= 0
    ) {
      return 0.0;
    }

    const uniqueRecommended = new Set(recommendedSongIds);
    const coverage = uniqueRecommended.size / totalCatalogSongCount;

    return Number(Math.max(0, Math.min(1, coverage)).toFixed(4));
  }

  /**
   * Calculates a simple novelty score (0.0 to 1.0) giving higher values to less frequently played songs.
   * Novelty = 1.0 - (playCount / maxCatalogPlayCount)
   */
  static calculateNovelty(
    songs: DiversitySongItem[],
    maxCatalogPlayCount = 1000
  ): number {
    if (!songs || songs.length === 0) {
      return 0.0;
    }

    const safeMaxPlayCount = Math.max(1, maxCatalogPlayCount);
    let totalNovelty = 0;

    for (const song of songs) {
      const playCount = Math.max(0, song.playCount || 0);
      // Normalized item novelty: less plays -> higher novelty score
      const itemNovelty = 1 - Math.min(1, playCount / safeMaxPlayCount);
      totalNovelty += itemNovelty;
    }

    const averageNovelty = totalNovelty / songs.length;
    return Number(Math.max(0, Math.min(1, averageNovelty)).toFixed(4));
  }

  /**
   * Comprehensive evaluation method computing Diversity, Catalog Coverage, and Novelty metrics.
   */
  static evaluateDiversityAndNovelty(
    recommendedSongs: DiversitySongItem[],
    totalCatalogSongCount: number,
    maxCatalogPlayCount = 1000
  ): DiversityMetricsResult {
    const validSongs = recommendedSongs || [];
    const songIds = validSongs.map((s) => s.songId).filter(Boolean);

    const div = this.calculateDiversity(validSongs);
    const catalogCoverage = this.calculateCatalogCoverage(songIds, totalCatalogSongCount);
    const noveltyScore = this.calculateNovelty(validSongs, maxCatalogPlayCount);

    return {
      diversityScore: div.diversityScore,
      genreDiversity: div.genreDiversity,
      artistDiversity: div.artistDiversity,
      catalogCoverage,
      noveltyScore,
      uniqueGenresCount: div.uniqueGenresCount,
      uniqueArtistsCount: div.uniqueArtistsCount,
      recommendedCount: validSongs.length,
      catalogCount: totalCatalogSongCount || 0,
    };
  }
}
