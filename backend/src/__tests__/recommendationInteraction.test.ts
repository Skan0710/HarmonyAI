import assert from 'node:assert';
import {
  RecommendationInteractionService,
  DEFAULT_INTERACTION_WEIGHTS,
} from '../services/recommendationInteractionService.js';

export function runRecommendationInteractionTests() {
  console.log('[Recommendation Interaction Test Suite] Starting tests...');

  // Test 1: Verify Default Configurable Weights
  {
    const weights = RecommendationInteractionService.getWeights();
    assert.strictEqual(weights.LIKE, 5, 'Default LIKE weight should be 5');
    assert.strictEqual(weights.COMPLETED_PLAYBACK, 4, 'Default COMPLETED_PLAYBACK weight should be 4');
    assert.strictEqual(weights.PARTIAL_PLAYBACK, 2, 'Default PARTIAL_PLAYBACK weight should be 2');
    assert.strictEqual(weights.REPEATED_PLAYBACK, 3, 'Default REPEATED_PLAYBACK weight should be 3');
    assert.strictEqual(weights.SKIP, -2, 'Default SKIP weight should be -2');
    console.log('✓ Test 1 Passed: Default interaction weights match specification.');
  }

  // Test 2: Calculate Single Event Weights
  {
    assert.strictEqual(RecommendationInteractionService.calculateSingleEventWeight('LIKE'), 5);
    assert.strictEqual(RecommendationInteractionService.calculateSingleEventWeight('COMPLETED_PLAYBACK'), 4);
    assert.strictEqual(RecommendationInteractionService.calculateSingleEventWeight('PARTIAL_PLAYBACK'), 2);
    assert.strictEqual(RecommendationInteractionService.calculateSingleEventWeight('REPEATED_PLAYBACK'), 3);
    assert.strictEqual(RecommendationInteractionService.calculateSingleEventWeight('SKIP'), -2);
    console.log('✓ Test 2 Passed: Single event weights calculated correctly.');
  }

  // Test 3: Centralized Configurable Weights Override
  {
    RecommendationInteractionService.setWeights({ LIKE: 10, SKIP: -5 });
    const updated = RecommendationInteractionService.getWeights();

    assert.strictEqual(updated.LIKE, 10, 'Updated LIKE weight should be 10');
    assert.strictEqual(updated.SKIP, -5, 'Updated SKIP weight should be -5');
    assert.strictEqual(updated.COMPLETED_PLAYBACK, 4, 'Unchanged weights preserved');

    // Reset back to defaults
    RecommendationInteractionService.resetWeights();
    const reset = RecommendationInteractionService.getWeights();
    assert.strictEqual(reset.LIKE, 5, 'Reset LIKE weight should be 5');
    console.log('✓ Test 3 Passed: Centralized configurable weights update and reset correctly.');
  }

  console.log('🎉 All recommendation interaction service tests completed successfully.');
}
