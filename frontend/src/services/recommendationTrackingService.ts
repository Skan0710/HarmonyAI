import { apiClient } from './api';
import { extractEnvelopeData } from '../utils/apiHelpers';

export type ExplanationFeedbackType =
  | 'helpful'
  | 'not_relevant'
  | 'too_similar'
  | 'not_my_style'
  | 'thumbs_up'
  | 'thumbs_down';

export type RecommendationActionType =
  | 'impression'
  | 'click'
  | 'play'
  | 'like'
  | 'skip'
  | 'thumbs_up'
  | 'thumbs_down'
  | 'explanation_feedback';

/**
 * Lightweight, non-blocking service for recording recommendation interaction events
 * (impression, click, play, like, skip). Silently catches errors so UI and player are never blocked.
 */
export const trackRecommendationInteraction = async (
  songId: string,
  action: RecommendationActionType,
  recommendationSource = 'hybrid',
  metadata?: Record<string, any>
): Promise<void> => {
  if (!songId || !action) return;

  try {
    await apiClient('/recommendations/interactions', {
      method: 'POST',
      body: JSON.stringify({
        songId,
        action,
        recommendationSource,
        metadata,
      }),
    });
  } catch {
    // Non-blocking catch: swallow tracking errors silently
  }
};

/**
 * Submits feedback (helpful, not_relevant, too_similar, not_my_style, thumbs_up, thumbs_down) for a recommended song explanation.
 */
export const submitRecommendationFeedbackApi = async (
  songId: string,
  feedback: ExplanationFeedbackType,
  recommendationSource = 'hybrid',
  explanationContext?: Record<string, any>
): Promise<{ success: boolean; error: string | null }> => {
  if (!songId || !feedback) return { success: false, error: 'Invalid parameters' };

  try {
    const response = await apiClient<any>('/recommendations/feedback', {
      method: 'POST',
      body: JSON.stringify({
        songId,
        feedback,
        recommendationSource,
        explanationContext,
      }),
    });

    const result = extractEnvelopeData(response, 'Failed to submit feedback');
    return { success: !result.error, error: result.error };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error submitting feedback' };
  }
};

/**
 * Records multiple recommendation impressions in a single bulk request.
 */
export const trackBulkRecommendationImpressions = async (
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
  } catch {
    // Non-blocking catch: swallow tracking errors silently
  }
};

export const trackRecommendationBulkImpressions = trackBulkRecommendationImpressions;
