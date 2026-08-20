import assert from 'node:assert';
import { NoveltyScoringService } from '../services/noveltyScoringService.js';
import {
  getNoveltyConfigWeights,
  updateNoveltyConfigWeights,
  resetNoveltyConfigWeights,
} from '../config/recommendationConfig.js';

export function runNoveltyScoringServiceTests() {
  console.log('[Novelty Scoring Service Test Suite] Starting tests...');

  // Test 1: Raw Novelty Calculation (Catalog & User Exposure)
  {
    const rareSongNovelty = NoveltyScoringService.calculateCatalogNovelty(10, 1000);
    const popularSongNovelty = NoveltyScoringService.calculateCatalogNovelty(900, 1000);
    assert.ok(rareSongNovelty > popularSongNovelty, 'Rare catalog song has higher novelty than popular song');

    const freshUserNovelty = NoveltyScoringService.calculateUserExposureNovelty(0);
    const frequentUserNovelty = NoveltyScoringService.calculateUserExposureNovelty(4);
    assert.ok(freshUserNovelty > frequentUserNovelty, 'Never encountered track has higher user novelty');

    const composite = NoveltyScoringService.computeCompositeNovelty({
      catalogPlayCount: 50,
      userPlayCount: 0,
    });
    assert.ok(composite > 0.8, 'Composite novelty for rare, unencountered track is high');

    console.log('✓ Test 1 Passed: Raw catalog & user novelty calculation verified.');
  }

  // Test 2: Controlled Boost for Relevant Unencountered Songs
  {
    const baseRelevance = 0.85; // High relevance
    const rawNovelty = 0.90;    // High novelty

    const { finalScore, gatedNoveltyScore } = NoveltyScoringService.combineNoveltyWithBaseScore(
      baseRelevance,
      rawNovelty,
      { noveltyWeight: 0.20, minRelevanceThreshold: 0.35 }
    );

    assert.ok(gatedNoveltyScore > 0.6, 'Gated novelty boost is actively applied for high relevance track');
    assert.ok(finalScore >= 0.0 && finalScore <= 1.0, 'Final score normalized between 0 and 1');

    console.log('✓ Test 2 Passed: Controlled boost for relevant unencountered songs verified.');
  }

  // Test 3: Avoid Excessively Boosting Obscure Songs with Low Relevance (Gating Check)
  {
    const lowBaseRelevance = 0.20; // Below minRelevanceThreshold (0.35)
    const maximumNovelty = 1.00;   // Highly obscure/rare

    const { finalScore, gatedNoveltyScore } = NoveltyScoringService.combineNoveltyWithBaseScore(
      lowBaseRelevance,
      maximumNovelty,
      { noveltyWeight: 0.20, minRelevanceThreshold: 0.35 }
    );

    assert.strictEqual(gatedNoveltyScore, 0.0, 'Novelty boost is gated to 0 when relevance is below threshold');
    assert.strictEqual(finalScore, 0.16, 'Final score is not boosted by obscure status when relevance is low');

    console.log('✓ Test 3 Passed: Relevance gating for obscure songs verified.');
  }

  // Test 4: Batch Item Scoring & Score Normalization Bounds
  {
    const items = [
      { id: '1', score: 0.90, playCount: 20 },
      { id: '2', score: 0.70, playCount: 800 },
      { id: '3', score: 0.15, playCount: 0 }, // Obscure but irrelevant
    ];

    const scored = NoveltyScoringService.scoreItemsWithNovelty({
      items,
      scoreExtractor: (it) => it.score,
      playCountExtractor: (it) => it.playCount,
    });

    assert.strictEqual(scored.length, 3);
    for (const sc of scored) {
      assert.ok(sc.finalScore >= 0.0 && sc.finalScore <= 1.0, 'Score is strictly in [0, 1]');
    }

    assert.ok(scored[0].finalScore > scored[1].finalScore);
    assert.ok(scored[2].finalScore < 0.2, 'Irrelevant obscure song is not inflated to top rank');

    console.log('✓ Test 4 Passed: Batch item scoring & normalization bounds verified.');
  }

  // Test 5: Configurable Novelty Weights
  {
    const initial = getNoveltyConfigWeights();
    assert.strictEqual(initial.noveltyWeight, 0.15);

    const updated = updateNoveltyConfigWeights({ noveltyWeight: 0.25 });
    assert.strictEqual(updated.noveltyWeight, 0.25);
    assert.strictEqual(getNoveltyConfigWeights().noveltyWeight, 0.25);

    const reset = resetNoveltyConfigWeights();
    assert.strictEqual(reset.noveltyWeight, 0.15);

    console.log('✓ Test 5 Passed: Configurable novelty weights verified.');
  }

  console.log('🎉 All novelty scoring service tests completed successfully.');
}
