import assert from 'node:assert';
import { Types } from 'mongoose';
import { RecommendationEvaluation } from '../models/RecommendationEvaluation.js';
import {
  RecommendationQualityMetricsService,
} from '../services/recommendationQualityMetricsService.js';
import {
  RecommendationScoreCalibrationService,
  UserFeedbackProfile,
} from '../services/recommendationScoreCalibrationService.js';
import {
  RecommendationFeedbackLearningService,
} from '../services/recommendationFeedbackLearningService.js';
import {
  RecommendationAnalyticsService,
} from '../services/recommendationAnalyticsService.js';
import { HybridRankedResult } from '../services/hybridRankingPipeline.js';
import {
  getRecommendationQualityConfig,
  updateRecommendationQualityConfig,
  resetRecommendationQualityConfig,
  getRecommendationCalibrationConfig,
  updateRecommendationCalibrationConfig,
  resetRecommendationCalibrationConfig,
} from '../config/recommendationConfig.js';

export async function runRecommendationIntelligenceTests() {
  console.log('[Recommendation Intelligence & Evaluation Test Suite] Starting tests...');

  const sampleUserId = new Types.ObjectId().toString();
  const songId1 = new Types.ObjectId().toString();
  const songId2 = new Types.ObjectId().toString();
  const songId3 = new Types.ObjectId().toString();

  try {
    // =========================================================================
    // 1. RECOMMENDATION EVALUATION MODEL & SCORE COMPUTATION
    // =========================================================================
    {
      console.log('\n--- 1. Recommendation Evaluation Model & Score Computation ---');

      // 1a. Full positive engagement (played + liked + saved + 100% completion)
      const fullScore = RecommendationEvaluation.computeScore({
        played: true,
        liked: true,
        saved: true,
        completionRate: 1.0,
      });
      assert.strictEqual(fullScore, 1.0, 'Full positive engagement score should be 1.0');

      // 1b. Skipped song (negative signal)
      const skippedScore = RecommendationEvaluation.computeScore({
        played: false,
        skipped: true,
        completionRate: 0.1,
      });
      assert.ok(skippedScore <= 0.05, `Skipped song score should be near 0, got ${skippedScore}`);

      // 1c. Moderate completion played without like/save
      const playOnlyScore = RecommendationEvaluation.computeScore({
        played: true,
        completionRate: 0.5,
      });
      assert.ok(playOnlyScore > 0.2 && playOnlyScore < 0.6, `Play-only score expected ~0.325, got ${playOnlyScore}`);

      // 1d. Missing optional completionRate defaults gracefully
      const missingCompScore = RecommendationEvaluation.computeScore({
        played: true,
        liked: false,
        saved: false,
      });
      assert.ok(missingCompScore > 0.2, 'Score with missing completion rate should compute without NaN');
      assert.ok(!isNaN(missingCompScore), 'Score must not be NaN');

      console.log('✓ Model score computation tests passed');
    }

    // =========================================================================
    // 2. RECOMMENDATION QUALITY METRICS SERVICE
    // =========================================================================
    {
      console.log('\n--- 2. Recommendation Quality Metrics Service ---');

      const mockEvaluations = [
        {
          userId: new Types.ObjectId(sampleUserId),
          songId: new Types.ObjectId(songId1),
          source: 'hybrid',
          signals: ['hybrid', 'temporal'],
          played: true,
          skipped: false,
          liked: true,
          saved: false,
          completionRate: 0.95,
        },
        {
          userId: new Types.ObjectId(sampleUserId),
          songId: new Types.ObjectId(songId2),
          source: 'hybrid',
          signals: ['hybrid', 'collaborative'],
          played: false,
          skipped: true,
          liked: false,
          saved: false,
          completionRate: 0.05,
        },
        {
          userId: new Types.ObjectId(sampleUserId),
          songId: new Types.ObjectId(songId3),
          source: 'temporal',
          signals: ['temporal', 'content'],
          played: true,
          skipped: false,
          liked: false,
          saved: true,
          completionRate: 0.80,
        },
        {
          userId: new Types.ObjectId(sampleUserId),
          songId: new Types.ObjectId(),
          source: 'collaborative',
          signals: ['collaborative'],
          played: false,
          skipped: true,
          liked: false,
          saved: false,
          completionRate: 0.10,
        },
      ];

      const metrics = RecommendationQualityMetricsService.calculateMetricsFromEvaluations(mockEvaluations, {
        windowDays: 30,
      });

      assert.strictEqual(metrics.totalRecommendations, 4, 'Total recommendations should be 4');
      assert.strictEqual(metrics.playRate.count, 2, 'Played count should be 2');
      assert.strictEqual(metrics.playRate.rate, 0.5, 'Play rate should be 0.5');
      assert.strictEqual(metrics.skipRate.count, 2, 'Skipped count should be 2');
      assert.strictEqual(metrics.skipRate.rate, 0.5, 'Skip rate should be 0.5');
      assert.strictEqual(metrics.likeRate.count, 1, 'Liked count should be 1');
      assert.strictEqual(metrics.likeRate.rate, 0.25, 'Like rate should be 0.25');
      assert.strictEqual(metrics.saveRate.count, 1, 'Saved count should be 1');
      assert.strictEqual(metrics.saveRate.rate, 0.25, 'Save rate should be 0.25');
      assert.strictEqual(metrics.completionRate.sampleCount, 4, 'Sample count should be 4');
      assert.ok(metrics.completionRate.averageRate !== null, 'Average completion rate must be present');
      assert.ok(metrics.engagementScore > 0, 'Engagement score must be positive');
      assert.strictEqual(metrics.dataAvailable, true, 'Data should be marked available');

      // Test Signal Breakdown
      const temporalSignal = metrics.signalPerformance['temporal'];
      assert.ok(temporalSignal, 'Temporal signal performance should be tracked');
      assert.strictEqual(temporalSignal.total, 2, 'Temporal total should be 2');
      assert.strictEqual(temporalSignal.playedCount, 2, 'Temporal played count should be 2');
      assert.strictEqual(temporalSignal.skipRate, 0, 'Temporal skip rate should be 0');

      const collabSignal = metrics.signalPerformance['collaborative'];
      assert.ok(collabSignal, 'Collaborative signal performance should be tracked');
      assert.strictEqual(collabSignal.skipRate, 1.0, 'Collaborative skip rate should be 1.0');

      // Strongest vs Weakest Signals
      const { strongest, weakest } = RecommendationQualityMetricsService.getStrongestAndWeakestSignals(
        metrics.signalPerformance,
        2
      );
      assert.ok(strongest.length > 0, 'Should identify strongest signals');
      assert.strictEqual(strongest[0].source, 'temporal', 'Temporal should be strongest performing signal');

      console.log('✓ Quality metrics calculation and signal splitting passed');
    }

    // =========================================================================
    // 3. EDGE CASES: EMPTY AND INSUFFICIENT HISTORY
    // =========================================================================
    {
      console.log('\n--- 3. Edge Cases: Empty and Insufficient History ---');

      // 3a. User with no recommendations or interactions
      const emptyMetrics = RecommendationQualityMetricsService.calculateMetricsFromEvaluations([]);
      assert.strictEqual(emptyMetrics.totalRecommendations, 0, 'Total should be 0');
      assert.strictEqual(emptyMetrics.engagementScore, 0, 'Engagement score should be 0');
      assert.strictEqual(emptyMetrics.dataAvailable, false, 'dataAvailable should be false');
      assert.strictEqual(emptyMetrics.playRate.rate, 0, 'Play rate should be 0');
      assert.strictEqual(emptyMetrics.completionRate.averageRate, null, 'Average completion should be null');

      // 3b. Missing optional interaction fields (evaluations with no completionRate)
      const partialEvaluations = [
        {
          userId: new Types.ObjectId(sampleUserId),
          songId: new Types.ObjectId(songId1),
          source: 'hybrid',
          played: true,
          skipped: false,
          liked: false,
          saved: false,
        },
      ];
      const partialMetrics = RecommendationQualityMetricsService.calculateMetricsFromEvaluations(partialEvaluations);
      assert.strictEqual(partialMetrics.totalRecommendations, 1);
      assert.strictEqual(partialMetrics.completionRate.averageRate, null, 'Completion rate should be gracefully null');
      assert.strictEqual(partialMetrics.completionRate.dataAvailable, false);
      assert.ok(partialMetrics.engagementScore > 0, 'Engagement score should still be computed');

      // 3c. Strongest/weakest with insufficient sample threshold
      const { strongest: noStrongest } = RecommendationQualityMetricsService.getStrongestAndWeakestSignals(
        partialMetrics.signalPerformance,
        5 // requires 5 samples
      );
      assert.strictEqual(noStrongest.length, 0, 'Should return empty array when samples below threshold');

      console.log('✓ Edge cases with empty and partial history handled safely');
    }

    // =========================================================================
    // 4. RECOMMENDATION SCORE CALIBRATION
    // =========================================================================
    {
      console.log('\n--- 4. Recommendation Score Calibration ---');

      const config = getRecommendationCalibrationConfig();
      const feedbackProfile: UserFeedbackProfile = {
        likedSongIds: new Set([songId1]),
        savedSongIds: new Set([songId2]),
        skippedSongIds: new Map([
          [songId3, 2], // 2 skips -> repeated skip penalty
          ['song_single_skip', 1],
        ]),
        highCompletionSongIds: new Set([songId1]),
        genrePositiveScores: new Map([['genre_rock', 4]]),
        genreSkipCounts: new Map([['genre_metal', 5]]),
        artistPositiveScores: new Map([['artist_queen', 4]]),
        artistSkipCounts: new Map([['artist_unknown', 5]]),
        signalPerformance: {
          temporal: {
            source: 'temporal',
            total: 5,
            playedCount: 5,
            skippedCount: 0,
            likedCount: 3,
            savedCount: 2,
            playRate: 1.0,
            skipRate: 0.0,
            likeRate: 0.6,
            saveRate: 0.4,
            averageCompletionRate: 0.9,
            engagementScore: 0.85, // High engagement > 0.5
            confidence: 'high',
          },
        },
      };

      // 4a. Liked song boost
      const likedSong = { _id: songId1, genre: 'genre_pop' };
      const likedRes = RecommendationScoreCalibrationService.computeCalibrationForItem(
        likedSong,
        ['hybrid'],
        0.50,
        feedbackProfile,
        config
      );
      assert.ok(likedRes.multiplier > 1.0, `Liked song multiplier should exceed 1.0, got ${likedRes.multiplier}`);
      assert.ok(likedRes.adjustedScore > 0.50, `Liked song adjusted score should exceed base, got ${likedRes.adjustedScore}`);
      assert.ok(likedRes.reasons.some((r) => r.includes('liked_song_boost')));

      // 4b. Repeated skip penalty
      const repeatedSkipSong = { _id: songId3, genre: 'genre_pop' };
      const skipRes = RecommendationScoreCalibrationService.computeCalibrationForItem(
        repeatedSkipSong,
        ['hybrid'],
        0.50,
        feedbackProfile,
        config
      );
      assert.ok(skipRes.multiplier < 1.0, `Repeated skip multiplier should be < 1.0, got ${skipRes.multiplier}`);
      assert.ok(skipRes.adjustedScore < 0.50, `Repeated skip adjusted score should be < base, got ${skipRes.adjustedScore}`);
      assert.ok(skipRes.reasons.some((r) => r.includes('repeated_skip_penalty')));

      // 4c. Single skip penalty should be milder than repeated skip penalty
      const singleSkipSong = { _id: 'song_single_skip', genre: 'genre_pop' };
      const singleSkipRes = RecommendationScoreCalibrationService.computeCalibrationForItem(
        singleSkipSong,
        ['hybrid'],
        0.50,
        feedbackProfile,
        config
      );
      assert.ok(singleSkipRes.multiplier > skipRes.multiplier, 'Single skip penalty should be milder than repeated skip');

      // 4d. Clamping bounds under extreme multipliers
      const clampedMaxRes = RecommendationScoreCalibrationService.computeCalibrationForItem(
        { _id: songId1, genre: 'genre_rock', artist: 'artist_queen' },
        ['temporal'],
        0.90,
        feedbackProfile,
        config
      );
      assert.ok(clampedMaxRes.multiplier <= config.maxCalibrationMultiplier, 'Multiplier must not exceed max clamp');
      assert.ok(clampedMaxRes.adjustedScore <= 1.0, 'Adjusted score must not exceed 1.0');

      // 4e. Calibrating and re-ranking a list
      const rankedResults: HybridRankedResult[] = [
        {
          song: { _id: songId3, title: 'Frequently Skipped Track' },
          hybridScore: 0.75, // Higher initial score
          sources: ['hybrid'],
          componentScores: {
            contentScore: 0.8,
            collaborativeScore: 0.7,
            userTasteAffinityScore: 0.75,
            popularityScore: 0.5,
            recencyScore: 0.5,
          },
        },
        {
          song: { _id: songId1, title: 'Beloved Track' },
          hybridScore: 0.70, // Slightly lower initial score
          sources: ['temporal'],
          componentScores: {
            contentScore: 0.7,
            collaborativeScore: 0.7,
            userTasteAffinityScore: 0.70,
            popularityScore: 0.5,
            recencyScore: 0.5,
          },
        },
      ];

      const calibrated = RecommendationScoreCalibrationService.calibrateRankedResults(
        rankedResults,
        feedbackProfile,
        config
      );

      // Beloved Track should be boosted above Frequently Skipped Track and ranked #1
      assert.strictEqual(calibrated[0].song._id, songId1, 'Beloved track should be calibrated to rank #1');
      assert.ok(calibrated[0].hybridScore > calibrated[1].hybridScore, 'Rank #1 score must exceed Rank #2 score');
      assert.ok(calibrated[0].componentScores.calibrationMultiplier! > 1.0);
      assert.ok(calibrated[1].componentScores.calibrationMultiplier! < 1.0);

      console.log('✓ Score calibration and re-ranking tests passed');
    }

    // =========================================================================
    // 5. RECOMMENDATION FEEDBACK LEARNING LOOP
    // =========================================================================
    {
      console.log('\n--- 5. Recommendation Feedback Learning Loop ---');

      const feedbackProfile: UserFeedbackProfile = {
        likedSongIds: new Set(),
        savedSongIds: new Set(),
        skippedSongIds: new Map(),
        highCompletionSongIds: new Set(),
        genrePositiveScores: new Map(),
        genreSkipCounts: new Map(),
        artistPositiveScores: new Map(),
        artistSkipCounts: new Map(),
        signalPerformance: {},
      };

      // 5a. Positive interaction analysis
      const positiveImpact = RecommendationFeedbackLearningService.analyzeFeedbackImpact(
        {
          userId: sampleUserId,
          songId: songId1,
          action: 'like',
        },
        feedbackProfile
      );
      assert.strictEqual(positiveImpact.impactType, 'positive', 'Like action must produce positive impact');
      assert.strictEqual(positiveImpact.recommendationAction, 'strengthen_signals', 'Should strengthen signals');
      assert.ok(positiveImpact.calibrationDelta > 0, 'Calibration delta must be positive');

      // 5b. Negative skip analysis
      const negativeImpact = RecommendationFeedbackLearningService.analyzeFeedbackImpact(
        {
          userId: sampleUserId,
          songId: songId2,
          action: 'skip',
        },
        feedbackProfile
      );
      assert.strictEqual(negativeImpact.impactType, 'negative', 'Skip action must produce negative impact');
      assert.strictEqual(negativeImpact.recommendationAction, 'suppress_signals', 'Should suppress signals');
      assert.ok(negativeImpact.calibrationDelta < 0, 'Calibration delta must be negative');

      console.log('✓ Feedback learning loop impact analysis tests passed');
    }

    // =========================================================================
    // 6. RECOMMENDATION ANALYTICS & DEBUG INFORMATION
    // =========================================================================
    {
      console.log('\n--- 6. Recommendation Analytics & Debug Information ---');

      const rankedItem: HybridRankedResult = {
        song: {
          _id: songId1,
          title: 'Midnight City',
          artist: { name: 'M83' },
        },
        hybridScore: 0.88,
        originalScore: 0.80,
        finalScore: 0.88,
        sources: ['content', 'temporal'],
        componentScores: {
          contentScore: 0.85,
          collaborativeScore: 0.70,
          userTasteAffinityScore: 0.90,
          popularityScore: 0.60,
          recencyScore: 0.50,
          contextScore: 0.75,
          sessionScore: 0.80,
          temporalTasteScore: 0.92,
          calibrationMultiplier: 1.10,
          calibrationScore: 0.88,
        },
        metadata: {
          temporalInfluence: 0.30,
          sessionInfluence: 0.20,
          contextSituation: 'workout',
          calibration: {
            multiplier: 1.10,
            appliedReasons: ['liked_song_boost', 'preferred_artist_affinity'],
          },
        },
      };

      // 6a. Single Item Analytics Breakdown
      const itemAnalytics = RecommendationAnalyticsService.generateItemAnalytics(rankedItem);

      assert.strictEqual(itemAnalytics.songId, songId1);
      assert.strictEqual(itemAnalytics.songTitle, 'Midnight City');
      assert.strictEqual(itemAnalytics.artistName, 'M83');
      assert.strictEqual(itemAnalytics.baseScore, 0.80);
      assert.strictEqual(itemAnalytics.finalRankingScore, 0.88);

      // Check major contributing signals
      assert.ok(itemAnalytics.majorContributingSignals.length > 0, 'Must contain contributing signals');
      const topSignal = itemAnalytics.majorContributingSignals[0];
      assert.ok(topSignal.signal, 'Top signal must have a name');
      assert.ok(topSignal.contributionPercentage > 0, 'Contribution percentage must be positive');

      // Check temporal contribution
      assert.ok(itemAnalytics.temporalPreferenceContribution !== null, 'Temporal contribution must be present');
      assert.strictEqual(itemAnalytics.temporalPreferenceContribution.score, 0.92);
      assert.strictEqual(itemAnalytics.temporalPreferenceContribution.influence, 0.30);

      // Check session contribution
      assert.ok(itemAnalytics.sessionContribution !== null, 'Session contribution must be present');
      assert.strictEqual(itemAnalytics.sessionContribution.score, 0.80);

      // Check context contribution
      assert.ok(itemAnalytics.contextContribution !== null, 'Context contribution must be present');
      assert.strictEqual(itemAnalytics.contextContribution.situation, 'workout');

      // Check feedback contribution
      assert.ok(itemAnalytics.feedbackContribution !== null, 'Feedback contribution must be present');
      assert.strictEqual(itemAnalytics.feedbackContribution.isBoosted, true);
      assert.strictEqual(itemAnalytics.feedbackContribution.isPenalized, false);
      assert.strictEqual(itemAnalytics.feedbackContribution.calibrationMultiplier, 1.10);

      // 6b. Set-Level Aggregated Analytics
      const summary = RecommendationAnalyticsService.generateAnalytics(sampleUserId, [rankedItem]);
      assert.strictEqual(summary.userId, sampleUserId);
      assert.strictEqual(summary.totalRecommendations, 1);
      assert.strictEqual(summary.averageScore, 0.88);
      assert.ok(summary.dominantSignals.length > 0, 'Dominant signals must be identified');
      assert.strictEqual(summary.analyticsPerSong.length, 1);

      console.log('✓ Recommendation analytics & debug information tests passed');
    }

    // =========================================================================
    // 7. CONFIGURATION RESILIENCE & MODULARITY
    // =========================================================================
    {
      console.log('\n--- 7. Configuration Modularity & Dynamic Tuning ---');

      // Update quality weights
      updateRecommendationQualityConfig({ playRateWeight: 0.50, skipPenaltyWeight: 0.40 });
      const updatedQualityConfig = getRecommendationQualityConfig();
      assert.strictEqual(updatedQualityConfig.playRateWeight, 0.50);
      assert.strictEqual(updatedQualityConfig.skipPenaltyWeight, 0.40);
      resetRecommendationQualityConfig();
      assert.strictEqual(getRecommendationQualityConfig().playRateWeight, 0.30);

      // Update calibration config
      updateRecommendationCalibrationConfig({ likedBoostFactor: 1.30, enabled: false });
      const updatedCalibConfig = getRecommendationCalibrationConfig();
      assert.strictEqual(updatedCalibConfig.likedBoostFactor, 1.30);
      assert.strictEqual(updatedCalibConfig.enabled, false);

      // When calibration disabled, multiplier is always 1.0
      const disabledRes = RecommendationScoreCalibrationService.computeCalibrationForItem(
        { _id: songId1 },
        ['hybrid'],
        0.60,
        { likedSongIds: new Set([songId1]) } as any,
        updatedCalibConfig
      );
      assert.strictEqual(disabledRes.multiplier, 1.0, 'Disabled calibration must return 1.0 multiplier');
      assert.strictEqual(disabledRes.adjustedScore, 0.60, 'Disabled calibration must preserve original score');

      resetRecommendationCalibrationConfig();
      assert.strictEqual(getRecommendationCalibrationConfig().enabled, true);

      console.log('✓ Configuration resilience & dynamic tuning tests passed');
    }

    console.log('\n🎉 ALL DAY 29 RECOMMENDATION INTELLIGENCE TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    throw error;
  }
}
