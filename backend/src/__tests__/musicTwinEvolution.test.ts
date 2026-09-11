import assert from 'node:assert';
import {
  MusicTwinEvolutionService,
  DEFAULT_TWIN_EVOLUTION_CONFIG,
  getTwinEvolutionConfig,
  updateTwinEvolutionConfig,
  resetTwinEvolutionConfig,
} from '../services/musicTwinEvolutionService.js';
import {
  getDefaultPersonalMusicTwin,
  PersonalMusicTwinAttributes,
} from '../schemas/personalMusicTwinSchema.js';

export async function runMusicTwinEvolutionTests() {
  console.log('[Music Twin Evolution & Confidence Test Suite] Starting tests...\n');

  resetTwinEvolutionConfig();

  // ---------------------------------------------------------------------------
  // Test 1: Stable Users (High Inertia & Confidence Calibration)
  // ---------------------------------------------------------------------------
  console.log('Test 1: Stable personality evolution and overreaction prevention');
  {
    const userId = crypto.randomUUID();
    const baseTwin = getDefaultPersonalMusicTwin(userId);

    const previousTwin: PersonalMusicTwinAttributes = {
      ...baseTwin,
      explorationTendency: 0.30,
      familiarityTendency: 0.85,
      diversityPreference: 0.40,
      dominantMusicalTraits: {
        ...baseTwin.dominantMusicalTraits,
        energyPreference: 0.60,
        danceabilityPreference: 0.50,
      },
      listeningBehavior: {
        ...baseTwin.listeningBehavior,
        repeatListeningTendency: 0.80,
        discoveryTendency: 0.25,
        sessionListeningIntensity: 0.60,
        isDataSufficient: true,
      },
      tasteStability: {
        stabilityScore: 0.85,
        volatilityScore: 0.15,
        preferencePersistence: 0.90,
        stabilityRating: 'highly_stable',
        description: 'Rock solid bedrock taste.',
      },
      tasteEvolution: {
        transformationIntensity: 0.10,
        evolutionArchetype: 'Anchor / High Stability',
        primaryTasteDirection: 'Classical and acoustic permanence',
        activePhase: 'Classical Era',
        velocity: 'static',
      },
      listenerArchetype: 'Loyal Listener',
      confidenceScore: 0.88,
      isDataSufficient: true,
    };

    // Incoming twin with slight noise (e.g. user played 3 electronic tracks at a party)
    const incomingTwin: PersonalMusicTwinAttributes = {
      ...previousTwin,
      explorationTendency: 0.38, // slight bump +0.08 (under 0.15 meaningful threshold)
      dominantMusicalTraits: {
        ...previousTwin.dominantMusicalTraits,
        energyPreference: 0.66, // slight bump +0.06
      },
      listeningBehavior: {
        ...previousTwin.listeningBehavior,
        repeatListeningTendency: 0.74, // slight drop -0.06
      },
    };

    const result = MusicTwinEvolutionService.evolveTwin(previousTwin, incomingTwin, {
      totalInteractionCount: 65,
      interactionCountDelta: 3, // only 3 new plays (below minInteractionsForMeaningfulShift 5)
    });

    assert.strictEqual(result.personalityState, 'stable personality');
    assert.ok(result.confidenceScore >= 0.80, `Confidence should remain high for stable user: ${result.confidenceScore}`);
    assert.strictEqual(result.changeSummary.hasMeaningfulChange, false);
    assert.ok(result.changeSummary.stableCharacteristics.includes('explorationTendency'));
    assert.ok(result.changeSummary.stableCharacteristics.includes('energyPreference'));

    // Verify overreaction prevention: smoothed value should stay very close to previous
    // Since interactionCountDelta was 3, extra inertia is applied (0.95)
    // 0.95 * 0.30 + 0.05 * 0.38 = 0.304
    assert.ok(
      result.evolvedTwin.explorationTendency < 0.33,
      `Exploration tendency should be strongly dampened: ${result.evolvedTwin.explorationTendency}`
    );

    console.log(`✓ Test 1 Passed: Stable user correctly classified with high inertia (exploration kept at ${result.evolvedTwin.explorationTendency}, confidence: ${(result.confidenceScore * 100).toFixed(0)}%).`);
  }

  // ---------------------------------------------------------------------------
  // Test 2: New Users (Developing Personality & Calibrated Baseline Confidence)
  // ---------------------------------------------------------------------------
  console.log('\nTest 2: New user developing personality state and confidence ramp');
  {
    const userId = crypto.randomUUID();
    const newTwin = getDefaultPersonalMusicTwin(userId);

    // Initial first-time evolution (previousTwin is null)
    const initialResult = MusicTwinEvolutionService.evolveTwin(null, newTwin, {
      totalInteractionCount: 8,
    });

    assert.strictEqual(initialResult.personalityState, 'developing personality');
    assert.ok(
      initialResult.confidenceScore <= 0.40,
      `Confidence for 8 interactions should be developing: ${initialResult.confidenceScore}`
    );
    assert.ok(initialResult.changeSummary.explanation.includes('developing personality'));

    // Second evolution with 18 interactions (still developing < 25)
    const updatedIncoming: PersonalMusicTwinAttributes = {
      ...newTwin,
      explorationTendency: 0.65,
      confidenceScore: 0.45,
      isDataSufficient: true,
    };

    const secondResult = MusicTwinEvolutionService.evolveTwin(initialResult.evolvedTwin, updatedIncoming, {
      totalInteractionCount: 18,
      interactionCountDelta: 10,
    });

    assert.strictEqual(secondResult.personalityState, 'developing personality');
    assert.ok(
      secondResult.confidenceScore <= 0.65,
      `Developing personality confidence should not exceed developing cap of 0.65: ${secondResult.confidenceScore}`
    );
    assert.ok(secondResult.confidenceScore > initialResult.confidenceScore, 'Confidence should ramp upward as plays increase');

    console.log(`✓ Test 2 Passed: New user recognized as developing personality (confidence ramp: ${initialResult.confidenceScore} -> ${secondResult.confidenceScore}).`);
  }

  // ---------------------------------------------------------------------------
  // Test 3: Rapidly Changing Users (Dynamic Adaptation & Changing Characteristics)
  // ---------------------------------------------------------------------------
  console.log('\nTest 3: Rapidly changing taste detection and responsive trait adaptation');
  {
    const userId = crypto.randomUUID();
    const baseTwin = getDefaultPersonalMusicTwin(userId);

    const previousTwin: PersonalMusicTwinAttributes = {
      ...baseTwin,
      listenerArchetype: 'Comfort Listener',
      explorationTendency: 0.25,
      familiarityTendency: 0.85,
      diversityPreference: 0.30,
      dominantMusicalTraits: {
        ...baseTwin.dominantMusicalTraits,
        energyPreference: 0.35,
        danceabilityPreference: 0.30,
      },
      listeningBehavior: {
        ...baseTwin.listeningBehavior,
        repeatListeningTendency: 0.75,
        discoveryTendency: 0.20,
        sessionListeningIntensity: 0.40,
        isDataSufficient: true,
      },
      tasteStability: {
        stabilityScore: 0.35,
        volatilityScore: 0.65,
        preferencePersistence: 0.40,
        stabilityRating: 'rapid_transformation',
        description: 'Undergoing dramatic musical transformation.',
      },
      tasteEvolution: {
        transformationIntensity: 0.70, // above rapidTransformationThreshold (0.45)
        evolutionArchetype: 'Transforming / Paradigm Shift',
        primaryTasteDirection: 'Pivoting from acoustic folk to darksynth',
        activePhase: 'Cyberpunk Awakening',
        velocity: 'rapid',
      },
      isDataSufficient: true,
    };

    // Incoming twin reflects a real taste revolution
    const incomingTwin: PersonalMusicTwinAttributes = {
      ...previousTwin,
      listenerArchetype: 'Explorer', // archetype transitioned!
      explorationTendency: 0.85, // delta +0.60 (huge change)
      familiarityTendency: 0.20, // delta -0.65 (huge change)
      dominantMusicalTraits: {
        ...previousTwin.dominantMusicalTraits,
        energyPreference: 0.88, // delta +0.53
      },
    };

    const result = MusicTwinEvolutionService.evolveTwin(previousTwin, incomingTwin, {
      totalInteractionCount: 50,
      interactionCountDelta: 15,
    });

    assert.strictEqual(result.personalityState, 'rapidly changing taste');
    assert.strictEqual(result.changeSummary.hasMeaningfulChange, true);

    const changingTraits = result.changeSummary.changingCharacteristics.map((c) => c.trait);
    assert.ok(changingTraits.includes('explorationTendency'), 'Should detect exploration tendency shift');
    assert.ok(changingTraits.includes('familiarityTendency'), 'Should detect familiarity tendency shift');
    assert.ok(changingTraits.includes('energyPreference'), 'Should detect energy preference shift');
    assert.ok(changingTraits.includes('listenerArchetype'), 'Should detect archetype transition');

    // Verify explanation detail
    const explorationChange = result.changeSummary.changingCharacteristics.find((c) => c.trait === 'explorationTendency');
    assert.ok(explorationChange);
    assert.strictEqual(explorationChange.previousValue, 0.25);
    assert.strictEqual(explorationChange.currentValue, 0.85);
    assert.ok(explorationChange.explanation.includes('increased'));

    // Verify responsive adaptation: under rapidly changing state, volatileInertiaWeight is 0.40
    // 0.40 * 0.25 + 0.60 * 0.85 = 0.61
    assert.ok(
      result.evolvedTwin.explorationTendency >= 0.55,
      `Rapidly evolving user should adapt swiftly: ${result.evolvedTwin.explorationTendency}`
    );

    console.log(`✓ Test 3 Passed: Rapidly changing taste detected with ${result.changeSummary.changingCharacteristics.length} changing traits.`);
  }

  // ---------------------------------------------------------------------------
  // Test 4: Emerging Preferences Detection
  // ---------------------------------------------------------------------------
  console.log('\nTest 4: Emerging preferences detection and momentum tracking');
  {
    const userId = crypto.randomUUID();
    const baseTwin = getDefaultPersonalMusicTwin(userId);

    const incomingWithEmerging: PersonalMusicTwinAttributes = {
      ...baseTwin,
      currentEmergingInterests: {
        genres: [
          { name: 'Hyperpop', confidence: 0.82, momentumVelocity: 0.45 },
          { name: 'Drift Phonk', confidence: 0.74, momentumVelocity: 0.25 },
          { name: 'Quiet Ambient', confidence: 0.30, momentumVelocity: 0.05 }, // below threshold
        ],
        artists: [
          { name: '100 gecs', confidence: 0.80, momentumVelocity: 0.40 },
        ],
        moods: ['Chaotic', 'Hyperactive'],
        narrative: 'High velocity emergence in hyperpop and phonk.',
      },
      isDataSufficient: true,
    };

    const result = MusicTwinEvolutionService.evolveTwin(baseTwin, incomingWithEmerging, {
      totalInteractionCount: 40,
    });

    assert.ok(result.changeSummary.emergingPreferences.includes('Hyperpop'));
    assert.ok(result.changeSummary.emergingPreferences.includes('Drift Phonk'));
    assert.ok(!result.changeSummary.emergingPreferences.includes('Quiet Ambient'), 'Low momentum genre should not be flagged');
    assert.ok(result.changeSummary.explanation.includes('Hyperpop'));

    console.log(`✓ Test 4 Passed: Emerging preferences detected: [${result.changeSummary.emergingPreferences.join(', ')}].`);
  }

  // ---------------------------------------------------------------------------
  // Test 5: Fading Preferences Detection
  // ---------------------------------------------------------------------------
  console.log('\nTest 5: Fading preferences detection on taste departure');
  {
    const userId = crypto.randomUUID();
    const baseTwin = getDefaultPersonalMusicTwin(userId);

    // Prior twin had Rock and Jazz in core genres
    const previousTwin: PersonalMusicTwinAttributes = {
      ...baseTwin,
      genreIdentity: {
        coreGenres: [
          { name: 'Progressive Rock', affinityScore: 0.85, isPrimary: true },
          { name: 'Bebop Jazz', affinityScore: 0.78, isPrimary: false },
          { name: 'Synthwave', affinityScore: 0.70, isPrimary: false },
        ],
        secondaryGenres: [],
        genreDiversityScore: 0.60,
        signatureSound: 'Rock & Jazz',
      },
      isDataSufficient: true,
    };

    // Incoming twin dropped Bebop Jazz completely, and Progressive Rock dropped from 0.85 to 0.55 (-0.30 delta)
    const incomingTwin: PersonalMusicTwinAttributes = {
      ...previousTwin,
      genreIdentity: {
        coreGenres: [
          { name: 'Synthwave', affinityScore: 0.90, isPrimary: true },
          { name: 'Cyberpunk', affinityScore: 0.85, isPrimary: false },
          { name: 'Progressive Rock', affinityScore: 0.55, isPrimary: false }, // dropped by -0.30
        ],
        secondaryGenres: [],
        genreDiversityScore: 0.60,
        signatureSound: 'Synthwave & Cyberpunk',
      },
    };

    const result = MusicTwinEvolutionService.evolveTwin(previousTwin, incomingTwin, {
      totalInteractionCount: 50,
    });

    assert.ok(
      result.changeSummary.fadingPreferences.includes('Bebop Jazz'),
      'Should detect completely departed core genre as fading'
    );
    assert.ok(
      result.changeSummary.fadingPreferences.includes('Progressive Rock'),
      'Should detect genre with steep affinity decline as fading'
    );
    assert.ok(result.changeSummary.explanation.includes('Fading:'));

    console.log(`✓ Test 5 Passed: Fading preferences detected: [${result.changeSummary.fadingPreferences.join(', ')}].`);
  }

  // ---------------------------------------------------------------------------
  // Test 6: Configurable Thresholds & Runtime Tuning
  // ---------------------------------------------------------------------------
  console.log('\nTest 6: Configurable evolution thresholds and runtime overrides');
  {
    // Update global config
    updateTwinEvolutionConfig({
      meaningfulChangeThreshold: 0.30, // raise bar from 0.15 to 0.30
      minInteractionsForStability: 50, // raise stability bar
    });

    const activeConfig = getTwinEvolutionConfig();
    assert.strictEqual(activeConfig.meaningfulChangeThreshold, 0.30);
    assert.strictEqual(activeConfig.minInteractionsForStability, 50);

    const userWith35PlaysState = MusicTwinEvolutionService.determinePersonalityState(35, 0.8, 0.1, 0.1);
    assert.strictEqual(
      userWith35PlaysState,
      'developing personality',
      'Under threshold 50, user with 35 plays should now be developing'
    );

    // Reset to defaults
    resetTwinEvolutionConfig();
    const restored = getTwinEvolutionConfig();
    assert.strictEqual(restored.meaningfulChangeThreshold, 0.15);
    assert.strictEqual(restored.minInteractionsForStability, 25);

    console.log('✓ Test 6 Passed: Evolution thresholds are fully modular, configurable, and resettable.');
  }

  console.log('\n[Music Twin Evolution & Confidence Test Suite] All tests passed!\n');
  return true;
}

// Standalone execution support
if (
  process.argv[1]?.endsWith('musicTwinEvolution.test.ts') ||
  process.argv[1]?.endsWith('musicTwinEvolution.test.js')
) {
  runMusicTwinEvolutionTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Test suite failed:', err);
      process.exit(1);
    });
}
