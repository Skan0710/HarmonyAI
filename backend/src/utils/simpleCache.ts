// Tiny in-process TTL cache for read-mostly, non-personalized list endpoints
// (genres/artists/albums). These are re-fetched on nearly every page nav —
// caching them for a short window turns a ~500-800ms Supabase round trip
// into a near-instant repeat response without risking long-lived staleness.
interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value as T;
  }

  const value = await fn();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

// Call after any write to a cached resource so edits are visible immediately
// instead of waiting out the TTL.
export function invalidateCache(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
