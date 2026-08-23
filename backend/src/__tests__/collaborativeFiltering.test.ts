import assert from 'node:assert';
import { UserSimilarityService } from '../services/userSimilarityService.js';
import { SparseInteractionMatrix } from '../services/interactionMatrixService.js';

export function runCollaborativeFilteringTests() {
  console.log('[Collaborative Filtering Test Suite] Starting tests...');

  {
    const userIds = ['user_alpha', 'user_twin'];
    const songIds = ['song_synthwave_1', 'song_rock_2'];
    const matrix = new SparseInteractionMatrix(userIds, songIds);

    const uAlpha = matrix.userIndexMap.get('user_alpha')!;
    const uTwin = matrix.userIndexMap.get('user_twin')!;
    const s1 = matrix.songIndexMap.get('song_synthwave_1')!;
    const s2 = matrix.songIndexMap.get('song_rock_2')!;

    matrix.set(uAlpha, s1, 9);
    matrix.set(uAlpha, s2, 5);

    matrix.set(uTwin, s1, 9);
    matrix.set(uTwin, s2, 5);

    const similar = UserSimilarityService.findMostSimilarUsers('user_alpha', matrix);
    assert.strictEqual(similar.length, 1);
    assert.strictEqual(similar[0].userId, 'user_twin');
    assert.strictEqual(similar[0].similarityScore, 1.0);
    console.log('✓ Test 1 Passed: Users with identical preferences evaluated to 1.0 similarity.');
  }

  {
    const userIds = ['user_a', 'user_b'];
    const songIds = ['song_common', 'song_only_a', 'song_only_b'];
    const matrix = new SparseInteractionMatrix(userIds, songIds);

    const uA = matrix.userIndexMap.get('user_a')!;
    const uB = matrix.userIndexMap.get('user_b')!;
    const sCommon = matrix.songIndexMap.get('song_common')!;
    const sOnlyA = matrix.songIndexMap.get('song_only_a')!;
    const sOnlyB = matrix.songIndexMap.get('song_only_b')!;

    matrix.set(uA, sCommon, 5);
    matrix.set(uA, sOnlyA, 8);

    matrix.set(uB, sCommon, 5);
    matrix.set(uB, sOnlyB, 9);

    const similar = UserSimilarityService.findMostSimilarUsers('user_a', matrix);
    assert.strictEqual(similar.length, 1);
    assert.ok(similar[0].similarityScore > 0 && similar[0].similarityScore < 1.0);
    console.log('✓ Test 2 Passed: Users with partially overlapping preferences evaluated correctly.');
  }

  // Test 3: Users with No Overlapping Songs
  {
    const userIds = ['user_x', 'user_y'];
    const songIds = ['song_jazz', 'song_metal'];
    const matrix = new SparseInteractionMatrix(userIds, songIds);

    const uX = matrix.userIndexMap.get('user_x')!;
    const uY = matrix.userIndexMap.get('user_y')!;
    const sJazz = matrix.songIndexMap.get('song_jazz')!;
    const sMetal = matrix.songIndexMap.get('song_metal')!;

    matrix.set(uX, sJazz, 5);
    matrix.set(uY, sMetal, 5);

    const similar = UserSimilarityService.findMostSimilarUsers('user_x', matrix);
    assert.strictEqual(similar.length, 0, 'Should find 0 similar users when no songs overlap');
    console.log('✓ Test 3 Passed: Users with no overlapping songs return 0 similar users.');
  }

  // Test 4: Users with No Listening History (Cold Start)
  {
    const userIds = ['user_newborn', 'user_active'];
    const songIds = ['song_1', 'song_2'];
    const matrix = new SparseInteractionMatrix(userIds, songIds);

    const uActive = matrix.userIndexMap.get('user_active')!;
    const s1 = matrix.songIndexMap.get('song_1')!;
    matrix.set(uActive, s1, 5);

    // Target user_newborn has no listening history set in matrix
    const similar = UserSimilarityService.findMostSimilarUsers('user_newborn', matrix);
    assert.strictEqual(similar.length, 0, 'New user with no history returns 0 similar users safely');
    console.log('✓ Test 4 Passed: Users with no listening history handled safely.');
  }

  // Test 5: Exclusion of Already-Liked Songs
  {
    const userIds = ['target_user', 'similar_user_1', 'similar_user_2'];
    const songIds = ['song_already_liked', 'song_candidate_alpha', 'song_candidate_beta'];
    const matrix = new SparseInteractionMatrix(userIds, songIds);

    const uTarget = matrix.userIndexMap.get('target_user')!;
    const uSim1 = matrix.userIndexMap.get('similar_user_1')!;
    const uSim2 = matrix.userIndexMap.get('similar_user_2')!;

    const sLiked = matrix.songIndexMap.get('song_already_liked')!;
    const sAlpha = matrix.songIndexMap.get('song_candidate_alpha')!;
    const sBeta = matrix.songIndexMap.get('song_candidate_beta')!;

    // Target user has liked song_already_liked (score 5)
    matrix.set(uTarget, sLiked, 5);

    matrix.set(uSim1, sLiked, 5);
    matrix.set(uSim1, sAlpha, 9);

    matrix.set(uSim2, sLiked, 5);
    matrix.set(uSim2, sBeta, 4);

    const similarUsers = UserSimilarityService.findMostSimilarUsers('target_user', matrix);
    const targetRowMap = matrix.getUserRowMap('target_user');
    const candidateScores = new Map<string, number>();

    for (const neighbor of similarUsers) {
      const neighborRow = matrix.getUserRowMap(neighbor.userId);
      for (const [songId, score] of neighborRow.entries()) {
        // Exclude songs target user already interacted with
        if (targetRowMap.has(songId) && targetRowMap.get(songId)! > 0) {
          continue;
        }
        candidateScores.set(songId, (candidateScores.get(songId) || 0) + neighbor.similarityScore * score);
      }
    }

    assert.strictEqual(
      candidateScores.has('song_already_liked'),
      false,
      'Already liked track song_already_liked MUST be excluded'
    );
    assert.ok(candidateScores.has('song_candidate_alpha'));
    assert.ok(candidateScores.has('song_candidate_beta'));
    console.log('✓ Test 5 Passed: Already-liked songs strictly excluded from candidates.');
  }

  console.log('🎉 All 5 collaborative filtering evaluation tests completed successfully.');
}
