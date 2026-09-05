import assert from 'node:assert';
import {
  AdaptiveExplorationService,
  AdaptiveExplorationInputs,
} from '../services/adaptiveExplorationService.js';
import {
  getExplorationExploitationConfig,
  updateExplorationExploitationConfig,
  resetExplorationExploitationConfig,
} from '../config/recommendationSignalConfig.js';
import { UnifiedLayeredTasteProfile } from '../services/layeredTemporalTasteProfileService.js';
import { HybridRankedResult } from '../services/hybridRankingPipeline.js';

export function runAdaptiveExplorationTests() {
  console.log('[Adaptive Exploration vs Exploitation Test Suite] Starting tests...');

  try {
    resetExplorationExploitationConfig();

    // =========================================================================
    // 1. New Users Test (Reasonable Exploration Rate)
    // =========================================================================
    {
      console.log('\n--- 1. New Users (Reasonable Exploration Rate) ---');
      const inputs: AdaptiveExplorationInputs = {
        userId: 'user_new_001',
        userClassification: 'NEW',
        temporalProfile: null,
        feedbackProfile: null,
      };

      const result = AdaptiveExplorationService.calculateAdaptiveExplorationRate(inputs);

      assert.strictEqual(result.userId, 'user_new_001');
      assert.strictEqual(result.mode, 'EXPLORATION');
      assert.ok(
        result.effectiveExplorationRate >= 0.35,
        `Expected elevated exploration rate (>= 0.35) for new users, got ${result.effectiveExplorationRate}`
      );
      assert.ok(
        result.effectiveExploitationRate <= 0.65,
        `Expected exploitation rate (<= 0.65) for new users, got ${result.effectiveExploitationRate}`
      );
      assert.ok(
        Math.abs(result.effectiveExplorationRate + result.effectiveExploitationRate - 1.0) < 0.001,
        'Exploration + Exploitation rates must sum to 1.0'
      );
      assert.ok(
        result.rationales.some((r) => r.factor === 'new_user_cold_start'),
        'Must log new_user_cold_start rationale'
      );

      console.log('✓ New users receive higher exploration rate to enable catalog discovery');
    }

    // =========================================================================
    // 2. Limited History Users Test (Balanced Discovery)
    // =========================================================================
    {
      console.log('\n--- 2. Users with Limited History (Balanced Discovery) ---');
      const inputs: AdaptiveExplorationInputs = {
        userId: 'user_limited_002',
        userClassification: 'LIMITED_DATA',
        temporalProfile: null,
        feedbackProfile: null,
      };

      const result = AdaptiveExplorationService.calculateAdaptiveExplorationRate(inputs);

      assert.strictEqual(result.userId, 'user_limited_002');
      assert.ok(
        result.effectiveExplorationRate >= 0.25 && result.effectiveExplorationRate <= 0.35,
        `Expected moderate exploration rate (~0.30) for limited data user, got ${result.effectiveExplorationRate}`
      );
      assert.ok(
        result.rationales.some((r) => r.factor === 'limited_history_discovery'),
        'Must log limited_history_discovery rationale'
      );

      console.log('✓ Limited data users receive balanced exploration with emerging taste focus');
    }

    // =========================================================================
    // 3. Strong Established Preferences (Prioritizing Familiar Music / Exploitation)
    // =========================================================================
    {
      console.log('\n--- 3. Users with Strong Established Preferences (High Exploitation) ---');
      const stableTemporalProfile: any = {
        userId: 'user_established_003',
        tasteStabilityScore: 0.90, // High stability = loyal to historical comfort habits
      };

      const inputs: AdaptiveExplorationInputs = {
        userId: 'user_established_003',
        userClassification: 'WELL_ESTABLISHED',
        temporalProfile: stableTemporalProfile as UnifiedLayeredTasteProfile,
        feedbackProfile: null,
      };

      const result = AdaptiveExplorationService.calculateAdaptiveExplorationRate(inputs);

      assert.strictEqual(result.userId, 'user_established_003');
      assert.strictEqual(result.mode, 'EXPLOITATION');
      assert.ok(
        result.effectiveExplorationRate <= 0.15,
        `Expected low exploration rate (<= 0.15) for established user, got ${result.effectiveExplorationRate}`
      );
      assert.ok(
        result.effectiveExploitationRate >= 0.85,
        `Expected high exploitation rate (>= 0.85) for established user, got ${result.effectiveExploitationRate}`
      );
      assert.ok(
        result.rationales.some((r) => r.factor === 'established_preference_exploitation'),
        'Must log established_preference_exploitation rationale'
      );
      assert.ok(
        result.rationales.some((r) => r.factor === 'stable_habits_exploitation'),
        'Must log stable_habits_exploitation rationale'
      );

      console.log('✓ Established users retain high exploitation protecting familiar favorites');
    }

    // =========================================================================
    // 4. Strong Recent Preferences (Active Taste Pivot Boost)
    // =========================================================================
    {
      console.log('\n--- 4. Active Taste Pivot (Boosted Exploration) ---');
      const pivotTemporalProfile: any = {
        userId: 'user_pivot_004',
        tasteStabilityScore: 0.35, // Low stability = rapid drift / pivot
      };

      const inputs: AdaptiveExplorationInputs = {
        userId: 'user_pivot_004',
        userClassification: 'ACTIVE',
        temporalProfile: pivotTemporalProfile as UnifiedLayeredTasteProfile,
        feedbackProfile: null,
      };

      const result = AdaptiveExplorationService.calculateAdaptiveExplorationRate(inputs);

      assert.ok(
        result.effectiveExplorationRate > 0.20,
        `Expected exploration rate to exceed baseline for pivoting user, got ${result.effectiveExplorationRate}`
      );
      assert.ok(
        result.rationales.some((r) => r.factor === 'active_taste_pivot_exploration'),
        'Must log active_taste_pivot_exploration rationale'
      );

      console.log('✓ Active taste pivots trigger an exploration boost matching user curiosity');
    }

    // =========================================================================
    // 5. Repeated Negative Feedback (Suppression of Exploration)
    // =========================================================================
    {
      console.log('\n--- 5. Repeated Negative Feedback (Suppresses Exploration) ---');
      const negativeFeedbackProfile: any = {
        likedSongIds: new Set<string>(),
        savedSongIds: new Set<string>(),
        skippedSongIds: new Map<string, number>([['s1', 2], ['s2', 1], ['s3', 1]]),
        overallSkipRate: 0.80, // 80% skip rate
        overallLikeRate: 0.10,
        signalPerformance: {},
      };

      const inputs: AdaptiveExplorationInputs = {
        userId: 'user_skips_005',
        userClassification: 'ACTIVE',
        temporalProfile: null,
        feedbackProfile: negativeFeedbackProfile,
      };

      const result = AdaptiveExplorationService.calculateAdaptiveExplorationRate(inputs);

      assert.ok(
        result.effectiveExplorationRate <= 0.15,
        `Expected dampened exploration rate (<= 0.15) due to high skip rate, got ${result.effectiveExplorationRate}`
      );
      assert.ok(
        result.rationales.some((r) => r.factor === 'negative_feedback_exploration_suppression'),
        'Must log negative_feedback_exploration_suppression rationale'
      );

      console.log('✓ Repeated negative feedback suppresses exploration to prevent user fatigue');
    }

    // =========================================================================
    // 6. Relevance Gating Guarantee (No Random Unrelated Recommendations)
    // =========================================================================
    {
      console.log('\n--- 6. Relevance Gating Guarantee (No Random Noise) ---');
      // Candidate 1: Highly relevant known favorite (high relevance, low novelty)
      // Candidate 2: Relevant novel discovery (good relevance, high novelty)
      // Candidate 3: Irrelevant obscure track (low relevance <= minRelevanceThreshold, high novelty)
      const candidates: HybridRankedResult[] = [
        {
          song: { _id: 's_fav', title: 'Known Favorite', playCount: 5000 },
          hybridScore: 0.90, // High relevance
          originalScore: 0.90,
          finalScore: 0.90,
          componentScores: {
            contentScore: 0.9,
            collaborativeScore: 0.9,
            userTasteAffinityScore: 0.9,
            popularityScore: 0.8,
            recencyScore: 0.5,
          },
          sources: ['user_taste'],
        },
        {
          song: { _id: 's_discover', title: 'Relevant Novel Track', playCount: 15 },
          hybridScore: 0.75, // Strong relevance, high novelty
          originalScore: 0.75,
          finalScore: 0.75,
          componentScores: {
            contentScore: 0.75,
            collaborativeScore: 0.7,
            userTasteAffinityScore: 0.8,
            popularityScore: 0.1,
            recencyScore: 0.8,
          },
          sources: ['collaborative'],
        },
        {
          song: { _id: 's_garbage', title: 'Irrelevant Obscure Noise', playCount: 1 },
          hybridScore: 0.10, // Below minRelevanceThreshold (0.25)
          originalScore: 0.10,
          finalScore: 0.10,
          componentScores: {
            contentScore: 0.1,
            collaborativeScore: 0.1,
            userTasteAffinityScore: 0.1,
            popularityScore: 0.01,
            recencyScore: 0.1,
          },
          sources: ['catalog_random'],
        },
      ];

      const inputs: AdaptiveExplorationInputs = {
        userId: 'user_rerank_006',
        userClassification: 'NEW', // exploration rate = 0.40
        userEncounteredSongIds: new Set(['s_fav']),
      };

      const reranked = AdaptiveExplorationService.applyExplorationReranking(candidates, inputs);

      assert.strictEqual(reranked.results.length, 3);

      const irrelevantResult = reranked.results.find((r) => r.song.title === 'Irrelevant Obscure Noise');
      assert.ok(irrelevantResult, 'Irrelevant candidate should exist');

      // Crucial: The irrelevant track must NOT receive an exploration boost!
      assert.strictEqual(
        irrelevantResult.metadata?.adaptiveExploration?.explorationScore,
        0,
        'Irrelevant item must receive 0 exploration score due to relevance gating'
      );
      assert.ok(
        (irrelevantResult.finalScore ?? 0) < 0.15,
        'Irrelevant candidate score must remain low and never rise above relevant items'
      );

      // The relevant novel track must receive a genuine gated novelty boost
      const novelResult = reranked.results.find((r) => r.song.title === 'Relevant Novel Track');
      assert.ok(novelResult, 'Novel candidate should exist');
      assert.ok(
        (novelResult.metadata?.adaptiveExploration?.explorationScore || 0) > 0.40,
        `Expected positive exploration score for relevant novel track, got ${novelResult.metadata?.adaptiveExploration?.explorationScore}`
      );

      console.log('✓ Relevance gating strictly guarantees obscure irrelevant items receive 0 exploration bonus');
    }

    // =========================================================================
    // 7. Configurable Exploration Factor & Reset
    // =========================================================================
    {
      console.log('\n--- 7. Configurable Exploration Factor & Updates ---');
      const base = getExplorationExploitationConfig();
      assert.strictEqual(base.defaultExplorationRate, 0.20);

      // Update configuration dynamically
      updateExplorationExploitationConfig({
        defaultExplorationRate: 0.35,
        newUserExplorationRate: 0.50,
      });

      const updated = getExplorationExploitationConfig();
      assert.strictEqual(updated.defaultExplorationRate, 0.35);
      assert.strictEqual(updated.newUserExplorationRate, 0.50);

      // Verify calculation reflects updated config
      const res = AdaptiveExplorationService.calculateAdaptiveExplorationRate({
        userId: 'user_cfg_007',
        userClassification: 'NEW',
      });
      assert.strictEqual(res.effectiveExplorationRate, 0.50);

      // Reset
      resetExplorationExploitationConfig();
      const reset = getExplorationExploitationConfig();
      assert.strictEqual(reset.defaultExplorationRate, 0.20);
      assert.strictEqual(reset.newUserExplorationRate, 0.40);

      console.log('✓ Exploration parameters are fully configurable, observable, and resettable');
    }

    console.log('\n🎉 ALL ADAPTIVE EXPLORATION VS EXPLOITATION TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Adaptive exploration test failed:', err);
    throw err;
  }
}
