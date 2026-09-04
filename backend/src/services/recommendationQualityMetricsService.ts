import { Types } from 'mongoose';
import { RecommendationEvaluation, IRecommendationEvaluation } from '../models/RecommendationEvaluation.js';
import { RecommendationInteraction } from '../models/RecommendationInteraction.js';
import {
  getRecommendationQualityConfig,
  RecommendationQualityConfig,
} from '../config/recommendationConfig.js';

export interface QualityMetricRate {
  rate: number;          // 0.0 to 1.0 (rounded to 4 decimal places)
  count: number;
  total: number;
  dataAvailable: boolean;
}

export interface CompletionQualityMetric {
  averageRate: number | null; // 0.0 to 1.0, or null if no completion data recorded
  sampleCount: number;
  dataAvailable: boolean;
}

export interface SignalQualityMetrics {
  source: string;
  total: number;
  playedCount: number;
  skippedCount: number;
  likedCount: number;
  savedCount: number;
  playRate: number;
  skipRate: number;
  likeRate: number;
  saveRate: number;
  averageCompletionRate: number | null;
  engagementScore: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface RecommendationQualityMetrics {
  totalRecommendations: number;
  totalInteractions: number;
  playRate: QualityMetricRate;
  skipRate: QualityMetricRate;
  likeRate: QualityMetricRate;
  saveRate: QualityMetricRate;
  completionRate: CompletionQualityMetric;
  engagementScore: number; // 0.0 to 1.0
  positiveFeedbackRate: number; // Combined positive rate (likes + saves + completions)
  negativeFeedbackRate: number; // Skip rate
  signalPerformance: Record<string, SignalQualityMetrics>;
  windowDays?: number;
  dataAvailable: boolean;
}

export class RecommendationQualityMetricsService {
  /**
   * Computes engagement score using configurable weights.
   */
  static computeEngagementScore(
    data: {
      playRate: number;
      skipRate: number;
      likeRate: number;
      saveRate?: number;
      completionRate?: number | null;
    },
    config: RecommendationQualityConfig = getRecommendationQualityConfig()
  ): number {
    const playRate = Math.max(0, Math.min(1, data.playRate || 0));
    const skipRate = Math.max(0, Math.min(1, data.skipRate || 0));
    const likeRate = Math.max(0, Math.min(1, data.likeRate || 0));
    const saveRate = Math.max(0, Math.min(1, data.saveRate || 0));

    let score =
      playRate * config.playRateWeight +
      likeRate * config.likeRateWeight +
      saveRate * config.saveRateWeight;

    if (data.completionRate !== null && data.completionRate !== undefined && !isNaN(data.completionRate)) {
      const comp = Math.max(0, Math.min(1, data.completionRate));
      score += comp * config.completionRateWeight;
    } else {
      // Re-allocate completion weight to play rate when completion is unavailable
      score += playRate * (config.completionRateWeight * 0.5);
    }

    // Deduct skip penalty
    score -= skipRate * config.skipPenaltyWeight;

    return Number(Math.max(0, Math.min(1, score)).toFixed(4));
  }

