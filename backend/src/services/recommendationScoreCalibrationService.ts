import { Types } from 'mongoose';
import { HybridRankedResult } from './hybridRankingPipeline.js';
import { HybridCandidate } from './candidateGenerationService.js';
import { RecommendationEvaluation } from '../models/RecommendationEvaluation.js';
import { ListeningHistory } from '../models/ListeningHistory.js';
import { User } from '../models/User.js';
import {
  getRecommendationCalibrationConfig,
  RecommendationCalibrationConfig,
} from '../config/recommendationConfig.js';
import {
  RecommendationQualityMetricsService,
  SignalQualityMetrics,
} from './recommendationQualityMetricsService.js';

export interface UserFeedbackProfile {
  likedSongIds: Set<string>;
  savedSongIds: Set<string>;
  skippedSongIds: Map<string, number>; // songId -> skip count
  highCompletionSongIds: Set<string>;
  genrePositiveScores: Map<string, number>;
  genreSkipCounts: Map<string, number>;
  artistPositiveScores: Map<string, number>;
  artistSkipCounts: Map<string, number>;
  signalPerformance: Record<string, SignalQualityMetrics>;
}

export interface CalibrationItemResult {
  multiplier: number;
  adjustedScore: number;
  originalScore: number;
  reasons: string[];
}

export class RecommendationScoreCalibrationService {
  /**
   * Builds an in-memory profile of historical user feedback to calibrate recommendation scores.
   */
  static async buildUserFeedbackProfile(
    userId: string | Types.ObjectId
  ): Promise<UserFeedbackProfile> {
    const profile: UserFeedbackProfile = {
      likedSongIds: new Set<string>(),
      savedSongIds: new Set<string>(),
      skippedSongIds: new Map<string, number>(),
      highCompletionSongIds: new Set<string>(),
      genrePositiveScores: new Map<string, number>(),
      genreSkipCounts: new Map<string, number>(),
      artistPositiveScores: new Map<string, number>(),
      artistSkipCounts: new Map<string, number>(),
      signalPerformance: {},
    };

    if (!Types.ObjectId.isValid(userId)) {
      return profile;
    }

    const uid = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

    // 1. Fetch user's liked songs from User model
    try {
      const userDoc = await User.findById(uid).select('likedSongs').lean().exec();
      if (userDoc && Array.isArray((userDoc as any).likedSongs)) {
        for (const s of (userDoc as any).likedSongs) {
          if (s) profile.likedSongIds.add(s.toString());
        }
      }
    } catch {
      // Graceful fallback
    }

    // 2. Fetch evaluation records for user
    try {
      const evaluations = await RecommendationEvaluation.findByUser(uid, { limit: 200 });
      if (evaluations && evaluations.length > 0) {
        // Calculate signal performance from evaluations
        profile.signalPerformance =
          RecommendationQualityMetricsService.calculateMetricsBySource(evaluations);

        for (const ev of evaluations) {
          const sid = ev.songId ? ev.songId.toString() : '';
          if (!sid) continue;

          if (ev.liked) profile.likedSongIds.add(sid);
          if (ev.saved) profile.savedSongIds.add(sid);
          if (ev.skipped) {
            const count = profile.skippedSongIds.get(sid) || 0;
            profile.skippedSongIds.set(sid, count + 1);
          }
          if (typeof ev.completionRate === 'number' && ev.completionRate >= 0.75) {
            profile.highCompletionSongIds.add(sid);
          }
        }
      }
    } catch {
      // Graceful fallback
    }

    // 3. Fallback/enrich with recent listening history for skips and completions
    try {
      const recentHistory = await ListeningHistory.find({ user: uid })
        .sort({ playedAt: -1 })
        .limit(100)
        .populate({ path: 'song', select: 'genre artist' })
        .lean()
        .exec();

      for (const h of recentHistory) {
        const songDoc = (h as any).song;
        const sid = songDoc?._id ? songDoc._id.toString() : (h as any).song?.toString();
        if (!sid) continue;

        const genreId = songDoc?.genre?.toString();
        const artistId = songDoc?.artist?.toString();

        if (h.skipped) {
          const count = profile.skippedSongIds.get(sid) || 0;
          profile.skippedSongIds.set(sid, count + 1);

          if (genreId) {
            profile.genreSkipCounts.set(genreId, (profile.genreSkipCounts.get(genreId) || 0) + 1);
          }
          if (artistId) {
            profile.artistSkipCounts.set(artistId, (profile.artistSkipCounts.get(artistId) || 0) + 1);
          }
        } else if (h.completed || ((h as any).progressPercent && (h as any).progressPercent >= 70)) {
          profile.highCompletionSongIds.add(sid);
          if (genreId) {
            profile.genrePositiveScores.set(
              genreId,
              (profile.genrePositiveScores.get(genreId) || 0) + 1
            );
          }
          if (artistId) {
            profile.artistPositiveScores.set(
              artistId,
              (profile.artistPositiveScores.get(artistId) || 0) + 1
            );
          }
        }
      }
    } catch {
      // Graceful fallback
    }

    return profile;
  }

