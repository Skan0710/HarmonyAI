import { HybridCandidate } from './candidateGenerationService.js';
import {
  HybridScoringWeights,
  getHybridConfigWeights,
  getContextInfluenceConfig,
} from '../config/recommendationConfig.js';
import {
  RecommendationContextAttributes,
  normalizeListeningSituation,
} from '../schemas/recommendationContextSchema.js';
import {
  ContextPreferenceMappingService,
  ContextDerivedPreferences,
} from './contextPreferenceMappingService.js';

export interface HybridRankedResult {
  song: any;
  hybridScore: number;
  originalScore?: number;
  finalScore?: number;
  componentScores: {
    contentScore: number;
    collaborativeScore: number;
    userTasteAffinityScore: number;
    popularityScore: number;
    recencyScore: number;
    noveltyScore?: number;
    userPreferenceScore?: number;
    contextScore?: number;
  };
  sources: string[];
  metadata?: Record<string, any>;
}

export class HybridRankingPipeline {
  /**
   * Helper: Calculates a candidate song's context fit score (0.0 to 1.0)
   * based on acoustic energy, tempo, mood, and genre alignment with the derived preferences.
   */
  private static calculateContextFitScore(
    songDoc: any,
    preferences: ContextDerivedPreferences
  ): number {
    if (!songDoc) return 0.5;

    let totalWeight = 0;
    let accumulatedScore = 0;

    const audioFeatures = songDoc.audioFeatures || {};
    const songEnergy = typeof audioFeatures.energy === 'number' ? audioFeatures.energy : undefined;
    const songTempo = typeof audioFeatures.tempo === 'number' ? audioFeatures.tempo : undefined;
    const songMood = songDoc.mood ? String(songDoc.mood).trim().toLowerCase() : undefined;
    const songGenre = songDoc.genre
      ? typeof songDoc.genre === 'object' && songDoc.genre.name
        ? String(songDoc.genre.name).trim()
        : String(songDoc.genre).trim()
      : undefined;

    // 1. Energy Fit (Weight: 0.35)
    if (typeof songEnergy === 'number' && Number.isFinite(songEnergy)) {
      const energyDiff = Math.abs(songEnergy - preferences.targetEnergy);
      const energyScore = 1.0 - Math.min(1.0, energyDiff / 0.40);
      accumulatedScore += Math.max(0, energyScore) * 0.35;
      totalWeight += 0.35;
    }

    // 2. Tempo Fit (Weight: 0.25)
    if (typeof songTempo === 'number' && songTempo > 0) {
      const tempoDiff = Math.abs(songTempo - preferences.targetTempo);
      const tempoScore = 1.0 - Math.min(1.0, tempoDiff / 35);
      accumulatedScore += Math.max(0, tempoScore) * 0.25;
      totalWeight += 0.25;
    }

    // 3. Mood Fit (Weight: 0.20)
    if (songMood && preferences.targetMood) {
      const targetMoodLower = preferences.targetMood.toLowerCase();
      let moodScore = 0.5;
      if (songMood === targetMoodLower) {
        moodScore = 1.0;
      }
      accumulatedScore += moodScore * 0.20;
      totalWeight += 0.20;
    }

    // 4. Genre Fit (Weight: 0.20)
    if (songGenre && preferences.preferredGenres && preferences.preferredGenres.length > 0) {
      const isPreferred = preferences.preferredGenres.some(
        (g) => g.toLowerCase() === songGenre.toLowerCase()
      );
      const genreScore = isPreferred ? 1.0 : 0.40;
      accumulatedScore += genreScore * 0.20;
      totalWeight += 0.20;
    }

    if (totalWeight === 0) return 0.5;
    return Number((accumulatedScore / totalWeight).toFixed(4));
  }

