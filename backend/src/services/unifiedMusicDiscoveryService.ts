import { Types } from 'mongoose';
import { searchCatalog, GroupedSearchResults } from './searchService.js';
import { SemanticSearchService, SemanticSearchResult } from './semanticSearchService.js';
import { HybridRecommendationService } from './hybridRecommendationService.js';
import { ContentRecommendationService } from './recommendationService.js';
import { TrendingService } from './trendingService.js';
import { ColdStartRecommendationService } from './coldStartRecommendationService.js';

export type DiscoverySourceType = 'keyword_search' | 'semantic_search' | 'recommendation' | 'trending' | 'hybrid';

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
  source: DiscoverySourceType;
  sources: DiscoverySourceType[];
  raw?: any;
}

export interface UnifiedDiscoveryOptions {
  query?: string;
  mode?: 'all' | 'keyword' | 'semantic' | 'recommendations' | 'hybrid';
  userId?: string;
  seedSongId?: string;
  limit?: number;
  includeEntities?: ('songs' | 'artists' | 'albums')[];
}

export interface UnifiedDiscoveryResponse {
  query: string;
  mode: 'all' | 'keyword' | 'semantic' | 'recommendations' | 'hybrid';
  results: {
    songs: NormalizedSongItem[];
    artists: NormalizedArtistItem[];
    albums: NormalizedAlbumItem[];
  };
  counts: {
    songs: number;
    artists: number;
    albums: number;
    total: number;
  };
  metadata: {
    executedAt: string;
    sourcesUsed: DiscoverySourceType[];
    tookMs: number;
    hasResults: boolean;
    fallbackApplied: boolean;
    userState?: string;
  };
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
   * Normalize any Song document into the unified NormalizedSongItem structure
   */
  public static normalizeSong(
    songDoc: any,
    source: DiscoverySourceType = 'keyword_search',
    score: number = 1.0,
    matchReason?: string
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
      source,
      sources: [source],
      raw: songDoc,
    };
  }

  /**
   * Normalize any Artist document into the unified NormalizedArtistItem structure
   */
  public static normalizeArtist(
    artistDoc: any,
    source: DiscoverySourceType = 'keyword_search',
    score: number = 1.0,
    matchReason?: string
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
      source,
      sources: [source],
      raw: artistDoc,
    };
  }

  /**
   * Normalize any Album document into the unified NormalizedAlbumItem structure
   */
  public static normalizeAlbum(
    albumDoc: any,
    source: DiscoverySourceType = 'keyword_search',
    score: number = 1.0,
    matchReason?: string
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
      source,
      sources: [source],
      raw: albumDoc,
    };
  }

  /**
   * Main unified discovery entrypoint.
   * Coordinates keyword search, semantic search, and recommendation services with deduplication and normalized formatting.
   */
  public static async discover(options: UnifiedDiscoveryOptions = {}): Promise<UnifiedDiscoveryResponse> {
    const startTime = Date.now();
    const {
      query = '',
      mode = 'all',
      userId,
      seedSongId,
      limit = 10,
      includeEntities = ['songs', 'artists', 'albums'],
    } = options;

    const trimmedQuery = (query || '').trim();
    const safeLimit = Math.max(1, Math.min(50, limit));
    const sourcesUsed: DiscoverySourceType[] = [];

    const songsMap = new Map<string, NormalizedSongItem>();
    const artistsMap = new Map<string, NormalizedArtistItem>();
    const albumsMap = new Map<string, NormalizedAlbumItem>();

    let fallbackApplied = false;
    let userState: string | undefined;

    const searchSongs = includeEntities.includes('songs');
    const searchArtists = includeEntities.includes('artists');
    const searchAlbums = includeEntities.includes('albums');

    // 1. Keyword Search Execution (if mode is 'all', 'keyword', or 'hybrid')
    if (trimmedQuery && (mode === 'all' || mode === 'keyword' || mode === 'hybrid')) {
      try {
        const keywordResults: GroupedSearchResults = await searchCatalog(trimmedQuery, safeLimit);
        sourcesUsed.push('keyword_search');

        if (searchSongs && Array.isArray(keywordResults.songs)) {
          keywordResults.songs.forEach((s, idx) => {
            const normalized = this.normalizeSong(s, 'keyword_search', 1.0 - idx * 0.02, 'Exact keyword text match');
            if (normalized) {
              this.mergeSong(songsMap, normalized);
            }
          });
        }

        if (searchArtists && Array.isArray(keywordResults.artists)) {
          keywordResults.artists.forEach((a, idx) => {
            const normalized = this.normalizeArtist(a, 'keyword_search', 1.0 - idx * 0.02, 'Artist keyword text match');
            if (normalized) {
              this.mergeArtist(artistsMap, normalized);
            }
          });
        }

        if (searchAlbums && Array.isArray(keywordResults.albums)) {
          keywordResults.albums.forEach((al, idx) => {
            const normalized = this.normalizeAlbum(al, 'keyword_search', 1.0 - idx * 0.02, 'Album keyword text match');
            if (normalized) {
              this.mergeAlbum(albumsMap, normalized);
            }
          });
        }
      } catch (err: any) {
        console.warn('[UnifiedDiscovery] Keyword search error:', err.message);
      }
    }

    // 2. Semantic Search Execution (if mode is 'all', 'semantic', or 'hybrid')
    if (trimmedQuery && (mode === 'all' || mode === 'semantic' || mode === 'hybrid')) {
      try {
        const semanticResults: SemanticSearchResult[] = await SemanticSearchService.searchSongsBySemanticQuery(
          trimmedQuery,
          safeLimit
        );

        if (Array.isArray(semanticResults) && semanticResults.length > 0) {
          sourcesUsed.push('semantic_search');

          for (const item of semanticResults) {
            if (searchSongs && item.song) {
              const score = typeof item.similarityScore === 'number' ? item.similarityScore : 0.8;
              const normalized = this.normalizeSong(
                item.song,
                'semantic_search',
                score,
                `Semantic match (${Math.round(score * 100)}% similarity)`
              );
              if (normalized) {
                this.mergeSong(songsMap, normalized);
              }
            }

            // Extract associated artists and albums from semantic songs
            if (searchArtists && item.song?.artist && typeof item.song.artist === 'object') {
              const normalizedArtist = this.normalizeArtist(
                item.song.artist,
                'semantic_search',
                (item.similarityScore || 0.7) * 0.9,
                'Related artist from semantic query'
              );
              if (normalizedArtist) {
                this.mergeArtist(artistsMap, normalizedArtist);
              }
            }

            if (searchAlbums && item.song?.album && typeof item.song.album === 'object') {
              const normalizedAlbum = this.normalizeAlbum(
                item.song.album,
                'semantic_search',
                (item.similarityScore || 0.7) * 0.9,
                'Related album from semantic query'
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

    // 3. Recommendation Services Execution (if mode is 'all', 'recommendations', or 'hybrid', or if query is empty)
    const shouldRunRecommendations =
      mode === 'recommendations' ||
      (!trimmedQuery && (mode === 'all' || mode === 'hybrid')) ||
      (mode === 'all' && (userId || seedSongId));

    if (shouldRunRecommendations && searchSongs) {
      // 3A. Seed Song Recommendations
      if (seedSongId && Types.ObjectId.isValid(seedSongId)) {
        try {
          const recSongs = await ContentRecommendationService.getRecommendationsForSong(seedSongId, safeLimit);
          if (Array.isArray(recSongs) && recSongs.length > 0) {
            sourcesUsed.push('recommendation');
            recSongs.forEach((s, idx) => {
              const score = typeof s.similarityScore === 'number' ? s.similarityScore : 0.85 - idx * 0.03;
              const normalized = this.normalizeSong(s, 'recommendation', score, 'Content similarity recommendation');
              if (normalized) {
                this.mergeSong(songsMap, normalized);
              }
            });
          }
        } catch (err: any) {
          console.warn('[UnifiedDiscovery] Content recommendation error:', err.message);
        }
      }

      // 3B. Personalized User Hybrid Recommendations
      if (userId && Types.ObjectId.isValid(userId)) {
        try {
          const hybridRes = await HybridRecommendationService.getHybridRecommendations({
            userId,
            limit: safeLimit,
          });

          userState = hybridRes.userClassification;
          if (hybridRes.recommendations.length > 0) {
            sourcesUsed.push('recommendation');
            hybridRes.recommendations.forEach((item) => {
              const score = item.hybridScore || 0.8;
              const normalized = this.normalizeSong(
                item.song,
                'recommendation',
                score,
                `Personalized ${hybridRes.strategyUsed.toLowerCase()} recommendation`
              );
              if (normalized) {
                this.mergeSong(songsMap, normalized);
              }
            });
          }
        } catch (err: any) {
          console.warn('[UnifiedDiscovery] Hybrid recommendation error:', err.message);
        }
      }

      // 3C. Trending / Cold Start Catalog Fallback if maps are empty and no query was given
      if (songsMap.size === 0 && !trimmedQuery) {
        try {
          fallbackApplied = true;
          const trendingSongs = await TrendingService.getTrendingSongs(safeLimit);
          if (Array.isArray(trendingSongs) && trendingSongs.length > 0) {
            sourcesUsed.push('trending');
            trendingSongs.forEach((s, idx) => {
              const score = 0.9 - idx * 0.03;
              const normalized = this.normalizeSong(s, 'trending', score, 'Trending popular track');
              if (normalized) {
                this.mergeSong(songsMap, normalized);
              }
            });
          }
        } catch (err: any) {
          console.warn('[UnifiedDiscovery] Trending fallback error:', err.message);
        }
      }
    }

    // 4. Sort and Limit Final Normalized Collections
    const sortedSongs = Array.from(songsMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, safeLimit);

    const sortedArtists = Array.from(artistsMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, safeLimit);

    const sortedAlbums = Array.from(albumsMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, safeLimit);

    const totalCount = sortedSongs.length + sortedArtists.length + sortedAlbums.length;
    const tookMs = Date.now() - startTime;

    return {
      query: trimmedQuery,
      mode,
      results: {
        songs: sortedSongs,
        artists: sortedArtists,
        albums: sortedAlbums,
      },
      counts: {
        songs: sortedSongs.length,
        artists: sortedArtists.length,
        albums: sortedAlbums.length,
        total: totalCount,
      },
      metadata: {
        executedAt: new Date().toISOString(),
        sourcesUsed: Array.from(new Set(sourcesUsed)),
        tookMs,
        hasResults: totalCount > 0,
        fallbackApplied,
        userState,
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
      }
      if (!existing.sources.includes(incoming.source)) {
        existing.sources.push(incoming.source);
      }
    }
  }
}
