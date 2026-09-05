import { HybridCandidate } from './candidateGenerationService.js';
import {
  HybridScoringWeights,
  getHybridConfigWeights,
  getContextInfluenceConfig,
  getSessionInfluenceConfig,
  getTemporalTasteInfluenceConfig,
  TemporalTasteInfluenceConfig,
  getRecommendationSignalConfig,
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
import {
  UnifiedLayeredTasteProfile,
  TemporalTasteLayer,
} from './layeredTemporalTasteProfileService.js';

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
    shortTermScore?: number;
    mediumTermScore?: number;
    longTermScore?: number;
    temporalTasteScore?: number;
    calibrationMultiplier?: number;
    calibrationScore?: number;
    feedbackContribution?: number;
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

    const contextConfig = getRecommendationSignalConfig().contextSignals;

    // 1. Energy Fit
    if (typeof songEnergy === 'number' && Number.isFinite(songEnergy)) {
      const energyDiff = Math.abs(songEnergy - preferences.targetEnergy);
      const energyScore = 1.0 - Math.min(1.0, energyDiff / contextConfig.energyTolerance);
      accumulatedScore += Math.max(0, energyScore) * contextConfig.energyMatchWeight;
      totalWeight += contextConfig.energyMatchWeight;
    }

    // 2. Tempo Fit
    if (typeof songTempo === 'number' && songTempo > 0) {
      const tempoDiff = Math.abs(songTempo - preferences.targetTempo);
      const tempoScore = 1.0 - Math.min(1.0, tempoDiff / contextConfig.tempoTolerance);
      accumulatedScore += Math.max(0, tempoScore) * contextConfig.tempoMatchWeight;
      totalWeight += contextConfig.tempoMatchWeight;
    }

    // 3. Mood Fit
    if (songMood && preferences.targetMood) {
      const targetMoodLower = preferences.targetMood.toLowerCase();
      let moodScore = 0.5;
      if (songMood === targetMoodLower) {
        moodScore = 1.0;
      }
      accumulatedScore += moodScore * contextConfig.moodMatchWeight;
      totalWeight += contextConfig.moodMatchWeight;
    }

    // 4. Genre Fit
    if (songGenre && preferences.preferredGenres && preferences.preferredGenres.length > 0) {
      const isPreferred = preferences.preferredGenres.some(
        (g) => g.toLowerCase() === songGenre.toLowerCase()
      );
      const genreScore = isPreferred ? 1.0 : 0.40;
      accumulatedScore += genreScore * contextConfig.genreMatchWeight;
      totalWeight += contextConfig.genreMatchWeight;
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
   * Helper: Calculates alignment between a candidate song and a single temporal taste layer
   * (short-term, medium-term, or long-term) based on genre, artist, mood, and acoustic profiles.
   */
  private static calculateLayerFitScore(
    songDoc: any,
    layer: TemporalTasteLayer,
    config: TemporalTasteInfluenceConfig
  ): number {
    if (!songDoc || !layer) return 0.5;

    let accumulatedScore = 0;
    let totalWeight = 0;

    const songGenre = songDoc.genre
      ? typeof songDoc.genre === 'object' && songDoc.genre.name
        ? String(songDoc.genre.name).trim().toLowerCase()
        : String(songDoc.genre).trim().toLowerCase()
      : undefined;

    const songArtist = songDoc.artist
      ? typeof songDoc.artist === 'object' && songDoc.artist.name
        ? String(songDoc.artist.name).trim().toLowerCase()
        : String(songDoc.artist).trim().toLowerCase()
      : undefined;

    const songMood = songDoc.mood ? String(songDoc.mood).trim().toLowerCase() : undefined;
    const audioFeatures = songDoc.audioFeatures || {};

    // 1. Genre Fit (Weight from config, default 0.40)
    if (layer.genres && layer.genres.length > 0) {
      totalWeight += config.genreMatchWeight;
      if (songGenre) {
        const matched = layer.genres.find(
          (g) => g.name.toLowerCase() === songGenre || (g.id && String(g.id) === String(songDoc.genre?._id || songDoc.genre))
        );
        if (matched) {
          accumulatedScore += config.genreMatchWeight * Math.max(0.2, matched.score);
        }
      }
    }

    // 2. Artist Fit (Weight from config, default 0.30)
    if (layer.artists && layer.artists.length > 0) {
      totalWeight += config.artistMatchWeight;
      if (songArtist) {
        const matched = layer.artists.find(
          (a) => a.name.toLowerCase() === songArtist || (a.id && String(a.id) === String(songDoc.artist?._id || songDoc.artist))
        );
        if (matched) {
          accumulatedScore += config.artistMatchWeight * Math.max(0.2, matched.score);
        }
      }
    }

    // 3. Mood Fit (Weight from config, default 0.15)
    if (layer.moods && layer.moods.length > 0) {
      totalWeight += config.moodMatchWeight;
      if (songMood) {
        const matched = layer.moods.find((m) => m.name.toLowerCase() === songMood);
        if (matched) {
          accumulatedScore += config.moodMatchWeight * Math.max(0.2, matched.score);
        }
      }
    }

    // 4. Acoustic Target Fit (Weight from config, default 0.15)
    if (layer.acousticTargets && audioFeatures) {
      totalWeight += config.acousticMatchWeight;
      let acousticScore = 0.5;
      let acousticCount = 0;
      let acousticSum = 0;

      if (typeof audioFeatures.energy === 'number' && typeof layer.acousticTargets.energy === 'number') {
        const diff = Math.abs(audioFeatures.energy - layer.acousticTargets.energy);
        acousticSum += Math.max(0, 1.0 - diff / 0.40);
        acousticCount++;
      }
      if (typeof audioFeatures.tempo === 'number' && typeof layer.acousticTargets.tempo === 'number') {
        const diff = Math.abs(audioFeatures.tempo - layer.acousticTargets.tempo);
        acousticSum += Math.max(0, 1.0 - diff / 40);
        acousticCount++;
      }
      if (acousticCount > 0) {
        acousticScore = acousticSum / acousticCount;
      }
      accumulatedScore += config.acousticMatchWeight * acousticScore;
    }

    if (totalWeight === 0) return 0.5;
    return Number(Math.max(0, Math.min(1, accumulatedScore / totalWeight)).toFixed(4));
  }

  /**
   * Evaluates a candidate pool, applies Min-Max normalization across feature components,
   * calculates final weighted hybrid recommendation scores (incorporating content, collaborative,
   * user taste profile affinity, popularity, and recency signals), optionally applies context modulation,
   * optionally applies listening session taste profile modulation, optionally applies multi-layer
   * temporal taste profile modulation (short, medium, long term signals), ranks candidates descending,
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
    sessionDoc?: IListeningSession | null,
    temporalProfile?: UnifiedLayeredTasteProfile | null,
    customTemporalInfluence?: number
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

    // 4. Resolve Temporal Taste Influence if temporal profile is provided
    let effectiveTemporalInfluence = 0;
    const temporalConfig = getTemporalTasteInfluenceConfig();
    if (temporalProfile) {
      const requestedInfluence =
        customTemporalInfluence !== undefined
          ? customTemporalInfluence
          : temporalConfig.defaultTemporalInfluence;

      effectiveTemporalInfluence = Math.max(
        temporalConfig.minTemporalInfluence,
        Math.min(temporalConfig.maxTemporalInfluence, requestedInfluence)
      );
    }

    // Bound total contextual + session + temporal influence so personalized baseline is preserved >= minBaselineWeightFloor
    const signalConfig = getRecommendationSignalConfig();
    const maxModulation = signalConfig.modulationLayers.maxCombinedModulationInfluence;

    const totalExtraInfluence =
      effectiveContextInfluence + effectiveSessionInfluence + effectiveTemporalInfluence;
    if (totalExtraInfluence > maxModulation) {
      const scaleFactor = maxModulation / totalExtraInfluence;
      effectiveContextInfluence *= scaleFactor;
      effectiveSessionInfluence *= scaleFactor;
      effectiveTemporalInfluence *= scaleFactor;
    }

    const baselineHybridWeight =
      1 - effectiveContextInfluence - effectiveSessionInfluence - effectiveTemporalInfluence;

    // 5. Compute normalized component scores & weighted multi-layer fusion per candidate
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

      // Calculate separate temporal layer signals if active
      let shortTermScore: number | undefined = undefined;
      let mediumTermScore: number | undefined = undefined;
      let longTermScore: number | undefined = undefined;
      let temporalTasteScore: number | undefined = undefined;

      if (temporalProfile && effectiveTemporalInfluence > 0) {
        shortTermScore = this.calculateLayerFitScore(cand.songDoc, temporalProfile.shortTerm, temporalConfig);
        mediumTermScore = this.calculateLayerFitScore(cand.songDoc, temporalProfile.mediumTerm, temporalConfig);
        longTermScore = this.calculateLayerFitScore(cand.songDoc, temporalProfile.longTerm, temporalConfig);

        const sumSignalWeights =
          temporalConfig.shortTermSignalWeight +
          temporalConfig.mediumTermSignalWeight +
          temporalConfig.longTermSignalWeight;

        const weightedTemporal =
          (shortTermScore * temporalConfig.shortTermSignalWeight +
            mediumTermScore * temporalConfig.mediumTermSignalWeight +
            longTermScore * temporalConfig.longTermSignalWeight) /
          Math.max(0.01, sumSignalWeights);

        temporalTasteScore = Number(Math.max(0, Math.min(1, weightedTemporal)).toFixed(4));
      }

      // Blended multi-layer score
      let blended = baselineHybridWeight * baseHybridScore;
      if (contextFitScore !== undefined) {
        blended += effectiveContextInfluence * contextFitScore;
      }
      if (sessionFitScore !== undefined) {
        blended += effectiveSessionInfluence * sessionFitScore;
      }
      if (temporalTasteScore !== undefined) {
        blended += effectiveTemporalInfluence * temporalTasteScore;
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
          shortTermScore,
          mediumTermScore,
          longTermScore,
          temporalTasteScore,
        },
        sources: cand.sources || [],
        metadata:
          derivedPreferences || sessionProfile || temporalProfile
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
                ...(temporalProfile
                  ? {
                      temporalInfluence: effectiveTemporalInfluence,
                      shortTermFitScore: shortTermScore,
                      mediumTermFitScore: mediumTermScore,
                      longTermFitScore: longTermScore,
                      temporalTasteScore,
                      tasteStabilityScore: temporalProfile.tasteStabilityScore,
                    }
                  : {}),
              }
            : undefined,
      };
    });

    // 6. Sort candidates descending by final hybrid score
    scoredItems.sort((a, b) => b.hybridScore - a.hybridScore);

    // 7. Return top limit results
    return scoredItems.slice(0, Math.max(1, limit));
  }
}

export default HybridRankingPipeline;