  /**
   * Computes the calibration multiplier and breakdown for an individual candidate or ranked song.
   */
  static computeCalibrationForItem(
    songDoc: any,
    sources: string[],
    originalScore: number,
    feedbackProfile: UserFeedbackProfile,
    config: RecommendationCalibrationConfig = getRecommendationCalibrationConfig()
  ): CalibrationItemResult {
    if (!config.enabled) {
      return {
        multiplier: 1.0,
        adjustedScore: originalScore,
        originalScore,
        reasons: ['calibration_disabled'],
      };
    }

    const songId = songDoc?._id ? songDoc._id.toString() : songDoc?.id ? String(songDoc.id) : '';
    const reasons: string[] = [];
    let multiplier = 1.0;

    // 1. Direct song feedback adjustments
    if (songId) {
      const skipCount = feedbackProfile.skippedSongIds.get(songId) || 0;
      if (skipCount >= 2) {
        multiplier *= config.repeatedSkipPenaltyFactor;
        reasons.push(`repeated_skip_penalty(count=${skipCount})`);
      } else if (skipCount === 1) {
        multiplier *= config.skipPenaltyFactor;
        reasons.push('single_skip_penalty');
      }

      if (feedbackProfile.savedSongIds.has(songId)) {
        multiplier *= config.savedBoostFactor;
        reasons.push('saved_to_playlist_boost');
      } else if (feedbackProfile.likedSongIds.has(songId)) {
        multiplier *= config.likedBoostFactor;
        reasons.push('liked_song_boost');
      }

      if (feedbackProfile.highCompletionSongIds.has(songId)) {
        multiplier *= config.highCompletionBoostFactor;
        reasons.push('high_completion_boost');
      }
    }

    // 2. Genre & Artist historical feedback signals
    const genreId = songDoc?.genre?._id
      ? songDoc.genre._id.toString()
      : songDoc?.genre
      ? String(songDoc.genre)
      : null;
    if (genreId) {
      const genreSkips = feedbackProfile.genreSkipCounts.get(genreId) || 0;
      const genrePos = feedbackProfile.genrePositiveScores.get(genreId) || 0;
      if (genreSkips >= 3 && genreSkips > genrePos * 2) {
        multiplier *= 0.90;
        reasons.push(`high_genre_skip_rate(genre=${genreId})`);
      } else if (genrePos >= 3 && genrePos > genreSkips * 2) {
        multiplier *= 1.08;
        reasons.push(`preferred_genre_affinity(genre=${genreId})`);
      }
    }

    const artistId = songDoc?.artist?._id
      ? songDoc.artist._id.toString()
      : songDoc?.artist
      ? String(songDoc.artist)
      : null;
    if (artistId) {
      const artistSkips = feedbackProfile.artistSkipCounts.get(artistId) || 0;
      const artistPos = feedbackProfile.artistPositiveScores.get(artistId) || 0;
      if (artistSkips >= 3 && artistSkips > artistPos * 2) {
        multiplier *= 0.88;
        reasons.push(`high_artist_skip_rate(artist=${artistId})`);
      } else if (artistPos >= 3 && artistPos > artistSkips * 2) {
        multiplier *= 1.10;
        reasons.push(`preferred_artist_affinity(artist=${artistId})`);
      }
    }

    // 3. Recommendation signal source historical performance
    if (sources && sources.length > 0 && Object.keys(feedbackProfile.signalPerformance).length > 0) {
      let sourceAdjustSum = 0;
      let matchingSources = 0;

      for (const src of sources) {
        const perf = feedbackProfile.signalPerformance[src];
        if (perf && perf.total >= 3) {
          matchingSources++;
          // Engagement score centered around 0.5: >0.5 boosts, <0.5 penalizes
          const delta = perf.engagementScore - 0.5;
          sourceAdjustSum += delta * config.sourceWeightAdjustment;
        }
      }

      if (matchingSources > 0) {
        const avgAdjust = sourceAdjustSum / matchingSources;
        multiplier *= 1 + avgAdjust;
        reasons.push(`source_performance_adjustment(sources=${sources.join(',')},delta=${avgAdjust.toFixed(3)})`);
      }
    }

    // 4. Clamping bounds
    multiplier = Math.max(
      config.minCalibrationMultiplier,
      Math.min(config.maxCalibrationMultiplier, multiplier)
    );
    multiplier = Number(multiplier.toFixed(4));

    const adjustedScore = Number(
      Math.max(0, Math.min(1, originalScore * multiplier)).toFixed(4)
    );

    return {
      multiplier,
      adjustedScore,
      originalScore,
      reasons,
    };
  }

