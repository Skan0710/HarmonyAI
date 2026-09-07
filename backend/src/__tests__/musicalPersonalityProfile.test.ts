import assert from 'node:assert';
import {
  MusicalPersonalityProfileService,
  type PersonalityProfileInputSignals,
} from '../services/musicalPersonalityProfileService.js';

export async function runMusicalPersonalityProfileTests() {
  console.log('[Musical Personality Profile Test Suite] Starting tests...\n');

  // ---------------------------------------------------------------------------
  // Test 1: Highly Exploratory & Discovery Oriented Profile
  // ---------------------------------------------------------------------------
  console.log('Test 1: Highly exploratory and discovery oriented profile generation');
  {
    const inputs: PersonalityProfileInputSignals = {
      userId: 'user-exploratory',
      explorationTendency: 0.88,
      noveltyPreference: 0.84,
      genreDiversity: 0.78,
      artistDiversity: 0.82,
      repeatListeningTendency: 0.15,
      familiarityPreference: 0.20,
      sessionIntensity: 0.70,
      tasteStability: 0.45,
      transformationIntensity: 0.50,
      moodFocusScore: 0.40,
      dominantGenres: [
        { name: 'Ambient Electronic', affinity: 0.85, playCount: 42 },
        { name: 'Post-Rock', affinity: 0.75, playCount: 30 },
      ],
      dominantMoods: [
        { mood: 'Atmospheric', affinity: 0.80 },
        { mood: 'Ethereal', affinity: 0.70 },
      ],
      strongestArtists: [
        { artistName: 'Tycho', affinity: 0.88, playCount: 35 },
        { artistName: 'Bonobo', affinity: 0.76, playCount: 28 },
      ],
      interactionCount: 50,
      isDataSufficient: true,
    };

    const profile = MusicalPersonalityProfileService.generateProfileFromSignals(inputs);

    assert.strictEqual(profile.isDataSufficient, true);
    assert.ok(profile.confidenceScore >= 0.6);
    assert.strictEqual(profile.explorationLevel.level, 'high');
    assert.strictEqual(profile.explorationLevel.score, 0.88);
    assert.strictEqual(profile.repetitionTendency.level, 'low');
    assert.strictEqual(profile.repetitionTendency.score, 0.15);
    assert.strictEqual(profile.diversityLevel.level, 'high');

    // Traits verification
    const traitNames = profile.personalityTraits.map((t) => t.trait);
    assert.ok(traitNames.includes('highly exploratory'), 'Should identify highly exploratory trait');
    assert.ok(traitNames.includes('discovery oriented'), 'Should identify discovery oriented trait');

    // Verify trait evidence is backed by actual scores
    const exploratoryTrait = profile.personalityTraits.find((t) => t.trait === 'highly exploratory');
    assert.ok(exploratoryTrait);
    assert.strictEqual(exploratoryTrait.score, 0.88);
    assert.ok(exploratoryTrait.evidence.includes('88%'));
    assert.ok(exploratoryTrait.confidence > 0.5);

    console.log(`✓ Test 1 Passed: Exploratory profile identified traits: [${traitNames.join(', ')}].`);
  }

  // ---------------------------------------------------------------------------
  // Test 2: Genre Loyal & Comfort Oriented Profile
  // ---------------------------------------------------------------------------
  console.log('\nTest 2: Genre loyal, repeat enthusiast, and comfort oriented profile');
  {
    const inputs: PersonalityProfileInputSignals = {
      userId: 'user-loyal',
      explorationTendency: 0.12,
      familiarityPreference: 0.92,
      repeatListeningTendency: 0.88,
      genreDiversity: 0.22,
      artistDiversity: 0.30,
      sessionIntensity: 0.60,
      tasteStability: 0.88,
      transformationIntensity: 0.08,
      moodFocusScore: 0.35,
      dominantGenres: [
        { name: 'Classical Piano', affinity: 0.95, playCount: 110 },
      ],
      dominantMoods: [
        { mood: 'Peaceful', affinity: 0.90 },
      ],
      strongestArtists: [
        { artistName: 'Chopin', affinity: 0.95, playCount: 85 },
      ],
      interactionCount: 75,
      isDataSufficient: true,
    };

    const profile = MusicalPersonalityProfileService.generateProfileFromSignals(inputs);

    assert.strictEqual(profile.familiarityLevel.level, 'high');
    assert.strictEqual(profile.familiarityLevel.score, 0.92);
    assert.strictEqual(profile.repetitionTendency.level, 'high');
    assert.strictEqual(profile.repetitionTendency.score, 0.88);
    assert.strictEqual(profile.tasteStability.level, 'high');
    assert.strictEqual(profile.tasteStability.score, 0.88);
    assert.strictEqual(profile.explorationLevel.level, 'low');

    const traitNames = profile.personalityTraits.map((t) => t.trait);
    assert.ok(traitNames.includes('genre loyal'), 'Should identify genre loyal trait');
    assert.ok(traitNames.includes('comfort oriented'), 'Should identify comfort oriented trait');
    assert.ok(traitNames.includes('repeat enthusiast'), 'Should identify repeat enthusiast trait');

    console.log(`✓ Test 2 Passed: Loyal/comfort profile identified traits: [${traitNames.join(', ')}].`);
  }

  // ---------------------------------------------------------------------------
  // Test 3: Mood Driven Profile
  // ---------------------------------------------------------------------------
  console.log('\nTest 3: Mood driven personality profile detection');
  {
    const inputs: PersonalityProfileInputSignals = {
      userId: 'user-mood',
      moodFocusScore: 0.92,
      explorationTendency: 0.45,
      familiarityPreference: 0.50,
      genreDiversity: 0.55,
      artistDiversity: 0.50,
      repeatListeningTendency: 0.40,
      sessionIntensity: 0.55,
      tasteStability: 0.60,
      transformationIntensity: 0.25,
      dominantMoods: [
        { mood: 'Euphoric', affinity: 0.92 },
        { mood: 'Melancholy', affinity: 0.85 },
      ],
      interactionCount: 40,
      isDataSufficient: true,
    };

    const profile = MusicalPersonalityProfileService.generateProfileFromSignals(inputs);

    const traitNames = profile.personalityTraits.map((t) => t.trait);
    assert.ok(traitNames.includes('mood driven'), 'Should identify mood driven trait');

    const moodTrait = profile.personalityTraits.find((t) => t.trait === 'mood driven');
    assert.ok(moodTrait);
    assert.strictEqual(moodTrait.category, 'mood');
    assert.ok(moodTrait.evidence.includes('92%'));

    console.log(`✓ Test 3 Passed: Mood driven trait identified with evidence: "${moodTrait.evidence}".`);
  }

  // ---------------------------------------------------------------------------
  // Test 4: Artist Focused vs Highly Diverse & Artist Varied
  // ---------------------------------------------------------------------------
  console.log('\nTest 4: Artist diversity contrasting profiles');
  {
    // Profile A: Artist Focused
    const focusedInputs: PersonalityProfileInputSignals = {
      userId: 'user-artist-focused',
      artistDiversity: 0.22,
      genreDiversity: 0.45,
      explorationTendency: 0.35,
      repeatListeningTendency: 0.65,
      interactionCount: 30,
      isDataSufficient: true,
    };
    const focusedProfile = MusicalPersonalityProfileService.generateProfileFromSignals(focusedInputs);
    const focusedTraits = focusedProfile.personalityTraits.map((t) => t.trait);
    assert.ok(focusedTraits.includes('artist focused'), 'Should flag artist focused when diversity <= 0.35');

    // Profile B: Artist Varied & Highly Diverse
    const variedInputs: PersonalityProfileInputSignals = {
      userId: 'user-artist-varied',
      artistDiversity: 0.88,
      genreDiversity: 0.82,
      diversityPreference: 0.85,
      explorationTendency: 0.65,
      repeatListeningTendency: 0.20,
      interactionCount: 35,
      isDataSufficient: true,
    };
    const variedProfile = MusicalPersonalityProfileService.generateProfileFromSignals(variedInputs);
    const variedTraits = variedProfile.personalityTraits.map((t) => t.trait);
    assert.ok(variedTraits.includes('artist varied'), 'Should flag artist varied when diversity >= 0.75');
    assert.ok(variedTraits.includes('highly diverse'), 'Should flag highly diverse trait');

    console.log('✓ Test 4 Passed: Contrast between artist focused and highly diverse/artist varied successfully detected.');
  }

  // ---------------------------------------------------------------------------
  // Test 5: Taste Transformation & Dynamic Evolver
  // ---------------------------------------------------------------------------
  console.log('\nTest 5: Taste transformation intensity and volatility classification');
  {
    const transformingInputs: PersonalityProfileInputSignals = {
      userId: 'user-transformer',
      transformationIntensity: 0.76,
      tasteStability: 0.28,
      transformationArchetype: 'Transforming / Paradigm Shift',
      stabilityArchetype: 'Dynamic Churn / High Volatility',
      explorationTendency: 0.80,
      repeatListeningTendency: 0.20,
      interactionCount: 45,
      isDataSufficient: true,
    };

    const profile = MusicalPersonalityProfileService.generateProfileFromSignals(transformingInputs);

    assert.strictEqual(profile.tasteStability.level, 'volatile');
    assert.strictEqual(profile.tasteTransformation.level, 'high');
    assert.strictEqual(profile.tasteTransformation.velocity, 'rapid');
    assert.strictEqual(profile.tasteTransformation.archetype, 'Transforming / Paradigm Shift');

    const traitNames = profile.personalityTraits.map((t) => t.trait);
    assert.ok(traitNames.includes('taste_transformer') || traitNames.includes('taste transformer'));

    console.log('✓ Test 5 Passed: Rapid transformation velocity and taste transformer trait correctly identified.');
  }

  // ---------------------------------------------------------------------------
  // Test 6: Cold Start & Insufficient Data Handling
  // ---------------------------------------------------------------------------
  console.log('\nTest 6: Cold start and insufficient data handling');
  {
    const coldInputs: PersonalityProfileInputSignals = {
      userId: 'new-listener-cold',
      interactionCount: 3,
      isDataSufficient: false,
    };

    const profile = MusicalPersonalityProfileService.generateProfileFromSignals(coldInputs);

    assert.strictEqual(profile.isDataSufficient, false);
    assert.strictEqual(profile.confidenceScore, 0.15);
    assert.strictEqual(profile.archetype.primary, 'Balanced Listener');
    assert.strictEqual(profile.personalityTraits.length, 1);
    assert.strictEqual(profile.personalityTraits[0].trait, 'emerging listener');
    assert.ok(profile.narrativeSummary.includes('forming'));

    console.log('✓ Test 6 Passed: Insufficient history returned safe baseline profile with emerging listener trait.');
  }

  // ---------------------------------------------------------------------------
  // Test 7: Machine-Readable Schema Integrity & Deterministic Invariance
  // ---------------------------------------------------------------------------
  console.log('\nTest 7: Machine-readable schema completeness and deterministic invariance');
  {
    const inputs: PersonalityProfileInputSignals = {
      userId: 'user-invariance',
      explorationTendency: 0.65,
      familiarityPreference: 0.45,
      genreDiversity: 0.72,
      artistDiversity: 0.68,
      repeatListeningTendency: 0.35,
      noveltyPreference: 0.60,
      sessionIntensity: 0.80,
      tasteStability: 0.70,
      transformationIntensity: 0.25,
      moodFocusScore: 0.60,
      dominantGenres: [{ name: 'Synthwave', affinity: 0.88, playCount: 50 }],
      dominantMoods: [{ mood: 'Energetic', affinity: 0.82 }],
      strongestArtists: [{ artistName: 'Gunship', affinity: 0.90, playCount: 40 }],
      emergingGenres: [{ name: 'Darksynth', confidence: 0.75, momentumVelocity: 0.4 }],
      emergingArtists: [{ name: 'Carpenter Brut', confidence: 0.80, momentumVelocity: 0.5 }],
      emergingMoods: ['Cyberpunk'],
      emergingNarrative: 'Emerging preference for heavier darksynth sounds.',
      interactionCount: 35,
      isDataSufficient: true,
    };

    const runA = MusicalPersonalityProfileService.generateProfileFromSignals(inputs);
    const runB = MusicalPersonalityProfileService.generateProfileFromSignals(inputs);

    // Verify deterministic invariance (no random assignment)
    assert.strictEqual(runA.archetype.primary, runB.archetype.primary);
    assert.strictEqual(runA.confidenceScore, runB.confidenceScore);
    assert.deepStrictEqual(runA.personalityTraits, runB.personalityTraits);

    // Verify all required summary properties exist
    const requiredKeys: (keyof typeof runA)[] = [
      'dominantGenres',
      'dominantMoods',
      'strongestArtists',
      'explorationLevel',
      'familiarityLevel',
      'diversityLevel',
      'listeningIntensity',
      'repetitionTendency',
      'tasteStability',
      'tasteTransformation',
      'emergingInterests',
      'personalityTraits',
    ];

    for (const key of requiredKeys) {
      assert.ok(runA[key] !== undefined, `Missing required personality profile field: ${key}`);
    }

    // Verify emerging interests structure
    assert.strictEqual(runA.emergingInterests.genres.length, 1);
    assert.strictEqual(runA.emergingInterests.genres[0].name, 'Darksynth');
    assert.strictEqual(runA.emergingInterests.artists[0].name, 'Carpenter Brut');
    assert.strictEqual(runA.emergingInterests.moods[0], 'Cyberpunk');
    assert.strictEqual(runA.emergingInterests.summaryNarrative, 'Emerging preference for heavier darksynth sounds.');

    // Verify JSON serializability
    const serialized = JSON.stringify(runA);
    const deserialized = JSON.parse(serialized);
    assert.strictEqual(deserialized.archetype.primary, runA.archetype.primary);

    console.log('✓ Test 7 Passed: Machine-readable JSON contract verified with complete deterministic invariance.');
  }

  console.log('\n[Musical Personality Profile Test Suite] All tests passed!\n');
  return true;
}

// Standalone execution support
if (
  process.argv[1]?.endsWith('musicalPersonalityProfile.test.ts') ||
  process.argv[1]?.endsWith('musicalPersonalityProfile.test.js')
) {
  runMusicalPersonalityProfileTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Test suite failed:', err);
      process.exit(1);
    });
}
