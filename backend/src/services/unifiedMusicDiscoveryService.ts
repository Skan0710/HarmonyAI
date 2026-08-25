import { Types } from 'mongoose';
import { searchCatalog, GroupedSearchResults } from './searchService.js';
import { SemanticSearchService, SemanticSearchResult } from './semanticSearchService.js';
import { HybridRecommendationService } from './hybridRecommendationService.js';
import { ContentRecommendationService } from './recommendationService.js';
import { TrendingService } from './trendingService.js';
import { ColdStartRecommendationService } from './coldStartRecommendationService.js';
import { UserTasteProfileService } from './userTasteProfileService.js';
import { ListeningSessionService } from './listeningSessionService.js';
import { CandidateGenerationService } from './candidateGenerationService.js';
import { RecommendationPostRankingPipeline } from './recommendationPostRankingPipeline.js';
import { Artist } from '../models/Artist.js';

export type DiscoverySourceType = 'keyword_search' | 'semantic_search' | 'recommendation' | 'trending' | 'hybrid';

export type DiscoveryMode = 'all' | 'keyword' | 'semantic' | 'recommendations' | 'hybrid';

export interface NormalizedArtistSummary {
  id: string;
  name: string;
  avatar?: string;
  profileImage?: string;
  verified?: boolean;
}

export interface NormalizedAlbumSummary {
  id: string;
  title: string;
  coverImage?: string;
  releaseYear?: number;
}

export interface NormalizedGenreSummary {
  id: string;
  name: string;
  slug?: string;
}

export interface RankingScoreBreakdown {
  exactTitleMatch: number;
  exactArtistMatch: number;
  partialTextMatch: number;
  artistRelevance: number;
  albumRelevance: number;
  semanticSimilarity: number;
  popularityScore: number;
  finalScore: number;
}

export interface NormalizedSongItem {
  type: 'song';
  id: string;
  title: string;
  artist: NormalizedArtistSummary | null;
  album: NormalizedAlbumSummary | null;
  genre: NormalizedGenreSummary | null;
  duration: number;
  durationFormatted: string;
  coverImage?: string;
  audioUrl?: string;
  score: number;
  matchReason?: string;
  rankingBreakdown?: RankingScoreBreakdown;
  source: DiscoverySourceType;
  sources: DiscoverySourceType[];
  raw?: any;
}

export interface NormalizedArtistItem {
  type: 'artist';
  id: string;
  name: string;
  bio?: string;
  profileImage?: string;
  avatar?: string;
  verified?: boolean;
  genres: string[];
  monthlyListeners?: number;
  score: number;
  matchReason?: string;
  rankingBreakdown?: Partial<RankingScoreBreakdown>;
  source: DiscoverySourceType;
  sources: DiscoverySourceType[];
  raw?: any;
}

export interface NormalizedAlbumItem {
  type: 'album';
  id: string;
  title: string;
  artist: NormalizedArtistSummary | null;
  genre: NormalizedGenreSummary | null;
  coverImage?: string;
  releaseYear?: number;
  trackCount?: number;
  score: number;
  matchReason?: string;
  rankingBreakdown?: Partial<RankingScoreBreakdown>;
  source: DiscoverySourceType;
  sources: DiscoverySourceType[];
  raw?: any;
}

export interface UnifiedDiscoveryOptions {
  query?: string;
  mode?: DiscoveryMode;
  userId?: string;
  seedSongId?: string;
  page?: number;
  limit?: number;
  includeEntities?: ('songs' | 'artists' | 'similarArtists' | 'albums' | 'recommendedSongs')[];
  customRankingWeights?: Partial<UnifiedSearchRankingWeights>;
}

export interface UnifiedDiscoveryResults {
  artists: NormalizedArtistItem[];
  similarArtists?: NormalizedArtistItem[];
  albums: NormalizedAlbumItem[];
  songs: NormalizedSongItem[];
  recommendedSongs: NormalizedSongItem[];
}

export interface UnifiedDiscoveryPagination {
  page: number;
  limit: number;
  totalPages: {
    artists: number;
    albums: number;
    songs: number;
    recommendedSongs: number;
  };
  hasMore: {
    artists: boolean;
    albums: boolean;
    songs: boolean;
    recommendedSongs: boolean;
  };
}

export interface UnifiedDiscoveryResponse {
  query: string;
  mode: DiscoveryMode;
  results: UnifiedDiscoveryResults;
  counts: {
    artists: number;
    similarArtists?: number;
    albums: number;
    songs: number;
    recommendedSongs: number;
    total: number;
  };
  pagination: UnifiedDiscoveryPagination;
  metadata: {
    executedAt: string;
    sourcesUsed: DiscoverySourceType[];
    tookMs: number;
    hasResults: boolean;
    fallbackApplied: boolean;
    userState?: string;
    rankingWeightsApplied: UnifiedSearchRankingWeights;
    isAuthenticated: boolean;
  };
}

/**
 * Configurable weights for intelligent ranking of unified search results.
 * Allows fine-tuning of exact match priorities, semantic signals, and popularity damping.
 */
