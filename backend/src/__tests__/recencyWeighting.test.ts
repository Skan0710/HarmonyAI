import assert from 'node:assert';
import { UserTasteProfileService } from '../services/userTasteProfileService.js';
import { updateRecencyConfig, resetRecencyConfig } from '../config/recommendationConfig.js';

export function runRecencyWeightingTests() {
  console.log('[Recency Weighting Test Suite] Starting tests...');

  // Test 1: Recent interaction (0 days old) retains ~100% base weight
  {
    const now = new Date();
    const baseWeight = 4;
    const weight = UserTasteProfileService.calculateRecencyWeight(now, baseWeight, 30);

    assert.strictEqual(weight, baseWeight, '0-day old interaction should retain 100% base weight');
    console.log('✓ Test 1 Passed: Recent interaction retains full base weight.');
  }

  // Test 2: 30-day old interaction (1 half-life) decays to 50% base weight
  {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const baseWeight = 4;
    const weight = UserTasteProfileService.calculateRecencyWeight(thirtyDaysAgo, baseWeight, 30);

    const expected = baseWeight * 0.5; // 2.0
    assert.ok(Math.abs(weight - expected) < 0.05, `30-day old interaction weight (${weight}) should decay to ~2.0`);
    console.log('✓ Test 2 Passed: 30-day old interaction decays to 50% of base weight.');
  }

  // Test 3: 60-day old interaction (2 half-lives) decays to 25% base weight
  {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const baseWeight = 4;
    const weight = UserTasteProfileService.calculateRecencyWeight(sixtyDaysAgo, baseWeight, 30);

    const expected = baseWeight * 0.25; // 1.0
    assert.ok(Math.abs(weight - expected) < 0.05, `60-day old interaction weight (${weight}) should decay to ~1.0`);
    console.log('✓ Test 3 Passed: 60-day old interaction decays to 25% of base weight.');
  }

  // Test 4: Mixed Interactions (Recent play outranks older play)
  {
    const recentPlayDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const oldPlayDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const baseWeight = 5;

    const recentWeight = UserTasteProfileService.calculateRecencyWeight(recentPlayDate, baseWeight, 30);
    const oldWeight = UserTasteProfileService.calculateRecencyWeight(oldPlayDate, baseWeight, 30);

    assert.ok(recentWeight > oldWeight, 'Recent interaction weight must exceed older interaction weight');
    assert.ok(recentWeight / oldWeight > 4, 'Recent interaction weight should be significantly higher');
    console.log('✓ Test 4 Passed: Recent plays outrank older plays in mixed interaction scenarios.');
  }

  // Test 5: Configurable Decay Rate Change
  {
    resetRecencyConfig();
    updateRecencyConfig({ halfLifeDays: 10 }); // Faster 10-day half-life decay

    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const baseWeight = 10;
    const weightFast = UserTasteProfileService.calculateRecencyWeight(tenDaysAgo, baseWeight);

    assert.ok(Math.abs(weightFast - 5) < 0.1, '10-day old interaction with 10-day half-life should decay to 50% (5.0)');

    resetRecencyConfig(); // Restore defaults
    console.log('✓ Test 5 Passed: Configurable decay half-life update verified.');
  }

  console.log('🎉 All recency weighting tests completed successfully.');
}
