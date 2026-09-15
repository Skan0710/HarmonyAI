const MUSICBRAINZ_BASE_URL = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'HarmonyAI/1.0.0 ( https://github.com/Skan0710/HarmonyAI )';
const MIN_DELAY_MS = 1050; // MusicBrainz strictly requires max 1 req/sec

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let lastRequestTime = 0;

async function rateLimitedFetch(url: string): Promise<any | null> {
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < MIN_DELAY_MS) {
    await sleep(MIN_DELAY_MS - timeSinceLast);
  }
  lastRequestTime = Date.now();

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export class MusicBrainzProvider {
  /**
   * Discovers prominent English-speaking artists for a given genre/tag.
   */
  async discoverArtistsByGenre(
    genreTag: string,
    limit = 25,
    offset = 0
  ): Promise<{ name: string; country?: string; tags?: string[] }[]> {
    // Search artists with matching tag, country US/GB/CA/AU to guarantee English-language catalog
    const query = `tag:"${genreTag}" AND (country:US OR country:GB OR country:CA OR country:AU)`;
    const url = `${MUSICBRAINZ_BASE_URL}/artist/?query=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}&fmt=json`;

    const data = await rateLimitedFetch(url);
    if (!data || !data.artists) return [];

    return data.artists
      .filter((a: any) => a.name && (a.score === undefined || a.score > 60))
      .map((a: any) => ({
        name: a.name,
        country: a.country,
        tags: (a.tags || []).map((t: any) => t.name),
      }));
  }
}
