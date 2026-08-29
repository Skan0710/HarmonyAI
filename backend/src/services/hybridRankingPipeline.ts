import { HybridCandidate } from './candidateGenerationService.js';
import {
  HybridScoringWeights,
  getHybridConfigWeights,
  getContextInfluenceConfig,
  getSessionInfluenceConfig,
} from '../config/recommendationConfig.js';
import {
  RecommendationContextAttributes,
  normalizeListeningSituation,
} from '../schemas/recommendationContextSchema.js';
import {
  ContextPreferenceMappingService,
  ContextDerivedPreferences,
} from './contextPreferenceMappingService.js';
import { SessionTasteProfile } from './sessionTasteProfileService.js';
import { IListeningSession } from '../models/ListeningSession.js';

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
    sessionScore?: number;
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
   * Helper: Calculates a candidate song's session fit score (0.0 to 1.0)
   * based on the active temporary session profile, boosting completed/replayed track patterns
   * and penalizing directly or repeatedly skipped tracks.
   */
  private static calculateSessionFitScore(
    songDoc: any,
    sessionProfile: SessionTasteProfile,
    sessionDoc?: IListeningSession | null
  ): number {
    if (!songDoc || !sessionProfile) return 0.5;

    const sessionConfig = getSessionInfluenceConfig();
    const songId = songDoc._id ? songDoc._id.toString() : '';

    // Direct suppression: If song was skipped during the current session, penalize directly
    if (sessionDoc && sessionDoc.tracksSkipped) {
      const isDirectlySkipped = sessionDoc.tracksSkipped.some(
        (s) => s.song && s.song.toString() === songId
      );
      if (isDirectlySkipped) {
        return Number((0.20 * sessionConfig.directSkippedSongSuppression).toFixed(4));
      }
    }

    let accumulatedScore = 0;
    let totalWeight = 0;

    const audioFeatures = songDoc.audioFeatures || {};
    const songEnergy = typeof audioFeatures.energy === 'number' ? audioFeatures.energy : undefined;
    const songTempo = typeof audioFeatures.tempo === 'number' ? audioFeatures.tempo : undefined;
    const songMood = songDoc.mood ? String(songDoc.mood).trim().toLowerCase() : undefined;
    const songGenre = songDoc.genre
      ? typeof songDoc.genre === 'object' && songDoc.genre.name
        ? String(songDoc.genre.name).trim()
        : String(songDoc.genre).trim()
      : undefined;
    const songArtistId = songDoc.artist
      ? typeof songDoc.artist === 'object' && songDoc.artist._id
        ? String(songDoc.artist._id)
        : String(songDoc.artist)
      : undefined;

    // 1. Session Genre Alignment (Weight: 0.35)
    if (songGenre && sessionProfile.preferredGenres.length > 0) {
      const match = sessionProfile.preferredGenres.find(
        (g) => g.genre.toLowerCase() === songGenre.toLowerCase()
      );
      const genreScore = match ? Math.min(1.0, match.score * 2.5) : 0.30;
      accumulatedScore += genreScore * 0.35;
      totalWeight += 0.35;
    }

    // 2. Session Artist Alignment (Weight: 0.25)
    if (songArtistId && sessionProfile.preferredArtists.length > 0) {
      const match = sessionProfile.preferredArtists.find(
        (a) => a.artistId === songArtistId
      );
      const artistScore = match ? Math.min(1.0, match.score * 2.0) : 0.40;
      accumulatedScore += artistScore * 0.25;
      totalWeight += 0.25;
    }

    // 3. Acoustic Energy Fit (Weight: 0.20)
    if (typeof songEnergy === 'number' && Number.isFinite(songEnergy)) {
      const energyDiff = Math.abs(songEnergy - sessionProfile.averageEnergy);
      const energyScore = Math.max(0, 1.0 - energyDiff / 0.40);
      accumulatedScore += energyScore * 0.20;
      totalWeight += 0.20;
    }

    // 4. Acoustic Tempo Fit (Weight: 0.10)
    if (typeof songTempo === 'number' && songTempo > 0) {
      const tempoDiff = Math.abs(songTempo - sessionProfile.averageTempo);
      const tempoScore = Math.max(0, 1.0 - tempoDiff / 40);
      accumulatedScore += tempoScore * 0.10;
      totalWeight += 0.10;
    }

    // 5. Dominant Mood Alignment (Weight: 0.10)
    if (songMood && sessionProfile.dominantMoods.length > 0) {
      const match = sessionProfile.dominantMoods.find(
        (m) => m.mood.toLowerCase() === songMood
      );
      const moodScore = match ? Math.min(1.0, match.score * 2.0) : 0.40;
      accumulatedScore += moodScore * 0.10;
      totalWeight += 0.10;
    }

    let baseSessionFit = totalWeight > 0 ? accumulatedScore / totalWeight : 0.5;

    // Boost tracks similar to recent completions/replays
    if (sessionProfile.interactionSummary.completionsCount > 0 || sessionProfile.interactionSummary.replaysCount > 0) {
      const isTopSessionGenre = sessionProfile.preferredGenres.slice(0, 1).some(
        (g) => songGenre && g.genre.toLowerCase() === songGenre.toLowerCase()
      );
      const isTopSessionArtist = songArtistId && sessionProfile.preferredArtists.slice(0, 1).some(
        (a) => a.artistId === songArtistId
      );
      if (isTopSessionGenre || isTopSessionArtist) {
        baseSessionFit *= sessionConfig.recentCompletionBoost;
      }
    }

    // Penalize tracks similar to repeatedly skipped items
    if (sessionProfile.interactionSummary.skipsCount >= 2) {
      const isTopSessionGenre = sessionProfile.preferredGenres.slice(0, 1).some(
        (g) => songGenre && g.genre.toLowerCase() === songGenre.toLowerCase()
      );
      if (!isTopSessionGenre) {
        baseSessionFit *= sessionConfig.repeatedSkipPenalty;
      }
    }

    return Number(Math.max(0, Math.min(1, baseSessionFit)).toFixed(4));
  }

  /**
   * Evaluates a candidate pool, applies Min-Max normalization across feature components,
   * calculates final weighted hybrid recommendation scores (incorporating content, collaborative,
   * user taste profile affinity, popularity, and recency signals), optionally applies context modulation,
   * optionally applies listening session taste profile modulation, ranks candidates descending,
   * and returns top items up to configurable limit.
   */
  static rankCandidates(
    candidates: HybridCandidate[],
    limit = 10,
    customWeights?: Partial<HybridScoringWeights>,
    context?: RecommendationContextAttributes | string | null,
    customContextInfluence?: number,
    sessionProfile?: SessionTasteProfile | null,
    customSessionInfluence?: number,
    sessionDoc?: IListeningSession | null
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
    let effectiveContextInfluence = 0;

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

        effectiveContextInfluence = Math.max(
          influenceConfig.minContextInfluence,
          Math.min(influenceConfig.maxContextInfluence, requestedInfluence)
        );
      }
    }

    // 3. Resolve Session Influence if session profile is provided
    let effectiveSessionInfluence = 0;
    if (sessionProfile) {
      const sessionConfig = getSessionInfluenceConfig();
      const requestedInfluence =
        customSessionInfluence !== undefined
          ? customSessionInfluence
          : sessionConfig.defaultSessionInfluence;

      effectiveSessionInfluence = Math.max(
        sessionConfig.minSessionInfluence,
        Math.min(sessionConfig.maxSessionInfluence, requestedInfluence)
      );
    }

    // Bound total contextual + session influence so personalized taste is always primary >= 50%
    const totalExtraInfluence = effectiveContextInfluence + effectiveSessionInfluence;
    if (totalExtraInfluence > 0.50) {
      const scaleFactor = 0.50 / totalExtraInfluence;
      effectiveContextInfluence *= scaleFactor;
      effectiveSessionInfluence *= scaleFactor;
    }

    const baselineHybridWeight = 1 - effectiveContextInfluence - effectiveSessionInfluence;

    // 4. Compute normalized component scores & weighted multi-layer fusion per candidate
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
      let contextFitScore: number | undefined = undefined;
      if (derivedPreferences && effectiveContextInfluence > 0) {
        contextFitScore = this.calculateContextFitScore(cand.songDoc, derivedPreferences);
      }

      // Calculate session adjustment if active
      let sessionFitScore: number | undefined = undefined;
      if (sessionProfile && effectiveSessionInfluence > 0) {
        sessionFitScore = this.calculateSessionFitScore(cand.songDoc, sessionProfile, sessionDoc);
      }

      // Blended multi-layer score
      let blended = baselineHybridWeight * baseHybridScore;
      if (contextFitScore !== undefined) {
        blended += effectiveContextInfluence * contextFitScore;
      }
      if (sessionFitScore !== undefined) {
        blended += effectiveSessionInfluence * sessionFitScore;
      }

      const finalScore = Number(Math.max(0, Math.min(1, blended)).toFixed(4));

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
          sessionScore: sessionFitScore,
        },
        sources: cand.sources || [],
        metadata:
          derivedPreferences || sessionProfile
            ? {
                ...(derivedPreferences
                  ? {
                      contextSituation: derivedPreferences.situation,
                      contextInfluence: effectiveContextInfluence,
                      contextFitScore,
                    }
                  : {}),
                ...(sessionProfile
                  ? {
                      sessionId: sessionProfile.sessionId,
                      sessionInfluence: effectiveSessionInfluence,
                      sessionFitScore,
                    }
                  : {}),
              }
            : undefined,
      };
    });

    // 5. Sort candidates descending by final hybrid score
    scoredItems.sort((a, b) => b.hybridScore - a.hybridScore);

    // 6. Return top limit results
    return scoredItems.slice(0, Math.max(1, limit));
  }
}

export default HybridRankingPipeline;
