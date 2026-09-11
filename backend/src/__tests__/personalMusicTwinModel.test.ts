import assert from 'node:assert';
import {
  getDefaultPersonalMusicTwin,
  validateAndSanitizePersonalMusicTwin,
  DEFAULT_MUSICAL_TRAITS,
  DEFAULT_GENRE_IDENTITY,
  DEFAULT_MOOD_IDENTITY,
  DEFAULT_TWIN_LISTENING_BEHAVIOR,
  DEFAULT_TASTE_STABILITY,
  DEFAULT_TASTE_EVOLUTION,
  DEFAULT_PERSONALITY_PROFILE,
  DEFAULT_COMPATIBILITY_DIMENSIONS,
} from '../schemas/personalMusicTwinSchema.js';

export async function runPersonalMusicTwinModelTests() {
  console.log('[Personal Music Twin Model Test Suite] Starting tests...\n');

  // ---------------------------------------------------------------------------
  // Test 1: Baseline Default Personal Music Twin Generation
  // ---------------------------------------------------------------------------
  console.log('Test 1: Default Personal Music Twin generation & baseline dimensions');
  {
    const userId = crypto.randomUUID();
    const twin = getDefaultPersonalMusicTwin(userId);

    assert.strictEqual(twin.userId.toString(), userId.toString());
    assert.strictEqual(twin.twinVersion, '1.0.0');
    assert.strictEqual(twin.listenerArchetype, 'Balanced Explorer');
    assert.ok(twin.archetypeDescription.length > 0);

    // Verify default sub-structures
    assert.strictEqual(twin.dominantMusicalTraits.energyPreference, 0.5);
    assert.strictEqual(twin.dominantMusicalTraits.targetTempoBpm, 120);
    assert.deepStrictEqual(twin.genreIdentity.coreGenres, []);
    assert.deepStrictEqual(twin.moodIdentity.dominantMoods, []);
    assert.strictEqual(twin.explorationTendency, 0.5);
    assert.strictEqual(twin.familiarityTendency, 0.5);
    assert.strictEqual(twin.diversityPreference, 0.5);
    assert.strictEqual(twin.listeningBehavior.completionRate, 0.75);
    assert.strictEqual(twin.tasteStability.stabilityScore, 0.5);
    assert.strictEqual(twin.tasteEvolution.transformationIntensity, 0.0);
    assert.strictEqual(twin.confidenceScore, 0.1);
    assert.strictEqual(twin.isDataSufficient, false);

    // Verify extensible personality and compatibility defaults
    assert.strictEqual(twin.personalityProfile.personaName, 'The Open Explorer');
    assert.ok(Array.isArray(twin.personalityProfile.vibeKeywords));
    assert.strictEqual(twin.compatibilityDimensions.opennessScore, 0.5);
    assert.strictEqual(twin.compatibilityDimensions.tasteVector.length, 5);

    console.log('✓ Test 1 Passed: Default Personal Music Twin initialized with correct high-level traits.');
  }

  // ---------------------------------------------------------------------------
  // Test 2: Validation & Sanitization Helper
  // ---------------------------------------------------------------------------
  console.log('\nTest 2: Validation and sanitization bounds enforcement');
  {
    const sanitized = validateAndSanitizePersonalMusicTwin({
      userId: crypto.randomUUID().toString(),
      listenerArchetype: 'Adventurous Pioneer',
      explorationTendency: 1.8, // out of range: should clamp to 1.0
      familiarityTendency: -0.4, // out of range: should clamp to 0.0
      dominantMusicalTraits: {
        ...DEFAULT_MUSICAL_TRAITS,
        energyPreference: 2.0, // should clamp to 1.0
        targetTempoBpm: 320, // exceeds max: should clamp to 240
      },
      genreIdentity: {
        coreGenres: [
          { name: 'Synthwave', affinityScore: 1.5, isPrimary: true },
          { name: '   ', affinityScore: 0.8, isPrimary: false }, // empty name: should filter out
        ],
        secondaryGenres: [],
        genreDiversityScore: -0.1, // should clamp to 0.0
        signatureSound: 'Retro Cyber Sound',
      },
      confidenceScore: 0.95,
      isDataSufficient: true,
    });

    assert.strictEqual(sanitized.explorationTendency, 1.0);
    assert.strictEqual(sanitized.familiarityTendency, 0.0);
    assert.strictEqual(sanitized.dominantMusicalTraits.energyPreference, 1.0);
    assert.strictEqual(sanitized.dominantMusicalTraits.targetTempoBpm, 240);
    assert.strictEqual(sanitized.genreIdentity.coreGenres.length, 1);
    assert.strictEqual(sanitized.genreIdentity.coreGenres[0].name, 'Synthwave');
    assert.strictEqual(sanitized.genreIdentity.coreGenres[0].affinityScore, 1.0);
    assert.strictEqual(sanitized.genreIdentity.genreDiversityScore, 0.0);
    assert.strictEqual(sanitized.confidenceScore, 0.95);
    assert.strictEqual(sanitized.isDataSufficient, true);

    console.log('✓ Test 2 Passed: Sanitizer rigorously clamps bounds and discards invalid elements.');
  }

  console.log('\n[Personal Music Twin Model Test Suite] All tests passed!\n');
  return true;
}

// Standalone execution support
if (
  process.argv[1]?.endsWith('personalMusicTwinModel.test.ts') ||
  process.argv[1]?.endsWith('personalMusicTwinModel.test.js')
) {
  runPersonalMusicTwinModelTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Test suite failed:', err);
      process.exit(1);
    });
}
