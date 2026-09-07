import assert from 'node:assert';
import { Types } from 'mongoose';
import { PersonalMusicTwin } from '../models/PersonalMusicTwin.js';
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
    const userId = new Types.ObjectId();
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
      userId: new Types.ObjectId().toString(),
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

  // ---------------------------------------------------------------------------
  // Test 3: Full Model Document Instantiation & Schema Validation
  // ---------------------------------------------------------------------------
  console.log('\nTest 3: Full Mongoose Model instantiation and validation');
  {
    const userId = new Types.ObjectId();
    const twinDoc = new PersonalMusicTwin({
      userId,
      twinVersion: '1.0.0',
      listenerArchetype: 'Deep Catalog Diver',
      archetypeDescription: 'A focused listener who immerses deeply in artist discographies and niche musical corners.',
      dominantMusicalTraits: {
        energyPreference: 0.72,
        danceabilityPreference: 0.65,
        valencePreference: 0.45,
        acousticnessPreference: 0.20,
        instrumentalnessPreference: 0.85,
        targetTempoBpm: 124,
        tempoRange: { min: 110, max: 135 },
        keyAcousticDescriptors: ['Atmospheric', 'Synthesized', 'Driving Rhythm'],
      },
      genreIdentity: {
        coreGenres: [
          { name: 'Cyberpunk', affinityScore: 0.92, isPrimary: true },
          { name: 'Darksynth', affinityScore: 0.84, isPrimary: false },
        ],
        secondaryGenres: [
          { name: 'Industrial', affinityScore: 0.60 },
        ],
        genreDiversityScore: 0.42,
        signatureSound: 'Dark Electro & Industrial Pulse',
      },
      moodIdentity: {
        dominantMoods: [
          { mood: 'Intense', affinityScore: 0.88 },
          { mood: 'Euphoric', affinityScore: 0.74 },
        ],
        emotionalBreadth: 'focused',
        contextualMoodAffinity: {
          workout: 'Intense',
          night_drive: 'Euphoric',
        },
      },
      explorationTendency: 0.65,
      familiarityTendency: 0.35,
      diversityPreference: 0.58,
      listeningBehavior: {
        repeatListeningTendency: 0.30,
        discoveryTendency: 0.70,
        skipTendency: 0.15,
        sessionListeningIntensity: 0.80,
        completionRate: 0.90,
        avgSessionDurationMinutes: 45,
        peakListeningTime: 'late_night',
        isDataSufficient: true,
      },
      tasteStability: {
        stabilityScore: 0.68,
        volatilityScore: 0.32,
        preferencePersistence: 0.75,
        stabilityRating: 'moderate_drift',
        description: 'Smooth musical evolution anchoring to electronic core.',
      },
      tasteEvolution: {
        transformationIntensity: 0.40,
        evolutionArchetype: 'Gradual Evolver',
        primaryTasteDirection: 'Expanding from Synthwave into harder Cyberpunk and Darksynth sounds.',
        activePhase: 'Cyberpunk Era',
        velocity: 'moderate',
      },
      currentEmergingInterests: {
        genres: [{ name: 'Hyperpop', confidence: 0.75, momentumVelocity: 0.5 }],
        artists: [{ name: 'Gunship', confidence: 0.82, momentumVelocity: 0.6 }],
        moods: ['Futuristic', 'High Velocity'],
        narrative: 'Recent high engagement with futuristic and hyperpop influences.',
      },
      personalityProfile: {
        personaName: 'The Neon Cyber-Drifter',
        tagline: 'Navigating nocturnal sonic landscapes',
        bio: 'Immersed in high-energy electronic basslines and retro-futuristic soundscapes.',
        vibeKeywords: ['neon', 'darksynth', 'cyberpunk', 'nocturnal'],
        rarityScore: 0.88,
      },
      compatibilityDimensions: {
        opennessScore: 0.82,
        intensityScore: 0.90,
        eclecticismScore: 0.60,
        tasteVector: [0.72, 0.65, 0.45, 0.20, 0.85],
      },
      confidenceScore: 0.85,
      lastUpdatedTimestamp: new Date(),
      isDataSufficient: true,
      metadata: { source: 'day33_unit_test' },
    });

    let validationError: any = null;
    try {
      await twinDoc.validate();
    } catch (err) {
      validationError = err;
    }
    assert.strictEqual(validationError, null, `Document validation failed: ${validationError?.message}`);

    assert.strictEqual(twinDoc.userId.toString(), userId.toString());
    assert.strictEqual(twinDoc.listenerArchetype, 'Deep Catalog Diver');
    assert.strictEqual(twinDoc.dominantMusicalTraits.energyPreference, 0.72);
    assert.strictEqual(twinDoc.dominantMusicalTraits.targetTempoBpm, 124);
    assert.strictEqual(twinDoc.genreIdentity.coreGenres.length, 2);
    assert.strictEqual(twinDoc.moodIdentity.dominantMoods.length, 2);
    assert.strictEqual(twinDoc.personalityProfile.personaName, 'The Neon Cyber-Drifter');
    assert.strictEqual(twinDoc.compatibilityDimensions.tasteVector.length, 5);
    assert.strictEqual(twinDoc.metadata?.source, 'day33_unit_test');

    console.log('✓ Test 3 Passed: Comprehensive Personal Music Twin document validates cleanly against Mongoose schema.');
  }

  // ---------------------------------------------------------------------------
  // Test 4: Schema Boundary & Validation Error Traps
  // ---------------------------------------------------------------------------
  console.log('\nTest 4: Schema boundary and validation constraint enforcement');
  {
    // Invalid energy preference (> 1.0)
    const invalidEnergy = new PersonalMusicTwin({
      userId: new Types.ObjectId(),
      dominantMusicalTraits: {
        ...DEFAULT_MUSICAL_TRAITS,
        energyPreference: 1.5,
      },
    });

    let energyErr: any = null;
    try {
      await invalidEnergy.validate();
    } catch (err) {
      energyErr = err;
    }
    assert.ok(energyErr?.errors['dominantMusicalTraits.energyPreference'], 'Should reject energyPreference > 1.0');

    // Invalid target tempo (< 40)
    const invalidTempo = new PersonalMusicTwin({
      userId: new Types.ObjectId(),
      dominantMusicalTraits: {
        ...DEFAULT_MUSICAL_TRAITS,
        targetTempoBpm: 20,
      },
    });

    let tempoErr: any = null;
    try {
      await invalidTempo.validate();
    } catch (err) {
      tempoErr = err;
    }
    assert.ok(tempoErr?.errors['dominantMusicalTraits.targetTempoBpm'], 'Should reject targetTempoBpm < 40');

    // Missing userId
    const missingUser = new PersonalMusicTwin({});
    let userErr: any = null;
    try {
      await missingUser.validate();
    } catch (err) {
      userErr = err;
    }
    assert.ok(userErr?.errors['userId'], 'Should require userId');

    console.log('✓ Test 4 Passed: Strict boundary constraints and required fields enforced.');
  }

  // ---------------------------------------------------------------------------
  // Test 5: Static Helper findByUserId Safe Handling
  // ---------------------------------------------------------------------------
  console.log('\nTest 5: Model static helper safe handling');
  {
    const invalidResult = await PersonalMusicTwin.findByUserId('invalid-id');
    assert.strictEqual(invalidResult, null, 'Invalid ObjectId should safely return null without throwing');

    console.log('✓ Test 5 Passed: Model static findByUserId handles invalid IDs safely.');
  }

  // ---------------------------------------------------------------------------
  // Test 6: Extensibility and Non-Duplication of Raw History
  // ---------------------------------------------------------------------------
  console.log('\nTest 6: Derived representation integrity & schema extensibility');
  {
    const twin = new PersonalMusicTwin({
      userId: new Types.ObjectId(),
      personalityProfile: {
        personaName: 'Future Sound Shaman',
        tagline: 'Resonating across spatial dimensions',
        bio: 'Experimental listener embracing acoustic-electronic hybrids.',
        vibeKeywords: ['transcendent', 'spatial', 'minimalist'],
        rarityScore: 0.92,
      },
      metadata: {
        customUspAttribute: 'spatial_audio_explorer',
        twinMatchingEnabled: true,
        futureAiModelVersion: 'gpt-audio-next',
      },
    });

    assert.strictEqual(twin.personalityProfile.personaName, 'Future Sound Shaman');
    assert.strictEqual(twin.metadata?.customUspAttribute, 'spatial_audio_explorer');
    assert.strictEqual(twin.metadata?.twinMatchingEnabled, true);

    // Verify it is a derived structure without raw interaction lists
    const rawKeys = Object.keys(twin.toObject());
    assert.ok(!rawKeys.includes('rawInteractions'), 'Must not duplicate raw listening interactions');
    assert.ok(!rawKeys.includes('playHistory'), 'Must not duplicate raw play history');

    console.log('✓ Test 6 Passed: Model represents derived intelligence with full USP extensibility.');
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
