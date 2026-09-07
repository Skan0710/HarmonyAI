import assert from 'node:assert';
import {
  ListenerArchetypeEngine,
  ARCHETYPE_DEFINITIONS,
  DEFAULT_ARCHETYPE_ENGINE_CONFIG,
  getArchetypeEngineConfig,
  updateArchetypeEngineConfig,
  resetArchetypeEngineConfig,
  type ListenerArchetypeType,
  type ArchetypeSignalInputs,
} from '../services/listenerArchetypeEngine.js';

export async function runListenerArchetypeEngineTests() {
  console.log('[Listener Archetype Engine Test Suite] Starting tests...\n');

  // Reset config before running tests to ensure clean state
  resetArchetypeEngineConfig();

  // ---------------------------------------------------------------------------
  // Test 1: Explorer Behavior Pattern
  // ---------------------------------------------------------------------------
  console.log('Test 1: Explorer behavior pattern detection');
  {
    const inputs: ArchetypeSignalInputs = {
      userId: 'test-user-explorer',
      explorationTendency: 0.94,
      artistDiversity: 0.90,
      genreDiversity: 0.85,
      noveltyPreference: 0.62,
      recentTasteChanges: 0.40,
      repeatListeningTendency: 0.10,
      familiarityPreference: 0.12,
      preferenceStability: 0.45,
      moodFocusScore: 0.35,
      interactionCount: 45,
      isDataSufficient: true,
    };

    const result = ListenerArchetypeEngine.determineArchetypeFromSignals(inputs);

    assert.strictEqual(result.primaryArchetype, 'Explorer');
    assert.strictEqual(result.isFallback, false);
    assert.ok(result.confidenceScore >= 0.5, `Confidence score should be solid: ${result.confidenceScore}`);
    assert.strictEqual(result.title, ARCHETYPE_DEFINITIONS['Explorer'].title);
    assert.ok(result.primaryTraits.includes('High Novelty'));
    assert.ok(result.explanation.includes('Explorer'));

    console.log(`✓ Test 1 Passed: Correctly identified Explorer (confidence: ${(result.confidenceScore * 100).toFixed(0)}%).`);
  }

  // ---------------------------------------------------------------------------
  // Test 2: Loyal Listener Behavior Pattern
  // ---------------------------------------------------------------------------
  console.log('\nTest 2: Loyal Listener behavior pattern detection');
  {
    const inputs: ArchetypeSignalInputs = {
      userId: 'test-user-loyal',
      repeatListeningTendency: 0.95,
      familiarityPreference: 0.90,
      preferenceStability: 0.88,
      artistDiversity: 0.15,
      genreDiversity: 0.25,
      explorationTendency: 0.10,
      noveltyPreference: 0.12,
      recentTasteChanges: 0.10,
      moodFocusScore: 0.30,
      interactionCount: 60,
      isDataSufficient: true,
    };

    const result = ListenerArchetypeEngine.determineArchetypeFromSignals(inputs);

    assert.strictEqual(result.primaryArchetype, 'Loyal Listener');
    assert.strictEqual(result.isFallback, false);
    assert.ok(result.confidenceScore >= 0.5);
    assert.strictEqual(result.title, ARCHETYPE_DEFINITIONS['Loyal Listener'].title);
    assert.ok(result.primaryTraits.includes('Deep Artist Loyalty'));
    assert.ok(result.explanation.includes('Loyal Listener') || result.explanation.includes('Devoted Loyalist'));

    console.log(`✓ Test 2 Passed: Correctly identified Loyal Listener (confidence: ${(result.confidenceScore * 100).toFixed(0)}%).`);
  }

  // ---------------------------------------------------------------------------
  // Test 3: Mood Listener Behavior Pattern
  // ---------------------------------------------------------------------------
  console.log('\nTest 3: Mood Listener behavior pattern detection');
  {
    const inputs: ArchetypeSignalInputs = {
      userId: 'test-user-mood',
      moodFocusScore: 0.96,
      genreDiversity: 0.55,
      preferenceStability: 0.65,
      familiarityPreference: 0.50,
      explorationTendency: 0.35,
      repeatListeningTendency: 0.40,
      noveltyPreference: 0.45,
      artistDiversity: 0.50,
      recentTasteChanges: 0.30,
      interactionCount: 35,
      isDataSufficient: true,
    };

    const result = ListenerArchetypeEngine.determineArchetypeFromSignals(inputs);

    assert.strictEqual(result.primaryArchetype, 'Mood Listener');
    assert.strictEqual(result.isFallback, false);
    assert.strictEqual(result.title, ARCHETYPE_DEFINITIONS['Mood Listener'].title);
    assert.ok(result.primaryTraits.includes('Atmospheric Sensitivity') || result.primaryTraits.includes('Emotionally Driven'));

    console.log(`✓ Test 3 Passed: Correctly identified Mood Listener (confidence: ${(result.confidenceScore * 100).toFixed(0)}%).`);
  }

  // ---------------------------------------------------------------------------
  // Test 4: Genre Hopper Behavior Pattern
  // ---------------------------------------------------------------------------
  console.log('\nTest 4: Genre Hopper behavior pattern detection');
  {
    const inputs: ArchetypeSignalInputs = {
      userId: 'test-user-genre-hopper',
      genreDiversity: 0.98,
      explorationTendency: 0.78,
      recentTasteChanges: 0.82,
      artistDiversity: 0.80,
      preferenceStability: 0.18,
      repeatListeningTendency: 0.15,
      familiarityPreference: 0.20,
      noveltyPreference: 0.60,
      moodFocusScore: 0.40,
      interactionCount: 50,
      isDataSufficient: true,
    };

    const result = ListenerArchetypeEngine.determineArchetypeFromSignals(inputs);

    assert.strictEqual(result.primaryArchetype, 'Genre Hopper');
    assert.strictEqual(result.isFallback, false);
    assert.strictEqual(result.title, ARCHETYPE_DEFINITIONS['Genre Hopper'].title);
    assert.ok(result.primaryTraits.includes('High Genre Diversity'));

    console.log(`✓ Test 4 Passed: Correctly identified Genre Hopper (confidence: ${(result.confidenceScore * 100).toFixed(0)}%).`);
  }

  // ---------------------------------------------------------------------------
  // Test 5: Discovery Seeker Behavior Pattern
  // ---------------------------------------------------------------------------
  console.log('\nTest 5: Discovery Seeker behavior pattern detection');
  {
    const inputs: ArchetypeSignalInputs = {
      userId: 'test-user-discovery-seeker',
      noveltyPreference: 0.96,
      explorationTendency: 0.65,
      artistDiversity: 0.70,
      recentTasteChanges: 0.40,
      repeatListeningTendency: 0.08,
      familiarityPreference: 0.18,
      preferenceStability: 0.45,
      genreDiversity: 0.40,
      moodFocusScore: 0.35,
      interactionCount: 40,
      isDataSufficient: true,
    };

    const result = ListenerArchetypeEngine.determineArchetypeFromSignals(inputs);

    assert.strictEqual(result.primaryArchetype, 'Discovery Seeker');
    assert.strictEqual(result.isFallback, false);
    assert.strictEqual(result.title, ARCHETYPE_DEFINITIONS['Discovery Seeker'].title);
    assert.ok(result.primaryTraits.includes('Novelty Drive') || result.primaryTraits.includes('Freshness Focused'));

    console.log(`✓ Test 5 Passed: Correctly identified Discovery Seeker (confidence: ${(result.confidenceScore * 100).toFixed(0)}%).`);
  }

  // ---------------------------------------------------------------------------
  // Test 6: Comfort Listener Behavior Pattern
  // ---------------------------------------------------------------------------
  console.log('\nTest 6: Comfort Listener behavior pattern detection');
  {
    const inputs: ArchetypeSignalInputs = {
      userId: 'test-user-comfort',
      familiarityPreference: 0.94,
      preferenceStability: 0.95,
      recentTasteChanges: 0.05,
      repeatListeningTendency: 0.55,
      explorationTendency: 0.08,
      noveltyPreference: 0.10,
      genreDiversity: 0.30,
      artistDiversity: 0.35,
      moodFocusScore: 0.30,
      interactionCount: 55,
      isDataSufficient: true,
    };

    const result = ListenerArchetypeEngine.determineArchetypeFromSignals(inputs);

    assert.strictEqual(result.primaryArchetype, 'Comfort Listener');
    assert.strictEqual(result.isFallback, false);
    assert.strictEqual(result.title, ARCHETYPE_DEFINITIONS['Comfort Listener'].title);
    assert.ok(result.primaryTraits.includes('Familiarity Affinity') || result.primaryTraits.includes('Emotional Grounding'));

    console.log(`✓ Test 6 Passed: Correctly identified Comfort Listener (confidence: ${(result.confidenceScore * 100).toFixed(0)}%).`);
  }

  // ---------------------------------------------------------------------------
  // Test 7: Balanced Listener Behavior Pattern
  // ---------------------------------------------------------------------------
  console.log('\nTest 7: Balanced Listener behavior pattern detection');
  {
    const inputs: ArchetypeSignalInputs = {
      userId: 'test-user-balanced',
      explorationTendency: 0.51,
      repeatListeningTendency: 0.49,
      genreDiversity: 0.50,
      artistDiversity: 0.50,
      noveltyPreference: 0.50,
      familiarityPreference: 0.50,
      preferenceStability: 0.52,
      recentTasteChanges: 0.25,
      moodFocusScore: 0.40,
      interactionCount: 30,
      isDataSufficient: true,
    };

    const result = ListenerArchetypeEngine.determineArchetypeFromSignals(inputs);

    assert.strictEqual(result.primaryArchetype, 'Balanced Listener');
    assert.strictEqual(result.isFallback, false);
    assert.strictEqual(result.title, ARCHETYPE_DEFINITIONS['Balanced Listener'].title);
    assert.ok(result.primaryTraits.includes('Well-Rounded Palette'));

    console.log(`✓ Test 7 Passed: Correctly identified Balanced Listener (confidence: ${(result.confidenceScore * 100).toFixed(0)}%).`);
  }

  // ---------------------------------------------------------------------------
  // Test 8: Insufficient Data / Cold Start Fallback
  // ---------------------------------------------------------------------------
  console.log('\nTest 8: Cold start and insufficient interaction history fallback');
  {
    // Case A: Explicit isDataSufficient = false
    const fallbackResultA = ListenerArchetypeEngine.determineArchetypeFromSignals({
      userId: 'cold-user-1',
      isDataSufficient: false,
      interactionCount: 2,
    });

    assert.strictEqual(fallbackResultA.isFallback, true);
    assert.strictEqual(fallbackResultA.primaryArchetype, DEFAULT_ARCHETYPE_ENGINE_CONFIG.fallbackArchetype);
    assert.strictEqual(fallbackResultA.confidenceScore, DEFAULT_ARCHETYPE_ENGINE_CONFIG.minConfidenceFloor);
    assert.ok(fallbackResultA.explanation.includes('insufficient'));

    // Case B: Interaction count below threshold (< 10)
    const fallbackResultB = ListenerArchetypeEngine.determineArchetypeFromSignals({
      userId: 'cold-user-2',
      interactionCount: 4,
      explorationTendency: 0.99, // signals should be ignored if data is insufficient
    });

    assert.strictEqual(fallbackResultB.isFallback, true);
    assert.strictEqual(fallbackResultB.primaryArchetype, 'Balanced Listener');
    assert.strictEqual(fallbackResultB.confidenceScore, 0.15);

    console.log('✓ Test 8 Passed: Cold start scenarios reliably trigger balanced fallback profile with baseline confidence floor.');
  }

  // ---------------------------------------------------------------------------
  // Test 9: Configurable & Modular Engine Tuning
  // ---------------------------------------------------------------------------
  console.log('\nTest 9: Configurable parameters, runtime overrides, and resets');
  {
    // Update global config
    updateArchetypeEngineConfig({
      fallbackArchetype: 'Comfort Listener',
      minInteractionThreshold: 20,
      minConfidenceFloor: 0.25,
    });

    const activeConfig = getArchetypeEngineConfig();
    assert.strictEqual(activeConfig.fallbackArchetype, 'Comfort Listener');
    assert.strictEqual(activeConfig.minInteractionThreshold, 20);
    assert.strictEqual(activeConfig.minConfidenceFloor, 0.25);

    // Verify user with 15 interactions is now treated as insufficient under new threshold
    const modifiedThresholdResult = ListenerArchetypeEngine.determineArchetypeFromSignals({
      userId: 'user-with-15-plays',
      interactionCount: 15,
    });
    assert.strictEqual(modifiedThresholdResult.isFallback, true);
    assert.strictEqual(modifiedThresholdResult.primaryArchetype, 'Comfort Listener');
    assert.strictEqual(modifiedThresholdResult.confidenceScore, 0.25);

    // Per-call override
    const overriddenResult = ListenerArchetypeEngine.determineArchetypeFromSignals(
      {
        userId: 'override-user',
        interactionCount: 5,
      },
      {
        fallbackArchetype: 'Explorer',
        minConfidenceFloor: 0.30,
      }
    );
    assert.strictEqual(overriddenResult.primaryArchetype, 'Explorer');
    assert.strictEqual(overriddenResult.confidenceScore, 0.30);

    // Reset to defaults
    resetArchetypeEngineConfig();
    const restoredConfig = getArchetypeEngineConfig();
    assert.strictEqual(restoredConfig.fallbackArchetype, 'Balanced Listener');
    assert.strictEqual(restoredConfig.minInteractionThreshold, 10);
    assert.strictEqual(restoredConfig.minConfidenceFloor, 0.15);

    console.log('✓ Test 9 Passed: Configuration is fully modular, runtime customizable, and resettable.');
  }

  // ---------------------------------------------------------------------------
  // Test 10: Definitions & Probability Distribution Integrity
  // ---------------------------------------------------------------------------
  console.log('\nTest 10: Archetype score distribution integrity and complete definition taxonomy');
  {
    const expectedArchetypes: ListenerArchetypeType[] = [
      'Explorer',
      'Loyal Listener',
      'Mood Listener',
      'Genre Hopper',
      'Discovery Seeker',
      'Comfort Listener',
      'Balanced Listener',
    ];

    // Verify all 7 archetypes have definitions
    for (const archetype of expectedArchetypes) {
      const def = ARCHETYPE_DEFINITIONS[archetype];
      assert.ok(def, `Missing definition for ${archetype}`);
      assert.strictEqual(def.type, archetype);
      assert.ok(def.title.length > 0);
      assert.ok(def.tagline.length > 0);
      assert.ok(def.description.length > 0);
      assert.ok(def.primaryTraits.length >= 3);
    }

    // Verify probability distribution sums to ~1.0
    const result = ListenerArchetypeEngine.determineArchetypeFromSignals({
      explorationTendency: 0.6,
      repeatListeningTendency: 0.4,
      genreDiversity: 0.7,
      artistDiversity: 0.5,
      noveltyPreference: 0.65,
      familiarityPreference: 0.35,
      preferenceStability: 0.5,
      recentTasteChanges: 0.3,
      moodFocusScore: 0.45,
      interactionCount: 25,
      isDataSufficient: true,
    });

    const scoreValues = Object.values(result.archetypeScores);
    const sum = scoreValues.reduce((acc, v) => acc + v, 0);
    assert.ok(
      Math.abs(sum - 1.0) < 0.05,
      `Normalized score distribution sum ${sum} should be close to 1.0`
    );

    // Verify all 7 archetypes are represented in scores
    for (const archetype of expectedArchetypes) {
      assert.ok(
        result.archetypeScores[archetype] !== undefined && result.archetypeScores[archetype] >= 0,
        `Archetype ${archetype} should have a non-negative score in distribution`
      );
    }

    // Check signal breakdown bounds
    for (const [, val] of Object.entries(result.signalBreakdown)) {
      assert.ok(val >= 0.0 && val <= 1.0, `Signal value ${val} must be clamped to [0.0, 1.0]`);
    }

    console.log('✓ Test 10 Passed: All 7 archetypes properly defined and score distributions normalize cleanly.');
  }

  console.log('\n[Listener Archetype Engine Test Suite] All tests passed!\n');
  return true;
}

// Standalone execution support
if (
  process.argv[1]?.endsWith('listenerArchetypeEngine.test.ts') ||
  process.argv[1]?.endsWith('listenerArchetypeEngine.test.js')
) {
  runListenerArchetypeEngineTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Test suite failed:', err);
      process.exit(1);
    });
}
