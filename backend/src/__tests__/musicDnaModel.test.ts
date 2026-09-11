import assert from 'node:assert';
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
    const userId = crypto.randomUUID();
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

  // Test 4: Tendency Dimensions Boundaries and Clamping
  {
    // Sanitizer clamps out-of-bounds tendencies gracefully
    const sanitizedResult = validateAndSanitizeMusicDNA({
      userId: crypto.randomUUID(),
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
      userId: crypto.randomUUID().toString(),
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
