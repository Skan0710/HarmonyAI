import assert from 'node:assert';
import { Types } from 'mongoose';
import {
  TemporalPreference,
  normalizeTimeWindow,
  TimeWindow,
  TIME_WINDOW_DURATIONS_DAYS,
  TEMPORAL_TIME_WINDOWS,
} from '../models/TemporalPreference.js';

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

  // Test 2: Instantiation with All Required Fields and Short-Term Window
  {
    const userId = new Types.ObjectId();
    const genreId = new Types.ObjectId();
    const artistId = new Types.ObjectId();
    const lastInteraction = new Date();

    const shortPref = new TemporalPreference({
      userId,
      genre: genreId,
      artist: artistId,
      mood: 'Energetic',
      preferenceScore: 0.85,
      interactionCount: 12,
      lastInteractionAt: lastInteraction,
      timeWindow: TimeWindow.SHORT_TERM,
    });

    assert.strictEqual(shortPref.userId.toString(), userId.toString());
    assert.strictEqual(shortPref.genre?.toString(), genreId.toString());
    assert.strictEqual(shortPref.artist?.toString(), artistId.toString());
    assert.strictEqual(shortPref.mood, 'Energetic');
    assert.strictEqual(shortPref.preferenceScore, 0.85);
    assert.strictEqual(shortPref.interactionCount, 12);
    assert.strictEqual(shortPref.lastInteractionAt.getTime(), lastInteraction.getTime());
    assert.strictEqual(shortPref.timeWindow, 'short_term');

    await shortPref.validate();
    console.log('✓ Test 2 Passed: Short-term preference instantiates and validates correctly.');
  }

  // Test 3: Medium-Term and Long-Term Windows with Normalized Inputs
  {
    const userId = new Types.ObjectId();

    const medPref = new TemporalPreference({
      userId,
      genre: 'Synthwave',
      mood: 'Chill',
      preferenceScore: 0.72,
      interactionCount: 25,
      lastInteractionAt: new Date(),
      timeWindow: 'medium-term', // hyphenated input
    });
    assert.strictEqual(medPref.timeWindow, 'medium_term', 'Hyphenated medium-term must normalize');
    await medPref.validate();

    const longPref = new TemporalPreference({
      userId,
      artist: 'Daft Punk',
      preferenceScore: 0.95,
      interactionCount: 150,
      lastInteractionAt: new Date(),
      timeWindow: 'long-term', // hyphenated input
    });
    assert.strictEqual(longPref.timeWindow, 'long_term', 'Hyphenated long-term must normalize');
    await longPref.validate();

    console.log('✓ Test 3 Passed: Medium-term and Long-term preferences normalize and validate cleanly.');
  }

  // Test 4: Validation Constraints (Score Range, Required Fields, Negative Interaction Count)
  {
    const invalidPref = new TemporalPreference({
      preferenceScore: 1.5, // > 1
      interactionCount: -5, // < 0
    });

    let validationFailed = false;
    try {
      await invalidPref.validate();
    } catch (err: any) {
      validationFailed = true;
      assert.ok(err.errors['userId'], 'userId should be required');
      assert.ok(err.errors['preferenceScore'], 'preferenceScore > 1 should be rejected');
      assert.ok(err.errors['interactionCount'], 'interactionCount < 0 should be rejected');
      assert.ok(err.errors['timeWindow'], 'timeWindow should be required');
    }
    assert.strictEqual(validationFailed, true, 'Validation error should be triggered for invalid bounds');

    console.log('✓ Test 4 Passed: Model validation boundaries and required fields verified.');
  }

  // Test 5: Compound Indexes Declaration
  {
    const indexes = TemporalPreference.schema.indexes();
    const indexFields = indexes.map((idx) => Object.keys(idx[0]));

    const hasUserTimeScore = indexFields.some(
      (keys) => keys.includes('userId') && keys.includes('timeWindow') && keys.includes('preferenceScore')
    );
    const hasUserGenreTime = indexFields.some(
      (keys) => keys.includes('userId') && keys.includes('genre') && keys.includes('timeWindow')
    );
    const hasUserArtistTime = indexFields.some(
      (keys) => keys.includes('userId') && keys.includes('artist') && keys.includes('timeWindow')
    );
    const hasUserMoodTime = indexFields.some(
      (keys) => keys.includes('userId') && keys.includes('mood') && keys.includes('timeWindow')
    );
    const hasUserLastInteraction = indexFields.some(
      (keys) => keys.includes('userId') && keys.includes('lastInteractionAt')
    );

    assert.ok(hasUserTimeScore, 'Index { userId, timeWindow, preferenceScore } must exist');
    assert.ok(hasUserGenreTime, 'Index { userId, genre, timeWindow } must exist');
    assert.ok(hasUserArtistTime, 'Index { userId, artist, timeWindow } must exist');
    assert.ok(hasUserMoodTime, 'Index { userId, mood, timeWindow } must exist');
    assert.ok(hasUserLastInteraction, 'Index { userId, lastInteractionAt } must exist');

    console.log('✓ Test 5 Passed: All required temporal compound indexes verified.');
  }

  // Test 6: Alias Compatibility ('user' and 'userId')
  {
    const userId = new Types.ObjectId();
    const prefWithUserAlias = new TemporalPreference({
      user: userId,
      preferenceScore: 0.60,
      interactionCount: 3,
      timeWindow: 'short_term',
    });

    assert.strictEqual(prefWithUserAlias.userId.toString(), userId.toString());
    assert.strictEqual(prefWithUserAlias.user?.toString(), userId.toString());
    console.log('✓ Test 6 Passed: Alias user/userId bidirectional compatibility verified.');
  }

  console.log('🎉 ALL Temporal Preference Model tests completed successfully.');
}
