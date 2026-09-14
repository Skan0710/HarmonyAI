import { fetchYoutubeVideoIdApi } from '../services/songService';

// Session-lived cache of songId -> resolved YouTube video id (null = confirmed
// no match, found once and won't change). Shared by the player UI (read
// instantly instead of re-fetching on every track change) and predictive
// prefetching (warm the cache for the upcoming song before playback reaches
// it, so the swap has zero network latency when it actually happens).
const cache = new Map<string, string | null>();
const pending = new Map<string, Promise<string | null>>();

export const getCachedVideoId = (songId: string): string | null | undefined => cache.get(songId);

export const resolveVideoId = (songId: string): Promise<string | null> => {
  if (cache.has(songId)) return Promise.resolve(cache.get(songId) ?? null);

  const inFlight = pending.get(songId);
  if (inFlight) return inFlight;

  const promise = fetchYoutubeVideoIdApi(songId)
    .then((videoId) => {
      cache.set(songId, videoId);
      pending.delete(songId);
      return videoId;
    })
    .catch(() => {
      pending.delete(songId);
      return null;
    });

  pending.set(songId, promise);
  return promise;
};

/**
 * Fire-and-forget warmup for a song that isn't playing yet. `knownVideoId`
 * short-circuits the network call when the id is already on the song object
 * (e.g. from a prior resolution merged back onto the queue).
 */
export const prefetchVideoId = (songId: string | undefined | null, knownVideoId?: string | null): void => {
  if (!songId || cache.has(songId) || pending.has(songId)) return;

  if (knownVideoId !== undefined && knownVideoId !== null) {
    cache.set(songId, knownVideoId);
    return;
  }

  resolveVideoId(songId).catch(() => {});
};
