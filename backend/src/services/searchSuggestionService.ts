import { Song } from '../models/Song.js';
import { Artist } from '../models/Artist.js';
import { Album } from '../models/Album.js';

export type SuggestionEntityType = 'artist' | 'song' | 'album';
export type SuggestionMatchType = 'exact_prefix' | 'word_prefix' | 'substring';

export interface SearchSuggestionItem {
  id: string;
  title: string;
  type: SuggestionEntityType;
  subtitle?: string;
  coverImage?: string;
  avatar?: string;
  score: number;
  matchType: SuggestionMatchType;
}

export interface SearchSuggestionResponse {
  query: string;
  suggestions: SearchSuggestionItem[];
  total: number;
}

export interface SearchSuggestionOptions {
  query: string;
  limit?: number;
  includeEntities?: SuggestionEntityType[];
}

export class SearchSuggestionService {
  /**
   * Helper: Sanitizes string by lowercasing and trimming extra whitespace
   */
  public static clean(text?: string): string {
    if (!text || typeof text !== 'string') return '';
    return text.toLowerCase().trim();
  }

  /**
   * Evaluates match type and calculates priority score:
   * 1. Exact full match / Exact prefix match: score in [0.90, 1.00]
   * 2. Word prefix match: score in [0.75, 0.89]
   * 3. Partial substring match: score in [0.50, 0.74]
   */
  public static evaluateMatch(target: string, query: string): { score: number; matchType: SuggestionMatchType } | null {
    const cleanTarget = this.clean(target);
    const cleanQuery = this.clean(query);

    if (!cleanTarget || !cleanQuery) return null;

    if (cleanTarget === cleanQuery) {
      return { score: 1.0, matchType: 'exact_prefix' };
    }

    if (cleanTarget.startsWith(cleanQuery)) {
      // Shorter distance from query length to target length gives slightly higher score
      const lengthBonus = Math.min(0.08, (cleanQuery.length / cleanTarget.length) * 0.08);
      return { score: Number((0.90 + lengthBonus).toFixed(4)), matchType: 'exact_prefix' };
    }

    // Check if any internal word starts with query (e.g. "The Weeknd" starts with "weeknd")
    const words = cleanTarget.split(/[\s\-_/]+/);
    const wordPrefixMatch = words.some((w) => w.startsWith(cleanQuery));
    if (wordPrefixMatch) {
      return { score: 0.80, matchType: 'word_prefix' };
    }

    if (cleanTarget.includes(cleanQuery)) {
      return { score: 0.60, matchType: 'substring' };
    }

    return null;
  }

  /**
   * Main suggestion service method:
   * Queries Artist, Song, and Album collections, applies prefix-first ranking,
   * eliminates duplicate suggestion texts/entities, and returns a lightweight list.
   */
  public static async getSuggestions(options: SearchSuggestionOptions): Promise<SearchSuggestionResponse> {
    const { query = '', limit = 6, includeEntities = ['artist', 'song', 'album'] } = options;
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      return {
        query: '',
        suggestions: [],
        total: 0,
      };
    }

    const safeLimit = Math.max(1, Math.min(20, limit));
    const searchRegex = new RegExp(trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const searchArtists = includeEntities.includes('artist');
    const searchSongs = includeEntities.includes('song');
    const searchAlbums = includeEntities.includes('album');

    const candidates: SearchSuggestionItem[] = [];
    const seenKeys = new Set<string>();

    // Concurrently fetch candidate matches from catalog
    const [artists, songs, albums] = await Promise.all([
      searchArtists
        ? Artist.find({ name: searchRegex })
            .select('_id name profileImage avatar verified genres')
            .limit(safeLimit * 2)
            .lean()
            .catch(() => [])
        : Promise.resolve([]),

      searchSongs
        ? Song.find({ title: searchRegex, isPublished: true })
            .select('_id title duration coverImage artist')
            .populate('artist', 'name')
            .limit(safeLimit * 2)
            .lean()
            .catch(() => [])
        : Promise.resolve([]),

      searchAlbums
        ? Album.find({ title: searchRegex })
            .select('_id title coverImage releaseYear artist')
            .populate('artist', 'name')
            .limit(safeLimit * 2)
            .lean()
            .catch(() => [])
        : Promise.resolve([]),
    ]);

    // 1. Process Artist Matches
    if (Array.isArray(artists)) {
      for (const artist of artists) {
        if (!artist || !artist.name) continue;
        const match = this.evaluateMatch(artist.name, trimmedQuery);
        if (!match) continue;

        const key = `artist:${artist.name.toLowerCase()}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        candidates.push({
          id: String(artist._id),
          title: artist.name,
          type: 'artist',
          subtitle: 'Artist',
          avatar: artist.avatar || artist.profileImage,
          coverImage: artist.profileImage || artist.avatar,
          score: match.score,
          matchType: match.matchType,
        });
      }
    }

    // 2. Process Song Matches
    if (Array.isArray(songs)) {
      for (const song of songs) {
        if (!song || !song.title) continue;
        const match = this.evaluateMatch(song.title, trimmedQuery);
        if (!match) continue;

        const artistName = typeof song.artist === 'object' && song.artist ? (song.artist as any).name : 'Song';
        const key = `song:${song.title.toLowerCase()}:${artistName.toLowerCase()}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        candidates.push({
          id: String(song._id),
          title: song.title,
          type: 'song',
          subtitle: `Song • ${artistName}`,
          coverImage: song.coverImage,
          score: match.score,
          matchType: match.matchType,
        });
      }
    }

    // 3. Process Album Matches
    if (Array.isArray(albums)) {
      for (const album of albums) {
        if (!album || !album.title) continue;
        const match = this.evaluateMatch(album.title, trimmedQuery);
        if (!match) continue;

        const artistName = typeof album.artist === 'object' && album.artist ? (album.artist as any).name : undefined;
        const year = album.releaseYear ? ` • ${album.releaseYear}` : '';
        const subtitle = artistName ? `Album • ${artistName}${year}` : `Album${year}`;

        const key = `album:${album.title.toLowerCase()}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        candidates.push({
          id: String(album._id),
          title: album.title,
          type: 'album',
          subtitle,
          coverImage: album.coverImage,
          score: match.score,
          matchType: match.matchType,
        });
      }
    }

    // 4. Sort by score descending (Prefix matches first) and limit to requested size
    candidates.sort((a, b) => b.score - a.score);
    const results = candidates.slice(0, safeLimit);

    return {
      query: trimmedQuery,
      suggestions: results,
      total: results.length,
    };
  }
}
