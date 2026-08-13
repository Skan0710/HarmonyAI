import assert from 'node:assert';
import { RecommendationEvaluationService } from '../services/recommendationEvaluationService.js';

export function runRecommendationEvaluationTests() {
  console.log('[Recommendation Evaluation Service Test Suite] Starting tests...');

  // Test 1: Normal Case - Partial Match
  {
    const recommended = ['song_1', 'song_2', 'song_3', 'song_4', 'song_5'];
    const relevant = ['song_2', 'song_4', 'song_6', 'song_7'];
    const k = 5;

    // Hits in top 5 = 2 (song_2, song_4)
    // Precision@5 = 2 / 5 = 0.4
    // Recall@5 = 2 / 4 = 0.5
    // F1@5 = 2 * (0.4 * 0.5) / (0.4 + 0.5) = 0.4 / 0.9 = 0.4444

    const metrics = RecommendationEvaluationService.evaluateRecommendationSet(recommended, relevant, k);

    assert.strictEqual(metrics.precisionAtK, 0.4, 'Precision@5 should be 0.4');
    assert.strictEqual(metrics.recallAtK, 0.5, 'Recall@5 should be 0.5');
    assert.strictEqual(metrics.f1AtK, 0.4444, 'F1@5 should be 0.4444');
    assert.strictEqual(metrics.hitsCount, 2, 'Hits count should be 2');
    console.log('✓ Test 1 Passed: Normal partial match metrics evaluated correctly.');
  }

  // Test 2: Perfect Match
  {
    const recommended = ['song_a', 'song_b', 'song_c'];
    const relevant = ['song_a', 'song_b', 'song_c'];
    const k = 3;

    const metrics = RecommendationEvaluationService.evaluateRecommendationSet(recommended, relevant, k);

    assert.strictEqual(metrics.precisionAtK, 1.0, 'Perfect match precision should be 1.0');
    assert.strictEqual(metrics.recallAtK, 1.0, 'Perfect match recall should be 1.0');
    assert.strictEqual(metrics.f1AtK, 1.0, 'Perfect match F1 should be 1.0');
    console.log('✓ Test 2 Passed: Perfect match metrics evaluated to 1.0.');
  }

  // Test 3: Edge Case - Empty Recommendation Set
  {
    const recommended: string[] = [];
    const relevant = ['song_1', 'song_2'];
    const k = 5;

    const metrics = RecommendationEvaluationService.evaluateRecommendationSet(recommended, relevant, k);

    assert.strictEqual(metrics.precisionAtK, 0.0, 'Empty recommendations precision should be 0.0');
    assert.strictEqual(metrics.recallAtK, 0.0, 'Empty recommendations recall should be 0.0');
    assert.strictEqual(metrics.f1AtK, 0.0, 'Empty recommendations F1 should be 0.0');
    assert.strictEqual(metrics.hitsCount, 0, 'Hits count should be 0');
    console.log('✓ Test 3 Passed: Empty recommendation set handled safely.');
  }

  // Test 4: Edge Case - Empty Relevant Interactions
  {
    const recommended = ['song_1', 'song_2'];
    const relevant: string[] = [];
    const k = 5;

    const metrics = RecommendationEvaluationService.evaluateRecommendationSet(recommended, relevant, k);

    assert.strictEqual(metrics.precisionAtK, 0.0);
    assert.strictEqual(metrics.recallAtK, 0.0);
    assert.strictEqual(metrics.f1AtK, 0.0);
    console.log('✓ Test 4 Passed: Empty relevant interactions handled safely.');
  }

  // Test 5: Edge Case - Non-Overlapping Sets (Zero Hits)
  {
    const recommended = ['song_x', 'song_y'];
    const relevant = ['song_m', 'song_n'];
    const k = 2;

    const metrics = RecommendationEvaluationService.evaluateRecommendationSet(recommended, relevant, k);

    assert.strictEqual(metrics.precisionAtK, 0.0);
    assert.strictEqual(metrics.recallAtK, 0.0);
    assert.strictEqual(metrics.f1AtK, 0.0);
    assert.strictEqual(metrics.hitsCount, 0);
    console.log('✓ Test 5 Passed: Non-overlapping sets handled safely.');
  }

  // Test 6: Edge Case - Invalid or Negative K
  {
    const recommended = ['song_1', 'song_2'];
    const relevant = ['song_1'];

    const precision = RecommendationEvaluationService.calculatePrecisionAtK(recommended, relevant, -1);
    const recall = RecommendationEvaluationService.calculateRecallAtK(recommended, relevant, 0);

    assert.strictEqual(precision, 0.0, 'Negative K should return 0.0 safely');
    assert.strictEqual(recall, 0.0, 'Zero K should return 0.0 safely');
    console.log('✓ Test 6 Passed: Invalid K parameters handled safely.');
  }

  console.log('🎉 All recommendation evaluation service tests completed successfully.');
}