  /**
   * Evaluates a candidate pool, applies Min-Max normalization across feature components,
   * calculates final weighted hybrid recommendation scores (incorporating content, collaborative,
   * user taste profile affinity, popularity, and recency signals), optionally applies context modulation,
   * ranks candidates descending, and returns top items up to configurable limit.
   * 
   * @param candidates Pool of merged hybrid candidate tracks
   * @param limit Maximum number of ranked recommendations to return (default 10)
   * @param customWeights Optional custom weight overrides
   * @param context Optional listening context or situation string
   * @param customContextInfluence Optional weight override for contextual influence
   */
  static rankCandidates(
    candidates: HybridCandidate[],
    limit = 10,
    customWeights?: Partial<HybridScoringWeights>,
    context?: RecommendationContextAttributes | string | null,
    customContextInfluence?: number
  ): HybridRankedResult[] {
    if (!candidates || candidates.length === 0) {
      return [];
    }

    const weights: HybridScoringWeights = {
      ...getHybridConfigWeights(),
      ...customWeights,
    };

    // 1. Min-Max Normalization scale bounds across candidate pool
    const maxContent = Math.max(
      ...candidates.map((c) => (isNaN(c.contentScore) ? 0 : c.contentScore || 0)),
      0.0001
    );
    const maxCollab = Math.max(
      ...candidates.map((c) => (isNaN(c.collaborativeScore) ? 0 : c.collaborativeScore || 0)),
      0.0001
    );
    const maxTaste = Math.max(
      ...candidates.map((c) => (isNaN(c.userTasteAffinityScore) ? 0 : c.userTasteAffinityScore || 0)),
      0.0001
    );
    const maxPop = Math.max(
      ...candidates.map((c) => (isNaN(c.popularitySignal) ? 0 : c.popularitySignal || 0)),
      1
    );
    const maxRec = Math.max(
      ...candidates.map((c) => (isNaN(c.recencySignal) ? 0 : c.recencySignal || 0)),
      0.0001
    );

    const totalWeightSum =
      weights.contentSimilarityWeight +
      weights.collaborativeWeight +
      weights.userTasteAffinityWeight +
      weights.popularityWeight +
      weights.recencyWeight;

    // 2. Resolve Context Preferences & Influence if context is provided
    let derivedPreferences: ContextDerivedPreferences | null = null;
    let effectiveInfluence = 0;

    if (context) {
      const contextInput: RecommendationContextAttributes =
        typeof context === 'string'
          ? { situation: normalizeListeningSituation(context) || context }
          : context;

      if (contextInput.situation || contextInput.mood || contextInput.desiredEnergy !== undefined) {
        derivedPreferences = ContextPreferenceMappingService.mapContextToPreferences(contextInput);
        const influenceConfig = getContextInfluenceConfig();
        const requestedInfluence =
          customContextInfluence !== undefined
            ? customContextInfluence
            : influenceConfig.defaultContextInfluence;

        effectiveInfluence = Math.max(
          influenceConfig.minContextInfluence,
          Math.min(influenceConfig.maxContextInfluence, requestedInfluence)
        );
      }
    }

    // 3. Compute normalized component scores & weighted fusion per candidate
    const scoredItems: HybridRankedResult[] = candidates.map((cand) => {
      const rawContent = isNaN(cand.contentScore) ? 0 : cand.contentScore || 0;
      const rawCollab = isNaN(cand.collaborativeScore) ? 0 : cand.collaborativeScore || 0;
      const rawTaste = isNaN(cand.userTasteAffinityScore) ? 0 : cand.userTasteAffinityScore || 0;
      const rawPop = isNaN(cand.popularitySignal) ? 0 : cand.popularitySignal || 0;
      const rawRec = isNaN(cand.recencySignal) ? 0 : cand.recencySignal || 0;

      const normContent = rawContent / maxContent;
      const normCollab = rawCollab / maxCollab;
      const normTaste = rawTaste / maxTaste;
      const normPop = rawPop / maxPop;
      const normRec = rawRec / maxRec;

      const weightedScoreSum =
        normContent * weights.contentSimilarityWeight +
        normCollab * weights.collaborativeWeight +
        normTaste * weights.userTasteAffinityWeight +
        normPop * weights.popularityWeight +
        normRec * weights.recencyWeight;

      const rawHybrid = totalWeightSum > 0 ? weightedScoreSum / totalWeightSum : 0;
      const baseHybridScore = Number(Math.max(0, Math.min(1, rawHybrid)).toFixed(4));

      // Calculate context adjustment if active
      let finalScore = baseHybridScore;
      let contextFitScore: number | undefined = undefined;

      if (derivedPreferences && effectiveInfluence > 0) {
        contextFitScore = this.calculateContextFitScore(cand.songDoc, derivedPreferences);
        const blended = (1 - effectiveInfluence) * baseHybridScore + effectiveInfluence * contextFitScore;
        finalScore = Number(Math.max(0, Math.min(1, blended)).toFixed(4));
      }

      return {
        song: cand.songDoc,
        hybridScore: finalScore,
        originalScore: baseHybridScore,
        finalScore,
        componentScores: {
          contentScore: Number(normContent.toFixed(4)),
          collaborativeScore: Number(normCollab.toFixed(4)),
          userTasteAffinityScore: Number(normTaste.toFixed(4)),
          popularityScore: Number(normPop.toFixed(4)),
          recencyScore: Number(normRec.toFixed(4)),
          contextScore: contextFitScore,
        },
        sources: cand.sources || [],
        metadata: derivedPreferences
          ? {
              contextSituation: derivedPreferences.situation,
              contextInfluence: effectiveInfluence,
              contextFitScore,
            }
          : undefined,
      };
    });

    // 4. Sort candidates descending by final hybrid score
    scoredItems.sort((a, b) => b.hybridScore - a.hybridScore);

    // 5. Return top limit results
    return scoredItems.slice(0, Math.max(1, limit));
  }
}
