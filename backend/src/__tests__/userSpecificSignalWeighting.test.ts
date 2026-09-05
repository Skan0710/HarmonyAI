import assert from 'node:assert';
import {
  UserSpecificSignalWeightingService,
  UserSignalWeightingInputs,
} from '../services/userSpecificSignalWeightingService.js';
import {
  getRecommendationSignalConfig,
  resetRecommendationSignalConfig,
} from '../config/recommendationSignalConfig.js';
import { UnifiedLayeredTasteProfile } from '../services/layeredTemporalTasteProfileService.js';
import { UserFeedbackProfile } from '../services/recommendationScoreCalibrationService.js';

export function runUserSpecificSignalWeightingTests() {
  console.log('[User-Specific Signal Weighting Test Suite] Starting tests...');

  try {
    resetRecommendationSignalConfig();

    // =========================================================================
    // 1. New Users Test
    // =========================================================================
    {
      console.log('\n--- 1. New Users (Cold Start) ---');
      const inputs: UserSignalWeightingInputs = {
        userId: 'user_new_001',
        userClassification: 'NEW',
        temporalProfile: null,
        feedbackProfile: null,
      };

      const result = UserSpecificSignalWeightingService.calculateUserSpecificWeights(inputs);

      assert.strictEqual(result.userId, 'user_new_001');
      assert.strictEqual(result.userClassification, 'NEW');
      assert.strictEqual(result.isPersonalized, false, 'New user recommendations must be marked unpersonalized');

      // Check exploratory weighting
      assert.ok(
        result.baselineWeights.popularityWeight > 0.25,
        `Expected high popularity weight for new user, got ${result.baselineWeights.popularityWeight}`
      );
      assert.ok(
        result.baselineWeights.recencyWeight > 0.15,
        `Expected elevated recency weight for new user, got ${result.baselineWeights.recencyWeight}`
      );

      // Check fallback floors: no signal should be zeroed or below MIN_SIGNAL_FLOOR
      const floor = UserSpecificSignalWeightingService.MIN_SIGNAL_FLOOR;
      assert.ok(result.baselineWeights.contentSimilarityWeight >= floor);
      assert.ok(result.baselineWeights.collaborativeWeight >= floor);
      assert.ok(result.baselineWeights.userTasteAffinityWeight >= floor);
      assert.ok(result.baselineWeights.popularityWeight >= floor);
      assert.ok(result.baselineWeights.recencyWeight >= floor);

      // Sum must be normalized to ~1.0
      const sum =
        result.baselineWeights.contentSimilarityWeight +
        result.baselineWeights.collaborativeWeight +
        result.baselineWeights.userTasteAffinityWeight +
        result.baselineWeights.popularityWeight +
        result.baselineWeights.recencyWeight;
      assert.ok(Math.abs(sum - 1.0) < 0.005, `Baseline weights must sum to 1.0, got ${sum}`);

      // Temporal influence should be minimal for new users
      assert.ok(
        result.modulationLayers.temporalInfluence <= 0.10,
        `Expected minimal temporal influence for new user, got ${result.modulationLayers.temporalInfluence}`
      );

      // Verify rationale
      assert.ok(
        result.rationales.some((r) => r.factor === 'new_user_cold_start'),
        'Must include new_user_cold_start rationale'
      );
      assert.ok(result.explanation.includes('new user'), 'Explanation must mention new user');

      console.log('✓ New users receive safe exploratory weights, fallback floors, and clear rationale');
    }

    // =========================================================================
    // 2. Users with Limited History Test
    // =========================================================================
    {
      console.log('\n--- 2. Users with Limited History ---');
      const inputs: UserSignalWeightingInputs = {
        userId: 'user_limited_002',
        userClassification: 'LIMITED_DATA',
        temporalProfile: null,
        feedbackProfile: null,
      };

      const result = UserSpecificSignalWeightingService.calculateUserSpecificWeights(inputs);

      assert.strictEqual(result.userId, 'user_limited_002');
      assert.strictEqual(result.userClassification, 'LIMITED_DATA');
      assert.strictEqual(result.isPersonalized, true, 'Limited history users should receive early personalization');

      // Emerging taste should carry more weight than purely cold start
      assert.ok(
        result.baselineWeights.userTasteAffinityWeight > 0.18,
        `Expected growing taste affinity weight for limited data user, got ${result.baselineWeights.userTasteAffinityWeight}`
      );
      assert.ok(
        result.baselineWeights.contentSimilarityWeight > 0.22,
        `Expected strong content similarity weight for limited data user, got ${result.baselineWeights.contentSimilarityWeight}`
      );

      // Moderate temporal influence for emerging habits (scaled to respect maxCombinedModulationInfluence)
      assert.ok(
        result.modulationLayers.temporalInfluence >= 0.10 && result.modulationLayers.temporalInfluence <= 0.20,
        `Expected moderate temporal influence, got ${result.modulationLayers.temporalInfluence}`
      );
      const totalMod =
        result.modulationLayers.temporalInfluence +
        result.modulationLayers.sessionInfluence +
        result.modulationLayers.contextInfluence;
      assert.ok(
        totalMod <= result.modulationLayers.maxCombinedModulationInfluence + 0.001,
        `Total modulation (${totalMod}) must not exceed maxCombinedModulationInfluence (${result.modulationLayers.maxCombinedModulationInfluence})`
      );

      // Ensure no signal is extinguished
      const floor = UserSpecificSignalWeightingService.MIN_SIGNAL_FLOOR;
      for (const [sig, w] of Object.entries(result.baselineWeights)) {
        assert.ok(w >= floor, `Signal ${sig} is below floor: ${w}`);
      }

      // Sum normalized to 1.0
      const sum = Object.values(result.baselineWeights).reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(sum - 1.0) < 0.005, `Baseline weights must sum to 1.0, got ${sum}`);

      // Verify rationale
      assert.ok(
        result.rationales.some((r) => r.factor === 'limited_data_adaptation'),
        'Must include limited_data_adaptation rationale'
      );

      console.log('✓ Limited data users receive balanced early personalization with sensible fallbacks');
    }

    // =========================================================================
    // 3. Users with Strong Recent Preferences (Active Taste Pivot)
    // =========================================================================
    {
      console.log('\n--- 3. Users with Strong Recent Preferences (Taste Pivot) ---');
      const pivotTemporalProfile: any = {
        userId: 'user_pivot_003',
        tasteStabilityScore: 0.35, // Low stability = strong recent divergence / pivot
        shortTerm: { layerName: 'short_term', genres: [{ name: 'Electronic', affinity: 0.8 }] },
        mediumTerm: { layerName: 'medium_term', genres: [{ name: 'Indie Rock', affinity: 0.5 }] },
        longTerm: { layerName: 'long_term', genres: [{ name: 'Classical', affinity: 0.7 }] },
      };

      const inputs: UserSignalWeightingInputs = {
        userId: 'user_pivot_003',
        userClassification: 'ACTIVE',
        temporalProfile: pivotTemporalProfile as UnifiedLayeredTasteProfile,
        feedbackProfile: null,
      };

      const result = UserSpecificSignalWeightingService.calculateUserSpecificWeights(inputs);

      assert.strictEqual(result.userId, 'user_pivot_003');
      assert.strictEqual(result.userClassification, 'ACTIVE');
      assert.strictEqual(result.isPersonalized, true);

      // Short-term taste horizon must be significantly boosted over long-term
      assert.ok(
        result.temporalHorizons.shortTermWeight > 0.50,
        `Expected short-term horizon weight > 0.50, got ${result.temporalHorizons.shortTermWeight}`
      );
      assert.ok(
        result.temporalHorizons.shortTermWeight > result.temporalHorizons.longTermWeight,
        'Short-term weight must exceed long-term weight for a pivoting user'
      );

      // Temporal modulation influence should be boosted
      const baseConfig = getRecommendationSignalConfig();
      assert.ok(
        result.modulationLayers.temporalInfluence > baseConfig.modulationLayers.temporalInfluence,
        'Temporal modulation influence should be boosted for active pivot'
      );

      // Check recency baseline boost
      assert.ok(
        result.baselineWeights.recencyWeight > baseConfig.baselineSignals.recencyWeight,
        'Recency baseline weight should be elevated for active recent taste momentum'
      );

      // Check signal floors: long-term taste should NOT be removed completely
      assert.ok(
        result.temporalHorizons.longTermWeight >= UserSpecificSignalWeightingService.MIN_SIGNAL_FLOOR,
        'Long-term horizon must not be extinguished'
      );
      assert.ok(
        result.baselineWeights.userTasteAffinityWeight >= UserSpecificSignalWeightingService.MIN_SIGNAL_FLOOR,
        'User taste affinity must not be extinguished'
      );

      // Rationale check
      const pivotRationale = result.rationales.find((r) => r.factor === 'active_taste_pivot');
      assert.ok(pivotRationale, 'Must log active_taste_pivot rationale');
      assert.ok(pivotRationale.reason.includes('recent-preference horizon'));

      console.log('✓ Users with strong recent preferences receive amplified short-term temporal weights and recency');
    }

    // =========================================================================
    // 4. Users with Strong Long-Term Preferences (High Taste Stability)
    // =========================================================================
    {
      console.log('\n--- 4. Users with Strong Long-Term Preferences (High Stability) ---');
      const stableTemporalProfile: any = {
        userId: 'user_stable_004',
        tasteStabilityScore: 0.92, // High stability = short-term mirrors long-term habits
        shortTerm: { layerName: 'short_term', genres: [{ name: 'Jazz', affinity: 0.8 }] },
        mediumTerm: { layerName: 'medium_term', genres: [{ name: 'Jazz', affinity: 0.8 }] },
        longTerm: { layerName: 'long_term', genres: [{ name: 'Jazz', affinity: 0.85 }] },
      };

      const inputs: UserSignalWeightingInputs = {
        userId: 'user_stable_004',
        userClassification: 'WELL_ESTABLISHED',
        temporalProfile: stableTemporalProfile as UnifiedLayeredTasteProfile,
        feedbackProfile: null,
      };

      const result = UserSpecificSignalWeightingService.calculateUserSpecificWeights(inputs);

      assert.strictEqual(result.userId, 'user_stable_004');
      assert.strictEqual(result.userClassification, 'WELL_ESTABLISHED');

      const baseConfig = getRecommendationSignalConfig();

      // Foundational long-term taste affinity weight must be elevated
      assert.ok(
        result.baselineWeights.userTasteAffinityWeight > baseConfig.baselineSignals.userTasteAffinityWeight,
        `Expected elevated userTasteAffinityWeight, got ${result.baselineWeights.userTasteAffinityWeight}`
      );

      // Long-term temporal horizon weight should be elevated
      assert.ok(
        result.temporalHorizons.longTermWeight > baseConfig.temporalHorizons.longTermWeight,
        `Expected elevated longTermWeight, got ${result.temporalHorizons.longTermWeight}`
      );

      // Mainstream popularity weight should be lower compared to new users
      assert.ok(
        result.baselineWeights.popularityWeight < 0.15,
        `Expected lower popularity weight for stable user, got ${result.baselineWeights.popularityWeight}`
      );

      // Verify rationale
      const stabilityRationale = result.rationales.find((r) => r.factor === 'high_taste_stability');
      assert.ok(stabilityRationale, 'Must log high_taste_stability rationale');
      assert.ok(stabilityRationale.reason.includes('foundational long-term taste'));

      console.log('✓ Users with strong long-term preferences retain strong foundational long-term weights');
    }

    // =========================================================================
    // 5. Feedback-Driven Signal Adaptation
    // =========================================================================
    {
      console.log('\n--- 5. Feedback-Driven Signal Adaptation ---');
      const feedbackProfileWithSkips: any = {
        likedSongIds: new Set<string>(),
        savedSongIds: new Set<string>(),
        skippedSongIds: new Map<string, number>(),
        highCompletionSongIds: new Set<string>(),
        genrePositiveScores: new Map<string, number>(),
        genreSkipCounts: new Map<string, number>(),
        artistPositiveScores: new Map<string, number>(),
        artistSkipCounts: new Map<string, number>(),
        signalPerformance: {
          collaborative: {
            source: 'collaborative',
            total: 10,
            playedCount: 2,
            skippedCount: 8,
            likedCount: 1,
            savedCount: 0,
            playRate: 0.20,
            skipRate: 0.80, // High skip rate on collaborative signal
            likeRate: 0.10,
            saveRate: 0.0,
            averageCompletionRate: 0.20,
            engagementScore: 0.15,
            confidence: 'medium',
          },
          content: {
            source: 'content',
            total: 10,
            playedCount: 8,
            skippedCount: 2,
            likedCount: 4,
            savedCount: 2,
            playRate: 0.80,
            skipRate: 0.20,
            likeRate: 0.40, // High like rate on content signal
            saveRate: 0.20,
            averageCompletionRate: 0.85,
            engagementScore: 0.70,
            confidence: 'medium',
          },
        },
      };

      const inputs: UserSignalWeightingInputs = {
        userId: 'user_feedback_005',
        userClassification: 'ACTIVE',
        temporalProfile: null,
        feedbackProfile: feedbackProfileWithSkips,
      };

      const result = UserSpecificSignalWeightingService.calculateUserSpecificWeights(inputs);

      // Collaborative weight should be down-weighted due to high skip rate
      const baseConfig = getRecommendationSignalConfig();
      assert.ok(
        result.baselineWeights.collaborativeWeight < baseConfig.baselineSignals.collaborativeWeight,
        `Expected reduced collaborative weight due to high skip rate, got ${result.baselineWeights.collaborativeWeight}`
      );

      // Content similarity should be boosted due to positive feedback
      assert.ok(
        result.baselineWeights.contentSimilarityWeight > baseConfig.baselineSignals.contentSimilarityWeight,
        `Expected boosted content similarity weight due to positive feedback, got ${result.baselineWeights.contentSimilarityWeight}`
      );

      // Floor guaranteed: collaborative weight is still >= MIN_SIGNAL_FLOOR
      assert.ok(
        result.baselineWeights.collaborativeWeight >= UserSpecificSignalWeightingService.MIN_SIGNAL_FLOOR,
        'Collaborative signal must not be extinguished below floor'
      );

      // Rationales logged
      assert.ok(
        result.rationales.some((r) => r.factor === 'negative_collaborative_feedback'),
        'Must log negative collaborative feedback rationale'
      );
      assert.ok(
        result.rationales.some((r) => r.factor === 'positive_content_feedback'),
        'Must log positive content feedback rationale'
      );

      console.log('✓ Explicit feedback dynamically adapts signal weights with rationales while respecting floors');
    }

    // =========================================================================
    // 6. Floor Guarantees Under Extreme Overrides
    // =========================================================================
    {
      console.log('\n--- 6. Floor Guarantees and Bounding Under Extreme Overrides ---');
      const extremeInputs: UserSignalWeightingInputs = {
        userId: 'user_extreme_006',
        userClassification: 'ACTIVE',
        customOverrides: {
          collaborativeWeight: -0.50, // Negative override
          popularityWeight: 0.0,       // Zero override
        },
      };

      const result = UserSpecificSignalWeightingService.calculateUserSpecificWeights(extremeInputs);

      // Neither signal should fall below MIN_SIGNAL_FLOOR
      const floor = UserSpecificSignalWeightingService.MIN_SIGNAL_FLOOR;
      assert.ok(
        result.baselineWeights.collaborativeWeight >= floor,
        `Collaborative weight must not fall below floor: ${result.baselineWeights.collaborativeWeight}`
      );
      assert.ok(
        result.baselineWeights.popularityWeight >= floor,
        `Popularity weight must not fall below floor: ${result.baselineWeights.popularityWeight}`
      );

      // Total sum must still normalize to 1.0
      const sum = Object.values(result.baselineWeights).reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(sum - 1.0) < 0.005, `Baseline weights must sum to 1.0, got ${sum}`);

      console.log('✓ Extreme inputs and overrides safely constrained by MIN_SIGNAL_FLOOR and normalized');
    }

    console.log('\n🎉 ALL USER-SPECIFIC SIGNAL WEIGHTING TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ User-specific signal weighting test failed:', err);
    throw err;
  }
}
