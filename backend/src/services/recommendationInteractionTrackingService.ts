import { supabase } from '../config/supabase.js';
import { isValidObjectId } from '../utils/validators.js';

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

export type RecommendationSourceType =
  | 'content'
  | 'collaborative'
  | 'hybrid'
  | 'trending'
  | 'personalized_feed'
  | string;

export interface IRecommendationInteraction {
  _id: string;
  id: string;
  user: string;
  song: any;
  recommendationSource: RecommendationSourceType;
  action: RecommendationActionType;
  explanationFeedback?: ExplanationFeedbackType | string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface RecordInteractionParams {
  userId: string;
  songId: string;
  action: RecommendationActionType;
  recommendationSource?: RecommendationSourceType;
  explanationFeedback?: ExplanationFeedbackType | string;
  metadata?: Record<string, any>;
}

export interface RecordExplanationFeedbackParams {
  userId: string;
  songId: string;
  feedback: ExplanationFeedbackType | string;
  recommendationSource?: RecommendationSourceType;
  explanationContext?: Record<string, any>;
}

/**
 * Maps an embedded `songs` join row (a lighter field subset than the full
 * SongService.mapSongRow shape, mirroring the original Mongoose
 * `.populate('song', '<field list>')` projections) into the plain object
 * shape consumers expect. `artist`/`genre` intentionally stay as raw ids,
 * matching the original populate behavior which never sub-populated those refs.
 */
function mapEmbeddedSong(row: any): any {
  if (!row) return null;
  const mapped: Record<string, any> = {
    _id: row.id,
    id: row.id,
    title: row.title,
    artist: row.artist_id,
    genre: row.genre_id,
    coverImage: row.cover_image,
    duration: row.duration,
    audioUrl: row.audio_url,
  };
  if (row.audio_features !== undefined) mapped.audioFeatures = row.audio_features;
  if (row.mood !== undefined) mapped.mood = row.mood;
  if (row.play_count !== undefined) mapped.playCount = row.play_count;
  return mapped;
}

function mapInteractionRow(row: any): IRecommendationInteraction {
  const metadata = row.metadata || {};
  return {
    _id: row.id,
    id: row.id,
    user: row.user_id,
    song: row.songs ? mapEmbeddedSong(row.songs) : row.song_id,
    recommendationSource: metadata.recommendationSource || 'hybrid',
    action: row.action,
    explanationFeedback: metadata.explanationFeedback,
    metadata,
    timestamp: row.created_at ? new Date(row.created_at) : new Date(),
  };
}

export class RecommendationInteractionTrackingService {
  /**
   * Records a recommendation interaction event (impression, click, play, like, skip, thumbs_up, thumbs_down, explanation_feedback).
   */
  static async recordInteraction(
    params: RecordInteractionParams
  ): Promise<IRecommendationInteraction> {
    const { userId, songId, action, recommendationSource = 'hybrid', explanationFeedback, metadata } = params;

    if (!isValidObjectId(userId)) {
      throw new Error('Invalid user ID');
    }
    if (!isValidObjectId(songId)) {
      throw new Error('Invalid song ID');
    }

    const validActions: RecommendationActionType[] = [
      'impression',
      'click',
      'play',
      'like',
      'skip',
      'thumbs_up',
      'thumbs_down',
      'explanation_feedback',
    ];
    if (!validActions.includes(action)) {
      throw new Error(`Invalid interaction action: ${action}`);
    }

    const rowMetadata: Record<string, any> = {
      ...(metadata || {}),
      recommendationSource,
    };
    if (explanationFeedback) {
      rowMetadata.explanationFeedback = explanationFeedback;
    }

    const { data, error } = await supabase
      .from('recommendation_interactions')
      .insert({
        user_id: userId,
        song_id: songId,
        action,
        metadata: rowMetadata,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to record interaction: ${error?.message || 'unknown error'}`);
    }

    return mapInteractionRow(data);
  }

  /**
   * Records specific explanation feedback ('helpful', 'not_relevant', 'too_similar', 'not_my_style', 'thumbs_up', 'thumbs_down').
   * Prevents duplicate feedback and stores rich contextual metadata for future Music DNA learning.
   */
  static async recordExplanationFeedback(
    params: RecordExplanationFeedbackParams
  ): Promise<IRecommendationInteraction> {
    const { userId, songId, feedback, recommendationSource = 'hybrid', explanationContext = {} } = params;

    if (!isValidObjectId(userId)) {
      throw new Error('Invalid user ID');
    }
    if (!isValidObjectId(songId)) {
      throw new Error('Invalid song ID');
    }

    const validFeedbackTypes: string[] = [
      'helpful',
      'not_relevant',
      'too_similar',
      'not_my_style',
      'thumbs_up',
      'thumbs_down',
    ];

    if (!validFeedbackTypes.includes(feedback)) {
      throw new Error(`Invalid explanation feedback: ${feedback}`);
    }

    // 1. Remove previous explanation feedback for this song by this user to avoid stale duplicates
    await supabase
      .from('recommendation_interactions')
      .delete()
      .match({ user_id: userId, song_id: songId, action: 'explanation_feedback' });

    // 2. Map high-level thumbs actions if user supplied legacy feedback
    let actionType: RecommendationActionType = 'explanation_feedback';
    if (feedback === 'thumbs_up' || feedback === 'thumbs_down') {
      actionType = feedback;
    }

    // 3. Save new explanation feedback interaction with extensible metadata
    const { data, error } = await supabase
      .from('recommendation_interactions')
      .insert({
        user_id: userId,
        song_id: songId,
        action: actionType,
        metadata: {
          ...explanationContext,
          recommendationSource,
          explanationFeedback: feedback,
          feedbackRecordedAt: new Date().toISOString(),
        },
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to record explanation feedback: ${error?.message || 'unknown error'}`);
    }

    return mapInteractionRow(data);
  }

