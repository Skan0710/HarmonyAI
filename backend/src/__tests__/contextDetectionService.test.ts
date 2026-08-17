import assert from 'node:assert';
import { ContextDetectionService } from '../services/contextDetectionService.js';
import {
  ContextTimeOfDay,
  ContextMood,
  ContextActivity,
} from '../schemas/contextPreferenceSchema.js';

export function runContextDetectionServiceTests() {
  console.log('[Context Detection Service Test Suite] Starting tests...');

  // Test 1: Deterministic Time-of-Day Detection
  {
    const morningDate = new Date('2026-08-17T08:30:00'); // 8:30 AM
    const afternoonDate = new Date('2026-08-17T14:15:00'); // 2:15 PM
    const eveningDate = new Date('2026-08-17T19:00:00'); // 7:00 PM
    const nightDateLate = new Date('2026-08-17T23:45:00'); // 11:45 PM
    const nightDateEarly = new Date('2026-08-17T03:10:00'); // 3:10 AM

    assert.strictEqual(
      ContextDetectionService.detectTimeOfDayCategory(morningDate),
      ContextTimeOfDay.Morning
    );
    assert.strictEqual(
      ContextDetectionService.detectTimeOfDayCategory(afternoonDate),
      ContextTimeOfDay.Afternoon
    );
    assert.strictEqual(
      ContextDetectionService.detectTimeOfDayCategory(eveningDate),
      ContextTimeOfDay.Evening
    );
    assert.strictEqual(
      ContextDetectionService.detectTimeOfDayCategory(nightDateLate),
      ContextTimeOfDay.Night
    );
    assert.strictEqual(
      ContextDetectionService.detectTimeOfDayCategory(nightDateEarly),
      ContextTimeOfDay.Night
    );

    console.log('✓ Test 1 Passed: Deterministic time-of-day category detection verified.');
  }

  // Test 2: Merging Explicit Context & Time-of-Day Detection
  {
    const date = new Date('2026-08-17T09:00:00'); // Morning
    const explicit = {
      activity: ContextActivity.Workout,
    };

    const context = ContextDetectionService.detectCurrentContext({
      date,
      explicitContext: explicit,
    });

    assert.strictEqual(context.timeOfDay, ContextTimeOfDay.Morning);
    assert.strictEqual(context.activity, ContextActivity.Workout);
    assert.strictEqual(context.mood, ContextMood.Energetic, 'Derived Energetic mood from Workout activity');
    assert.strictEqual(context.energyLevel, 0.85, 'Derived high energy level from Workout activity');

    console.log('✓ Test 2 Passed: Explicit context merging & activity heuristics verified.');
  }

  // Test 3: Overriding Derived Activity Heuristics with Explicit Mood & Energy
  {
    const date = new Date('2026-08-17T15:00:00'); // Afternoon
    const explicit = {
      activity: ContextActivity.Study,
      mood: ContextMood.Chill, // Overrides default Focus mood
      energyLevel: 0.2, // Overrides default 0.50 energy
    };

    const context = ContextDetectionService.detectCurrentContext({
      date,
      explicitContext: explicit,
    });

    assert.strictEqual(context.timeOfDay, ContextTimeOfDay.Afternoon);
    assert.strictEqual(context.activity, ContextActivity.Study);
    assert.strictEqual(context.mood, ContextMood.Chill, 'Explicit Chill mood preserved');
    assert.strictEqual(context.energyLevel, 0.2, 'Explicit energy level preserved');

    console.log('✓ Test 3 Passed: Explicit overrides of derived heuristics verified.');
  }

  console.log('🎉 All context detection service tests completed successfully.');
}