  /**
   * Calculates quality metrics in-memory from a collection of evaluation records.
   */
  static calculateMetricsFromEvaluations(
    evaluations: Array<Partial<IRecommendationEvaluation>>,
    options: { windowDays?: number; config?: RecommendationQualityConfig } = {}
  ): RecommendationQualityMetrics {
    const total = evaluations ? evaluations.length : 0;
    const config = options.config || getRecommendationQualityConfig();

    if (total === 0) {
      return {
        totalRecommendations: 0,
        totalInteractions: 0,
        playRate: { rate: 0, count: 0, total: 0, dataAvailable: false },
        skipRate: { rate: 0, count: 0, total: 0, dataAvailable: false },
        likeRate: { rate: 0, count: 0, total: 0, dataAvailable: false },
        saveRate: { rate: 0, count: 0, total: 0, dataAvailable: false },
        completionRate: { averageRate: null, sampleCount: 0, dataAvailable: false },
        engagementScore: 0,
        positiveFeedbackRate: 0,
        negativeFeedbackRate: 0,
        signalPerformance: {},
        windowDays: options.windowDays,
        dataAvailable: false,
      };
    }

    let playedCount = 0;
    let skippedCount = 0;
    let likedCount = 0;
    let savedCount = 0;
    let totalCompletion = 0;
    let completionSampleCount = 0;

    for (const item of evaluations) {
      if (item.played) playedCount++;
      if (item.skipped) skippedCount++;
      if (item.liked) likedCount++;
      if (item.saved) savedCount++;

      if (typeof item.completionRate === 'number' && !isNaN(item.completionRate)) {
        totalCompletion += Math.max(0, Math.min(1, item.completionRate));
        completionSampleCount++;
      }
    }

    const playRateVal = Number((playedCount / total).toFixed(4));
    const skipRateVal = Number((skippedCount / total).toFixed(4));
    const likeRateVal = Number((likedCount / total).toFixed(4));
    const saveRateVal = Number((savedCount / total).toFixed(4));

    const avgCompletion =
      completionSampleCount > 0
        ? Number((totalCompletion / completionSampleCount).toFixed(4))
        : null;

    const engagementScore = this.computeEngagementScore(
      {
        playRate: playRateVal,
        skipRate: skipRateVal,
        likeRate: likeRateVal,
        saveRate: saveRateVal,
        completionRate: avgCompletion,
      },
      config
    );

    const positiveCount = likedCount + savedCount + (avgCompletion !== null && avgCompletion >= 0.7 ? playedCount : 0);
    const positiveFeedbackRate = Number(Math.min(1, positiveCount / (total * 2 || 1)).toFixed(4));
    const negativeFeedbackRate = skipRateVal;

    const signalPerformance = this.calculateMetricsBySource(evaluations, config);

    return {
      totalRecommendations: total,
      totalInteractions: playedCount + skippedCount + likedCount + savedCount,
      playRate: {
        rate: playRateVal,
        count: playedCount,
        total,
        dataAvailable: true,
      },
      skipRate: {
        rate: skipRateVal,
        count: skippedCount,
        total,
        dataAvailable: true,
      },
      likeRate: {
        rate: likeRateVal,
        count: likedCount,
        total,
        dataAvailable: true,
      },
      saveRate: {
        rate: saveRateVal,
        count: savedCount,
        total,
        dataAvailable: true,
      },
      completionRate: {
        averageRate: avgCompletion,
        sampleCount: completionSampleCount,
        dataAvailable: completionSampleCount > 0,
      },
      engagementScore,
      positiveFeedbackRate,
      negativeFeedbackRate,
      signalPerformance,
      windowDays: options.windowDays,
      dataAvailable: true,
    };
  }

  /**
   * Groups evaluations by source/signals and computes metrics per signal.
   */
  static calculateMetricsBySource(
    evaluations: Array<Partial<IRecommendationEvaluation>>,
    config: RecommendationQualityConfig = getRecommendationQualityConfig()
  ): Record<string, SignalQualityMetrics> {
    const map = new Map<
      string,
      {
        total: number;
        played: number;
        skipped: number;
        liked: number;
        saved: number;
        completionTotal: number;
        completionCount: number;
      }
    >();

    for (const item of evaluations) {
      const sources: string[] = [];
      if (item.source) sources.push(item.source);
      if (Array.isArray(item.signals)) {
        for (const sig of item.signals) {
          if (sig && !sources.includes(sig)) {
            sources.push(sig);
          }
        }
      }
      if (sources.length === 0) {
        sources.push('unknown');
      }

      for (const src of sources) {
        let entry = map.get(src);
        if (!entry) {
          entry = {
            total: 0,
            played: 0,
            skipped: 0,
            liked: 0,
            saved: 0,
            completionTotal: 0,
            completionCount: 0,
          };
          map.set(src, entry);
        }

        entry.total++;
        if (item.played) entry.played++;
        if (item.skipped) entry.skipped++;
        if (item.liked) entry.liked++;
        if (item.saved) entry.saved++;

        if (typeof item.completionRate === 'number' && !isNaN(item.completionRate)) {
          entry.completionTotal += Math.max(0, Math.min(1, item.completionRate));
          entry.completionCount++;
        }
      }
    }

    const result: Record<string, SignalQualityMetrics> = {};
    for (const [src, data] of map.entries()) {
      const playRate = Number((data.played / data.total).toFixed(4));
      const skipRate = Number((data.skipped / data.total).toFixed(4));
      const likeRate = Number((data.liked / data.total).toFixed(4));
      const saveRate = Number((data.saved / data.total).toFixed(4));
      const avgComp =
        data.completionCount > 0
          ? Number((data.completionTotal / data.completionCount).toFixed(4))
          : null;

      const engagementScore = this.computeEngagementScore(
        {
          playRate,
          skipRate,
          likeRate,
          saveRate,
          completionRate: avgComp,
        },
        config
      );

      let confidence: 'high' | 'medium' | 'low' = 'low';
      if (data.total >= config.minSamplesForSignificance * 3) {
        confidence = 'high';
      } else if (data.total >= config.minSamplesForSignificance) {
        confidence = 'medium';
      }

      result[src] = {
        source: src,
        total: data.total,
        playedCount: data.played,
        skippedCount: data.skipped,
        likedCount: data.liked,
        savedCount: data.saved,
        playRate,
        skipRate,
        likeRate,
        saveRate,
        averageCompletionRate: avgComp,
        engagementScore,
        confidence,
      };
    }

    return result;
  }

