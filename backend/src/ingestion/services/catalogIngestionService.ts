import { supabase } from '../../config/supabase.js';
import { ITunesProvider } from '../providers/itunesProvider.js';
import { MusicBrainzProvider } from '../providers/musicbrainzProvider.js';
import { isEnglishTrack } from '../filters/englishFilter.js';
import {
  CatalogDeduplicationService,
  ExistingSongRecord,
} from './catalogDeduplicationService.js';
import {
  IngestionOptions,
  IngestionReport,
  IngestionTrack,
  IngestionAlbum,
} from '../types.js';
import { AUDIO_SAMPLE_URLS, GENRE_AUDIO_DEFAULTS } from '../../seed.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const GENRE_MAPPINGS: Record<string, string> = {
  pop: 'pop',
  rock: 'rock',
  'alternative rock': 'rock',
  alternative: 'indie',
  indie: 'indie',
  'indie & folk': 'indie',
  'hip-hop': 'hip-hop',
  'hip hop': 'hip-hop',
  rap: 'hip-hop',
  electronic: 'electronic',
  dance: 'electronic',
  edm: 'electronic',
  'r&b': 'r-and-b',
  'r-and-b': 'r-and-b',
  soul: 'r-and-b',
  jazz: 'jazz',
  blues: 'jazz',
  'jazz & blues': 'jazz',
  classical: 'classical',
  metal: 'metal',
  'heavy metal': 'metal',
  country: 'country',
  reggae: 'reggae',
  ska: 'reggae',
};

export class CatalogIngestionService {
  private itunes: ITunesProvider;
  private musicbrainz: MusicBrainzProvider;
  private genreMap: Map<string, string> = new Map(); // key/slug -> uuid

  constructor(delayMs = 150) {
    this.itunes = new ITunesProvider(delayMs);
    this.musicbrainz = new MusicBrainzProvider();
  }

  /**
   * Initializes genre mapping, populating missing standard genres if needed.
   * Completely non-destructive: only appends missing genres, never deletes.
   */
  async initializeGenres(): Promise<void> {
    const { data: genres, error } = await supabase.from('genres').select('id, name, slug');
    if (error) throw new Error(`Failed to load genres: ${error.message}`);

    (genres || []).forEach((g) => {
      this.genreMap.set(g.slug, g.id);
      this.genreMap.set(g.name.toLowerCase(), g.id);
    });

    // Ensure metal, country, reggae exist if needed
    const additionalGenres = [
      {
        name: 'Heavy Metal',
        slug: 'metal',
        description: 'Heavy riffs, distortion, and aggressive rhythmic drive.',
        tags: ['metal', 'heavy', 'guitars', 'hardcore'],
      },
      {
        name: 'Country',
        slug: 'country',
        description: 'Storytelling traditions, acoustic guitars, and heartfelt melodies.',
        tags: ['country', 'americana', 'acoustic', 'roots'],
      },
      {
        name: 'Reggae',
        slug: 'reggae',
        description: 'Syncopated offbeats, heavy basslines, and island rhythms.',
        tags: ['reggae', 'dub', 'roots', 'ska'],
      },
    ];

    for (const g of additionalGenres) {
      if (!this.genreMap.has(g.slug)) {
        const { data: created } = await supabase
          .from('genres')
          .insert({
            name: g.name,
            slug: g.slug,
            description: g.description,
            tags: g.tags,
            is_featured: false,
          })
          .select('id, slug')
          .maybeSingle();

        if (created) {
          this.genreMap.set(created.slug, created.id);
          this.genreMap.set(g.name.toLowerCase(), created.id);
        }
      }
    }
  }

  getGenreId(rawGenre: string): string {
    const normalized = (rawGenre || 'pop').toLowerCase().trim();
    const mappedSlug = GENRE_MAPPINGS[normalized] || 'pop';
    return (
      this.genreMap.get(mappedSlug) ||
      this.genreMap.get('pop') ||
      Array.from(this.genreMap.values())[0]
    );
  }

  /**
   * Finds or creates an artist in Supabase.
   */
  async findOrCreateArtist(
    name: string,
    genreKey: string,
    dryRun = false
  ): Promise<{ artistId: string; isNew: boolean } | null> {
    const trimmed = name.trim();
    const { data: existing } = await supabase
      .from('artists')
      .select('id, name')
      .ilike('name', trimmed)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return { artistId: existing.id, isNew: false };
    }

    if (dryRun) {
      return { artistId: 'mock-artist-id', isNew: true };
    }

