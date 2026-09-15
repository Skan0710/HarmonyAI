import { IngestionAlbum, IngestionTrack } from '../types.js';

const ITUNES_LOCALE = 'country=US&lang=en_us';
const DEFAULT_DELAY_MS = 150;
const MAX_RETRIES = 3;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const upscaleArtwork = (url?: string): string => {
  if (!url) return '';
  return url.replace(/\d+x\d+bb\.(jpg|png)$/, '600x600bb.$1');
};

const normalizeAlbumTitle = (title: string): string =>
  title
    .toLowerCase()
    .replace(/\s*[([][^)\]]*(deluxe|remaster|anniversary|expanded|edition|version|bonus|explicit)[^)\]]*[)\]]/gi, '')
    .trim();

async function itunesFetch(url: string, retries = MAX_RETRIES): Promise<any | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.status === 429) {
        // Rate limited, back off
        const backoff = Math.pow(2, attempt) * 1000;
        console.warn(`[iTunesProvider] 429 Rate Limited. Backing off ${backoff}ms...`);
        await sleep(backoff);
        continue;
      }
      if (!response.ok) {
        if (attempt === retries) return null;
        await sleep(500 * attempt);
        continue;
      }
      const data = await response.json();
      return data;
    } catch (err) {
      if (attempt === retries) return null;
      await sleep(500 * attempt);
    }
  }
  return null;
}

export class ITunesProvider {
  private delayMs: number;

  constructor(delayMs = DEFAULT_DELAY_MS) {
    this.delayMs = delayMs;
  }

  async searchArtist(name: string): Promise<{ artistId: number; name: string; primaryGenre?: string } | null> {
    const url = `https://itunes.apple.com/search?entity=musicArtist&${ITUNES_LOCALE}&limit=1&term=${encodeURIComponent(name)}`;
    const body = await itunesFetch(url);
    await sleep(this.delayMs);

    const result = body?.results?.[0];
    if (!result?.artistId) return null;

    return {
      artistId: result.artistId,
      name: result.artistName || name,
      primaryGenre: result.primaryGenreName,
    };
  }

  async fetchArtistAlbums(
    artistId: number,
    artistName: string,
    limit = 100,
    dedupeByTitle = true
  ): Promise<IngestionAlbum[]> {
    const url = `https://itunes.apple.com/lookup?id=${artistId}&entity=album&${ITUNES_LOCALE}&limit=${limit}`;
    const body = await itunesFetch(url);
    await sleep(this.delayMs);

    const rawAlbums = (body?.results || []).filter(
      (r: any) =>
        r.wrapperType === 'collection' &&
        r.collectionType !== 'Compilation' &&
        typeof r.artistName === 'string' &&
        r.artistName.toLowerCase().includes(artistName.toLowerCase())
    );

    const albums: IngestionAlbum[] = rawAlbums.map((r: any) => {
      const rawTitle: string = r.collectionName || '';
      let albumType: 'album' | 'ep' | 'single' | 'compilation' = 'album';
      let title = rawTitle;

      if (/ - Single$/i.test(rawTitle)) {
        albumType = 'single';
        title = rawTitle.replace(/ - Single$/i, '');
      } else if (/ - EP$/i.test(rawTitle)) {
        albumType = 'ep';
        title = rawTitle.replace(/ - EP$/i, '');
      }

      const releaseYear = r.releaseDate ? new Date(r.releaseDate).getFullYear() : undefined;

      return {
        title,
        artistName: r.artistName || artistName,
        itunesCollectionId: r.collectionId,
        coverImage: upscaleArtwork(r.artworkUrl100),
        releaseYear,
        genreKey: (r.primaryGenreName || 'pop').toLowerCase(),
        albumType,
        totalTracks: r.trackCount || 1,
      };
    });

    let result = albums;
    if (dedupeByTitle) {
      const seenTitles = new Set<string>();
      const deduped: IngestionAlbum[] = [];
      for (const a of albums) {
        const key = normalizeAlbumTitle(a.title);
        if (!key || seenTitles.has(key)) continue;
        seenTitles.add(key);
        deduped.push(a);
      }
      result = deduped;
    }

    result.sort((a, b) => (b.releaseYear || 0) - (a.releaseYear || 0));
    return result;
  }

  async fetchAlbumTracks(
    collectionId: number,
    artistName: string,
    albumTitle: string,
    genreKey: string
  ): Promise<IngestionTrack[]> {
    const url = `https://itunes.apple.com/lookup?id=${collectionId}&entity=song&${ITUNES_LOCALE}&limit=200`;
    const body = await itunesFetch(url);
    await sleep(this.delayMs);

    const tracks = (body?.results || [])
      .filter((r: any) => r.wrapperType === 'track' && r.kind === 'song')
      .sort((a: any, b: any) => (a.trackNumber || 0) - (b.trackNumber || 0));

    return tracks.map((r: any) => {
      const duration = r.trackTimeMillis ? Math.round(r.trackTimeMillis / 1000) : 210;
      const releaseYear = r.releaseDate ? new Date(r.releaseDate).getFullYear() : undefined;

      return {
        title: r.trackName,
        artistName: r.artistName || artistName,
        albumTitle: r.collectionName || albumTitle,
        itunesTrackId: r.trackId,
        itunesCollectionId: collectionId,
        duration,
        coverImage: upscaleArtwork(r.artworkUrl100),
        releaseYear,
        genreKey,
        explicit: r.trackExplicitness === 'explicit',
        trackNumber: r.trackNumber,
        isrc: r.isrc,
        language: 'English',
      };
    });
  }

  async searchTracksByQuery(query: string, limit = 10): Promise<IngestionTrack[]> {
    const url = `https://itunes.apple.com/search?media=music&entity=song&${ITUNES_LOCALE}&limit=${limit}&term=${encodeURIComponent(query)}`;
    const body = await itunesFetch(url);
    await sleep(this.delayMs);

    return (body?.results || []).map((r: any) => ({
      title: r.trackName,
      artistName: r.artistName,
      albumTitle: r.collectionName,
      itunesTrackId: r.trackId,
      itunesCollectionId: r.collectionId,
      duration: r.trackTimeMillis ? Math.round(r.trackTimeMillis / 1000) : 210,
      coverImage: upscaleArtwork(r.artworkUrl100),
      releaseYear: r.releaseDate ? new Date(r.releaseDate).getFullYear() : undefined,
      genreKey: (r.primaryGenreName || 'pop').toLowerCase(),
      explicit: r.trackExplicitness === 'explicit',
      trackNumber: r.trackNumber,
      language: 'English',
    }));
  }
}