  /**
   * Evaluates and splits recommendation signals into strongest and weakest.
   */
  static getStrongestAndWeakestSignals(
    signalPerformance: Record<string, SignalQualityMetrics>,
    minSamples = 2
  ): { strongest: SignalQualityMetrics[]; weakest: SignalQualityMetrics[] } {
    const list = Object.values(signalPerformance).filter((s) => s.total >= minSamples);

    if (list.length === 0) {
      return { strongest: [], weakest: [] };
    }

    // Sort descending by engagement score
    const sorted = [...list].sort((a, b) => b.engagementScore - a.engagementScore);

    const mid = Math.ceil(sorted.length / 2);
    const strongest = sorted.slice(0, mid);
    const weakest = sorted.slice(mid).reverse();

    return { strongest, weakest };
  }

  /**
   * Calculates recommendation quality metrics for a given user from database records.
   */
  static async calculateMetricsForUser(
    userId: string | Types.ObjectId,
    options: { windowDays?: number } = {}
  ): Promise<RecommendationQualityMetrics> {
    const uid = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    const since = options.windowDays
      ? new Date(Date.now() - options.windowDays * 24 * 60 * 60 * 1000)
      : undefined;

    // 1. First fetch evaluations from RecommendationEvaluation
    let evaluations: Array<Partial<IRecommendationEvaluation>> = [];
    try {
      evaluations = await RecommendationEvaluation.findByUser(uid, { since });
    } catch {
      evaluations = [];
    }

    // 2. If no direct evaluations exist, gracefully derive metrics from RecommendationInteraction
    if (evaluations.length === 0) {
      try {
        const query: any = { user: uid };
        if (since) {
          query.timestamp = { $gte: since };
        }
        const interactions = await RecommendationInteraction.find(query).exec();

        if (interactions && interactions.length > 0) {
          // Synthesize evaluation entries grouped by song
          const songMap = new Map<string, Partial<IRecommendationEvaluation>>();
          for (const inter of interactions) {
            const sid = inter.song?.toString();
            if (!sid) continue;
            let entry = songMap.get(sid);
            if (!entry) {
              entry = {
                userId: uid,
                songId: inter.song,
                source: inter.recommendationSource || 'hybrid',
                signals: [inter.recommendationSource || 'hybrid'],
                played: false,
                skipped: false,
                liked: false,
                saved: false,
                timestamp: inter.timestamp,
              };
              songMap.set(sid, entry);
            }

            if (inter.action === 'play') entry.played = true;
            if (inter.action === 'skip') entry.skipped = true;
            if (inter.action === 'like' || inter.action === 'thumbs_up') entry.liked = true;
          }
          evaluations = Array.from(songMap.values());
        }
      } catch {
        // Fall back to empty evaluations
      }
    }

    return this.calculateMetricsFromEvaluations(evaluations, {
      windowDays: options.windowDays,
    });
  }
}
