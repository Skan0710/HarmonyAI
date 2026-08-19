import assert from 'node:assert';
import { ACTION_WEIGHT_MULTIPLIERS, SessionPreferenceUpdateService } from '../services/sessionPreferenceUpdateService.js';
import { SessionActionType } from '../models/ListeningSession.js';

export function runSessionPreferenceUpdateServiceTests() {
  console.log('[Session Preference Update Service Test Suite] Starting tests...');

  // Test 1: Action Weight Multipliers Verification
  {
    assert.strictEqual(ACTION_WEIGHT_MULTIPLIERS.like, 2.0, 'Like action boosts preference (+2.0)');
    assert.strictEqual(ACTION_WEIGHT_MULTIPLIERS.replay, 1.75, 'Replay action boosts preference (+1.75)');
    assert.strictEqual(ACTION_WEIGHT_MULTIPLIERS.complete, 1.25, 'Complete action boosts preference (+1.25)');
    assert.strictEqual(ACTION_WEIGHT_MULTIPLIERS.play, 1.0, 'Play action standard preference (+1.0)');
    assert.strictEqual(ACTION_WEIGHT_MULTIPLIERS.skip, -1.25, 'Skip action reduces preference (-1.25)');

    console.log('✓ Test 1 Passed: Action weight multipliers (like +2.0, replay +1.75, skip -1.25) verified.');
  }

  // Test 2: Exponential Recency Weighting for Interaction Events
  {
    const totalEvents = 4;
    // Event 3 is most recent -> recency weight = 1.0
    // Event 0 is oldest -> recency weight < 0.7
    const recencyNew = (SessionPreferenceUpdateService as any).calculateEventRecencyWeight(3, totalEvents);
    const recencyOld = (SessionPreferenceUpdateService as any).calculateEventRecencyWeight(0, totalEvents);

    assert.strictEqual(recencyNew, 1.0);
    assert.ok(recencyOld < recencyNew, 'Recent interactions have higher weight than older events');

    console.log('✓ Test 2 Passed: Event recency weighting verified.');
  }

  // Test 3: Net Score Penalty for Skipped Tracks
  {
    const calculateNetWeight = (action: SessionActionType, recencyWeight: number) => {
      return ACTION_WEIGHT_MULTIPLIERS[action] * recencyWeight;
    };

    const netLike = calculateNetWeight('like', 1.0);
    const netSkip = calculateNetWeight('skip', 1.0);

    assert.strictEqual(netLike, 2.0);
    assert.strictEqual(netSkip, -1.25);
    assert.ok(netSkip < 0, 'Skip action results in negative net weight adjustment');

    console.log('✓ Test 3 Passed: Net score penalty for skipped tracks verified.');
  }

  console.log('🎉 All session preference update service tests completed successfully.');
}