  /**
   * Calibrates candidate pool scores before ranking.
   */
  static calibrateCandidates(
    candidates: HybridCandidate[],
    feedbackProfile: UserFeedbackProfile,
    config: RecommendationCalibrationConfig = getRecommendationCalibrationConfig()
  ): HybridCandidate[] {
    if (!config.enabled || !candidates || candidates.length === 0) {
      return candidates;
    }

    return candidates.map((cand) => {
      const baseScore = cand.userTasteAffinityScore || 0.5;
      const { multiplier } = this.computeCalibrationForItem(
        cand.songDoc,
        cand.sources || [],
        baseScore,
        feedbackProfile,
        config
      );

      return {
        ...cand,
        userTasteAffinityScore: Number(
          Math.max(0, Math.min(1, cand.userTasteAffinityScore * multiplier)).toFixed(4)
        ),
      };
    });
  }

  /**
   * Calibrates a ranked recommendation list, applying quality adjustments and re-ranking.
   */
  static calibrateRankedResults(
    results: HybridRankedResult[],
    feedbackProfile: UserFeedbackProfile,
    config: RecommendationCalibrationConfig = getRecommendationCalibrationConfig()
  ): HybridRankedResult[] {
    if (!config.enabled || !results || results.length === 0) {
      return results;
    }

    const calibratedList: HybridRankedResult[] = results.map((item) => {
      const baseScore = item.hybridScore;
      const { multiplier, adjustedScore, reasons } = this.computeCalibrationForItem(
        item.song,
        item.sources || [],
        baseScore,
        feedbackProfile,
        config
      );

      return {
        ...item,
        originalScore: item.originalScore ?? baseScore,
        hybridScore: adjustedScore,
        finalScore: adjustedScore,
        componentScores: {
          ...item.componentScores,
          calibrationMultiplier: multiplier,
          calibrationScore: adjustedScore,
        },
        metadata: {
          ...(item.metadata || {}),
          calibration: {
            multiplier,
            appliedReasons: reasons,
          },
        },
      };
    });

    // Re-rank descending by newly calibrated hybridScore
    calibratedList.sort((a, b) => b.hybridScore - a.hybridScore);

    return calibratedList;
  }
}
