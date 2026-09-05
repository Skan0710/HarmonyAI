import assert from 'node:assert';
import {
  getRecommendationSignalConfig,
  updateRecommendationSignalConfig,
  resetRecommendationSignalConfig,
  getEffectiveSignalDistribution,
  DEFAULT_RECOMMENDATION_SIGNAL_CONFIG,
  DEFAULT_HYBRID_WEIGHTS,
  DEFAULT_CONTEXT_INFLUENCE_CONFIG,
  DEFAULT_SESSION_INFLUENCE_CONFIG,
  DEFAULT_TEMPORAL_INFLUENCE_CONFIG,
  DEFAULT_CALIBRATION_CONFIG,
  getHybridConfigWeights,
  updateHybridConfigWeights,
  resetHybridConfigWeights,
  getTemporalTasteInfluenceConfig,
  getSessionInfluenceConfig,
} from '../config/recommendationConfig.js';
import { HybridRankingPipeline } from '../services/hybridRankingPipeline.js';
import { HybridCandidate } from '../services/candidateGenerationService.js';

export function runRecommendationSignalConfigTests() {
  console.log('[Recommendation Signal Config Test Suite] Starting tests...');

  try {
    // 1. Default Configuration & Behavior Preservation
    {
      console.log('\n--- 1. Default Configuration & Legacy Baseline Preservation ---');
      resetRecommendationSignalConfig();
      resetHybridConfigWeights();

      const config = getRecommendationSignalConfig();

      // Verify baseline signals match default hybrid weights
      assert.strictEqual(
        config.baselineSignals.contentSimilarityWeight,
        DEFAULT_HYBRID_WEIGHTS.contentSimilarityWeight,
        'Content similarity weight must match DEFAULT_HYBRID_WEIGHTS'
      );
      assert.strictEqual(
        config.baselineSignals.collaborativeWeight,
        DEFAULT_HYBRID_WEIGHTS.collaborativeWeight,
        'Collaborative weight must match DEFAULT_HYBRID_WEIGHTS'
      );
      assert.strictEqual(
        config.baselineSignals.userTasteAffinityWeight,
        DEFAULT_HYBRID_WEIGHTS.userTasteAffinityWeight,
        'Long-term taste (userTasteAffinity) weight must match DEFAULT_HYBRID_WEIGHTS'
      );
      assert.strictEqual(
        config.baselineSignals.popularityWeight,
        DEFAULT_HYBRID_WEIGHTS.popularityWeight,
        'Popularity weight must match DEFAULT_HYBRID_WEIGHTS'
      );
      assert.strictEqual(
        config.baselineSignals.recencyWeight,
        DEFAULT_HYBRID_WEIGHTS.recencyWeight,
        'Recency weight must match DEFAULT_HYBRID_WEIGHTS'
      );

      // Verify modulation layer bounds
      assert.strictEqual(
        config.modulationLayers.temporalInfluence,
        DEFAULT_TEMPORAL_INFLUENCE_CONFIG.defaultTemporalInfluence
      );
      assert.strictEqual(
        config.modulationLayers.sessionInfluence,
        DEFAULT_SESSION_INFLUENCE_CONFIG.defaultSessionInfluence
      );
      assert.strictEqual(
        config.modulationLayers.contextInfluence,
        DEFAULT_CONTEXT_INFLUENCE_CONFIG.defaultContextInfluence
      );
      assert.strictEqual(
        config.modulationLayers.maxCombinedModulationInfluence,
        0.50,
        'maxCombinedModulationInfluence must default to 0.50'
      );
      assert.strictEqual(
        config.modulationLayers.minBaselineWeightFloor,
        0.50,
        'minBaselineWeightFloor must default to 0.50'
      );

      // Verify temporal horizons
      assert.strictEqual(
        config.temporalHorizons.shortTermWeight,
        DEFAULT_TEMPORAL_INFLUENCE_CONFIG.shortTermSignalWeight
      );
      assert.strictEqual(
        config.temporalHorizons.mediumTermWeight,
        DEFAULT_TEMPORAL_INFLUENCE_CONFIG.mediumTermSignalWeight
      );
      assert.strictEqual(
        config.temporalHorizons.longTermWeight,
        DEFAULT_TEMPORAL_INFLUENCE_CONFIG.longTermSignalWeight
      );

      // Verify feedback calibration defaults
      assert.strictEqual(
        config.feedbackSignals.likedBoostFactor,
        DEFAULT_CALIBRATION_CONFIG.likedBoostFactor
      );
      assert.strictEqual(
        config.feedbackSignals.skipPenaltyFactor,
        DEFAULT_CALIBRATION_CONFIG.skipPenaltyFactor
      );

      console.log('✓ Default signal configuration strictly preserves legacy recommendation behavior');
    }

    // 2. Centralized Signal Updates & Resets
    {
      console.log('\n--- 2. Centralized Signal Updates & Resets ---');

      updateRecommendationSignalConfig({
        baselineSignals: { contentSimilarityWeight: 0.40, userTasteAffinityWeight: 0.30 },
        modulationLayers: { maxCombinedModulationInfluence: 0.60 },
        temporalHorizons: { shortTermWeight: 0.65 },
        sessionBehavior: { recentCompletionBoost: 1.50 },
      });

      const updated = getRecommendationSignalConfig();
      assert.strictEqual(updated.baselineSignals.contentSimilarityWeight, 0.40);
      assert.strictEqual(updated.baselineSignals.userTasteAffinityWeight, 0.30);
      assert.strictEqual(updated.modulationLayers.maxCombinedModulationInfluence, 0.60);
      assert.strictEqual(updated.temporalHorizons.shortTermWeight, 0.65);
      assert.strictEqual(updated.sessionBehavior.recentCompletionBoost, 1.50);

      // Reset
      resetRecommendationSignalConfig();
      const reset = getRecommendationSignalConfig();
      assert.strictEqual(
        reset.baselineSignals.contentSimilarityWeight,
        DEFAULT_RECOMMENDATION_SIGNAL_CONFIG.baselineSignals.contentSimilarityWeight
      );
      assert.strictEqual(
        reset.modulationLayers.maxCombinedModulationInfluence,
        0.50
      );

      console.log('✓ Centralized signal configuration updates and resets operate correctly');
    }

    // 3. Two-Way Synchronization with Legacy Domain Configs
    {
      console.log('\n--- 3. Two-Way Synchronization with Legacy Domain Configs ---');

      // Update via master signal config -> reflects in legacy getter
      updateRecommendationSignalConfig({
        baselineSignals: { collaborativeWeight: 0.45 },
      });
      const legacyHybrid = getHybridConfigWeights();
      assert.strictEqual(legacyHybrid.collaborativeWeight, 0.45, 'Legacy getHybridConfigWeights must reflect master signal update');

      // Update via legacy setter -> reflects in master signal config
      updateHybridConfigWeights({ contentSimilarityWeight: 0.33 });
      const masterConfig = getRecommendationSignalConfig();
      assert.strictEqual(masterConfig.baselineSignals.contentSimilarityWeight, 0.33, 'Master signal config must reflect legacy update');

      // Reset
      resetHybridConfigWeights();
      resetRecommendationSignalConfig();

      console.log('✓ Two-way synchronization between master signal config and legacy domain configs verified');
    }

    // 4. Effective Signal Distribution & Normalized Weight Breakdown
    {
      console.log('\n--- 4. Effective Signal Distribution & Normalized Breakdown ---');

      const distribution = getEffectiveSignalDistribution({
        useTemporal: true,
        useSession: true,
        useContext: true,
        useFeedback: true,
      });

      // Verify all major signals are identified
      assert.ok('content_similarity' in distribution);
      assert.ok('collaborative' in distribution);
      assert.ok('long_term_taste' in distribution);
      assert.ok('short_term_taste' in distribution);
      assert.ok('medium_term_taste' in distribution);
      assert.ok('session_behavior' in distribution);
      assert.ok('context' in distribution);
      assert.ok('feedback_calibration' in distribution);
      assert.ok('popularity' in distribution);
      assert.ok('recency' in distribution);

      // Verify weights are bounded in [0, 1]
      for (const [key, sig] of Object.entries(distribution)) {
        assert.ok(sig.weight >= 0 && sig.weight <= 1.0, `${key} weight must be bounded in [0, 1]`);
        assert.ok(sig.percentage >= 0 && sig.percentage <= 100, `${key} percentage must be bounded in [0, 100]`);
      }

      // If temporal is disabled, temporal sub-horizons should be marked inactive
      const noTemporalDist = getEffectiveSignalDistribution({ useTemporal: false });
      assert.strictEqual(noTemporalDist.short_term_taste.active, false);
      assert.strictEqual(noTemporalDist.medium_term_taste.active, false);

      console.log('✓ Effective signal distribution calculates normalized weights for all major signals');
    }

    // 5. Recommendation Engine Integration & Ranking Verification
    {
      console.log('\n--- 5. Recommendation Engine Integration ---');

      resetRecommendationSignalConfig();
      resetHybridConfigWeights();

      const candidates: HybridCandidate[] = [
        {
          songId: 'song_taste',
          songDoc: { title: 'User Taste Song', genre: 'Rock' },
          contentScore: 0.2,
          collaborativeScore: 0.2,
          userTasteAffinityScore: 0.95, // high long-term taste
          popularitySignal: 50,
          recencySignal: 0.5,
          sources: ['user_taste_affinity'],
        },
        {
          songId: 'song_pop',
          songDoc: { title: 'Popular Song', genre: 'Pop' },
          contentScore: 0.2,
          collaborativeScore: 0.2,
          userTasteAffinityScore: 0.2,
          popularitySignal: 1000, // high popularity
          recencySignal: 0.5,
          sources: ['popularity'],
        },
      ];

      // Default weights (taste: 0.25, popularity: 0.125) -> taste wins
      const resDefault = HybridRankingPipeline.rankCandidates(candidates, 10);
      assert.strictEqual(resDefault[0].song.title, 'User Taste Song', 'With default weights, long-term taste should outscore popularity');

      // Now tune master signal config to heavily boost popularity over taste
      updateRecommendationSignalConfig({
        baselineSignals: {
          userTasteAffinityWeight: 0.05,
          popularityWeight: 0.80,
        },
      });

      const resTuned = HybridRankingPipeline.rankCandidates(candidates, 10);
      assert.strictEqual(resTuned[0].song.title, 'Popular Song', 'With tuned master signal config, popularity should outscore long-term taste');

      // Clean up
      resetRecommendationSignalConfig();
      resetHybridConfigWeights();

      console.log('✓ Recommendation engine dynamically respects centralized signal configuration');
    }

    console.log('\n🎉 ALL RECOMMENDATION SIGNAL CONFIG TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Recommendation signal config test failed:', err);
    throw err;
  }
}
