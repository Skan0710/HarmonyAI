const YOUTUBE_SEARCH_ENDPOINT = 'https://www.googleapis.com/youtube/v3/search';

interface YoutubeSearchResponse {
  items?: { id?: { videoId?: string } }[];
}

/**
 * Resolves a song to a playable YouTube video ID via the free YouTube Data
 * API v3 search endpoint. Full-length streaming needs the official IFrame
 * Player (this only finds the video ID it will load) — there is no free API
 * that returns full-length audio files directly for commercial music.
 *
 * Costs 100 quota units per call against the 10,000/day free quota, so
 * callers must cache the result (songs.youtube_video_id) rather than
 * re-searching on every play.
 */
export async function searchYoutubeVideoId(title: string, artistName: string): Promise<string | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return null;

  const query = `${title} ${artistName} official audio`.trim();
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: '1',
    videoEmbeddable: 'true',
    q: query,
    key: apiKey,
  });

  try {
    const response = await fetch(`${YOUTUBE_SEARCH_ENDPOINT}?${params.toString()}`);
    if (!response.ok) return null;

    const body = (await response.json()) as YoutubeSearchResponse;
    const videoId = body.items?.[0]?.id?.videoId;
    return videoId || null;
  } catch {
    return null;
  }
}
