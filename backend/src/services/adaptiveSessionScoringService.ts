import { ISong } from '../models/Song.js';
import { ISessionEvent } from '../models/ListeningSession.js';
import { TemporarySessionProfile } from './sessionProfileService.js';
import {
  AdaptiveSessionScoringWeights,
  getAdaptiveSessionWeights,
} from '../config/recommendationConfig.js';

export interface AdaptiveScoreBreakdown {
  adaptiveScore: number;
  contentSimilarityScore: number;
  sessionProfileAffinity: number;
  interactionFeedbackScore: number;
  positiveFeedbackBoost: number;
  negativeFeedbackPenalty: number;
}

export class AdaptiveSessionScoringService {
  /**
   * Calculates similarity between a candidate song and an interaction song (0.0 to 1.0).
   */
  static calculateSongSimilarity(candidateSong: any, eventSong: any): number {
    if (!candidateSong || !eventSong) return 0.5;

    let matchCount = 0;
    let totalFactors = 0;

    // 1. Artist Match
    const candArtistId =
      typeof candidateSong.artist === 'object' && candidateSong.artist && '_id' in candidateSong.artist
        ? String(candidateSong.artist._id)
        : String(candidateSong.artist || '');
    const eventArtistId =
      typeof eventSong.artist === 'object' && eventSong.artist && '_id' in eventSong.artist
        ? String(eventSong.artist._id)
        : String(eventSong.artist || '');

    if (candArtistId && eventArtistId) {
      totalFactors += 0.35;
      if (candArtistId === eventArtistId) {
        matchCount += 0.35;
      }
    }

    // 2. Genre Match
    const candGenre =
      typeof candidateSong.genre === 'object' && candidateSong.genre && 'name' in candidateSong.genre
        ? String(candidateSong.genre.name)
        : String(candidateSong.genre || '');
    const eventGenre =
      typeof eventSong.genre === 'object' && eventSong.genre && 'name' in eventSong.genre
        ? String(eventSong.genre.name)
        : String(eventSong.genre || '');

    if (candGenre && eventGenre) {
      totalFactors += 0.30;
      if (candGenre.toLowerCase() === eventGenre.toLowerCase()) {
        matchCount += 0.30;
      }
    }

    // 3. Mood Match
    const candMood = String(candidateSong.mood || '');
    const eventMood = String(eventSong.mood || '');
    if (candMood && eventMood) {
      totalFactors += 0.15;
      if (candMood.toLowerCase() === eventMood.toLowerCase()) {
        matchCount += 0.15;
      }
    }

    // 4. Audio Feature Alignment (Energy & BPM)
    if (candidateSong.audioFeatures && eventSong.audioFeatures) {
      totalFactors += 0.20;
      const energyDiff = Math.abs(
        (candidateSong.audioFeatures.energy || 0.5) - (eventSong.audioFeatures.energy || 0.5)
      );
      const bpmDiff = Math.abs(
        (candidateSong.audioFeatures.bpm || 110) - (eventSong.audioFeatures.bpm || 110)
      );
      const audioSim = (1.0 - Math.min(1, energyDiff)) * 0.5 + (1.0 - Math.min(1, bpmDiff / 50)) * 0.5;
      matchCount += audioSim * 0.20;
    }

    return totalFactors > 0 ? matchCount / totalFactors : 0.5;
  }

  /**
   * Calculates candidate affinity score (0.0 to 1.0) against temporary session profile.
   */
  static calculateSessionProfileAffinity(
    candidateSong: any,
    sessionProfile: TemporarySessionProfile
  ): number {
    if (!candidateSong || !sessionProfile) return 0.5;

    // 1. Genre Match Score (30% Weight)
    let genreScore = 0.3;
    const songGenre =
      typeof candidateSong.genre === 'object' && candidateSong.genre && 'name' in candidateSong.genre
        ? String(candidateSong.genre.name)
        : String(candidateSong.genre || '');

    const matchingGenreItem = sessionProfile.dominantGenres.find(
      (g) => g.genre.toLowerCase() === songGenre.toLowerCase()
    );
    if (matchingGenreItem) {
      genreScore = 0.5 + matchingGenreItem.score * 0.5;
    }

    // 2. Artist Match Score (25% Weight)
    let artistScore = 0.3;
    const songArtistId =
      typeof candidateSong.artist === 'object' && candidateSong.artist && '_id' in candidateSong.artist
        ? String(candidateSong.artist._id)
        : String(candidateSong.artist || '');

    const matchingArtistItem = sessionProfile.dominantArtists.find((a) => a.artistId === songArtistId);
    if (matchingArtistItem) {
      artistScore = 0.6 + matchingArtistItem.score * 0.4;
    }

    // 3. Mood Alignment (15% Weight)
    let moodScore = 0.4;
    const songMood = String(candidateSong.mood || 'Chill');
    if (sessionProfile.moodDistribution && sessionProfile.moodDistribution[songMood]) {
      moodScore = 0.5 + sessionProfile.moodDistribution[songMood] * 0.5;
    }

    // 4. Energy Alignment (15% Weight)
    let energyScore = 0.5;
    if (candidateSong.audioFeatures && typeof candidateSong.audioFeatures.energy === 'number') {
      const energyDiff = Math.abs(candidateSong.audioFeatures.energy - sessionProfile.averageEnergy);
      energyScore = 1.0 - Math.min(1, energyDiff);
    }

    // 5. Tempo Alignment (15% Weight)
    let tempoScore = 0.5;
    if (candidateSong.audioFeatures && typeof candidateSong.audioFeatures.bpm === 'number') {
      const bpmDiff = Math.abs(candidateSong.audioFeatures.bpm - sessionProfile.averageTempo);
      tempoScore = 1.0 - Math.min(1, bpmDiff / 50);
    }

    const affinity =
      genreScore * 0.30 +
      artistScore * 0.25 +
      moodScore * 0.15 +
      energyScore * 0.15 +
      tempoScore * 0.15;

    return Number(Math.max(0.0, Math.min(1.0, affinity)).toFixed(4));
  }

