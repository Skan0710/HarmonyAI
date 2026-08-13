import { apiClient } from './api';

export type RecommendationActionType = 'impression' | 'click' | 'play' | 'like' | 'skip';

/**
 * Lightweight, non-blocking service for recording recommendation interaction events
 * (impression, click, play, like, skip). Silently catches errors so UI and player are never blocked.
 */
export const trackRecommendationInteraction = async (
  songId: string,
  action: RecommendationActionType,
  recommendationSource = 'hybrid'
): Promise<void> => {
  if (!songId || !action) return;

  try {
    await apiClient('/recommendations/interactions', {
      method: 'POST',
      body: JSON.stringify({
        songId,
        action,
        recommendationSource,
      }),
    });
  } catch (err) {
    // Non-blocking catch: swallow tracking errors silently
  }
};

/**
 * Records impression events in bulk when a list/carousel of recommendations is displayed.
 */
export const trackRecommendationBulkImpressions = async (
  songIds: string[],
  recommendationSource = 'hybrid'
): Promise<void> => {
  if (!Array.isArray(songIds) || songIds.length === 0) return;

  try {
    await apiClient('/recommendations/interactions/bulk-impressions', {
      method: 'POST',
      body: JSON.stringify({
        songIds,
        recommendationSource,
      }),
    });
  } catch (err) {
    // Non-blocking catch
  }
};
