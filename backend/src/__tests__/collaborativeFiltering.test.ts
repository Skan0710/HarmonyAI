import assert from 'node:assert';
import { UserSimilarityService } from '../services/userSimilarityService.js';
import { SparseInteractionMatrix } from '../services/interactionMatrixService.js';

export function runCollaborativeFilteringTests() {
  console.log('[Collaborative Filtering Test Suite] Starting tests...');

  // Test 1: Collaborative Filtering Recommendation Ranking & Target Song Exclusion
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

    // Set interactions:
    // Target user has liked song_already_liked (score 5)
    matrix.set(uTarget, sLiked, 5);

    // Similar User 1 also liked song_already_liked (score 5) -> High similarity with Target User!
    // Similar User 1 strongly liked song_candidate_alpha (score 9)
    matrix.set(uSim1, sLiked, 5);
    matrix.set(uSim1, sAlpha, 9);

    // Similar User 2 also liked song_already_liked (score 5) -> High similarity!
    // Similar User 2 liked song_candidate_beta (score 4)
    matrix.set(uSim2, sLiked, 5);
    matrix.set(uSim2, sBeta, 4);

    // Verify User Similarities
    const similarUsers = UserSimilarityService.findMostSimilarUsers('target_user', matrix);
    assert.strictEqual(similarUsers.length, 2, 'Should find 2 similar neighbor users');
    assert.strictEqual(
      similarUsers.some((u) => u.userId === 'target_user'),
      false,
      'Target user excluded from neighbors'
    );

    // Verify candidate recommendations calculation logic
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

    // Assertions:
    assert.strictEqual(
      candidateScores.has('song_already_liked'),
      false,
      'Already interacted track song_already_liked MUST be excluded'
    );
    assert.ok(
      candidateScores.has('song_candidate_alpha'),
      'song_candidate_alpha should be recommended'
    );
    assert.ok(
      candidateScores.has('song_candidate_beta'),
      'song_candidate_beta should be recommended'
    );
    assert.ok(
      candidateScores.get('song_candidate_alpha')! > candidateScores.get('song_candidate_beta')!,
      'song_candidate_alpha with higher interaction strength should rank higher'
    );

    console.log('✓ Test 1 Passed: Collaborative candidate ranking and target song exclusion verified.');
  }

  console.log('🎉 All collaborative filtering service tests completed successfully.');
}
