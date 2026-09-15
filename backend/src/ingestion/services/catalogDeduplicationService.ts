import { IngestionTrack } from '../types.js';

export function normalizeTrackTitle(title: string): string {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    // Remove deluxe, remastered, anniversary suffixes in parentheses/brackets
    .replace(/\s*[([][^)\]]*(deluxe|remaster|anniversary|expanded|edition|version|bonus|explicit|live|mono|stereo|radio edit)[^)\]]*[)\]]/gi, '')
    // Remove common feat annotations for pure title comparison
    .replace(/\s*[([][^)\]]*(feat|ft\.|featuring)[^)\]]*[)\]]/gi, '')
    .replace(/[^a-z0-9\s]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeArtistName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/^the\s+/i, '')
    .replace(/[^a-z0-9\s]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildTrackDedupeKey(artistName: string, title: string): string {
  return `${normalizeArtistName(artistName)}:::${normalizeTrackTitle(title)}`;
}

export interface ExistingSongRecord {
  id: string;
  title: string;
  artist_id: string;
  album_id?: string | null;
  duration?: number | null;
  cover_image?: string | null;
  release_year?: number | null;
  lyrics?: string | null;
  youtube_video_id?: string | null;
  recommendation_metadata?: any;
}

export class CatalogDeduplicationService {
  /**
   * Matches an incoming track against existing database records for an artist.
   * Priority:
   * 1. Match by external provider ID (iTunes Track ID in recommendation_metadata)
   * 2. Match by normalized artist + normalized track title
   */
  static findMatch(
    incoming: IngestionTrack,
    existingSongs: ExistingSongRecord[]
  ): ExistingSongRecord | null {
    // 1. External Provider ID Match
    if (incoming.itunesTrackId) {
      const matchByProviderId = existingSongs.find(
        (s) => s.recommendation_metadata?.itunesTrackId === incoming.itunesTrackId
      );
      if (matchByProviderId) return matchByProviderId;
    }

    // 2. Normalized Title Match
    const incomingNorm = normalizeTrackTitle(incoming.title);
    if (!incomingNorm) return null;

    const matchByTitle = existingSongs.find((s) => {
      const existingNorm = normalizeTrackTitle(s.title);
      return existingNorm === incomingNorm;
    });

    return matchByTitle || null;
  }

  /**
   * Determines fields that can be safely enriched on an existing record
   * without overwriting valid data or ever touching youtube_video_id.
   */
  static computeEnrichment(
    existing: ExistingSongRecord,
    incoming: IngestionTrack
  ): Record<string, any> | null {
    const updates: Record<string, any> = {};

    if (!existing.cover_image && incoming.coverImage) {
      updates.cover_image = incoming.coverImage;
    }
    if (!existing.release_year && incoming.releaseYear) {
      updates.release_year = incoming.releaseYear;
    }
    if ((!existing.duration || existing.duration === 0) && incoming.duration) {
      updates.duration = incoming.duration;
    }

    // Save provider track ID in recommendation_metadata if not already present
    if (incoming.itunesTrackId && !existing.recommendation_metadata?.itunesTrackId) {
      updates.recommendation_metadata = {
        ...(existing.recommendation_metadata || {}),
        itunesTrackId: incoming.itunesTrackId,
        itunesCollectionId: incoming.itunesCollectionId,
      };
    }

    return Object.keys(updates).length > 0 ? updates : null;
  }
}
