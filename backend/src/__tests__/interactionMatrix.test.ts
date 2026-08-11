import assert from 'node:assert';
import { SparseInteractionMatrix } from '../services/interactionMatrixService.js';

export function runInteractionMatrixTests() {
  console.log('[User-Song Interaction Matrix Test Suite] Starting tests...');

  const userIds = ['user_alpha', 'user_beta', 'user_gamma'];
  const songIds = ['song_rock', 'song_jazz', 'song_pop', 'song_lofi'];

  // Test 1: Sparse Matrix Initialization
  {
    const matrix = new SparseInteractionMatrix(userIds, songIds);
    assert.strictEqual(matrix.userIds.length, 3, 'User row count should be 3');
    assert.strictEqual(matrix.songIds.length, 4, 'Song column count should be 4');
    assert.strictEqual(matrix.getScore('user_alpha', 'song_rock'), 0, 'Unset score should be 0 safely');
    assert.strictEqual(matrix.getScore('unknown_user', 'song_rock'), 0, 'Unknown user score should be 0 safely');
    console.log('✓ Test 1 Passed: Sparse matrix initialized with safe 0 default values.');
  }

  // Test 2: Multiple Interaction Aggregation
  {
    const matrix = new SparseInteractionMatrix(userIds, songIds);
    const uIdx = matrix.userIndexMap.get('user_alpha')!;
    const sIdx = matrix.songIndexMap.get('song_pop')!;

    // Like (5) + Completed Play (4) = 9
    matrix.set(uIdx, sIdx, 9);

    assert.strictEqual(matrix.getScore('user_alpha', 'song_pop'), 9, 'Score for user_alpha and song_pop should be 9');
    console.log('✓ Test 2 Passed: Multiple interaction score set and retrieved correctly.');
  }

  // Test 3: Dense & Sparse Row Queries
  {
    const matrix = new SparseInteractionMatrix(userIds, songIds);
    const uAlphaIdx = matrix.userIndexMap.get('user_alpha')!;
    const sRockIdx = matrix.songIndexMap.get('song_rock')!;
    const sPopIdx = matrix.songIndexMap.get('song_pop')!;

    matrix.set(uAlphaIdx, sRockIdx, 5); // Like
    matrix.set(uAlphaIdx, sPopIdx, 7); // Play + Repeat

    const denseRow = matrix.getDenseUserRow('user_alpha');
    assert.strictEqual(denseRow.length, 4, 'Dense row length should equal total song count (4)');
    assert.strictEqual(denseRow[sRockIdx], 5, 'Dense row rock index score should be 5');
    assert.strictEqual(denseRow[sPopIdx], 7, 'Dense row pop index score should be 7');

    const sparseRowMap = matrix.getUserRowMap('user_alpha');
    assert.strictEqual(sparseRowMap.get('song_rock'), 5, 'Sparse map rock score should be 5');
    assert.strictEqual(sparseRowMap.get('song_pop'), 7, 'Sparse map pop score should be 7');
    assert.strictEqual(sparseRowMap.has('song_jazz'), false, 'Sparse map omits zero-interaction entries for efficiency');
    console.log('✓ Test 3 Passed: Dense array and sparse map queries operate efficiently.');
  }

  console.log('🎉 All user-song interaction matrix tests completed successfully.');
}
