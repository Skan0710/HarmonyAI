import assert from 'node:assert';
import {
  normalizeTimeWindow,
  TIME_WINDOW_DURATIONS_DAYS,
  TEMPORAL_TIME_WINDOWS,
} from '../types/domainModels.js';

export async function runTemporalPreferenceModelTests() {
  console.log('[Temporal Preference Model Test Suite] Starting tests...');

  // Test 1: Normalization and Time Window Durations
  {
    assert.strictEqual(normalizeTimeWindow('short_term'), 'short_term');
    assert.strictEqual(normalizeTimeWindow('short-term'), 'short_term');
    assert.strictEqual(normalizeTimeWindow('shortTerm'), 'short_term');
    assert.strictEqual(normalizeTimeWindow('short'), 'short_term');

    assert.strictEqual(normalizeTimeWindow('medium_term'), 'medium_term');
    assert.strictEqual(normalizeTimeWindow('medium-term'), 'medium_term');
    assert.strictEqual(normalizeTimeWindow('mediumTerm'), 'medium_term');
    assert.strictEqual(normalizeTimeWindow('medium'), 'medium_term');

    assert.strictEqual(normalizeTimeWindow('long_term'), 'long_term');
    assert.strictEqual(normalizeTimeWindow('long-term'), 'long_term');
    assert.strictEqual(normalizeTimeWindow('longTerm'), 'long_term');
    assert.strictEqual(normalizeTimeWindow('long'), 'long_term');

    // Default fallback
    assert.strictEqual(normalizeTimeWindow(''), 'medium_term');
    assert.strictEqual(normalizeTimeWindow(undefined), 'medium_term');

    assert.strictEqual(TIME_WINDOW_DURATIONS_DAYS.short_term, 14);
    assert.strictEqual(TIME_WINDOW_DURATIONS_DAYS.medium_term, 60);
    assert.strictEqual(TIME_WINDOW_DURATIONS_DAYS.long_term, 180);

    assert.deepStrictEqual(TEMPORAL_TIME_WINDOWS, ['short_term', 'medium_term', 'long_term']);
    console.log('✓ Test 1 Passed: Time window normalization and constants verified.');
  }

  console.log('🎉 ALL Temporal Preference Model tests completed successfully.');
}
