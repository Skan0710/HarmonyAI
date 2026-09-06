import assert from 'node:assert';
import { Types } from 'mongoose';
import { MusicDNA } from '../models/MusicDNA.js';
import {
  validateAndSanitizeMusicDNA,
  getDefaultMusicDNAProfile,
  DEFAULT_TENDENCY_DIMENSIONS,
  DEFAULT_LISTENING_PATTERNS,
  DEFAULT_TEMPORAL_TASTE,
} from '../schemas/musicDnaSchema.js';

export async function runMusicDNAModelTests() {
  console.log('[Music DNA Model Test Suite] Starting tests...');

  // Test 1: Default Profile Generation and Defaults Verification
  {
    const userId = new Types.ObjectId();
    const defaultProfile = getDefaultMusicDNAProfile(userId);

    assert.strictEqual(defaultProfile.userId.toString(), userId.toString());
    assert.strictEqual(defaultProfile.dnaVersion, '1.0.0');
    assert.deepStrictEqual(defaultProfile.genres, []);
    assert.deepStrictEqual(defaultProfile.artists, []);
    assert.deepStrictEqual(defaultProfile.moods, []);
    assert.strictEqual(defaultProfile.tendencies.discoveryTendency, 0.5);
    assert.strictEqual(defaultProfile.tendencies.familiarityPreference, 0.5);
    assert.strictEqual(defaultProfile.tendencies.diversityPreference, 0.5);
    assert.strictEqual(defaultProfile.tendencies.explorationPreference, 0.5);
    assert.strictEqual(defaultProfile.listeningPatterns.avgSessionDurationMinutes, 30);
    assert.strictEqual(defaultProfile.temporalTaste.activeTimeWindow, 'medium_term');
    assert.strictEqual(defaultProfile.confidenceScore, 0.1);

    console.log('✓ Test 1 Passed: Default Music DNA profile generated with correct baseline dimensions.');
  }

  // Test 2: Instantiation with Full Dimensions and Mongoose Validation
  {
    const userId = new Types.ObjectId();
    const genreId = new Types.ObjectId();
    const artistId = new Types.ObjectId();

    const dnaDoc = new MusicDNA({
      userId,
      dnaVersion: '1.2.0',
      genres: [
        {
          genre: genreId,
          name: 'Synthwave',
          affinityScore: 0.88,
          playCount: 42,
          lastInteractionAt: new Date(),
        },
        {
          name: 'Indie Rock',
          affinityScore: 0.75,
          playCount: 28,
        },
      ],
      artists: [
        {
          artist: artistId,
          name: 'The Midnight',
          affinityScore: 0.94,
          playCount: 65,
          lastInteractionAt: new Date(),
        },
      ],
      moods: [
        {
          mood: 'Chill',
          affinityScore: 0.82,
          playCount: 50,
        },
        {
          mood: 'Energetic',
          affinityScore: 0.65,
          playCount: 30,
        },
      ],
      listeningPatterns: {
        timeOfDayDistribution: {
          morning: 0.1,
          afternoon: 0.3,
          evening: 0.45,
          night: 0.15,
        },
        avgSessionDurationMinutes: 45,
        skipRate: 0.12,
        completionRate: 0.88,
        replayRate: 0.25,
        preferredSituations: ['coding', 'workout', 'relaxation'],
        audioFeaturePreferences: {
          energy: 0.72,
          danceability: 0.68,
          valence: 0.55,
          acousticness: 0.25,
          instrumentalness: 0.4,
        },
        preferredTempo: {
          min: 90,
          max: 135,
          target: 120,
        },
      },
      tendencies: {
        discoveryTendency: 0.8,
        familiarityPreference: 0.35,
        diversityPreference: 0.75,
        explorationPreference: 0.7,
      },
      temporalTaste: {
        stabilityScore: 0.82,
        activeTimeWindow: 'short_term',
        trendingGenres: ['Synthwave', 'French House'],
        emergingGenres: ['Cyberpunk EDM'],
        decliningGenres: ['Traditional Pop'],
        temporalAffinities: [
          {
            window: 'short_term',
            topGenres: ['Synthwave'],
            topArtists: ['The Midnight'],
            topMoods: ['Chill'],
            score: 0.9,
          },
        ],
      },
      confidenceScore: 0.85,
      metadata: {
        dominantAcousticProfile: 'electronic_retro',
        notes: 'Enjoys driving at sunset with retro synthwave vibes',
      },
    });

    // Mongoose schema validation should succeed cleanly
    await dnaDoc.validate();

    assert.strictEqual(dnaDoc.userId.toString(), userId.toString());
    assert.strictEqual(dnaDoc.dnaVersion, '1.2.0');
    assert.strictEqual(dnaDoc.genres.length, 2);
    assert.strictEqual(dnaDoc.genres[0].name, 'Synthwave');
    assert.strictEqual(dnaDoc.artists.length, 1);
    assert.strictEqual(dnaDoc.artists[0].name, 'The Midnight');
    assert.strictEqual(dnaDoc.moods.length, 2);
    assert.strictEqual(dnaDoc.tendencies.discoveryTendency, 0.8);
    assert.strictEqual(dnaDoc.tendencies.familiarityPreference, 0.35);
    assert.strictEqual(dnaDoc.tendencies.diversityPreference, 0.75);
    assert.strictEqual(dnaDoc.tendencies.explorationPreference, 0.7);
    assert.strictEqual(dnaDoc.listeningPatterns.avgSessionDurationMinutes, 45);
    assert.strictEqual(dnaDoc.temporalTaste.activeTimeWindow, 'short_term');
    assert.strictEqual(dnaDoc.confidenceScore, 0.85);
    assert.strictEqual(dnaDoc.metadata?.dominantAcousticProfile, 'electronic_retro');

    console.log('✓ Test 2 Passed: Full Music DNA document instantiates and validates all core dimensions.');
  }

  // Test 3: Validation Errors on Missing Required Fields
  {
    const invalidDoc = new MusicDNA({
      // Missing userId
      dnaVersion: '1.0.0',
    });

    let error: any = null;
    try {
      await invalidDoc.validate();
    } catch (err) {
      error = err;
    }

    assert.ok(error, 'Validation must fail when userId is missing');
    assert.ok(error.errors?.userId, 'Error must identify userId as required');

    console.log('✓ Test 3 Passed: Missing required userId is rejected as expected.');
  }

  // Test 4: Tendency Dimensions Boundaries and Clamping
  {
    // Out-of-bounds tendencies should be rejected by schema validation
    const outOfBoundsDoc = new MusicDNA({
      userId: new Types.ObjectId(),
      tendencies: {
        discoveryTendency: 1.5, // Exceeds max: 1.0
        familiarityPreference: -0.2, // Below min: 0.0
        diversityPreference: 0.5,
        explorationPreference: 0.5,
      },
    });

    let error: any = null;
    try {
      await outOfBoundsDoc.validate();
    } catch (err) {
      error = err;
    }

    assert.ok(error, 'Validation must fail when tendencies are outside [0.0, 1.0]');

    // Sanitizer clamps out-of-bounds tendencies gracefully
    const sanitizedResult = validateAndSanitizeMusicDNA({
      userId: new Types.ObjectId(),
      tendencies: {
        discoveryTendency: 1.8,
        familiarityPreference: -0.5,
        diversityPreference: 0.65,
        explorationPreference: 2.0,
      },
    });

    assert.strictEqual(sanitizedResult.isValid, true);
    assert.strictEqual(sanitizedResult.sanitized.tendencies.discoveryTendency, 1.0);
    assert.strictEqual(sanitizedResult.sanitized.tendencies.familiarityPreference, 0.0);
    assert.strictEqual(sanitizedResult.sanitized.tendencies.diversityPreference, 0.65);
    assert.strictEqual(sanitizedResult.sanitized.tendencies.explorationPreference, 1.0);

    console.log('✓ Test 4 Passed: Tendency dimensions boundary constraints and clamping verified.');
  }

  // Test 5: Reused Concepts and Situations Normalization
  {
    const sanitized = validateAndSanitizeMusicDNA({
      userId: new Types.ObjectId().toString(),
      listeningPatterns: {
        preferredSituations: ['studying', 'working', 'casual', 'gym'],
      },
      temporalTaste: {
        activeTimeWindow: 'short-term', // Hyphenated alias from TemporalPreference
        stabilityScore: 0.6,
      },
    });

    assert.deepStrictEqual(sanitized.sanitized.listeningPatterns.preferredSituations, [
      'study',
      'work',
      'general_listening',
      'workout',
    ]);
    assert.strictEqual(sanitized.sanitized.temporalTaste.activeTimeWindow, 'short_term');

    console.log('✓ Test 5 Passed: Reused temporal time windows and standard situations normalized.');
  }

  // Test 6: Extensibility and Model Statics
  {
    assert.strictEqual(typeof MusicDNA.findByUserId, 'function');
    assert.strictEqual(typeof MusicDNA.getOrCreateProfile, 'function');
    assert.strictEqual(typeof MusicDNA.updateTendencies, 'function');

    const extensibleDoc = new MusicDNA({
      userId: new Types.ObjectId(),
      metadata: {
        neuralEmbedding: [0.12, -0.45, 0.88],
        experimentalClusterId: 'cluster_94',
        futureV2Metrics: {
          acousticNoveltySensitivity: 0.77,
        },
      },
    });

    await extensibleDoc.validate();
    assert.deepStrictEqual(extensibleDoc.metadata?.neuralEmbedding, [0.12, -0.45, 0.88]);
    assert.strictEqual(extensibleDoc.metadata?.futureV2Metrics?.acousticNoveltySensitivity, 0.77);

    console.log('✓ Test 6 Passed: Model extensibility and static methods verified.');
  }

  console.log('🎉 All Music DNA Model tests passed successfully!');
}

// Self-executing runner for standalone execution
if (process.argv[1]?.includes('musicDnaModel.test')) {
  runMusicDNAModelTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Music DNA test failed:', err);
      process.exit(1);
    });
}
