import { HybridRankedResult } from './hybridRankingPipeline.js';

export interface SignalContribution {
  signal: string;
  score: number;
  contributionPercentage: number;
}

export interface ItemRecommendationAnalytics {
  songId: string;
  songTitle?: string;
  artistName?: string;
  baseScore: number;
  finalRankingScore: number;
  majorContributingSignals: SignalContribution[];
  temporalPreferenceContribution: {
    score: number;
    influence: number;
    effectiveContribution: number;
    shortTermScore?: number;
    mediumTermScore?: number;
    longTermScore?: number;
    tasteStability?: number;
  } | null;
  sessionContribution: {
    score: number;
    influence: number;
    effectiveContribution: number;
    sessionId?: string;
  } | null;
  contextContribution: {
    score: number;
    influence: number;
    effectiveContribution: number;
    situation?: string;
  } | null;
  feedbackContribution: {
    calibrationMultiplier: number;
    appliedReasons: string[];
    isBoosted: boolean;
    isPenalized: boolean;
  } | null;
  componentScoresSnapshot: Record<string, number>;
}

export interface RecommendationAnalyticsSummary {
  userId: string;
  totalRecommendations: number;
  averageScore: number;
  dominantSignals: string[];
  analyticsPerSong: ItemRecommendationAnalytics[];
  generatedAt: Date;
}

