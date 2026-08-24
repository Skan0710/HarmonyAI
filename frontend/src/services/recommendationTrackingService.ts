import { apiClient } from './api';
import { extractEnvelopeData } from '../utils/apiHelpers';

export type RecommendationActionType =
  | 'impression'
  | 'click'
  | 'play'
  | 'like'
  | 'skip'
  | 'thumbs_up'
  | 'thumbs_down';

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
 * Submits thumbs_up or thumbs_down feedback for a recommended song.
 */
export const submitRecommendationFeedbackApi = async (
  songId: string,
  feedback: 'thumbs_up' | 'thumbs_down',
  recommendationSource = 'hybrid'
): Promise<{ success: boolean; error: string | null }> => {
  if (!songId || !feedback) return { success: false, error: 'Invalid parameters' };

  try {
    const response = await apiClient<any>('/recommendations/feedback', {
      method: 'POST',
      body: JSON.stringify({
        songId,
        feedback,
        recommendationSource,
      }),
    });

    const result = extractEnvelopeData(response, 'Failed to submit feedback');
    return { success: !result.error, error: result.error };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to submit feedback' };
  }
};

/**
 * Retrieves a user's recommendation feedback history (thumbs_up and thumbs_down).
 */
export const fetchUserRecommendationFeedbackApi = async (
  limit = 50
): Promise<{ feedback: any[]; error: string | null }> => {
  try {
    const response = await apiClient<any>(`/recommendations/feedback?limit=${limit}`, {
      method: 'GET',
    });

    const result = extractEnvelopeData(response, 'Failed to fetch feedback history');
    return { feedback: result.data || [], error: result.error };
  } catch (err: any) {
    return { feedback: [], error: err.message || 'Failed to fetch feedback history' };
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
