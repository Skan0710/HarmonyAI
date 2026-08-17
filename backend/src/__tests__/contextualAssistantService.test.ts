import assert from 'node:assert';
import { ContextualAssistantService } from '../services/contextualAssistantService.js';
import { ContextMood, ContextActivity, ContextTimeOfDay } from '../schemas/contextPreferenceSchema.js';

export function runContextualAssistantServiceTests() {
  console.log('[Contextual Assistant Service Test Suite] Starting tests...');

  // Test 1: Extracting Context from "Give me something calm for late-night studying."
  {
    const prompt = 'Give me something calm for late-night studying.';
    const extracted = ContextualAssistantService.extractContextRuleBased(prompt);

    assert.strictEqual(extracted.mood, ContextMood.Calm, 'Extracted Calm mood');
    assert.strictEqual(extracted.activity, ContextActivity.Study, 'Extracted Study activity');
    assert.strictEqual(extracted.timeOfDay, ContextTimeOfDay.LateNight, 'Extracted LateNight time of day');

    console.log('✓ Test 1 Passed: Natural-language extraction ("Give me something calm for late-night studying.") verified.');
  }

  // Test 2: Natural-Language Workout Prompt Extraction
  {
    const prompt = 'High energy tracks for morning gym workout';
    const extracted = ContextualAssistantService.extractContextRuleBased(prompt);

    assert.strictEqual(extracted.mood, ContextMood.Energetic, 'Extracted Energetic mood');
    assert.strictEqual(extracted.activity, ContextActivity.Workout, 'Extracted Workout activity');
    assert.strictEqual(extracted.timeOfDay, ContextTimeOfDay.Morning, 'Extracted Morning time of day');
    assert.strictEqual(extracted.energyLevel, 0.85, 'Extracted high energy level');

    console.log('✓ Test 2 Passed: Natural-language workout prompt extraction verified.');
  }

  // Test 3: Structured Context Output without Fake Song Names
  {
    const prompt = 'Instrumental lo-fi beats for late-night coding';
    const extracted = ContextualAssistantService.extractContextRuleBased(prompt);

    assert.strictEqual(extracted.activity, ContextActivity.Coding);
    assert.strictEqual(extracted.timeOfDay, ContextTimeOfDay.LateNight);

    // Verify structured context does not contain arbitrary song titles
    assert.ok(!('songTitle' in extracted), 'Does not generate arbitrary song names');
    assert.ok(!('artists' in extracted), 'Does not invent artist names');

    console.log('✓ Test 3 Passed: Verified LLM/NLP output contains structured context without fake song names.');
  }

  console.log('🎉 All contextual assistant service tests completed successfully.');
}
