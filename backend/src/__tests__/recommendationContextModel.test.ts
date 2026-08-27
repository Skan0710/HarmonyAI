import assert from 'node:assert';
import { Types } from 'mongoose';
import {
  StandardListeningSituation,
  STANDARD_SITUATIONS,
  normalizeListeningSituation,
  validateAndSanitizeRecommendationContext,
  RecommendationContextAttributes,
} from '../schemas/recommendationContextSchema.js';
import { RecommendationContext } from '../models/RecommendationContext.js';

export function runRecommendationContextModelTests() {
  console.log('[Recommendation Context Model Test Suite] Starting tests...');

  // Test 1: Standard Listening Situations Normalization & Aliases
  {
    const testCases: [string, StandardListeningSituation][] = [
      ['study', StandardListeningSituation.Study],
      ['studying', StandardListeningSituation.Study],
      ['work', StandardListeningSituation.Work],
      ['coding', StandardListeningSituation.Work],
      ['workout', StandardListeningSituation.Workout],
      ['gym', StandardListeningSituation.Workout],
      ['relaxation', StandardListeningSituation.Relaxation],
      ['chill', StandardListeningSituation.Relaxation],
      ['commute', StandardListeningSituation.Commute],
      ['driving', StandardListeningSituation.Commute],
      ['party', StandardListeningSituation.Party],
      ['sleep', StandardListeningSituation.Sleep],
      ['bedtime', StandardListeningSituation.Sleep],
      ['focus', StandardListeningSituation.Focus],
      ['deep_focus', StandardListeningSituation.Focus],
      ['general listening', StandardListeningSituation.GeneralListening],
      ['general_listening', StandardListeningSituation.GeneralListening],
      ['casual', StandardListeningSituation.GeneralListening],
    ];

    for (const [input, expected] of testCases) {
      const normalized = normalizeListeningSituation(input);
      assert.strictEqual(
        normalized,
        expected,
        `Expected situation '${input}' to normalize to '${expected}', got '${normalized}'`
      );
    }

    assert.strictEqual(STANDARD_SITUATIONS.length, 9);
    console.log('✓ Test 1 Passed: All 9 standard listening situations and common aliases normalized correctly.');
  }

  // Test 2: Extensible Custom Context Support
  {
    const customSituations = ['cooking_dinner', 'gaming_session', 'meditation', 'road_trip', 'coffee_shop'];

    for (const custom of customSituations) {
      const normalized = normalizeListeningSituation(custom);
      assert.strictEqual(normalized, custom, `Custom situation '${custom}' must be preserved for extensibility`);

      const validated = validateAndSanitizeRecommendationContext({ situation: custom });
      assert.strictEqual(validated.isValid, true);
      assert.strictEqual(validated.sanitized.situation, custom);
    }

    console.log('✓ Test 2 Passed: Custom contexts preserved cleanly without rejection.');
  }

  // Test 3: Optional Attributes Validation & Sanitization (mood, energy, tempo, genres, discovery)
  {
    const rawContext = {
      situation: 'workout',
      mood: '  High Energy  ',
      desiredEnergy: '0.85',
      desiredTempo: '140',
      preferredGenres: ['Synthwave', 'EDM', 'Synthwave', '  Rock  ', ''],
      discoveryLevel: '0.35',
      timeOfDay: 'Evening',
      targetDurationMinutes: '45',
      metadata: {
        equipment: 'Treadmill',
        heartRateZone: 4,
      },
    };

    const result = validateAndSanitizeRecommendationContext(rawContext);

    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.sanitized.situation, StandardListeningSituation.Workout);
    assert.strictEqual(result.sanitized.mood, 'High Energy');
    assert.strictEqual(result.sanitized.desiredEnergy, 0.85);
    assert.strictEqual(result.sanitized.desiredTempo, 140);
    assert.deepStrictEqual(result.sanitized.preferredGenres, ['Synthwave', 'EDM', 'Rock']);
    assert.strictEqual(result.sanitized.discoveryLevel, 0.35);
    assert.strictEqual(result.sanitized.timeOfDay, 'evening');
    assert.strictEqual(result.sanitized.targetDurationMinutes, 45);
    assert.strictEqual(result.sanitized.metadata?.equipment, 'Treadmill');
    assert.strictEqual(result.sanitized.metadata?.heartRateZone, 4);

    console.log('✓ Test 3 Passed: Optional attributes parsed, typed, and sanitized correctly.');
  }

  // Test 4: Numeric Clamping and Error Validation
  {
    // Out-of-bounds energy & tempo clamped safely
    const clampedInput = {
      situation: 'study',
      desiredEnergy: 1.5, // should clamp to 1.0
      desiredTempo: 20, // should clamp to 30
      discoveryLevel: -0.5, // should clamp to 0.0
    };

    const clampedResult = validateAndSanitizeRecommendationContext(clampedInput);
    assert.strictEqual(clampedResult.isValid, true);
    assert.strictEqual(clampedResult.sanitized.desiredEnergy, 1.0);
    assert.strictEqual(clampedResult.sanitized.desiredTempo, 30);
    assert.strictEqual(clampedResult.sanitized.discoveryLevel, 0.0);

    // Invalid non-numeric values return errors
    const invalidInput = {
      situation: 'focus',
      desiredEnergy: 'not-a-number',
      desiredTempo: 'invalid-tempo',
      discoveryLevel: 'nan',
    };

    const invalidResult = validateAndSanitizeRecommendationContext(invalidInput);
    assert.strictEqual(invalidResult.isValid, false);
    assert.strictEqual(invalidResult.errors.length, 3);

    console.log('✓ Test 4 Passed: Numeric clamping and error detection validated.');
  }

  // Test 5: Mongoose Model Instantiation & Schema Defaults
  {
    const userId = new Types.ObjectId();
    const contextDoc = new RecommendationContext({
      user: userId,
      name: 'Evening Coding Focus',
      situation: 'coding', // will trigger pre-save / set to 'work'
      mood: 'Deep Focus',
      desiredEnergy: 0.65,
      desiredTempo: 120,
      preferredGenres: ['Ambient', 'Lo-Fi'],
      discoveryLevel: 0.20,
      isPreset: true,
      metadata: { ide: 'VSCode' },
    });

    assert.strictEqual(contextDoc.situation, StandardListeningSituation.Work);
    assert.strictEqual(contextDoc.mood, 'Deep Focus');
    assert.strictEqual(contextDoc.desiredEnergy, 0.65);
    assert.strictEqual(contextDoc.desiredTempo, 120);
    assert.strictEqual(contextDoc.isPreset, true);
    assert.strictEqual(contextDoc.user?.toString(), userId.toString());
    assert.strictEqual(contextDoc.metadata?.ide, 'VSCode');

    console.log('✓ Test 5 Passed: Mongoose model instantiation, hooks, and defaults verified.');
  }

  // Test 6: Verify No Hardcoded Recommendation Results in Context Representation
  {
    const context = validateAndSanitizeRecommendationContext({
      situation: 'party',
      mood: 'Upbeat',
      desiredEnergy: 0.95,
      preferredGenres: ['Dance Pop', 'House'],
    });

    // The context representation must strictly represent the situational requirements,
    // not hardcoded track IDs or precomputed song lists.
    const serializedKeys = Object.keys(context.sanitized);
    assert.strictEqual(serializedKeys.includes('recommendedSongs'), false);
    assert.strictEqual(serializedKeys.includes('trackList'), false);
    assert.strictEqual(serializedKeys.includes('results'), false);

    console.log('✓ Test 6 Passed: Verified context representation is decoupled from hardcoded recommendation results.');
  }

  console.log('🎉 All 6 Recommendation Context Model tests completed successfully.');
}
