import { IFeatureScoringStage, PipelineItem, RecommendationPipelineContext } from '../recommendationPipelineTypes.js';
import { MoodFilteringService } from '../../services/moodFilteringService.js';

export class FeatureScoringStage implements IFeatureScoringStage {
  /**
   * Evaluates and normalizes candidate features across content, collaborative, taste,
   * popularity, recency, mood, and activity signals.
   */
  async scoreFeatures(
    items: PipelineItem[],
    context: RecommendationPipelineContext
  ): Promise<PipelineItem[]> {
    if (!items || items.length === 0) {
      return [];
    }

    const maxContent = Math.max(
      ...items.map((i) => (isNaN(i.rawFeatures.contentScore) ? 0 : i.rawFeatures.contentScore || 0)),
      0.0001
    );
    const maxCollab = Math.max(
      ...items.map((i) => (isNaN(i.rawFeatures.collaborativeScore) ? 0 : i.rawFeatures.collaborativeScore || 0)),
      0.0001
    );
    const maxTaste = Math.max(
      ...items.map((i) => (isNaN(i.rawFeatures.userTasteAffinityScore) ? 0 : i.rawFeatures.userTasteAffinityScore || 0)),
      0.0001
    );
    const maxPop = Math.max(
      ...items.map((i) => (isNaN(i.rawFeatures.popularitySignal) ? 0 : i.rawFeatures.popularitySignal || 0)),
      1
    );
    const maxRec = Math.max(
      ...items.map((i) => (isNaN(i.rawFeatures.recencySignal) ? 0 : i.rawFeatures.recencySignal || 0)),
      0.0001
    );

    return items.map((item) => {
      const rawContent = item.rawFeatures.contentScore || 0;
      const rawCollab = item.rawFeatures.collaborativeScore || 0;
      const rawTaste = item.rawFeatures.userTasteAffinityScore || 0;
      const rawPop = item.rawFeatures.popularitySignal || 0;
      const rawRec = item.rawFeatures.recencySignal || 0;

      const normContent = Number((rawContent / maxContent).toFixed(4));
      const normCollab = Number((rawCollab / maxCollab).toFixed(4));
      const normTaste = Number((rawTaste / maxTaste).toFixed(4));
      const normPop = Number((rawPop / maxPop).toFixed(4));
      const normRec = Number((rawRec / maxRec).toFixed(4));

      // Optional Contextual Mood & Activity Scores
      let moodScore = 0.5;
      let activityScore = 0.5;

      if (context.contextPreference) {
        if (context.contextPreference.mood) {
          moodScore = MoodFilteringService.calculateMoodCompatibilityScore(
            item.song,
            context.contextPreference.mood
          );
        }
        if (typeof context.contextPreference.energyLevel === 'number' && item.song?.audioFeatures) {
          const energyDiff = Math.abs(
            (item.song.audioFeatures.energy || 0.5) - context.contextPreference.energyLevel
          );
          activityScore = Number((1.0 - Math.min(1, energyDiff)).toFixed(4));
        }
      }

      return {
        ...item,
        normalizedScores: {
          contentScore: normContent,
          collaborativeScore: normCollab,
          userTasteAffinityScore: normTaste,
          popularityScore: normPop,
          recencyScore: normRec,
          moodScore,
          activityScore,
        },
      };
    });
  }
}
