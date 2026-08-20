import assert from 'node:assert';
import { RecommendationHistoryService } from '../services/recommendationHistoryService.js';
import {
  getRepetitionConfig,
  updateRepetitionConfig,
  resetRepetitionConfig,
} from '../config/recommendationConfig.js';

export function runRecommendationHistoryServiceTests() {
  console.log('[Recommendation History & Repetition Control Test Suite] Starting tests...');

  // Test 1: Repetition Penalty for Recently Recommended Songs within Cooldown
  {
    const items = [
      { songId: 'fresh_track', finalScore: 0.80 },
      { songId: 'recent_track', finalScore: 0.82 }, // slightly higher score, but shown recently
    ];

    const recentlyRecommended = new Map();
    recentlyRecommended.set('recent_track', {
      songId: 'recent_track',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      count: 1,
    });

    const result = RecommendationHistoryService.applyRepetitionControl({
      items,
      recentlyRecommended,
      recentlySkipped: new Set(),
      targetLimit: 2,
      scoreExtractor: (it) => it.finalScore,
      songIdExtractor: (it) => it.songId,
    });

    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].songId, 'fresh_track', 'Fresh track is prioritized over recently shown track');
    assert.ok(result[1].adjustedScore < result[1].baseScore, 'Repetition penalty applied to recent track');

    console.log('✓ Test 1 Passed: Repetition penalty within cooldown window verified.');
  }

  // Test 2: Recently Skipped Tracks Heavy Suppression
  {
    const items = [
      { songId: 'normal_track', finalScore: 0.75 },
      { songId: 'skipped_track', finalScore: 0.90 }, // high relevance, but recently skipped
    ];

    const recentlySkipped = new Set(['skipped_track']);

    const result = RecommendationHistoryService.applyRepetitionControl({
      items,
      recentlyRecommended: new Map(),
      recentlySkipped,
      targetLimit: 2,
      scoreExtractor: (it) => it.finalScore,
      songIdExtractor: (it) => it.songId,
    });

    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].songId, 'normal_track', 'Normal track beats recently skipped track');
    assert.strictEqual(result[1].songId, 'skipped_track');
    assert.ok(result[1].adjustedScore <= 0.15, 'Skipped track heavily penalized');
    assert.strictEqual(result[1].isRecentlySkipped, true);

    console.log('✓ Test 2 Passed: Recently skipped track suppression verified.');
  }

  // Test 3: Reappearance of Highly Relevant Tracks (High Relevance Exception)
  {
    const items = [
      { songId: 'fresh_track', finalScore: 0.70 },
      { songId: 'stellar_track', finalScore: 0.95 }, // >= reappearance threshold (0.85)
    ];

    const recentlyRecommended = new Map();
    recentlyRecommended.set('stellar_track', {
      songId: 'stellar_track',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
      count: 1,
    });

    const result = RecommendationHistoryService.applyRepetitionControl({
      items,
      recentlyRecommended,
      recentlySkipped: new Set(),
      targetLimit: 2,
      scoreExtractor: (it) => it.finalScore,
      songIdExtractor: (it) => it.songId,
    });

    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].songId, 'stellar_track', 'Highly relevant track (0.95) allowed to reappear top rank');
    assert.strictEqual(result[0].isReappearanceAllowed, true);

    console.log('✓ Test 3 Passed: High relevance reappearance verified.');
  }

  // Test 4: Configurable Repetition Config
  {
    const initial = getRepetitionConfig();
    assert.strictEqual(initial.cooldownWindowHours, 24);
    assert.strictEqual(initial.repetitionPenalty, 0.35);

    const updated = updateRepetitionConfig({ cooldownWindowHours: 48, repetitionPenalty: 0.40 });
    assert.strictEqual(updated.cooldownWindowHours, 48);
    assert.strictEqual(getRepetitionConfig().repetitionPenalty, 0.40);

    const reset = resetRepetitionConfig();
    assert.strictEqual(reset.cooldownWindowHours, 24);

    console.log('✓ Test 4 Passed: Configurable repetition parameters verified.');
  }

  console.log('🎉 All recommendation history & repetition control tests completed successfully.');
}
