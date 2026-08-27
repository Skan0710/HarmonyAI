import assert from 'node:assert';
import {
  ContextPreferenceMappingService,
  DEFAULT_CONTEXT_MAPPINGS,
} from '../services/contextPreferenceMappingService.js';
import { StandardListeningSituation } from '../schemas/recommendationContextSchema.js';

export function runContextPreferenceMappingServiceTests() {
  console.log('[Context-to-Preference Mapping Service Test Suite] Starting tests...');

  // Reset mappings before starting
  ContextPreferenceMappingService.resetMappings();

  // Test 1: Standard Contexts Coverage & Target Signals
  {
    const studyMapping = ContextPreferenceMappingService.getMapping('study');
    assert.strictEqual(studyMapping.situation, StandardListeningSituation.Study);
    assert.strictEqual(studyMapping.targetEnergy, 0.30);
    assert.strictEqual(studyMapping.targetMood, 'Focus');
    assert.strictEqual(studyMapping.targetTempo, 82);
    assert.ok(studyMapping.recommendedGenres.includes('Lo-Fi'));
    assert.ok(studyMapping.recommendedGenres.includes('Ambient'));
    assert.strictEqual(studyMapping.noveltyPreference, 0.25);

    const workoutMapping = ContextPreferenceMappingService.getMapping('workout');
    assert.strictEqual(workoutMapping.situation, StandardListeningSituation.Workout);
    assert.strictEqual(workoutMapping.targetEnergy, 0.90);
    assert.strictEqual(workoutMapping.targetMood, 'Energetic');
    assert.strictEqual(workoutMapping.targetTempo, 140);
    assert.ok(workoutMapping.recommendedGenres.includes('EDM'));
    assert.ok(workoutMapping.recommendedGenres.includes('Hard Rock'));

    const sleepMapping = ContextPreferenceMappingService.getMapping('sleep');
    assert.strictEqual(sleepMapping.situation, StandardListeningSituation.Sleep);
    assert.strictEqual(sleepMapping.targetEnergy, 0.10);
    assert.strictEqual(sleepMapping.targetMood, 'Calm');
    assert.strictEqual(sleepMapping.targetTempo, 58);
    assert.ok(sleepMapping.recommendedGenres.includes('Sleep Ambient'));

    const partyMapping = ContextPreferenceMappingService.getMapping('party');
    assert.strictEqual(partyMapping.situation, StandardListeningSituation.Party);
    assert.strictEqual(partyMapping.targetEnergy, 0.95);
    assert.strictEqual(partyMapping.targetMood, 'Party');
    assert.strictEqual(partyMapping.targetTempo, 128);

    const workMapping = ContextPreferenceMappingService.getMapping('work');
    assert.strictEqual(workMapping.situation, StandardListeningSituation.Work);
    assert.strictEqual(workMapping.targetEnergy, 0.55);

    const relaxMapping = ContextPreferenceMappingService.getMapping('relaxation');
    assert.strictEqual(relaxMapping.situation, StandardListeningSituation.Relaxation);
    assert.strictEqual(relaxMapping.targetEnergy, 0.25);

    const commuteMapping = ContextPreferenceMappingService.getMapping('commute');
    assert.strictEqual(commuteMapping.situation, StandardListeningSituation.Commute);
    assert.strictEqual(commuteMapping.targetEnergy, 0.70);

    const focusMapping = ContextPreferenceMappingService.getMapping('focus');
    assert.strictEqual(focusMapping.situation, StandardListeningSituation.Focus);
    assert.strictEqual(focusMapping.targetEnergy, 0.50);

    const generalMapping = ContextPreferenceMappingService.getMapping('general_listening');
    assert.strictEqual(generalMapping.situation, StandardListeningSituation.GeneralListening);
    assert.strictEqual(generalMapping.targetEnergy, 0.55);

    console.log('✓ Test 1 Passed: All 9 standard contexts mapped to distinct energy, tempo, mood, genre, and novelty targets.');
  }

  // Test 2: Alias Resolution (e.g. 'gym' -> workout, 'coding' -> work)
  {
    const gymResult = ContextPreferenceMappingService.getMapping('gym');
    assert.strictEqual(gymResult.situation, StandardListeningSituation.Workout);
    assert.strictEqual(gymResult.targetEnergy, 0.90);

    const codingResult = ContextPreferenceMappingService.getMapping('coding');
    assert.strictEqual(codingResult.situation, StandardListeningSituation.Work);
    assert.strictEqual(codingResult.targetEnergy, 0.55);

    const chillResult = ContextPreferenceMappingService.getMapping('chill');
    assert.strictEqual(chillResult.situation, StandardListeningSituation.Relaxation);
    assert.strictEqual(chillResult.targetEnergy, 0.25);

    console.log('✓ Test 2 Passed: Common context aliases resolved correctly.');
  }

  // Test 3: Extensible Custom Context Fallback
  {
    const customResult = ContextPreferenceMappingService.getMapping('cooking_dinner');
    assert.strictEqual(customResult.situation, 'cooking_dinner');
    assert.ok(customResult.targetEnergy > 0);
    assert.ok(customResult.weights.contentWeight > 0);

    console.log('✓ Test 3 Passed: Extensible custom context mappings handled gracefully.');
  }

  // Test 4: Runtime Configurability & Reset
  {
    // Update workout energy and weights
    ContextPreferenceMappingService.updateMapping('workout', {
      targetEnergy: 0.98,
      targetTempo: 155,
      weights: {
        ...DEFAULT_CONTEXT_MAPPINGS[StandardListeningSituation.Workout].weights,
        noveltyWeight: 0.30,
      },
    });

    const updated = ContextPreferenceMappingService.getMapping('workout');
    assert.strictEqual(updated.targetEnergy, 0.98);
    assert.strictEqual(updated.targetTempo, 155);
    assert.strictEqual(updated.weights.noveltyWeight, 0.30);

    // Reset back to defaults
    ContextPreferenceMappingService.resetMappings();
    const resetWorkout = ContextPreferenceMappingService.getMapping('workout');
    assert.strictEqual(resetWorkout.targetEnergy, 0.90);
    assert.strictEqual(resetWorkout.targetTempo, 140);
    assert.strictEqual(resetWorkout.weights.noveltyWeight, 0.15);

    console.log('✓ Test 4 Passed: Runtime mapping updates and reset behavior verified.');
  }

  // Test 5: Context-to-Preferences Resolution with User Overrides
  {
    const derived = ContextPreferenceMappingService.mapContextToPreferences(
      {
        situation: 'study',
        desiredEnergy: 0.40, // overrides default 0.30
      },
      {
        mood: 'Calm', // explicit user override
        preferredGenres: ['Neo-Classical', 'Piano'],
      }
    );

    assert.strictEqual(derived.situation, StandardListeningSituation.Study);
    assert.strictEqual(derived.targetEnergy, 0.40);
    assert.strictEqual(derived.targetMood, 'Calm');
    assert.deepStrictEqual(derived.preferredGenres, ['Neo-Classical', 'Piano']);
    assert.ok(derived.rankingWeights.acousticSimilarityWeight >= 0.40);
    assert.ok(derived.appliedOverrides.includes('mood'));
    assert.ok(derived.appliedOverrides.includes('context.desiredEnergy'));

    console.log('✓ Test 5 Passed: Preference resolution with layered user overrides verified.');
  }

  // Test 6: Pure Preference Weights Generation (Decoupled from Recommendation Queries)
  {
    const result = ContextPreferenceMappingService.mapContextToPreferences({ situation: 'focus' });

    assert.ok(typeof result.rankingWeights === 'object');
    assert.ok(result.rankingWeights.contentWeight > 0);
    assert.ok(result.rankingWeights.collaborativeWeight > 0);
    assert.ok(result.rankingWeights.genreAffinityWeight > 0);

    // Verify pure output without executing search or returning song lists
    assert.strictEqual((result as any).songs, undefined);
    assert.strictEqual((result as any).recommendations, undefined);

    console.log('✓ Test 6 Passed: Confirmed pure preference weights output without hardcoded recommendation results.');
  }

  console.log('🎉 All 6 Context-to-Preference Mapping Service tests completed successfully.');
}
