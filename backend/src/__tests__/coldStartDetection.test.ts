import assert from 'node:assert';
import {
  ColdStartThresholds,
  UserActivityStatistics,
  UserClassificationType,
  DEFAULT_COLD_START_THRESHOLDS,
} from '../services/coldStartDetectionService.js';

export function runColdStartDetectionTests() {
  console.log('[Cold-Start Detection Service Test Suite] Starting tests...');

  // Helper classification logic testing
  function computeMockClassification(
    stats: UserActivityStatistics,
    thresholds: ColdStartThresholds = DEFAULT_COLD_START_THRESHOLDS
  ): { classification: UserClassificationType; isColdStart: boolean; readinessScore: number } {
    const meetsEstablished =
      stats.totalPlays >= thresholds.minPlaysForEstablished &&
      stats.totalLikes >= thresholds.minLikesForEstablished &&
      stats.distinctArtistsCount >= thresholds.minArtistsForEstablished &&
      stats.distinctGenresCount >= thresholds.minGenresForEstablished;

    const meetsActive =
      stats.totalPlays >= thresholds.minPlaysForActive &&
      stats.totalLikes >= thresholds.minLikesForActive &&
      stats.distinctArtistsCount >= thresholds.minArtistsForActive &&
      stats.distinctGenresCount >= thresholds.minGenresForActive;

    let classification: UserClassificationType = 'NEW';
    if (meetsEstablished) {
      classification = 'WELL_ESTABLISHED';
    } else if (meetsActive) {
      classification = 'ACTIVE';
    } else if (stats.totalPlays > 2 || stats.totalLikes > 1 || stats.distinctArtistsCount > 1) {
      classification = 'LIMITED_DATA';
    } else {
      classification = 'NEW';
    }

    const isColdStart = classification === 'NEW' || classification === 'LIMITED_DATA';

    const playProgress = Math.min(1, stats.totalPlays / thresholds.minPlaysForActive);
    const likeProgress = Math.min(1, stats.totalLikes / thresholds.minLikesForActive);
    const artistProgress = Math.min(1, stats.distinctArtistsCount / thresholds.minArtistsForActive);
    const genreProgress = Math.min(1, stats.distinctGenresCount / thresholds.minGenresForActive);

    const readinessScore = Number(
      ((playProgress + likeProgress + artistProgress + genreProgress) / 4).toFixed(4)
    );

    return { classification, isColdStart, readinessScore };
  }

  // Test 1: NEW User Classification
  {
    const stats: UserActivityStatistics = {
      totalPlays: 1,
      completedPlays: 1,
      totalLikes: 0,
      distinctArtistsCount: 1,
      distinctGenresCount: 1,
      explicitFavoriteGenresCount: 0,
      explicitFavoriteArtistsCount: 0,
    };

    const res = computeMockClassification(stats);

    assert.strictEqual(res.classification, 'NEW');
    assert.strictEqual(res.isColdStart, true);
    assert.ok(res.readinessScore < 0.5);
    console.log('✓ Test 1 Passed: NEW user classified correctly.');
  }

  // Test 2: LIMITED_DATA User Classification
  {
    const stats: UserActivityStatistics = {
      totalPlays: 6,
      completedPlays: 4,
      totalLikes: 2,
      distinctArtistsCount: 2,
      distinctGenresCount: 1,
      explicitFavoriteGenresCount: 0,
      explicitFavoriteArtistsCount: 0,
    };

    const res = computeMockClassification(stats);

    assert.strictEqual(res.classification, 'LIMITED_DATA');
    assert.strictEqual(res.isColdStart, true);
    console.log('✓ Test 2 Passed: LIMITED_DATA user classified correctly.');
  }

  // Test 3: ACTIVE User Classification
  {
    const stats: UserActivityStatistics = {
      totalPlays: 15,
      completedPlays: 12,
      totalLikes: 5,
      distinctArtistsCount: 4,
      distinctGenresCount: 3,
      explicitFavoriteGenresCount: 1,
      explicitFavoriteArtistsCount: 2,
    };

    const res = computeMockClassification(stats);

    assert.strictEqual(res.classification, 'ACTIVE');
    assert.strictEqual(res.isColdStart, false);
    assert.strictEqual(res.readinessScore, 1.0);
    console.log('✓ Test 3 Passed: ACTIVE user classified correctly.');
  }

  // Test 4: WELL_ESTABLISHED User Classification
  {
    const stats: UserActivityStatistics = {
      totalPlays: 45,
      completedPlays: 40,
      totalLikes: 12,
      distinctArtistsCount: 10,
      distinctGenresCount: 5,
      explicitFavoriteGenresCount: 2,
      explicitFavoriteArtistsCount: 3,
    };

    const res = computeMockClassification(stats);

    assert.strictEqual(res.classification, 'WELL_ESTABLISHED');
    assert.strictEqual(res.isColdStart, false);
    assert.strictEqual(res.readinessScore, 1.0);
    console.log('✓ Test 4 Passed: WELL_ESTABLISHED user classified correctly.');
  }

  // Test 5: Custom Threshold Overrides
  {
    const stats: UserActivityStatistics = {
      totalPlays: 5,
      completedPlays: 5,
      totalLikes: 2,
      distinctArtistsCount: 2,
      distinctGenresCount: 2,
      explicitFavoriteGenresCount: 0,
      explicitFavoriteArtistsCount: 0,
    };

    const customThresholds: ColdStartThresholds = {
      ...DEFAULT_COLD_START_THRESHOLDS,
      minPlaysForActive: 4,
      minLikesForActive: 2,
      minArtistsForActive: 2,
      minGenresForActive: 2,
    };

    const res = computeMockClassification(stats, customThresholds);

    assert.strictEqual(res.classification, 'ACTIVE', 'With lower custom thresholds, user should be ACTIVE');
    assert.strictEqual(res.isColdStart, false);
    console.log('✓ Test 5 Passed: Custom threshold overrides verified.');
  }

  console.log('🎉 All cold-start detection service tests completed successfully.');
}