export interface UnifiedSearchRankingWeights {
  /** Weight for exact song or album title matches (Default: 0.35) */
  exactTitleMatchWeight: number;
  /** Weight for exact artist name matches (Default: 0.30) */
  exactArtistMatchWeight: number;
  /** Weight for partial substring and token overlap matching (Default: 0.15) */
  partialTextMatchWeight: number;
  /** Weight for artist authority/verification relevance (Default: 0.10) */
  artistRelevanceWeight: number;
  /** Weight for album contextual match relevance (Default: 0.05) */
  albumRelevanceWeight: number;
  /** Weight for vector semantic similarity when surfaced by semantic search (Default: 0.20) */
  semanticSimilarityWeight: number;
  /** Weight for popularity (play count, listeners) - strictly bounded to prevent query hijacking (Default: 0.08) */
  popularityWeight: number;
}

const DEFAULT_UNIFIED_RANKING_WEIGHTS: UnifiedSearchRankingWeights = {
  exactTitleMatchWeight: 0.35,
  exactArtistMatchWeight: 0.30,
  partialTextMatchWeight: 0.15,
  artistRelevanceWeight: 0.10,
  albumRelevanceWeight: 0.05,
  semanticSimilarityWeight: 0.20,
  popularityWeight: 0.08,
};

let activeUnifiedRankingWeights: UnifiedSearchRankingWeights = { ...DEFAULT_UNIFIED_RANKING_WEIGHTS };

export function getUnifiedSearchRankingWeights(): UnifiedSearchRankingWeights {
  return { ...activeUnifiedRankingWeights };
}

export function updateUnifiedSearchRankingWeights(
  newWeights: Partial<UnifiedSearchRankingWeights>
): UnifiedSearchRankingWeights {
  activeUnifiedRankingWeights = {
    ...activeUnifiedRankingWeights,
    ...newWeights,
  };
  return { ...activeUnifiedRankingWeights };
}

export function resetUnifiedSearchRankingWeights(): void {
  activeUnifiedRankingWeights = { ...DEFAULT_UNIFIED_RANKING_WEIGHTS };
}