export class RecommendationAnalyticsService {
  /**
   * Generates developer-friendly diagnostic analytics for an individual ranked recommendation item.
   */
  static generateItemAnalytics(item: HybridRankedResult): ItemRecommendationAnalytics {
    const song = item.song || {};
    const songId = song._id ? song._id.toString() : song.id ? String(song.id) : 'unknown';
    const songTitle = song.title || song.name;
    const artistName =
      typeof song.artist === 'object' && song.artist?.name
        ? song.artist.name
        : typeof song.artist === 'string'
        ? song.artist
        : undefined;

    const comp = item.componentScores || ({} as any);
    const meta = item.metadata || {};

    // 1. Identify all active signal scores
    const signalEntries: { signal: string; score: number }[] = [];
    if (typeof comp.contentScore === 'number') signalEntries.push({ signal: 'content', score: comp.contentScore });
    if (typeof comp.collaborativeScore === 'number') signalEntries.push({ signal: 'collaborative', score: comp.collaborativeScore });
    if (typeof comp.userTasteAffinityScore === 'number') signalEntries.push({ signal: 'user_taste_affinity', score: comp.userTasteAffinityScore });
    if (typeof comp.popularityScore === 'number') signalEntries.push({ signal: 'popularity', score: comp.popularityScore });
    if (typeof comp.recencyScore === 'number') signalEntries.push({ signal: 'recency', score: comp.recencyScore });
    if (typeof comp.contextScore === 'number') signalEntries.push({ signal: 'context', score: comp.contextScore });
    if (typeof comp.sessionScore === 'number') signalEntries.push({ signal: 'session', score: comp.sessionScore });
    if (typeof comp.temporalTasteScore === 'number') signalEntries.push({ signal: 'temporal_taste', score: comp.temporalTasteScore });

    const totalScoreSum = signalEntries.reduce((acc, curr) => acc + (curr.score || 0), 0) || 1;

    // Major contributing signals sorted descending by percentage
    const majorContributingSignals: SignalContribution[] = signalEntries
      .map((entry) => ({
        signal: entry.signal,
        score: Number(entry.score.toFixed(4)),
        contributionPercentage: Number(((entry.score / totalScoreSum) * 100).toFixed(2)),
      }))
      .sort((a, b) => b.score - a.score);

    // 2. Temporal Preference Contribution
    let temporalPreferenceContribution: ItemRecommendationAnalytics['temporalPreferenceContribution'] = null;
    if (typeof comp.temporalTasteScore === 'number' || meta.temporalInfluence !== undefined) {
      const influence = meta.temporalInfluence ?? 0.25;
      const score = comp.temporalTasteScore ?? 0;
      temporalPreferenceContribution = {
        score: Number(score.toFixed(4)),
        influence: Number(influence.toFixed(4)),
        effectiveContribution: Number((score * influence).toFixed(4)),
        shortTermScore: comp.shortTermScore,
        mediumTermScore: comp.mediumTermScore,
        longTermScore: comp.longTermScore,
        tasteStability: meta.tasteStabilityScore,
      };
    }

    // 3. Session Contribution
    let sessionContribution: ItemRecommendationAnalytics['sessionContribution'] = null;
    if (typeof comp.sessionScore === 'number' || meta.sessionInfluence !== undefined) {
      const influence = meta.sessionInfluence ?? 0.20;
      const score = comp.sessionScore ?? 0;
      sessionContribution = {
        score: Number(score.toFixed(4)),
        influence: Number(influence.toFixed(4)),
        effectiveContribution: Number((score * influence).toFixed(4)),
        sessionId: meta.sessionId,
      };
    }

    // 4. Context Contribution
    let contextContribution: ItemRecommendationAnalytics['contextContribution'] = null;
    if (typeof comp.contextScore === 'number' || meta.contextInfluence !== undefined) {
      const influence = meta.contextInfluence ?? 0.20;
      const score = comp.contextScore ?? 0;
      contextContribution = {
        score: Number(score.toFixed(4)),
        influence: Number(influence.toFixed(4)),
        effectiveContribution: Number((score * influence).toFixed(4)),
        situation: meta.contextSituation,
      };
    }

    // 5. Feedback / Calibration Contribution
    let feedbackContribution: ItemRecommendationAnalytics['feedbackContribution'] = null;
    const calibrationMeta = meta.calibration;
    const multiplier = comp.calibrationMultiplier ?? (calibrationMeta ? calibrationMeta.multiplier : 1.0);
    if (multiplier !== 1.0 || calibrationMeta) {
      feedbackContribution = {
        calibrationMultiplier: Number(multiplier.toFixed(4)),
        appliedReasons: calibrationMeta?.appliedReasons || [],
        isBoosted: multiplier > 1.0,
        isPenalized: multiplier < 1.0,
      };
    }

    const componentScoresSnapshot: Record<string, number> = {};
    for (const [k, v] of Object.entries(comp)) {
      if (typeof v === 'number') {
        componentScoresSnapshot[k] = Number(v.toFixed(4));
      }
    }

    return {
      songId,
      songTitle,
      artistName,
      baseScore: Number((item.originalScore ?? item.hybridScore).toFixed(4)),
      finalRankingScore: Number((item.finalScore ?? item.hybridScore).toFixed(4)),
      majorContributingSignals,
      temporalPreferenceContribution,
      sessionContribution,
      contextContribution,
      feedbackContribution,
      componentScoresSnapshot,
    };
  }

  /**
   * Aggregates item-level analytics into a comprehensive recommendation summary.
   */
  static generateAnalytics(
    userId: string,
    recommendations: HybridRankedResult[]
  ): RecommendationAnalyticsSummary {
    const list = recommendations || [];
    const total = list.length;

    const analyticsPerSong = list.map((item) => this.generateItemAnalytics(item));

    const avgScore =
      total > 0
        ? Number(
            (
              list.reduce((sum, item) => sum + (item.finalScore ?? item.hybridScore ?? 0), 0) /
              total
            ).toFixed(4)
          )
        : 0;

    // Determine dominant signals across the set
    const signalFrequencies: Record<string, number> = {};
    for (const item of analyticsPerSong) {
      const topSignal = item.majorContributingSignals[0]?.signal;
      if (topSignal) {
        signalFrequencies[topSignal] = (signalFrequencies[topSignal] || 0) + 1;
      }
    }

    const dominantSignals = Object.entries(signalFrequencies)
      .sort((a, b) => b[1] - a[1])
      .map(([sig]) => sig);

    return {
      userId,
      totalRecommendations: total,
      averageScore: avgScore,
      dominantSignals,
      analyticsPerSong,
      generatedAt: new Date(),
    };
  }
}
