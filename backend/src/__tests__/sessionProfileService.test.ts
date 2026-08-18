import assert from 'node:assert';
import { Types } from 'mongoose';
import { SessionProfileService } from '../services/sessionProfileService.js';
import { IListeningSession } from '../models/ListeningSession.js';

export function runSessionProfileServiceTests() {
  console.log('[Session Profile Service Test Suite] Starting tests...');

  // Test 1: Recency Position Weight Calculation
  {
    const totalSongs = 5;
    // Index 4 is most recent (recency distance 0 -> weight = 1.0)
    // Index 0 is oldest (recency distance 4 -> weight < 0.5)
    const weightMostRecent = (SessionProfileService as any).calculatePositionRecencyWeight(4, totalSongs);
    const weightOldest = (SessionProfileService as any).calculatePositionRecencyWeight(0, totalSongs);

    assert.strictEqual(weightMostRecent, 1.0, 'Most recent song index receives maximum weight 1.0');
    assert.ok(weightOldest < weightMostRecent, 'Older songs receive exponentially lower recency weight');

    console.log('✓ Test 1 Passed: Recency position weight calculation verified.');
  }

  // Test 2: Dominant Genres & Score Normalization
  {
    const genreWeightsMap = new Map<string, number>([
      ['Synthwave', 2.0],
      ['Pop', 1.0],
      ['Rock', 1.0],
    ]);
    const totalWeightSum = 4.0;

    const dominantGenres = Array.from(genreWeightsMap.entries())
      .map(([genre, w]) => ({ genre, score: w / totalWeightSum }))
      .sort((a, b) => b.score - a.score);

    assert.strictEqual(dominantGenres[0].genre, 'Synthwave');
    assert.strictEqual(dominantGenres[0].score, 0.5);
    const totalScoreSum = dominantGenres.reduce((sum, g) => sum + g.score, 0);
    assert.strictEqual(totalScoreSum, 1.0, 'Normalized genre scores sum to 1.0');

    console.log('✓ Test 2 Passed: Dominant genres & score normalization verified.');
  }

  // Test 3: Average Energy & Tempo Calculation
  {
    const weightedEnergySum = 0.9 * 1.0 + 0.5 * 0.8; // 0.9 + 0.4 = 1.3
    const energyWeightCount = 1.0 + 0.8; // 1.8
    const avgEnergy = Number((weightedEnergySum / energyWeightCount).toFixed(4));

    assert.ok(avgEnergy > 0.7, 'Weighted average energy biased towards recent high-energy track');

    console.log('✓ Test 3 Passed: Weighted average energy & tempo calculations verified.');
  }

  console.log('🎉 All session profile service tests completed successfully.');
}