export class UnifiedMusicDiscoveryService {
  /**
   * Helper: Formats duration in seconds to M:SS or H:MM:SS
   */
  public static formatDuration(seconds?: number): string {
    if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
    const totalSecs = Math.round(seconds);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  /**
   * Helper: Extracts ID string from MongoDB doc or populated object
   */
  public static extractId(doc: any): string {
    if (!doc) return '';
    if (typeof doc === 'string') return doc;
    if (doc._id) return String(doc._id);
    if (doc.id) return String(doc.id);
    return '';
  }

  /**
   * Helper: Sanitizes string for normalized comparison (lowercasing, trimming, removing extra punctuation)
   */
  public static cleanText(text?: string): string {
    if (!text || typeof text !== 'string') return '';
    return text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * Helper: Computes token overlap Jaccard ratio between query and target string
   */
  public static calculateTokenOverlap(queryText: string, targetText: string): number {
    const qTokens = new Set(this.cleanText(queryText).split(' ').filter(Boolean));
    const tTokens = new Set(this.cleanText(targetText).split(' ').filter(Boolean));

    if (qTokens.size === 0 || tTokens.size === 0) return 0;

    let intersectionCount = 0;
    for (const token of qTokens) {
      if (tTokens.has(token)) {
        intersectionCount++;
      }
    }

    return intersectionCount / Math.max(qTokens.size, 1);
  }

  /**
   * Intelligent Ranking Engine for Songs:
   * Evaluates exact title, exact artist, partial text overlap, artist relevance,
   * album relevance, semantic vector similarity, and bounded popularity.
   *
   * Exact matches receive guaranteed strong baseline priority (>= 0.90),
   * ensuring popularity never overrides an exact user search query.
   */
  public static calculateSongRanking(
    songDoc: any,
    query: string,
    semanticSimilarity: number = 0,
    weights: UnifiedSearchRankingWeights = activeUnifiedRankingWeights
  ): { finalScore: number; matchReason: string; breakdown: RankingScoreBreakdown } {
    const cleanQuery = this.cleanText(query);
    const cleanTitle = this.cleanText(songDoc?.title);
    const artistName = typeof songDoc?.artist === 'object' ? songDoc?.artist?.name : songDoc?.artist;
    const cleanArtist = this.cleanText(artistName);
    const albumTitle = typeof songDoc?.album === 'object' ? songDoc?.album?.title : songDoc?.album;
    const cleanAlbum = this.cleanText(albumTitle);

    // 1. Exact Title Match Factor
    const isExactTitle = cleanQuery && cleanTitle && cleanTitle === cleanQuery;
    const exactTitleScore = isExactTitle ? 1.0 : 0.0;

    // 2. Exact Artist Match Factor
    const isExactArtist = cleanQuery && cleanArtist && cleanArtist === cleanQuery;
    const exactArtistScore = isExactArtist ? 1.0 : 0.0;

    // 3. Partial Text Match Factor (title substring / token overlap)
    let partialTextScore = 0.0;
    if (cleanQuery) {
      if (cleanTitle.includes(cleanQuery) || cleanQuery.includes(cleanTitle)) {
        partialTextScore = Math.max(partialTextScore, 0.85);
      } else {
        const overlap = this.calculateTokenOverlap(cleanQuery, cleanTitle);
        partialTextScore = Math.max(partialTextScore, overlap * 0.75);
      }
    }

    // 4. Artist Relevance Factor (artist match or partial artist overlap)
    let artistRelevanceScore = 0.0;
    if (cleanQuery && cleanArtist) {
      if (cleanArtist.includes(cleanQuery) || cleanQuery.includes(cleanArtist)) {
        artistRelevanceScore = 0.80;
      } else {
        const overlap = this.calculateTokenOverlap(cleanQuery, cleanArtist);
        artistRelevanceScore = overlap * 0.60;
      }
    }
    if (songDoc?.artist && typeof songDoc.artist === 'object' && songDoc.artist.verified) {
      artistRelevanceScore = Math.min(1.0, artistRelevanceScore + 0.10);
    }

    // 5. Album Relevance Factor
    let albumRelevanceScore = 0.0;
    if (cleanQuery && cleanAlbum) {
      if (cleanAlbum.includes(cleanQuery) || cleanQuery.includes(cleanAlbum)) {
        albumRelevanceScore = 0.70;
      } else {
        albumRelevanceScore = this.calculateTokenOverlap(cleanQuery, cleanAlbum) * 0.50;
      }
    }

    // 6. Semantic Similarity Factor (0 to 1)
    const boundedSemantic = Math.max(0, Math.min(1.0, semanticSimilarity));

    // 7. Popularity Factor (logarithmic normalization, strictly bounded to prevent override)
    const playCount = Number(songDoc?.playCount) || 0;
    const popularityScore = Math.max(0, Math.min(1.0, Math.log10(playCount + 1) / 5)); // 100,000 plays = 1.0

    // Weighted linear combination of active ranking components
    const weightedSum =
      exactTitleScore * weights.exactTitleMatchWeight +
      exactArtistScore * weights.exactArtistMatchWeight +
      partialTextScore * weights.partialTextMatchWeight +
      artistRelevanceScore * weights.artistRelevanceWeight +
      albumRelevanceScore * weights.albumRelevanceWeight +
      boundedSemantic * weights.semanticSimilarityWeight +
      popularityScore * weights.popularityWeight;

    // Normalizing denominator based on active weights
    const totalWeights =
      weights.exactTitleMatchWeight +
      weights.exactArtistMatchWeight +
      weights.partialTextMatchWeight +
      weights.artistRelevanceWeight +
      weights.albumRelevanceWeight +
      weights.semanticSimilarityWeight +
      weights.popularityWeight;

    let finalScore = totalWeights > 0 ? weightedSum / totalWeights : 0.5;

    // Exact Match Strong Priority Guard:
    // If exact title or exact artist matches the query, guarantee strong score >= 0.90
    if (isExactTitle) {
      finalScore = Math.max(finalScore, 0.92 + 0.08 * popularityScore);
    } else if (isExactArtist) {
      finalScore = Math.max(finalScore, 0.88 + 0.08 * popularityScore);
    }

    // Strictly bound score in [0.0, 1.0]
    finalScore = Number(Math.max(0.0, Math.min(1.0, finalScore)).toFixed(4));

    // Formulate descriptive match reason
    let matchReason = 'Catalog search result';
    if (isExactTitle) {
      matchReason = 'Exact song title match (100%)';
    } else if (isExactArtist) {
      matchReason = `Exact artist match: ${artistName}`;
    } else if (boundedSemantic >= 0.65) {
      matchReason = `Semantic query match (${Math.round(boundedSemantic * 100)}% similarity)`;
    } else if (partialTextScore >= 0.7) {
      matchReason = 'High keyword relevance';
    } else if (popularityScore >= 0.6) {
      matchReason = 'Popular trending match';
    }

    const breakdown: RankingScoreBreakdown = {
      exactTitleMatch: exactTitleScore,
      exactArtistMatch: exactArtistScore,
      partialTextMatch: partialTextScore,
      artistRelevance: artistRelevanceScore,
      albumRelevance: albumRelevanceScore,
      semanticSimilarity: boundedSemantic,
      popularityScore,
      finalScore,
    };

    return { finalScore, matchReason, breakdown };
  }

  /**
   * Intelligent Ranking Engine for Artists:
   * Prioritizes exact name matches, partial name/bio matches, and bounded listener popularity.
   */
  public static calculateArtistRanking(
    artistDoc: any,
    query: string,
    semanticSimilarity: number = 0,
    weights: UnifiedSearchRankingWeights = activeUnifiedRankingWeights
  ): { finalScore: number; matchReason: string; breakdown: Partial<RankingScoreBreakdown> } {
    const cleanQuery = this.cleanText(query);
    const cleanName = this.cleanText(artistDoc?.name);
    const cleanBio = this.cleanText(artistDoc?.bio);

    const isExactName = cleanQuery && cleanName && cleanName === cleanQuery;
    const exactNameScore = isExactName ? 1.0 : 0.0;

    let partialTextScore = 0.0;
    if (cleanQuery) {
      if (cleanName.includes(cleanQuery) || cleanQuery.includes(cleanName)) {
        partialTextScore = 0.85;
      } else {
        partialTextScore = this.calculateTokenOverlap(cleanQuery, cleanName) * 0.75;
      }
      if (cleanBio && (cleanBio.includes(cleanQuery) || this.calculateTokenOverlap(cleanQuery, cleanBio) > 0.3)) {
        partialTextScore = Math.max(partialTextScore, 0.60);
      }
    }

    const listeners = Number(artistDoc?.monthlyListeners) || 0;
    const popularityScore = Math.max(0, Math.min(1.0, Math.log10(listeners + 1) / 7)); // 10M listeners = 1.0

    let finalScore =
      exactNameScore * 0.50 +
      partialTextScore * 0.30 +
      popularityScore * weights.popularityWeight +
      semanticSimilarity * 0.12;

    if (isExactName) {
      finalScore = Math.max(finalScore, 0.95 + 0.05 * popularityScore);
    }

    finalScore = Number(Math.max(0.0, Math.min(1.0, finalScore)).toFixed(4));

    const matchReason = isExactName
      ? 'Exact artist name match (100%)'
      : partialTextScore >= 0.7
      ? 'Artist keyword match'
      : 'Related artist discovery';

    return {
      finalScore,
      matchReason,
      breakdown: {
        exactArtistMatch: exactNameScore,
        partialTextMatch: partialTextScore,
        popularityScore,
        finalScore,
      },
    };
  }

  /**
   * Intelligent Ranking Engine for Albums:
   * Prioritizes exact title match, associated artist match, and release year recency.
   */
  public static calculateAlbumRanking(
    albumDoc: any,
    query: string,
    semanticSimilarity: number = 0,
    weights: UnifiedSearchRankingWeights = activeUnifiedRankingWeights
  ): { finalScore: number; matchReason: string; breakdown: Partial<RankingScoreBreakdown> } {
    const cleanQuery = this.cleanText(query);
    const cleanTitle = this.cleanText(albumDoc?.title);
    const artistName = typeof albumDoc?.artist === 'object' ? albumDoc?.artist?.name : albumDoc?.artist;
    const cleanArtist = this.cleanText(artistName);

    const isExactTitle = cleanQuery && cleanTitle && cleanTitle === cleanQuery;
    const exactTitleScore = isExactTitle ? 1.0 : 0.0;

    const isExactArtist = cleanQuery && cleanArtist && cleanArtist === cleanQuery;
    const exactArtistScore = isExactArtist ? 1.0 : 0.0;

    let partialTextScore = 0.0;
    if (cleanQuery) {
      if (cleanTitle.includes(cleanQuery) || cleanQuery.includes(cleanTitle)) {
        partialTextScore = 0.80;
      } else {
        partialTextScore = this.calculateTokenOverlap(cleanQuery, cleanTitle) * 0.70;
      }
    }

    let finalScore =
      exactTitleScore * 0.45 +
      exactArtistScore * 0.25 +
      partialTextScore * 0.20 +
      semanticSimilarity * 0.10;

    if (isExactTitle) {
      finalScore = Math.max(finalScore, 0.92);
    } else if (isExactArtist) {
      finalScore = Math.max(finalScore, 0.85);
    }

    finalScore = Number(Math.max(0.0, Math.min(1.0, finalScore)).toFixed(4));

    const matchReason = isExactTitle
      ? 'Exact album title match (100%)'
      : isExactArtist
      ? `Album by artist: ${artistName}`
      : 'Album catalog match';

    return {
      finalScore,
      matchReason,
      breakdown: {
        exactTitleMatch: exactTitleScore,
        exactArtistMatch: exactArtistScore,
        partialTextMatch: partialTextScore,
        finalScore,
      },
    };
  }

  /**
   * Public-Safe Normalization for Songs:
   * Strips internal database fields like `vectorEmbedding`, `__v`, internal MongoDB tokens.
   */
  public static normalizeSong(
    songDoc: any,
    source: DiscoverySourceType = 'keyword_search',
    score: number = 1.0,
    matchReason?: string,
    breakdown?: RankingScoreBreakdown
  ): NormalizedSongItem | null {
    if (!songDoc) return null;

    const id = this.extractId(songDoc);
    if (!id) return null;

    const title = songDoc.title || 'Untitled Track';
    const duration = typeof songDoc.duration === 'number' ? songDoc.duration : 0;

    let artist: NormalizedArtistSummary | null = null;
    if (songDoc.artist) {
      if (typeof songDoc.artist === 'object') {
        artist = {
          id: this.extractId(songDoc.artist),
          name: songDoc.artist.name || 'Unknown Artist',
          avatar: songDoc.artist.avatar || songDoc.artist.profileImage,
          profileImage: songDoc.artist.profileImage || songDoc.artist.avatar,
          verified: Boolean(songDoc.artist.verified),
        };
      } else {
        artist = {
          id: String(songDoc.artist),
          name: 'Unknown Artist',
        };
      }
    }

    let album: NormalizedAlbumSummary | null = null;
    if (songDoc.album) {
      if (typeof songDoc.album === 'object') {
        album = {
          id: this.extractId(songDoc.album),
          title: songDoc.album.title || 'Unknown Album',
          coverImage: songDoc.album.coverImage,
          releaseYear: songDoc.album.releaseYear,
        };
      } else {
        album = {
          id: String(songDoc.album),
          title: 'Unknown Album',
        };
      }
    }

    let genre: NormalizedGenreSummary | null = null;
    if (songDoc.genre) {
      if (typeof songDoc.genre === 'object') {
        genre = {
          id: this.extractId(songDoc.genre),
          name: songDoc.genre.name || 'General',
          slug: songDoc.genre.slug,
        };
      } else {
        genre = {
          id: String(songDoc.genre),
          name: String(songDoc.genre),
        };
      }
    }

    const coverImage =
      songDoc.coverImage ||
      (album && album.coverImage) ||
      (artist && artist.profileImage) ||
      undefined;

    return {
      type: 'song',
      id,
      title,
      artist,
      album,
      genre,
      duration,
      durationFormatted: this.formatDuration(duration),
      coverImage,
      audioUrl: songDoc.audioUrl,
      score: Number(score.toFixed(4)),
      matchReason: matchReason || (source === 'semantic_search' ? 'Semantic vector match' : 'Catalog match'),
      rankingBreakdown: breakdown,
      source,
      sources: [source],
    };
  }

  /**
   * Public-Safe Normalization for Artists:
   * Strips internal database fields like `__v`, internal MongoDB IDs.
   */
  public static normalizeArtist(
    artistDoc: any,
    source: DiscoverySourceType = 'keyword_search',
    score: number = 1.0,
    matchReason?: string,
    breakdown?: Partial<RankingScoreBreakdown>
  ): NormalizedArtistItem | null {
    if (!artistDoc) return null;

    const id = this.extractId(artistDoc);
    if (!id) return null;

    const genres: string[] = [];
    if (Array.isArray(artistDoc.genres)) {
      for (const g of artistDoc.genres) {
        if (typeof g === 'object' && g.name) genres.push(g.name);
        else if (typeof g === 'string') genres.push(g);
      }
    }

    return {
      type: 'artist',
      id,
      name: artistDoc.name || 'Unknown Artist',
      bio: artistDoc.bio,
      profileImage: artistDoc.profileImage || artistDoc.avatar,
      avatar: artistDoc.avatar || artistDoc.profileImage,
      verified: Boolean(artistDoc.verified),
      genres,
      monthlyListeners: artistDoc.monthlyListeners,
      score: Number(score.toFixed(4)),
      matchReason: matchReason || 'Artist catalog match',
      rankingBreakdown: breakdown,
      source,
      sources: [source],
    };
  }

  /**
   * Public-Safe Normalization for Albums:
   * Strips internal database fields like `__v`, internal vectors.
   */
  public static normalizeAlbum(
    albumDoc: any,
    source: DiscoverySourceType = 'keyword_search',
    score: number = 1.0,
    matchReason?: string,
    breakdown?: Partial<RankingScoreBreakdown>
  ): NormalizedAlbumItem | null {
    if (!albumDoc) return null;

    const id = this.extractId(albumDoc);
    if (!id) return null;

    let artist: NormalizedArtistSummary | null = null;
    if (albumDoc.artist) {
      if (typeof albumDoc.artist === 'object') {
        artist = {
          id: this.extractId(albumDoc.artist),
          name: albumDoc.artist.name || 'Unknown Artist',
          avatar: albumDoc.artist.avatar || albumDoc.artist.profileImage,
          profileImage: albumDoc.artist.profileImage || albumDoc.artist.avatar,
          verified: Boolean(albumDoc.artist.verified),
        };
      } else {
        artist = {
          id: String(albumDoc.artist),
          name: 'Unknown Artist',
        };
      }
    }

    let genre: NormalizedGenreSummary | null = null;
    if (albumDoc.genre) {
      if (typeof albumDoc.genre === 'object') {
        genre = {
          id: this.extractId(albumDoc.genre),
          name: albumDoc.genre.name || 'General',
          slug: albumDoc.genre.slug,
        };
      } else {
        genre = {
          id: String(albumDoc.genre),
          name: String(albumDoc.genre),
        };
      }
    }

    return {
      type: 'album',
      id,
      title: albumDoc.title || 'Untitled Album',
      artist,
      genre,
      coverImage: albumDoc.coverImage,
      releaseYear: albumDoc.releaseYear,
      trackCount: Array.isArray(albumDoc.songs) ? albumDoc.songs.length : albumDoc.trackCount,
      score: Number(score.toFixed(4)),
      matchReason: matchReason || 'Album catalog match',
      rankingBreakdown: breakdown,
      source,
      sources: [source],
    };
  }

  /**
   * Main unified discovery entrypoint.
   * Coordinates keyword search, semantic search, and personalized recommendation pipeline,
   * evaluating long-term taste, session preferences, novelty, and artist/genre diversity.
   */
  public static async discover(options: UnifiedDiscoveryOptions = {}): Promise<UnifiedDiscoveryResponse> {
    const startTime = Date.now();
    const {
      query = '',
      mode = 'all',
      userId,
      seedSongId,
      page = 1,
      limit = 10,
      includeEntities = ['artists', 'similarArtists', 'albums', 'songs', 'recommendedSongs'],
      customRankingWeights,
    } = options;

    const rankingWeights: UnifiedSearchRankingWeights = {
      ...activeUnifiedRankingWeights,
      ...customRankingWeights,
    };

    const trimmedQuery = (query || '').trim();
    const safePage = Math.max(1, Math.floor(page));
    const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
    const sourcesUsed: DiscoverySourceType[] = [];

    const songsMap = new Map<string, NormalizedSongItem>();
    const recommendedSongsMap = new Map<string, NormalizedSongItem>();
    const artistsMap = new Map<string, NormalizedArtistItem>();
    const similarArtistsMap = new Map<string, NormalizedArtistItem>();
    const albumsMap = new Map<string, NormalizedAlbumItem>();

    let fallbackApplied = false;
    let userState: string | undefined;

    const searchSongs = includeEntities.includes('songs');
    const searchArtists = includeEntities.includes('artists');
    const searchSimilarArtists = includeEntities.includes('similarArtists');
    const searchAlbums = includeEntities.includes('albums');
    const searchRecommended = includeEntities.includes('recommendedSongs');

    const internalFetchLimit = safeLimit * safePage * 3;

    const currentMode: string = mode || 'all';
    const executeKeyword = Boolean(trimmedQuery && (currentMode === 'all' || currentMode === 'keyword' || currentMode === 'hybrid'));
    const executeSemantic = Boolean(trimmedQuery && (currentMode === 'all' || currentMode === 'semantic' || currentMode === 'hybrid'));
    const executeRecommendations = Boolean(
      currentMode === 'recommendations' ||
      currentMode === 'all' ||
      currentMode === 'hybrid' ||
      (!trimmedQuery && (currentMode === 'all' || currentMode === 'hybrid' || currentMode === 'recommendations'))
    );

    // 1. Keyword Search Execution (Exact & text matches take absolute priority for query items)
    if (executeKeyword) {
      try {
        const keywordResults: GroupedSearchResults = await searchCatalog(trimmedQuery, internalFetchLimit);
        sourcesUsed.push('keyword_search');

        if (searchSongs && Array.isArray(keywordResults.songs)) {
          keywordResults.songs.forEach((s) => {
            const { finalScore, matchReason, breakdown } = this.calculateSongRanking(
              s,
              trimmedQuery,
              0,
              rankingWeights
            );
            const normalized = this.normalizeSong(s, 'keyword_search', finalScore, matchReason, breakdown);
            if (normalized) {
              this.mergeSong(songsMap, normalized);
            }
          });
        }

        if (searchArtists && Array.isArray(keywordResults.artists)) {
          keywordResults.artists.forEach((a) => {
            const { finalScore, matchReason, breakdown } = this.calculateArtistRanking(
              a,
              trimmedQuery,
              0,
              rankingWeights
            );
            const normalized = this.normalizeArtist(a, 'keyword_search', finalScore, matchReason, breakdown);
            if (normalized) {
              this.mergeArtist(artistsMap, normalized);
            }
          });
        }

        if (searchAlbums && Array.isArray(keywordResults.albums)) {
          keywordResults.albums.forEach((al) => {
            const { finalScore, matchReason, breakdown } = this.calculateAlbumRanking(
              al,
              trimmedQuery,
              0,
              rankingWeights
            );
            const normalized = this.normalizeAlbum(al, 'keyword_search', finalScore, matchReason, breakdown);
            if (normalized) {
              this.mergeAlbum(albumsMap, normalized);
            }
          });
        }
      } catch (err: any) {
        console.warn('[UnifiedDiscovery] Keyword search error:', err.message);
      }
    }

    // 2. Semantic Search Execution (Vector cosine similarity)
    if (executeSemantic) {
      try {
        const semanticResults: SemanticSearchResult[] = await SemanticSearchService.searchSongsBySemanticQuery(
          trimmedQuery,
          internalFetchLimit
        );

        if (Array.isArray(semanticResults) && semanticResults.length > 0) {
          sourcesUsed.push('semantic_search');

          for (const item of semanticResults) {
            const similarity = typeof item.similarityScore === 'number' ? item.similarityScore : 0.8;

            if (searchSongs && item.song) {
              const { finalScore, matchReason, breakdown } = this.calculateSongRanking(
                item.song,
                trimmedQuery,
                similarity,
                rankingWeights
              );
              const normalized = this.normalizeSong(item.song, 'semantic_search', finalScore, matchReason, breakdown);
              if (normalized) {
                this.mergeSong(songsMap, normalized);
              }
            }

            if (searchArtists && item.song?.artist && typeof item.song.artist === 'object') {
              const { finalScore, matchReason, breakdown } = this.calculateArtistRanking(
                item.song.artist,
                trimmedQuery,
                similarity * 0.9,
                rankingWeights
              );
              const normalizedArtist = this.normalizeArtist(
                item.song.artist,
                'semantic_search',
                finalScore,
                matchReason,
                breakdown
              );
              if (normalizedArtist) {
                this.mergeArtist(artistsMap, normalizedArtist);
              }
            }

            if (searchAlbums && item.song?.album && typeof item.song.album === 'object') {
              const { finalScore, matchReason, breakdown } = this.calculateAlbumRanking(
                item.song.album,
                trimmedQuery,
                similarity * 0.9,
                rankingWeights
              );
              const normalizedAlbum = this.normalizeAlbum(
                item.song.album,
                'semantic_search',
                finalScore,
                matchReason,
                breakdown
              );
              if (normalizedAlbum) {
                this.mergeAlbum(albumsMap, normalizedAlbum);
              }
            }
          }
        }
      } catch (err: any) {
        console.warn('[UnifiedDiscovery] Semantic search error:', err.message);
      }
    }

    // 3. Personalized Recommendation Engine Execution
    if (executeRecommendations && (searchRecommended || searchSongs)) {
      // 3A. Personalized Discovery via Existing Recommendation Post-Ranking Pipeline
      if (userId && Types.ObjectId.isValid(userId)) {
        try {
          const [tasteProfile, rawCandidates] = await Promise.all([
            UserTasteProfileService.generateTasteProfile(userId).catch(() => null),
            CandidateGenerationService.generateHybridCandidates({
              userId,
              seedSongId,
              candidateLimit: internalFetchLimit * 2,
            }).catch(() => []),
          ]);

          if (rawCandidates.length > 0) {
            sourcesUsed.push('recommendation');
            const postRankedRes = await RecommendationPostRankingPipeline.executePostRanking({
              userId,
              items: rawCandidates,
              tasteProfile: tasteProfile || undefined,
              targetLimit: internalFetchLimit,
            });

            if (Array.isArray(postRankedRes) && postRankedRes.length > 0) {
              postRankedRes.forEach((item) => {
                const score = item.finalScore || 0.85;
                const songDoc = item.song || (item.item as any)?.song || item.item;
                const normalized = this.normalizeSong(
                  songDoc,
                  'recommendation',
                  score,
                  `Personalized AI match (${Math.round(score * 100)}% taste affinity)`
                );
                if (normalized) {
                  if (currentMode === 'recommendations' || !trimmedQuery) {
                    this.mergeSong(songsMap, normalized);
                  }
                  this.mergeSong(recommendedSongsMap, normalized);
                }
              });
            }
          }
        } catch (err: any) {
          console.warn('[UnifiedDiscovery] Post-ranking recommendation error:', err.message);
        }
      }

      // 3B. Seed Song Recommendations Fallback
      if (seedSongId && Types.ObjectId.isValid(seedSongId) && recommendedSongsMap.size === 0) {
        try {
          const recSongs = await ContentRecommendationService.getRecommendationsForSong(seedSongId, internalFetchLimit);
          if (Array.isArray(recSongs) && recSongs.length > 0) {
            sourcesUsed.push('recommendation');
            recSongs.forEach((s) => {
              const score = typeof s.similarityScore === 'number' ? s.similarityScore : 0.80;
              const { finalScore, matchReason, breakdown } = this.calculateSongRanking(
                s,
                trimmedQuery,
                score,
                rankingWeights
              );
              const normalized = this.normalizeSong(
                s,
                'recommendation',
                finalScore,
                'Content similarity recommendation',
                breakdown
              );
              if (normalized) {
                if (currentMode === 'recommendations' || !trimmedQuery) {
                  this.mergeSong(songsMap, normalized);
                }
                this.mergeSong(recommendedSongsMap, normalized);
              }
            });
          }
        } catch (err: any) {
          console.warn('[UnifiedDiscovery] Content recommendation error:', err.message);
        }
      }

      // 3C. Hybrid Recommendation Service Fallback
      if (userId && Types.ObjectId.isValid(userId) && recommendedSongsMap.size === 0) {
        try {
          const hybridRes = await HybridRecommendationService.getHybridRecommendations({
            userId,
            limit: internalFetchLimit,
          });

          userState = hybridRes.userClassification;
          if (hybridRes.recommendations.length > 0) {
            sourcesUsed.push('recommendation');
            hybridRes.recommendations.forEach((item) => {
              const hybridScore = item.hybridScore || 0.8;
              const { finalScore, matchReason, breakdown } = this.calculateSongRanking(
                item.song,
                trimmedQuery,
                hybridScore,
                rankingWeights
              );
              const normalized = this.normalizeSong(
                item.song,
                'recommendation',
                finalScore,
                matchReason || `Personalized ${hybridRes.strategyUsed.toLowerCase()} recommendation`,
                breakdown
              );
              if (normalized) {
                if (currentMode === 'recommendations' || !trimmedQuery) {
                  this.mergeSong(songsMap, normalized);
                }
                this.mergeSong(recommendedSongsMap, normalized);
              }
            });
          }
        } catch (err: any) {
          console.warn('[UnifiedDiscovery] Hybrid recommendation error:', err.message);
        }
      }

      // 3D. Public Trending / Cold-Start Catalog Fallback
      if (recommendedSongsMap.size === 0 || (songsMap.size === 0 && !trimmedQuery)) {
        try {
          fallbackApplied = true;
          const trendingSongs = await TrendingService.getTrendingSongs(internalFetchLimit);
          if (Array.isArray(trendingSongs) && trendingSongs.length > 0) {
            sourcesUsed.push('trending');
            trendingSongs.forEach((s) => {
              const { finalScore, matchReason, breakdown } = this.calculateSongRanking(
                s,
                '',
                0,
                rankingWeights
              );
              const normalized = this.normalizeSong(s, 'trending', finalScore, 'Trending popular track', breakdown);
              if (normalized) {
                if (!trimmedQuery || currentMode === 'recommendations') {
                  this.mergeSong(songsMap, normalized);
                }
                this.mergeSong(recommendedSongsMap, normalized);
              }
            });
          }
        } catch (err: any) {
          console.warn('[UnifiedDiscovery] Trending fallback error:', err.message);
        }
      }
    }

    // 4. Personalized Similar Artists & Related Discovery
    if (searchSimilarArtists && artistsMap.size > 0) {
      try {
        const topMatchedArtists = Array.from(artistsMap.values()).slice(0, 3);
        const genresToFind = Array.from(new Set(topMatchedArtists.flatMap((a) => a.genres))).filter(Boolean);
        const matchedArtistIds = topMatchedArtists.map((a) => a.id);

        if (genresToFind.length > 0) {
          const similarArtistDocs = await Artist.find({
            genres: { $in: genresToFind },
            _id: { $nin: matchedArtistIds.map((id) => new Types.ObjectId(id)) },
          })
            .limit(4)
            .lean();

          if (Array.isArray(similarArtistDocs)) {
            for (const doc of similarArtistDocs) {
              const normalized = this.normalizeArtist(
                doc,
                'recommendation',
                0.80,
                `Similar genre artist (${genresToFind[0]})`
              );
              if (normalized) {
                this.mergeArtist(similarArtistsMap, normalized);
              }
            }
          }
        }
      } catch (err: any) {
        console.warn('[UnifiedDiscovery] Similar artists discovery error:', err.message);
      }
    }

    // Filter recommendedSongs to avoid duplicating songs already in primary songs list
    for (const songKey of songsMap.keys()) {
      if (trimmedQuery) {
        recommendedSongsMap.delete(songKey);
      }
    }

    // 5. Sort and Paginate Normalized Collections
    const allSortedArtists = Array.from(artistsMap.values()).sort((a, b) => b.score - a.score);
    const allSortedSimilarArtists = Array.from(similarArtistsMap.values()).sort((a, b) => b.score - a.score);
    const allSortedAlbums = Array.from(albumsMap.values()).sort((a, b) => b.score - a.score);
    const allSortedSongs = Array.from(songsMap.values()).sort((a, b) => b.score - a.score);
    const allSortedRecommended = Array.from(recommendedSongsMap.values()).sort((a, b) => b.score - a.score);

    const startIndex = (safePage - 1) * safeLimit;
    const endIndex = safePage * safeLimit;

    const pagedArtists = allSortedArtists.slice(startIndex, endIndex);
    const pagedAlbums = allSortedAlbums.slice(startIndex, endIndex);
    const pagedSongs = allSortedSongs.slice(startIndex, endIndex);
    const pagedRecommended = allSortedRecommended.slice(startIndex, endIndex);

    const totalArtists = allSortedArtists.length;
    const totalAlbums = allSortedAlbums.length;
    const totalSongs = allSortedSongs.length;
    const totalRecommended = allSortedRecommended.length;
    const totalCount = totalArtists + totalAlbums + totalSongs + totalRecommended;

    const tookMs = Date.now() - startTime;

    return {
      query: trimmedQuery,
      mode,
      results: {
        artists: pagedArtists,
        similarArtists: allSortedSimilarArtists.length > 0 ? allSortedSimilarArtists : undefined,
        albums: pagedAlbums,
        songs: pagedSongs,
        recommendedSongs: pagedRecommended,
      },
      counts: {
        artists: totalArtists,
        similarArtists: allSortedSimilarArtists.length > 0 ? allSortedSimilarArtists.length : undefined,
        albums: totalAlbums,
        songs: totalSongs,
        recommendedSongs: totalRecommended,
        total: totalCount,
      },
      pagination: {
        page: safePage,
        limit: safeLimit,
        totalPages: {
          artists: Math.ceil(totalArtists / safeLimit) || 1,
          albums: Math.ceil(totalAlbums / safeLimit) || 1,
          songs: Math.ceil(totalSongs / safeLimit) || 1,
          recommendedSongs: Math.ceil(totalRecommended / safeLimit) || 1,
        },
        hasMore: {
          artists: endIndex < totalArtists,
          albums: endIndex < totalAlbums,
          songs: endIndex < totalSongs,
          recommendedSongs: endIndex < totalRecommended,
        },
      },
      metadata: {
        executedAt: new Date().toISOString(),
        sourcesUsed: Array.from(new Set(sourcesUsed)),
        tookMs,
        hasResults: totalCount > 0,
        fallbackApplied,
        userState,
        rankingWeightsApplied: rankingWeights,
        isAuthenticated: Boolean(userId),
      },
    };
  }

  /**
   * Deduplicating merge helpers that preserve highest score and collect multiple source tags
   */
  private static mergeSong(map: Map<string, NormalizedSongItem>, incoming: NormalizedSongItem): void {
    const existing = map.get(incoming.id);
    if (!existing) {
      map.set(incoming.id, incoming);
    } else {
      if (incoming.score > existing.score) {
        existing.score = incoming.score;
        existing.matchReason = incoming.matchReason;
        existing.rankingBreakdown = incoming.rankingBreakdown;
      }
      if (!existing.sources.includes(incoming.source)) {
        existing.sources.push(incoming.source);
      }
    }
  }

  private static mergeArtist(map: Map<string, NormalizedArtistItem>, incoming: NormalizedArtistItem): void {
    const existing = map.get(incoming.id);
    if (!existing) {
      map.set(incoming.id, incoming);
    } else {
      if (incoming.score > existing.score) {
        existing.score = incoming.score;
        existing.matchReason = incoming.matchReason;
        existing.rankingBreakdown = incoming.rankingBreakdown;
      }
      if (!existing.sources.includes(incoming.source)) {
        existing.sources.push(incoming.source);
      }
    }
  }

  private static mergeAlbum(map: Map<string, NormalizedAlbumItem>, incoming: NormalizedAlbumItem): void {
    const existing = map.get(incoming.id);
    if (!existing) {
      map.set(incoming.id, incoming);
    } else {
      if (incoming.score > existing.score) {
        existing.score = incoming.score;
        existing.matchReason = incoming.matchReason;
        existing.rankingBreakdown = incoming.rankingBreakdown;
      }
      if (!existing.sources.includes(incoming.source)) {
        existing.sources.push(incoming.source);
      }
    }
  }
}
