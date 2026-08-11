import assert from 'node:assert';
import { UserSimilarityService } from '../services/userSimilarityService.js';
import { SparseInteractionMatrix } from '../services/interactionMatrixService.js';

export function runUserSimilarityTests() {
  console.log('[User Similarity Test Suite] Starting tests...');

  // Test 1: Identical User Interaction Vectors
  {
    const userA = new Map<string, number>([
      ['song_synthwave', 9],
      ['song_rock', 5],
    ]);
    const userB = new Map<string, number>([
      ['song_synthwave', 9],
      ['song_rock', 5],
    ]);

    const similarity = UserSimilarityService.calculateUserSimilarity(userA, userB);
    assert.strictEqual(similarity, 1.0, 'Identical interaction maps should have similarity 1.0');
    console.log('✓ Test 1 Passed: Identical user interaction vectors return 1.0.');
  }

  // Test 2: Partially Overlapping Interaction Vectors
  {
    const userA = new Map<string, number>([
      ['song_synthwave', 9],
      ['song_rock', 5],
    ]);
    const userB = new Map<string, number>([
      ['song_synthwave', 9],
      ['song_pop', 4],
    ]);

    const similarity = UserSimilarityService.calculateUserSimilarity(userA, userB);
    assert.ok(similarity > 0 && similarity < 1.0, 'Partial overlap similarity should be strictly between 0 and 1');
    console.log('✓ Test 2 Passed: Partially overlapping interaction vectors calculated correctly.');
  }

  // Test 3: No Overlapping Interactions
  {
    const userA = new Map<string, number>([['song_jazz', 5]]);
    const userB = new Map<string, number>([['song_metal', 4]]);

    const similarity = UserSimilarityService.calculateUserSimilarity(userA, userB);
    assert.strictEqual(similarity, 0.0, 'No overlapping interactions should return similarity 0.0');
    console.log('✓ Test 3 Passed: Non-overlapping user interactions return 0.0.');
  }

  // Test 4: Self-Comparison Exclusion in Matrix
  {
    const userIds = ['user_1', 'user_2', 'user_3'];
    const songIds = ['song_a', 'song_b'];
    const matrix = new SparseInteractionMatrix(userIds, songIds);

    const u1 = matrix.userIndexMap.get('user_1')!;
    const u2 = matrix.userIndexMap.get('user_2')!;
    const sA = matrix.songIndexMap.get('song_a')!;

    matrix.set(u1, sA, 5);
    matrix.set(u2, sA, 5);

    const similarUsers = UserSimilarityService.findMostSimilarUsers('user_1', matrix);
    assert.strictEqual(
      similarUsers.some((u) => u.userId === 'user_1'),
      false,
      'Target user_1 must be excluded from similar users list'
    );
    assert.strictEqual(similarUsers.length, 1, 'Should find user_2 as similar user');
    assert.strictEqual(similarUsers[0].userId, 'user_2', 'user_2 should be top matching similar user');
    console.log('✓ Test 4 Passed: Target user self-comparison excluded correctly.');
  }

  console.log('🎉 All user similarity calculation tests completed successfully.');
}
