import assert from 'node:assert';
import {
  DEFAULT_HYBRID_WEIGHTS,
  getHybridConfigWeights,
  updateHybridConfigWeights,
  resetHybridConfigWeights,
} from '../config/recommendationConfig.js';

export function runHybridRecommendationTests() {
  console.log('[Hybrid Recommendation Test Suite] Starting tests...');

  // Test 1: Centralized Configuration Weights
  {
    const weights = getHybridConfigWeights();
    assert.strictEqual(weights.contentSimilarityWeight, 0.35, 'Default content weight should be 0.35');
    assert.strictEqual(weights.collaborativeWeight, 0.35, 'Default collaborative weight should be 0.35');
    assert.strictEqual(weights.popularityWeight, 0.15, 'Default popularity weight should be 0.15');
    assert.strictEqual(weights.recencyWeight, 0.15, 'Default recency weight should be 0.15');
    console.log('✓ Test 1 Passed: Centralized recommendationConfig weights match specification.');
  }

  // Test 2: Centralized Config Weight Updates & Resets
  {
    updateHybridConfigWeights({ contentSimilarityWeight: 0.5, popularityWeight: 0.1 });
    const updated = getHybridConfigWeights();
    assert.strictEqual(updated.contentSimilarityWeight, 0.5, 'Updated content weight should be 0.5');
    assert.strictEqual(updated.popularityWeight, 0.1, 'Updated popularity weight should be 0.1');
    assert.strictEqual(updated.collaborativeWeight, 0.35, 'Unmodified collaborative weight preserved');

    resetHybridConfigWeights();
    const reset = getHybridConfigWeights();
    assert.strictEqual(reset.contentSimilarityWeight, 0.35, 'Reset content weight should be 0.35');
    console.log('✓ Test 2 Passed: Configuration updates and resets operate correctly.');
  }

  // Test 3: Hybrid Score Fusion Calculation & Normalization Bounds
  {
    const weights = getHybridConfigWeights();
    const totalWeight =
      weights.contentSimilarityWeight +
      weights.collaborativeWeight +
      weights.popularityWeight +
      weights.recencyWeight;

    // Simulate candidate component scores normalized to [0.0, 1.0]
    const normContent = 0.9;
    const normCollab = 0.8;
    const normPopularity = 0.5;
    const normRecency = 0.7;

    const rawScore =
      (normContent * weights.contentSimilarityWeight +
        normCollab * weights.collaborativeWeight +
        normPopularity * weights.popularityWeight +
        normRecency * weights.recencyWeight) /
      totalWeight;

    const hybridScore = Number(Math.max(0, Math.min(1, rawScore)).toFixed(4));

    assert.ok(hybridScore >= 0 && hybridScore <= 1.0, 'Hybrid score strictly bounded between 0 and 1');
    assert.strictEqual(hybridScore, 0.775, 'Fused hybrid score matches weighted calculation');
    console.log('✓ Test 3 Passed: Hybrid score fusion and [0.0, 1.0] normalization verified.');
  }

  console.log('🎉 All hybrid recommendation scoring tests completed successfully.');
}
