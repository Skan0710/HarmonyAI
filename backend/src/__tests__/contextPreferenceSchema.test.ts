import assert from 'node:assert';
import {
  validateAndSanitizeContextPreference,
  ContextMood,
  ContextActivity,
  ContextTimeOfDay,
  ContextInstrumentalPreference,
} from '../schemas/contextPreferenceSchema.js';

export function runContextPreferenceSchemaTests() {
  console.log('[Context Preference Schema Test Suite] Starting tests...');

  // Test 1: Full Valid Context Preference Sanitization
  {
    const rawInput = {
      mood: 'energetic',
      activity: 'workout',
      energyLevel: 0.9,
      timeOfDay: 'morning',
      preferredDurationMinutes: 45,
      language: 'English',
      instrumentalPreference: 'instrumentalonly',
    };

    const sanitized = validateAndSanitizeContextPreference(rawInput);

    assert.strictEqual(sanitized.mood, ContextMood.Energetic);
    assert.strictEqual(sanitized.activity, ContextActivity.Workout);
    assert.strictEqual(sanitized.energyLevel, 0.9);
    assert.strictEqual(sanitized.timeOfDay, ContextTimeOfDay.Morning);
    assert.strictEqual(sanitized.preferredDurationMinutes, 45);
    assert.strictEqual(sanitized.language, 'English');
    assert.strictEqual(sanitized.instrumentalPreference, ContextInstrumentalPreference.InstrumentalOnly);

    console.log('✓ Test 1 Passed: Full valid context preference sanitization verified.');
  }

  // Test 2: Invalid Enum Values & Numeric Clamping
  {
    const rawInput = {
      mood: 'invalid_mood_string',
      energyLevel: 2.5, // Exceeds max 1.0 -> should clamp to 1.0
      preferredDurationMinutes: 999, // Exceeds max 300 -> should clamp to 300
    };

    const sanitized = validateAndSanitizeContextPreference(rawInput);

    assert.strictEqual(sanitized.mood, undefined, 'Invalid mood string returns undefined');
    assert.strictEqual(sanitized.energyLevel, 1.0, 'Excessive energy level clamped to 1.0');
    assert.strictEqual(sanitized.preferredDurationMinutes, 300, 'Excessive duration clamped to 300');
    assert.strictEqual(sanitized.instrumentalPreference, ContextInstrumentalPreference.Any);

    console.log('✓ Test 2 Passed: Invalid enum handling & numeric clamping verified.');
  }

  // Test 3: Optional Properties Handling
  {
    const minimalInput = {};

    const sanitized = validateAndSanitizeContextPreference(minimalInput);

    assert.strictEqual(sanitized.mood, undefined);
    assert.strictEqual(sanitized.activity, undefined);
    assert.strictEqual(sanitized.energyLevel, undefined);
    assert.strictEqual(sanitized.instrumentalPreference, ContextInstrumentalPreference.Any);

    console.log('✓ Test 3 Passed: Optional properties handling verified.');
  }

  console.log('🎉 All context preference schema tests completed successfully.');
}
