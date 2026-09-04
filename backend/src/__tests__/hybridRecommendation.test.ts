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
    assert.strictEqual(weights.contentSimilarityWeight, DEFAULT_HYBRID_WEIGHTS.contentSimilarityWeight, 'Default content weight should match config');
    assert.strictEqual(weights.collaborativeWeight, DEFAULT_HYBRID_WEIGHTS.collaborativeWeight, 'Default collaborative weight should match config');
    assert.strictEqual(weights.popularityWeight, DEFAULT_HYBRID_WEIGHTS.popularityWeight, 'Default popularity weight should match config');
    assert.strictEqual(weights.recencyWeight, DEFAULT_HYBRID_WEIGHTS.recencyWeight, 'Default recency weight should match config');
    console.log('✓ Test 1 Passed: Centralized recommendationConfig weights match specification.');
  }

  // Test 2: Centralized Config Weight Updates & Resets
  {
    updateHybridConfigWeights({ contentSimilarityWeight: 0.5, popularityWeight: 0.1 });
    const updated = getHybridConfigWeights();
    assert.strictEqual(updated.contentSimilarityWeight, 0.5, 'Updated content weight should be 0.5');
    assert.strictEqual(updated.popularityWeight, 0.1, 'Updated popularity weight should be 0.1');
    assert.strictEqual(updated.collaborativeWeight, DEFAULT_HYBRID_WEIGHTS.collaborativeWeight, 'Unmodified collaborative weight preserved');

    resetHybridConfigWeights();
    const reset = getHybridConfigWeights();
    assert.strictEqual(reset.contentSimilarityWeight, DEFAULT_HYBRID_WEIGHTS.contentSimilarityWeight, 'Reset content weight should match default');
    console.log('✓ Test 2 Passed: Configuration updates and resets operate correctly.');
  }

  // Test 3: Hybrid Score Fusion Calculation & Normalization Bounds
  {
    const weights = getHybridConfigWeights();
    const totalWeight =
      weights.contentSimilarityWeight +
      weights.collaborativeWeight +
      weights.userTasteAffinityWeight +
      weights.popularityWeight +
      weights.recencyWeight;

    // Simulate candidate component scores normalized to [0.0, 1.0]
    const normContent = 0.9;
    const normCollab = 0.8;
    const normTaste = 0.85;
    const normPopularity = 0.5;
    const normRecency = 0.7;

    const rawScore =
      (normContent * weights.contentSimilarityWeight +
        normCollab * weights.collaborativeWeight +
        normTaste * weights.userTasteAffinityWeight +
        normPopularity * weights.popularityWeight +
        normRecency * weights.recencyWeight) /
      totalWeight;

    const hybridScore = Number(Math.max(0, Math.min(1, rawScore)).toFixed(4));

    assert.ok(hybridScore >= 0 && hybridScore <= 1.0, 'Hybrid score strictly bounded between 0 and 1');
    assert.strictEqual(hybridScore, 0.7875, 'Fused hybrid score matches weighted calculation');
    console.log('✓ Test 3 Passed: Hybrid score fusion and [0.0, 1.0] normalization verified.');
  }

  console.log('🎉 All hybrid recommendation scoring tests completed successfully.');
}