  /**
   * Calculates interaction feedback score:
   * - Boosts score for songs similar to recently liked or replayed tracks.
   * - Reduces score for songs similar to recently skipped tracks.
   * - Applies exponential recency decay to recent interaction events.
   */
  static calculateInteractionFeedbackScore(
    candidateSong: any,
    sessionEvents: ISessionEvent[],
    songMap: Map<string, any>,
    weights: AdaptiveSessionScoringWeights = getAdaptiveSessionWeights()
  ): { feedbackScore: number; positiveBoost: number; negativePenalty: number } {
    if (!sessionEvents || sessionEvents.length === 0) {
      return { feedbackScore: 0.5, positiveBoost: 0, negativePenalty: 0 };
    }

    let positiveImpact = 0;
    let negativeImpact = 0;
    let totalWeight = 0;

    const totalEvents = sessionEvents.length;

    sessionEvents.forEach((ev, idx) => {
      const eventSong = songMap.get(ev.song.toString());
      if (!eventSong) return;

      const distance = totalEvents - 1 - idx;
      const recencyWeight = Math.exp(-weights.recencyDecayLambda * distance);

      let actionMult = 0;
      if (ev.action === 'like') {
        actionMult = weights.likeInteractionMultiplier;
      } else if (ev.action === 'replay') {
        actionMult = weights.replayInteractionMultiplier;
      } else if (ev.action === 'complete') {
        actionMult = weights.completeInteractionMultiplier;
      } else if (ev.action === 'skip') {
        actionMult = weights.skipInteractionMultiplier; // negative
      } else if (ev.action === 'play' || ev.action === 'queue_add') {
        actionMult = 0.5;
      }

      const sim = this.calculateSongSimilarity(candidateSong, eventSong);
      const contribution = sim * actionMult * recencyWeight;

      if (actionMult > 0) {
        positiveImpact += contribution;
      } else if (actionMult < 0) {
        negativeImpact += Math.abs(contribution);
      }

      totalWeight += Math.abs(actionMult) * recencyWeight;
    });

    const netEffect = totalWeight > 0 ? (positiveImpact - negativeImpact) / totalWeight : 0;
    // Scale netEffect centered around baseline 0.5
    const feedbackScore = Number(Math.max(0.0, Math.min(1.0, 0.5 + netEffect * 0.5)).toFixed(4));
    const positiveBoost = Number(positiveImpact.toFixed(4));
    const negativePenalty = Number(negativeImpact.toFixed(4));

    return { feedbackScore, positiveBoost, negativePenalty };
  }

  /**
   * Computes final adaptive recommendation score fusing content similarity, session profile affinity, and interaction feedback.
   */
  static computeAdaptiveScore(params: {
    candidateSong: any;
    contentSimilarityScore: number;
    sessionProfile: TemporarySessionProfile;
    sessionEvents: ISessionEvent[];
    songMap: Map<string, any>;
    customWeights?: Partial<AdaptiveSessionScoringWeights>;
  }): AdaptiveScoreBreakdown {
    const {
      candidateSong,
      contentSimilarityScore,
      sessionProfile,
      sessionEvents,
      songMap,
      customWeights,
    } = params;

    const weights = { ...getAdaptiveSessionWeights(), ...(customWeights || {}) };

    const profileAffinity = this.calculateSessionProfileAffinity(candidateSong, sessionProfile);

    const { feedbackScore, positiveBoost, negativePenalty } =
      this.calculateInteractionFeedbackScore(candidateSong, sessionEvents, songMap, weights);

    const totalWeight =
      weights.contentSimilarityWeight +
      weights.sessionProfileAffinityWeight +
      weights.interactionFeedbackWeight;

    const rawScore =
      (contentSimilarityScore * weights.contentSimilarityWeight +
        profileAffinity * weights.sessionProfileAffinityWeight +
        feedbackScore * weights.interactionFeedbackWeight) /
      (totalWeight > 0 ? totalWeight : 1.0);

    const adaptiveScore = Number(Math.max(0.0, Math.min(1.0, rawScore)).toFixed(4));

    return {
      adaptiveScore,
      contentSimilarityScore,
      sessionProfileAffinity: profileAffinity,
      interactionFeedbackScore: feedbackScore,
      positiveFeedbackBoost: positiveBoost,
      negativeFeedbackPenalty: negativePenalty,
    };
  }
}
