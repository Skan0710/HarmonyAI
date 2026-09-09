import { HybridCandidate } from './candidateGenerationService.js';
import {
  HybridScoringWeights,
  getHybridConfigWeights,
  getContextInfluenceConfig,
  getSessionInfluenceConfig,
  getTemporalTasteInfluenceConfig,
  TemporalTasteInfluenceConfig,
  getMusicDNAInfluenceConfig,
  MusicDNAInfluenceConfig,
  getTasteEvolutionInfluenceConfig,
  TasteEvolutionInfluenceConfig,
  getPersonalMusicTwinInfluenceConfig,
  PersonalMusicTwinInfluenceConfig,
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
import {
  UnifiedMusicDNA,
  MusicDNAProfileAttributes,
} from '../schemas/musicDnaSchema.js';
import { IMusicDNA } from '../models/MusicDNA.js';
import { PersonalMusicTwinAttributes } from '../schemas/personalMusicTwinSchema.js';

export interface TasteEvolutionSignal {
  emergingGenres?: string[];
  emergingArtists?: string[];
  sustainedEmergingGenres?: string[];
  sustainedEmergingArtists?: string[];
  fadingGenres?: string[];
  fadingArtists?: string[];
  stableGenres?: string[];
  stableArtists?: string[];
  tasteStabilityRating?: string;
  tasteStabilityScore?: number;
  transformationIntensityScore?: number;
  tasteVolatilityRating?: string;
  archetype?: string;
}

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
    musicDnaScore?: number;
    tasteEvolutionScore?: number;
    personalMusicTwinScore?: number;
    calibrationMultiplier?: number;
    calibrationScore?: number;
    feedbackContribution?: number;
    diversityAdjustment?: number;
  };
  sources: string[];
  metadata?: Record<string, any>;
  explanation?: any;
  reasons?: any[];
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
    if (songGenre && sessionProfile.preferredGenres?.length > 0) {
      const match = sessionProfile.preferredGenres.find(
        (g) => g.genre.toLowerCase() === songGenre.toLowerCase()
      );
      const genreScore = match ? Math.min(1.0, match.score * 2.5) : 0.30;
      accumulatedScore += genreScore * 0.35;
      totalWeight += 0.35;
    }

    // 2. Session Artist Alignment (Weight: 0.25)
    if (songArtistId && sessionProfile.preferredArtists?.length > 0) {
      const match = sessionProfile.preferredArtists.find(
        (a) => a.artistId === songArtistId
      );
      const artistScore = match ? Math.min(1.0, match.score * 2.0) : 0.40;
      accumulatedScore += artistScore * 0.25;
      totalWeight += 0.25;
    }

    // 3. Acoustic Energy Fit (Weight: 0.20)
    if (
      typeof songEnergy === 'number' &&
      Number.isFinite(songEnergy) &&
      typeof sessionProfile.averageEnergy === 'number'
    ) {
      const energyDiff = Math.abs(songEnergy - sessionProfile.averageEnergy);
      const energyScore = Math.max(0, 1.0 - energyDiff / 0.40);
      accumulatedScore += energyScore * 0.20;
      totalWeight += 0.20;
    }

    // 4. Acoustic Tempo Fit (Weight: 0.10)
    if (
      typeof songTempo === 'number' &&
      songTempo > 0 &&
      typeof sessionProfile.averageTempo === 'number'
    ) {
      const tempoDiff = Math.abs(songTempo - sessionProfile.averageTempo);
      const tempoScore = Math.max(0, 1.0 - tempoDiff / 40);
      accumulatedScore += tempoScore * 0.10;
      totalWeight += 0.10;
    }

    // 5. Dominant Mood Alignment (Weight: 0.10)
    if (songMood && sessionProfile.dominantMoods?.length > 0) {
      const match = sessionProfile.dominantMoods.find(
        (m) => m.mood.toLowerCase() === songMood
      );
      const moodScore = match ? Math.min(1.0, match.score * 2.0) : 0.40;
      accumulatedScore += moodScore * 0.10;
      totalWeight += 0.10;
    }

    let baseSessionFit = totalWeight > 0 ? accumulatedScore / totalWeight : 0.5;

    // Boost tracks similar to recent completions/replays
    if (sessionProfile.interactionSummary && (sessionProfile.interactionSummary.completionsCount > 0 || sessionProfile.interactionSummary.replaysCount > 0)) {
      const isTopSessionGenre = sessionProfile.preferredGenres?.slice(0, 1).some(
        (g) => songGenre && g.genre.toLowerCase() === songGenre.toLowerCase()
      );
      const isTopSessionArtist = songArtistId && sessionProfile.preferredArtists?.slice(0, 1).some(
        (a) => a.artistId === songArtistId
      );
      if (isTopSessionGenre || isTopSessionArtist) {
        baseSessionFit *= sessionConfig.recentCompletionBoost;
      }
    }

    // Penalize tracks similar to repeatedly skipped items
    if (sessionProfile.interactionSummary && sessionProfile.interactionSummary.skipsCount >= 2) {
      const isTopSessionGenre = sessionProfile.preferredGenres?.slice(0, 1).some(
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
   * Helper: Calculates a candidate song's Music DNA fit score (0.0 to 1.0)
   * evaluating genre alignment (top + emerging), artist alignment (strongest + emerging),
   * mood match, acoustic targets, and tendency harmony.
   */
  private static calculateMusicDnaFitScore(
    songDoc: any,
    dna: UnifiedMusicDNA | IMusicDNA | MusicDNAProfileAttributes | any,
    config: MusicDNAInfluenceConfig
  ): number {
    if (!songDoc || !dna) return 0.5;

    let accumulatedScore = 0;
    let totalWeight = 0;

    const songGenre = (
      typeof songDoc.genre === 'object' && songDoc.genre?.name
        ? songDoc.genre.name
        : typeof songDoc.genre === 'string'
        ? songDoc.genre
        : ''
    ).toLowerCase().trim();

    const songArtist = (
      typeof songDoc.artist === 'object' && songDoc.artist?.name
        ? songDoc.artist.name
        : typeof songDoc.artist === 'string'
        ? songDoc.artist
        : ''
    ).toLowerCase().trim();

    const songMood = songDoc.mood ? String(songDoc.mood).trim().toLowerCase() : undefined;
    const audioFeatures = songDoc.audioFeatures || {};

    // 1. Top Genre Alignment
    const topGenres = dna.genreProfile?.topGenres || dna.genres || [];
    if (topGenres.length > 0) {
      totalWeight += config.topGenreMatchWeight;
      if (songGenre) {
        const match = topGenres.find(
          (g: any) => (g.name || '').toLowerCase().trim() === songGenre
        );
        if (match) {
          const score = match.score ?? match.affinityScore ?? 0.8;
          accumulatedScore += config.topGenreMatchWeight * Math.max(0.2, score);
        }
      }
    }

    // 2. Emerging Genre Alignment
    const emergingGenres = dna.genreProfile?.emergingGenres || dna.temporalTaste?.emergingGenres || [];
    if (emergingGenres.length > 0) {
      totalWeight += config.emergingGenreMatchWeight;
      if (songGenre) {
        const match = emergingGenres.find(
          (g: any) => (typeof g === 'string' ? g : g.name || '').toLowerCase().trim() === songGenre
        );
        if (match) {
          const score = typeof match === 'string' ? 0.9 : match.score ?? 0.9;
          accumulatedScore += config.emergingGenreMatchWeight * Math.max(0.3, score);
        }
      }
    }

    // 3. Strongest Artist Alignment
    const strongestArtists = dna.artistProfile?.strongestArtists || dna.artists || [];
    if (strongestArtists.length > 0) {
      totalWeight += config.strongestArtistMatchWeight;
      if (songArtist) {
        const match = strongestArtists.find(
          (a: any) => (a.name || '').toLowerCase().trim() === songArtist
        );
        if (match) {
          const score = match.score ?? match.affinityScore ?? 0.8;
          accumulatedScore += config.strongestArtistMatchWeight * Math.max(0.2, score);
        }
      }
    }

    // 4. Emerging Artist Alignment
    const emergingArtists = dna.artistProfile?.emergingArtists || [];
    if (emergingArtists.length > 0) {
      totalWeight += config.emergingArtistMatchWeight;
      if (songArtist) {
        const match = emergingArtists.find(
          (a: any) => (a.name || '').toLowerCase().trim() === songArtist
        );
        if (match) {
          const score = match.score ?? 0.85;
          accumulatedScore += config.emergingArtistMatchWeight * Math.max(0.3, score);
        }
      }
    }

    // 5. Preferred Mood Alignment
    const preferredMoods = dna.moodProfile?.preferredMoods || dna.moods || [];
    if (preferredMoods.length > 0) {
      totalWeight += config.moodMatchWeight;
      if (songMood) {
        const match = preferredMoods.find(
          (m: any) => (m.mood || m.name || '').toLowerCase().trim() === songMood
        );
        if (match) {
          const score = match.score ?? match.affinityScore ?? 0.75;
          accumulatedScore += config.moodMatchWeight * Math.max(0.2, score);
        }
      }
    }

    // 6. Acoustic / Feature Target Alignment
    const acousticPrefs = dna.listeningPatterns?.audioFeaturePreferences;
    const preferredTempo = dna.listeningPatterns?.preferredTempo;
    if (acousticPrefs || preferredTempo) {
      totalWeight += config.acousticMatchWeight;
      let count = 0;
      let sum = 0;

      if (acousticPrefs?.energy !== undefined && typeof audioFeatures.energy === 'number') {
        const diff = Math.abs(audioFeatures.energy - acousticPrefs.energy);
        sum += Math.max(0, 1.0 - diff / 0.40);
        count++;
      }
      if (preferredTempo?.target !== undefined && typeof audioFeatures.tempo === 'number') {
        const diff = Math.abs(audioFeatures.tempo - preferredTempo.target);
        sum += Math.max(0, 1.0 - diff / 40);
        count++;
      } else if (acousticPrefs?.tempo !== undefined && typeof audioFeatures.tempo === 'number') {
        const diff = Math.abs(audioFeatures.tempo - acousticPrefs.tempo);
        sum += Math.max(0, 1.0 - diff / 40);
        count++;
      }

      const acousticScore = count > 0 ? sum / count : 0.5;
      accumulatedScore += config.acousticMatchWeight * acousticScore;
    }

    if (totalWeight === 0) return 0.5;

    const rawFit = Math.max(0, Math.min(1, accumulatedScore / totalWeight));

    // Scale by confidenceScore if available to ensure sparse/unconfident profiles don't introduce high variance
    const confidence = typeof dna.confidenceScore === 'number' ? Math.max(0.1, Math.min(1.0, dna.confidenceScore)) : 0.8;
    const calibratedFit = 0.5 * (1 - confidence) + rawFit * confidence;

    return Number(calibratedFit.toFixed(4));
  }

  /**
   * Helper: Calculates a candidate song's Taste Evolution fit score (0.0 to 1.0)
   * based on directional taste evolution: boosts emerging & sustained emerging preferences,
   * dampens fading preferences, and reinforces stable foundational favorites.
   */
  private static calculateTasteEvolutionFitScore(
    songDoc: any,
    evolution: TasteEvolutionSignal | null | undefined,
    config: TasteEvolutionInfluenceConfig
  ): number {
    if (!songDoc || !evolution) return 0.5;

    const songGenre = (
      typeof songDoc.genre === 'object' && songDoc.genre?.name
        ? songDoc.genre.name
        : typeof songDoc.genre === 'string'
        ? songDoc.genre
        : ''
    ).toLowerCase().trim();

    const songArtist = (
      typeof songDoc.artist === 'object' && songDoc.artist?.name
        ? songDoc.artist.name
        : typeof songDoc.artist === 'string'
        ? songDoc.artist
        : ''
    ).toLowerCase().trim();

    // Baseline neutral score
    let baseScore = 0.50;

    const isEmergingGenre = (evolution.emergingGenres || []).some(
      (g) => g.toLowerCase().trim() === songGenre
    );
    const isSustainedEmergingGenre = (evolution.sustainedEmergingGenres || []).some(
      (g) => g.toLowerCase().trim() === songGenre
    );
    const isEmergingArtist = (evolution.emergingArtists || []).some(
      (a) => a.toLowerCase().trim() === songArtist
    );
    const isSustainedEmergingArtist = (evolution.sustainedEmergingArtists || []).some(
      (a) => a.toLowerCase().trim() === songArtist
    );

    const isFadingGenre = (evolution.fadingGenres || []).some(
      (g) => g.toLowerCase().trim() === songGenre
    );
    const isFadingArtist = (evolution.fadingArtists || []).some(
      (a) => a.toLowerCase().trim() === songArtist
    );

    const isStableGenre = (evolution.stableGenres || []).some(
      (g) => g.toLowerCase().trim() === songGenre
    );
    const isStableArtist = (evolution.stableArtists || []).some(
      (a) => a.toLowerCase().trim() === songArtist
    );

    // 1. Emerging Boost: Directional Discovery
    if (isSustainedEmergingGenre || isSustainedEmergingArtist) {
      baseScore += config.sustainedEmergingBoost;
    } else if (isEmergingGenre || isEmergingArtist) {
      baseScore += config.emergingDiscoveryBoost;
    }

    // 2. Fading Attenuation: Directional De-prioritization
    if (isFadingGenre || isFadingArtist) {
      baseScore -= config.fadingPreferencePenalty;
    }

    // 3. Stable Preference Protection: Foundational Retention
    if (isStableGenre || isStableArtist) {
      baseScore = Math.min(1.0, baseScore * config.stablePreferenceMultiplier);
    }

    return Number(Math.max(0.0, Math.min(1.0, baseScore)).toFixed(4));
  }

  /**
   * Helper: Calculates a candidate song's fit with the user's Personal Music Twin (0.0 to 1.0)
   * incorporating listener archetype, personality traits, exploration/familiarity preferences,
   * acoustic traits, and directional taste evolution.
   */
  private static calculatePersonalMusicTwinFitScore(
    songDoc: any,
    twin: PersonalMusicTwinAttributes | null | undefined,
    config: PersonalMusicTwinInfluenceConfig
  ): number {
    if (!songDoc || !twin) return 0.50;

    const songGenre = (
      typeof songDoc.genre === 'object' && songDoc.genre?.name
        ? songDoc.genre.name
        : typeof songDoc.genre === 'string'
        ? songDoc.genre
        : ''
    ).toLowerCase().trim();

    const songArtist = (
      typeof songDoc.artist === 'object' && songDoc.artist?.name
        ? songDoc.artist.name
        : typeof songDoc.artist === 'string'
        ? songDoc.artist
        : ''
    ).toLowerCase().trim();

    // 1. Genre Core Alignment
    let genreScore = 0.50;
    const isPrimaryGenre = (twin.genreIdentity?.coreGenres || []).some(
      (g) => g.isPrimary && g.name.toLowerCase().trim() === songGenre
    );
    const isCoreGenre = (twin.genreIdentity?.coreGenres || []).some(
      (g) => g.name.toLowerCase().trim() === songGenre
    );
    const isSecondaryGenre = (twin.genreIdentity?.secondaryGenres || []).some(
      (g) => g.name.toLowerCase().trim() === songGenre
    );

    if (isPrimaryGenre) {
      genreScore = 0.90;
    } else if (isCoreGenre) {
      genreScore = 0.80;
    } else if (isSecondaryGenre) {
      genreScore = 0.65;
    } else {
      const explorationBonus = Math.max(0, (twin.explorationTendency ?? 0.5) - 0.5) * 0.40;
      genreScore = 0.35 + explorationBonus;
    }

    // 2. Mood Alignment
    const songMood = (
      songDoc.mood ||
      songDoc.primaryMood ||
      (songDoc.song && (songDoc.song.mood || songDoc.song.primaryMood)) ||
      ''
    ).toLowerCase().trim();

    let moodScore = 0.50;
    const dominantMoods = twin.moodIdentity?.dominantMoods || [];
    const matchedMood = dominantMoods.find(
      (m) => m.mood.toLowerCase().trim() === songMood
    );
    const matchesDominantMood = Boolean(matchedMood);
    if (matchesDominantMood && matchedMood) {
      moodScore = 0.70 + 0.30 * (matchedMood.affinityScore ?? 0.8);
    } else if (dominantMoods.length > 0 && songMood) {
      moodScore = 0.40;
    }

    // 3. Archetype Modulation
    let archetypeScore = 0.50;
    const archetype = twin.listenerArchetype;

    if (archetype === 'Explorer') {
      // Explorer: rewards uncore genres and tracks that broaden horizons
      archetypeScore = !isCoreGenre ? 0.85 : 0.45;
      archetypeScore += 0.20 * ((twin.explorationTendency ?? 0.5) - 0.5);
    } else if (archetype === 'Loyal Listener') {
      // Loyal Listener: rewards core genres and familiar tracks
      archetypeScore = isCoreGenre ? 0.88 : 0.32;
      archetypeScore += 0.20 * ((twin.familiarityTendency ?? 0.5) - 0.5);
    } else if (archetype === 'Mood Listener') {
      // Mood Listener: rewards emotional atmospheric alignment
      archetypeScore = matchesDominantMood ? 0.92 : 0.38;
      if (matchesDominantMood) {
        genreScore = Math.max(genreScore, 0.75);
      }
    } else if (archetype === 'Genre Hopper') {
      // Genre Hopper: rewards variety and transitions
      archetypeScore = isSecondaryGenre || !isCoreGenre ? 0.82 : 0.52;
      archetypeScore += 0.15 * ((twin.diversityPreference ?? 0.5) - 0.5);
    } else if (archetype === 'Discovery Seeker') {
      // Discovery Seeker: rewards newly released / novel tracks and emerging interests
      const isEmergingGenreCheck = (twin.currentEmergingInterests?.genres || []).some(
        (g) => g.name.toLowerCase().trim() === songGenre
      );
      const isRecent = songDoc.releaseDate
        ? (Date.now() - new Date(songDoc.releaseDate).getTime()) < 180 * 24 * 3600 * 1000
        : false;
      archetypeScore = isEmergingGenreCheck || isRecent || !isCoreGenre ? 0.88 : 0.42;
    } else if (archetype === 'Comfort Listener') {
      // Comfort Listener: rewards stable core catalog
      archetypeScore = isCoreGenre ? 0.88 : 0.32;
      archetypeScore += 0.15 * ((twin.familiarityTendency ?? 0.5) - 0.5);
    } else {
      // Balanced Listener
      archetypeScore = 0.55;
    }

    // 4. Personality Traits Alignment
    let traitsBonus = 0.0;
    const rawTraits: any[] = twin.metadata?.personalityTraits || [];
    const traitNames = rawTraits.map((t: any) => t.trait || t.id || '');

    if (traitNames.includes('highly exploratory') && !isCoreGenre) {
      traitsBonus += 0.12;
    }
    if (traitNames.includes('genre loyal') && isCoreGenre) {
      traitsBonus += 0.12;
    }
    if (traitNames.includes('comfort oriented') && isCoreGenre) {
      traitsBonus += 0.10;
    }
    if (
      traitNames.includes('discovery oriented') &&
      (!isCoreGenre ||
        Boolean(
          twin.currentEmergingInterests?.genres?.some(
            (g) => g.name.toLowerCase().trim() === songGenre
          )
        ))
    ) {
      traitsBonus += 0.12;
    }
    if (traitNames.includes('mood driven') && matchesDominantMood) {
      traitsBonus += 0.15;
    }
    if (traitNames.includes('highly diverse') && (!isCoreGenre || isSecondaryGenre)) {
      traitsBonus += 0.08;
    }

    // 5. Taste Evolution / Emerging Preferences Alignment
    let evolutionBonus = 0.0;
    const isEmergingGenre = (twin.currentEmergingInterests?.genres || []).some(
      (g) => g.name.toLowerCase().trim() === songGenre
    );
    const isEmergingArtist = (twin.currentEmergingInterests?.artists || []).some(
      (a) => a.name.toLowerCase().trim() === songArtist
    );
    const isFading = (twin.metadata?.fadingPreferences?.genres || []).some(
      (g: string) => g.toLowerCase().trim() === songGenre
    );

    if (isEmergingGenre || isEmergingArtist) {
      evolutionBonus += 0.18 * (1.0 + (twin.tasteEvolution?.transformationIntensity || 0.0));
    }
    if (isFading) {
      evolutionBonus -= 0.15;
    }

    // 6. Acoustic Trait Harmony
    let acousticHarmony = 0.50;
    if (songDoc.energy !== undefined && twin.dominantMusicalTraits?.energyPreference !== undefined) {
      const energyDelta = Math.abs(songDoc.energy - twin.dominantMusicalTraits.energyPreference);
      acousticHarmony = Math.max(0.0, 1.0 - energyDelta);
    }

    // Synthesize component weights
    let compositeScore =
      0.25 * genreScore +
      0.25 * archetypeScore +
      0.20 * moodScore +
      0.15 * acousticHarmony +
      0.15 *
        (twin.explorationTendency !== undefined && !isCoreGenre
          ? twin.explorationTendency
          : twin.familiarityTendency !== undefined && isCoreGenre
          ? twin.familiarityTendency
          : 0.50) +
      traitsBonus +
      evolutionBonus;

    compositeScore = Math.max(0.0, Math.min(1.0, compositeScore));

    // Modulate by Twin confidence score (ensures low-data twins do not perturb ranking)
    const confidenceWeight = Math.max(0.20, Math.min(1.0, twin.confidenceScore || 0.5));
    const finalFitScore = confidenceWeight * compositeScore + (1.0 - confidenceWeight) * 0.50;

    return Number(finalFitScore.toFixed(4));
  }

  /**
   * Evaluates a candidate pool, applies Min-Max normalization across feature components,
   * calculates final weighted hybrid recommendation scores (incorporating content, collaborative,
   * user taste profile affinity, popularity, and recency signals), optionally applies context modulation,
   * optionally applies listening session taste profile modulation, optionally applies multi-layer
   * temporal taste profile modulation (short, medium, long term signals), optionally applies
   * Music DNA profile modulation, optionally applies Taste Evolution modulation,
   * optionally applies Personal Music Twin modulation,
   * ranks candidates descending, and returns top items up to configurable limit.
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
    customTemporalInfluence?: number,
    musicDnaProfile?: UnifiedMusicDNA | IMusicDNA | MusicDNAProfileAttributes | any,
    customMusicDnaInfluence?: number,
    tasteEvolutionSignal?: TasteEvolutionSignal | null,
    customEvolutionInfluence?: number,
    personalMusicTwin?: PersonalMusicTwinAttributes | any | null,
    customTwinInfluence?: number
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

    // 5. Resolve Music DNA Influence if Music DNA profile is provided
    let effectiveMusicDnaInfluence = 0;
    const musicDnaConfig = getMusicDNAInfluenceConfig();
    if (musicDnaProfile) {
      const requestedInfluence =
        customMusicDnaInfluence !== undefined
          ? customMusicDnaInfluence
          : musicDnaConfig.defaultMusicDNAInfluence;

      effectiveMusicDnaInfluence = Math.max(
        musicDnaConfig.minMusicDNAInfluence,
        Math.min(musicDnaConfig.maxMusicDNAInfluence, requestedInfluence)
      );
    }

    // 6. Resolve Taste Evolution Influence if Taste Evolution signal is provided
    let effectiveEvolutionInfluence = 0;
    const evolutionConfig = getTasteEvolutionInfluenceConfig();
    if (tasteEvolutionSignal) {
      const requestedInfluence =
        customEvolutionInfluence !== undefined
          ? customEvolutionInfluence
          : evolutionConfig.defaultEvolutionInfluence;

      effectiveEvolutionInfluence = Math.max(
        evolutionConfig.minEvolutionInfluence,
        Math.min(evolutionConfig.maxEvolutionInfluence, requestedInfluence)
      );
    }

    // 7. Resolve Personal Music Twin Influence if Personal Music Twin is provided
    let effectiveTwinInfluence = 0;
    const twinConfig = getPersonalMusicTwinInfluenceConfig();
    if (personalMusicTwin) {
      const requestedInfluence =
        customTwinInfluence !== undefined
          ? customTwinInfluence
          : twinConfig.defaultTwinInfluence;

      effectiveTwinInfluence = Math.max(
        twinConfig.minTwinInfluence,
        Math.min(twinConfig.maxTwinInfluence, requestedInfluence)
      );
    }

    // Bound total contextual + session + temporal + music DNA + evolution + twin influence so personalized baseline is preserved >= minBaselineWeightFloor
    const signalConfig = getRecommendationSignalConfig();
    const maxModulation = signalConfig.modulationLayers.maxCombinedModulationInfluence;

    const totalExtraInfluence =
      effectiveContextInfluence +
      effectiveSessionInfluence +
      effectiveTemporalInfluence +
      effectiveMusicDnaInfluence +
      effectiveEvolutionInfluence +
      effectiveTwinInfluence;

    if (totalExtraInfluence > maxModulation) {
      const scaleFactor = maxModulation / totalExtraInfluence;
      effectiveContextInfluence *= scaleFactor;
      effectiveSessionInfluence *= scaleFactor;
      effectiveTemporalInfluence *= scaleFactor;
      effectiveMusicDnaInfluence *= scaleFactor;
      effectiveEvolutionInfluence *= scaleFactor;
      effectiveTwinInfluence *= scaleFactor;
    }

    const baselineHybridWeight =
      1 -
      effectiveContextInfluence -
      effectiveSessionInfluence -
      effectiveTemporalInfluence -
      effectiveMusicDnaInfluence -
      effectiveEvolutionInfluence -
      effectiveTwinInfluence;

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

      // Calculate Music DNA adjustment if active
      let musicDnaScore: number | undefined = undefined;
      if (musicDnaProfile && effectiveMusicDnaInfluence > 0) {
        musicDnaScore = this.calculateMusicDnaFitScore(cand.songDoc, musicDnaProfile, musicDnaConfig);
      }

      // Calculate Taste Evolution adjustment if active
      let tasteEvolutionScore: number | undefined = undefined;
      if (tasteEvolutionSignal && effectiveEvolutionInfluence > 0) {
        tasteEvolutionScore = this.calculateTasteEvolutionFitScore(
          cand.songDoc,
          tasteEvolutionSignal,
          evolutionConfig
        );
      }

      // Calculate Personal Music Twin adjustment if active
      let personalMusicTwinScore: number | undefined = undefined;
      if (personalMusicTwin && effectiveTwinInfluence > 0) {
        personalMusicTwinScore = this.calculatePersonalMusicTwinFitScore(
          cand.songDoc,
          personalMusicTwin,
          twinConfig
        );
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
      if (musicDnaScore !== undefined) {
        blended += effectiveMusicDnaInfluence * musicDnaScore;
      }
      if (tasteEvolutionScore !== undefined) {
        blended += effectiveEvolutionInfluence * tasteEvolutionScore;
      }
      if (personalMusicTwinScore !== undefined) {
        blended += effectiveTwinInfluence * personalMusicTwinScore;
      }

      const safeBlended = Number.isFinite(blended) && !Number.isNaN(blended) ? blended : 0;
      const finalScore = Number(Math.max(0, Math.min(1, safeBlended)).toFixed(4));

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
          musicDnaScore,
          tasteEvolutionScore,
          personalMusicTwinScore,
        },
        sources: cand.sources || [],
        metadata:
          derivedPreferences ||
          sessionProfile ||
          temporalProfile ||
          (musicDnaProfile && effectiveMusicDnaInfluence > 0) ||
          (tasteEvolutionSignal && effectiveEvolutionInfluence > 0) ||
          (personalMusicTwin && effectiveTwinInfluence > 0)
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
                ...(musicDnaProfile && effectiveMusicDnaInfluence > 0
                  ? {
                      musicDnaInfluence: effectiveMusicDnaInfluence,
                      musicDnaConfidence: musicDnaProfile.confidenceScore,
                      musicDnaFitScore: musicDnaScore,
                    }
                  : {}),
                ...(tasteEvolutionSignal && effectiveEvolutionInfluence > 0
                  ? {
                      tasteEvolutionInfluence: effectiveEvolutionInfluence,
                      tasteEvolutionScore,
                      tasteStabilityRating: tasteEvolutionSignal.tasteStabilityRating,
                      evolutionArchetype: tasteEvolutionSignal.archetype,
                    }
                  : {}),
                ...(personalMusicTwin && effectiveTwinInfluence > 0
                  ? {
                      personalMusicTwinInfluence: effectiveTwinInfluence,
                      personalMusicTwinScore,
                      twinArchetype: personalMusicTwin.listenerArchetype,
                      twinConfidence: personalMusicTwin.confidenceScore,
                    }
                  : {}),
              }
            : undefined,
      };
    });

    // 6. Sort candidates descending with deterministic tie-breaker
    scoredItems.sort((a, b) => {
      const scoreA = Number.isFinite(a.hybridScore) ? a.hybridScore : 0;
      const scoreB = Number.isFinite(b.hybridScore) ? b.hybridScore : 0;
      const scoreDiff = scoreB - scoreA;
      if (Math.abs(scoreDiff) > 1e-5) return scoreDiff;
      const idA = a.song?._id?.toString() || a.song?.id?.toString() || a.song?.title || '';
      const idB = b.song?._id?.toString() || b.song?.id?.toString() || b.song?.title || '';
      return idA.localeCompare(idB);
    });

    // 7. Deduplicate candidates by unique song ID (preserving highest scored occurrence)
    const seenSongIds = new Set<string>();
    const uniqueItems: HybridRankedResult[] = [];
    for (const item of scoredItems) {
      const songId = item.song?._id?.toString() || item.song?.id?.toString();
      if (songId) {
        if (seenSongIds.has(songId)) continue;
        seenSongIds.add(songId);
      }
      uniqueItems.push(item);
    }

    // 8. Return top limit results
    return uniqueItems.slice(0, Math.max(1, limit));
  }
}

export default HybridRankingPipeline;