    // Resolve artist from iTunes to get real image
    const itunesInfo = await this.itunes.searchArtist(trimmed);
    const itunesAlbums = itunesInfo
      ? await this.itunes.fetchArtistAlbums(itunesInfo.artistId, trimmed, 1)
      : [];
    const image = itunesAlbums[0]?.coverImage || '';

    const genreId = this.getGenreId(genreKey);

    const { data: created, error } = await supabase
      .from('artists')
      .insert({
        name: trimmed,
        bio: `${trimmed} — real recording artist, catalogued from verified public music metadata.`,
        profile_image: image,
        avatar: image,
        banner_image: image,
        monthly_listeners: Math.floor(Math.random() * 3500000) + 250000,
        verified: true,
        tags: [genreKey.toLowerCase()],
      })
      .select('id')
      .single();

    if (error || !created) {
      console.warn(`[Ingestion] Failed to create artist "${trimmed}": ${error?.message}`);
      return null;
    }

    // Link artist to genre
    if (genreId) {
      await supabase.from('artist_genres').insert({
        artist_id: created.id,
        genre_id: genreId,
      });
    }

    return { artistId: created.id, isNew: true };
  }

  /**
   * Finds or creates an album for an artist in Supabase.
   */
  async findOrCreateAlbum(
    artistId: string,
    album: IngestionAlbum,
    dryRun = false
  ): Promise<{ albumId: string; isNew: boolean } | null> {
    const { data: existing } = await supabase
      .from('albums')
      .select('id, title')
      .eq('artist_id', artistId)
      .ilike('title', album.title.trim())
      .limit(1)
      .maybeSingle();

    if (existing) {
      return { albumId: existing.id, isNew: false };
    }

    if (dryRun) {
      return { albumId: 'mock-album-id', isNew: true };
    }

    const genreId = this.getGenreId(album.genreKey);

    const { data: created, error } = await supabase
      .from('albums')
      .insert({
        title: album.title.trim(),
        artist_id: artistId,
        genre_id: genreId || null,
        cover_image: album.coverImage || null,
        release_year: album.releaseYear || null,
        album_type: album.albumType,
        total_tracks: album.totalTracks || 1,
        tags: [album.genreKey.toLowerCase()],
      })
      .select('id')
      .single();

    if (error || !created) {
      console.warn(`[Ingestion] Failed to create album "${album.title}": ${error?.message}`);
      return null;
    }

    return { albumId: created.id, isNew: true };
  }

  /**
   * Ingests full catalog for a single artist.
   * Pulls their albums and full tracklists, deduplicating against existing DB rows.
   */
  async ingestArtistCatalog(
    artistName: string,
    genreKey: string,
    options: IngestionOptions = {}
  ): Promise<{
    songsAdded: number;
    albumsAdded: number;
    duplicatesSkipped: number;
    filteredCount: number;
  }> {
    const { dryRun = false } = options;
    let songsAdded = 0;
    let albumsAdded = 0;
    let duplicatesSkipped = 0;
    let filteredCount = 0;

    // 1. Resolve artist in iTunes
    const itunesArtist = await this.itunes.searchArtist(artistName);
    if (!itunesArtist) {
      return { songsAdded: 0, albumsAdded: 0, duplicatesSkipped: 0, filteredCount: 0 };
    }

    // 2. Find or create artist in Supabase
    const artistRes = await this.findOrCreateArtist(artistName, genreKey, dryRun);
    if (!artistRes) return { songsAdded: 0, albumsAdded: 0, duplicatesSkipped: 0, filteredCount: 0 };
    const artistId = artistRes.artistId;

    // 3. Load existing songs for this artist to perform in-memory deduplication
    const { data: existingSongsRaw } = await supabase
      .from('songs')
      .select('id, title, artist_id, album_id, duration, cover_image, release_year, lyrics, youtube_video_id, recommendation_metadata')
      .eq('artist_id', artistId);

    const existingSongs: ExistingSongRecord[] = (existingSongsRaw || []).map((r: any) => ({
      id: r.id,
      title: r.title,
      artist_id: r.artist_id,
      album_id: r.album_id,
      duration: r.duration,
      cover_image: r.cover_image,
      release_year: r.release_year,
      lyrics: r.lyrics,
      youtube_video_id: r.youtube_video_id,
      recommendation_metadata: r.recommendation_metadata,
    }));

    const isFullDiscography = [
      'frank ocean',
      'franck ocean',
      'kanye west',
      'a$ap rocky',
      'asap rocky',
      'travis scott',
      'playboi carti',
      'kendrick lamar',
      'drake',
      'the weeknd',
      'tyler, the creator',
      'taylor swift',
      'mac miller',
      'juice wrld',
      'j. cole',
      'future',
      'eminem',
      'radiohead',
    ].some((name) => artistName.toLowerCase().includes(name));

    // 4. Fetch artist's albums from iTunes:
    // For full discography acts, pull up to 200 releases keeping all editions/deluxe/singles.
    // Track-level deduplication against the DB ensures zero duplicate tracks are created.
    const albumLimit = isFullDiscography ? 200 : 60;
    const itunesAlbums = await this.itunes.fetchArtistAlbums(
      itunesArtist.artistId,
      artistName,
      albumLimit,
      !isFullDiscography
    );
    if (itunesAlbums.length === 0) return { songsAdded: 0, albumsAdded: 0, duplicatesSkipped: 0, filteredCount: 0 };

    // Select albums: full discography for prioritized artists, top 40 for others
    const selectedAlbums = isFullDiscography ? itunesAlbums : itunesAlbums.slice(0, 40);

    let audioIdx = 0;
    const pendingSongs: any[] = [];

    for (const album of selectedAlbums) {
      if (!album.itunesCollectionId) continue;

      const tracks = await this.itunes.fetchAlbumTracks(
        album.itunesCollectionId,
        artistName,
        album.title,
        genreKey
      );

      if (tracks.length === 0) continue;

      // Ensure album row exists
      const albumRes = await this.findOrCreateAlbum(artistId, album, dryRun);
      if (!albumRes) continue;
      if (albumRes.isNew) albumsAdded++;
      const albumId = albumRes.albumId;

      for (const track of tracks) {
        // English and quality gatekeeper
        const filterRes = isEnglishTrack(track);
        if (!filterRes.valid) {
          filteredCount++;
          continue;
        }

        // Deduplication check
        const match = CatalogDeduplicationService.findMatch(track, existingSongs);
        if (match) {
          duplicatesSkipped++;
          // Safe enrichment check
          if (!dryRun) {
            const updates = CatalogDeduplicationService.computeEnrichment(match, track);
            if (updates) {
              await supabase.from('songs').update(updates as any).eq('id', match.id);
            }
          }
          continue;
        }

        // Not in DB: prepare new song record
        const genreId = this.getGenreId(genreKey);
        const defaults =
          GENRE_AUDIO_DEFAULTS[genreKey.toLowerCase()] ||
          GENRE_AUDIO_DEFAULTS.pop;
        const sampleAudioUrl = AUDIO_SAMPLE_URLS[audioIdx % AUDIO_SAMPLE_URLS.length];
        audioIdx++;

        const songRow = {
          title: track.title,
          artist_id: artistId,
          album_id: albumId,
          genre_id: genreId,
          duration: track.duration,
          cover_image: track.coverImage || album.coverImage || '',
          audio_url: sampleAudioUrl,
          release_year: track.releaseYear || album.releaseYear || null,
          audio_features: {
            bpm: defaults.bpm,
            energy: defaults.energy,
            danceability: Math.round((0.5 + Math.random() * 0.4) * 100) / 100,
            valence: defaults.valence,
            acousticness: defaults.acousticness,
            instrumentalness: defaults.instrumentalness,
          },
          tags: [genreKey.toLowerCase(), 'english-catalog'],
          language: 'English',
          explicit: Boolean(track.explicit),
          lyrics: '',
          is_published: true,
          youtube_video_id: null, // Strict requirement: resolved lazily on first user play
          recommendation_metadata: {
            itunesTrackId: track.itunesTrackId,
            itunesCollectionId: album.itunesCollectionId,
            isrc: track.isrc,
          },
        };

        pendingSongs.push(songRow);
        // Track in local list so subsequent tracks in other albums don't duplicate
        existingSongs.push({
          id: `temp-${Math.random()}`,
          title: track.title,
          artist_id: artistId,
          recommendation_metadata: songRow.recommendation_metadata,
        });
      }
    }

    // 5. Bulk insert pending tracks in chunks
    if (!dryRun && pendingSongs.length > 0) {
      const CHUNK_SIZE = 200;
      for (let i = 0; i < pendingSongs.length; i += CHUNK_SIZE) {
        const chunk = pendingSongs.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase.from('songs').insert(chunk);
        if (error) {
          console.warn(`[Ingestion] Failed to insert songs chunk for ${artistName}: ${error.message}`);
        } else {
          songsAdded += chunk.length;
        }
      }
    } else if (dryRun) {
      songsAdded = pendingSongs.length;
    }

    return { songsAdded, albumsAdded, duplicatesSkipped, filteredCount };
  }
}
