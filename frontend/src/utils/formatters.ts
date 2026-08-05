/**
 * Formats time in seconds to mm:ss format.
 */
export const formatTime = (seconds: number): string => {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

/**
 * Formats large numerical values (play count, listener count) with K/M suffixes.
 */
export const formatCount = (count?: number): string => {
  if (!count || count <= 0) return '0';
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return count.toString();
};

/**
 * Formats listener counts specifically for artist profiles.
 */
export const formatListeners = (listeners?: number): string => {
  if (!listeners || listeners <= 0) return '0 listeners';
  if (listeners >= 1_000_000) return `${(listeners / 1_000_000).toFixed(1)}M listeners`;
  if (listeners >= 1_000) return `${(listeners / 1_000).toFixed(0)}k listeners`;
  return `${listeners} listeners`;
};