  /**
   * Records user feedback (thumbs_up or thumbs_down) for a recommended song.
   * Prevents duplicate feedback for the same recommendation event by checking existing feedback records.
   */
  static async recordFeedback(
    userId: string,
    songId: string,
    feedback: 'thumbs_up' | 'thumbs_down',
    recommendationSource = 'hybrid'
  ): Promise<IRecommendationInteraction> {
    if (!isValidObjectId(userId)) {
      throw new Error('Invalid user ID');
    }
    if (!isValidObjectId(songId)) {
      throw new Error('Invalid song ID');
    }

    // 1. Check if identical feedback action already exists to prevent duplicates
    const { data: existingFeedback } = await supabase
      .from('recommendation_interactions')
      .select('*')
      .eq('user_id', userId)
      .eq('song_id', songId)
      .eq('action', feedback)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingFeedback) {
      return mapInteractionRow(existingFeedback);
    }

    // 2. Remove opposite feedback if user toggled (e.g. thumbs_down to thumbs_up)
    const oppositeAction = feedback === 'thumbs_up' ? 'thumbs_down' : 'thumbs_up';
    await supabase
      .from('recommendation_interactions')
      .delete()
      .match({ user_id: userId, song_id: songId, action: oppositeAction });

    // 3. Save new feedback interaction
    return await this.recordInteraction({
      userId,
      songId,
      action: feedback,
      explanationFeedback: feedback,
      recommendationSource,
    });
  }

  /**
   * Records multiple recommendation impressions in bulk.
   */
  static async recordBulkImpressions(
    userId: string,
    songIds: string[],
    recommendationSource = 'hybrid'
  ): Promise<number> {
    if (!isValidObjectId(userId) || !Array.isArray(songIds) || songIds.length === 0) {
      return 0;
    }

    const validRows = songIds
      .filter((id) => isValidObjectId(id))
      .map((id) => ({
        user_id: userId,
        song_id: id,
        action: 'impression' as RecommendationActionType,
        metadata: { recommendationSource },
      }));

    if (validRows.length === 0) return 0;

    const { data, error } = await supabase
      .from('recommendation_interactions')
      .insert(validRows)
      .select('id');

    if (error) {
      throw new Error(`Failed to record bulk impressions: ${error.message}`);
    }

    return (data || []).length;
  }

  /**
   * Retrieves recorded recommendation interactions for a specific user.
   */
  static async getUserRecommendationInteractions(
    userId: string,
    limit = 50,
    actionFilter?: RecommendationActionType
  ): Promise<IRecommendationInteraction[]> {
    if (!isValidObjectId(userId)) {
      return [];
    }

    let query = supabase
      .from('recommendation_interactions')
      .select(
        '*, songs(id, title, artist_id, genre_id, cover_image, duration, audio_url, audio_features, mood, play_count)'
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(Math.min(200, Math.max(1, limit)));

    if (actionFilter) {
      query = query.eq('action', actionFilter);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    return data.map(mapInteractionRow);
  }

  /**
   * Retrieves user feedback history (thumbs_up, thumbs_down, explanation_feedback) for a user.
   */
  static async getUserRecommendationFeedback(
    userId: string,
    limit = 50
  ): Promise<IRecommendationInteraction[]> {
    if (!isValidObjectId(userId)) {
      return [];
    }

    const { data, error } = await supabase
      .from('recommendation_interactions')
      .select('*, songs(id, title, artist_id, genre_id, cover_image, duration, audio_url)')
      .eq('user_id', userId)
      .in('action', ['thumbs_up', 'thumbs_down', 'explanation_feedback'])
      .order('created_at', { ascending: false })
      .limit(Math.min(200, Math.max(1, limit)));

    if (error || !data) return [];

    return data.map(mapInteractionRow);
  }
}
