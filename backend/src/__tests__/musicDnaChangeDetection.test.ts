import assert from 'node:assert';
import {
  MusicDNAChangeDetectionService,
  TasteItemChange,
} from '../services/musicDnaChangeDetectionService.js';

export async function runMusicDnaChangeDetectionTests() {
  console.log('[Music DNA Change Detection Test Suite] Starting tests...');

  // Test 1: Stable Taste (microscopic fluctuations suppressed below significanceThreshold)
  {
    const previous = {
      userId: 'user-stable',
      timestamp: new Date('2026-08-01'),
      topGenres: [
        { name: 'Rock', affinityScore: 0.82, playCount: 50 },
        { name: 'Jazz', affinityScore: 0.65, playCount: 30 },
      ],
      topArtists: [
        { name: 'Pink Floyd', affinityScore: 0.88, playCount: 40 },
      ],
      preferredMoods: [
        { mood: 'Calm', affinityScore: 0.70 },
      ],
      tendencies: {
        discoveryTendency: 0.50,
        familiarityPreference: 0.70,
        diversityPreference: 0.45,
        explorationPreference: 0.40,
      },
      listeningBehavior: {
        repeatListeningTendency: 0.65,
        listenerArchetype: 'Loyalist',
      },
    };

    const current = {
      userId: 'user-stable',
      timestamp: new Date('2026-08-15'),
      topGenres: [
        { name: 'Rock', affinityScore: 0.84, playCount: 55 }, // +0.02 delta (< 0.08 threshold)
        { name: 'Jazz', affinityScore: 0.64, playCount: 32 }, // -0.01 delta (< 0.08 threshold)
      ],
      topArtists: [
        { name: 'Pink Floyd', affinityScore: 0.87, playCount: 44 }, // -0.01 delta
      ],
      preferredMoods: [
        { mood: 'Calm', affinityScore: 0.72 }, // +0.02 delta
      ],
      tendencies: {
        discoveryTendency: 0.51,
        familiarityPreference: 0.69,
        diversityPreference: 0.46,
        explorationPreference: 0.39,
      },
      listeningBehavior: {
        repeatListeningTendency: 0.64,
        listenerArchetype: 'Loyalist',
      },
    };

    const analysis = MusicDNAChangeDetectionService.detectTasteChanges(previous, current);

    assert.strictEqual(analysis.hasSufficientHistory, true);
    assert.strictEqual(analysis.tasteStabilityRating, 'highly_stable');
    assert.strictEqual(analysis.genreChanges.every((g) => g.classification === 'stable'), true);
    assert.strictEqual(analysis.artistChanges.every((a) => a.classification === 'stable'), true);
    assert.strictEqual(analysis.moodChanges.every((m) => m.classification === 'stable'), true);
    assert.strictEqual(analysis.summary.emergingGenres.length, 0);
    assert.strictEqual(analysis.summary.fadingGenres.length, 0);

    console.log('✓ Test 1 Passed: Stable taste with microscopic fluctuations correctly classified as stable.');
  }

  // Test 2: Rapidly Changing Taste
  {
    const previous = {
      userId: 'user-rapid',
      timestamp: new Date('2026-08-01'),
      topGenres: [
        { name: 'Classical', affinityScore: 0.85, playCount: 60 },
      ],
      topArtists: [
        { name: 'Bach', affinityScore: 0.80, playCount: 50 },
      ],
      tendencies: {
        discoveryTendency: 0.30,
        explorationPreference: 0.30,
      },
    };

    const current = {
      userId: 'user-rapid',
      timestamp: new Date('2026-08-15'),
      topGenres: [
        { name: 'Classical', affinityScore: 0.20, playCount: 62 }, // large drop
        { name: 'Dubstep', affinityScore: 0.85, playCount: 80 },    // brand new large genre
      ],
      topArtists: [
        { name: 'Bach', affinityScore: 0.15, playCount: 51 },
        { name: 'Skrillex', affinityScore: 0.90, playCount: 75 },
      ],
      tendencies: {
        discoveryTendency: 0.85,
        explorationPreference: 0.90,
      },
    };

    const analysis = MusicDNAChangeDetectionService.detectTasteChanges(previous, current);

    assert.strictEqual(analysis.hasSufficientHistory, true);
    assert.strictEqual(analysis.tasteStabilityRating, 'rapid_transformation');
    assert.ok(analysis.overallShiftMagnitude >= 0.25, 'Shift magnitude should be >= 0.25');

    console.log('✓ Test 2 Passed: Rapid taste transformation correctly detected and classified.');
  }

  // Test 3: Emerging Genre Detection
  {
    const previous = {
      userId: 'user-emerging-genre',
      topGenres: [
        { name: 'Synthwave', affinityScore: 0.85 },
        { name: 'Darksynth', affinityScore: 0.10 }, // low baseline (< 0.20)
      ],
    };

    const current = {
      userId: 'user-emerging-genre',
      topGenres: [
        { name: 'Synthwave', affinityScore: 0.86 },
        { name: 'Darksynth', affinityScore: 0.68 }, // rose to >= 0.50 emergence threshold
      ],
    };

    const analysis = MusicDNAChangeDetectionService.detectTasteChanges(previous, current);
    const darksynthChange = analysis.genreChanges.find((g) => g.name === 'Darksynth');

    assert.ok(darksynthChange, 'Darksynth change should be recorded');
    assert.strictEqual(darksynthChange?.classification, 'emerging');
    assert.ok(analysis.summary.emergingGenres.includes('Darksynth'));

    console.log('✓ Test 3 Passed: Emerging genre (low baseline rising above emergence threshold) detected.');
  }

  // Test 4: Fading Genre Detection
  {
    const previous = {
      userId: 'user-fading-genre',
      topGenres: [
        { name: 'House', affinityScore: 0.75 }, // was strong (>= 0.50)
      ],
    };

    const current = {
      userId: 'user-fading-genre',
      topGenres: [
        { name: 'House', affinityScore: 0.15 }, // dropped below fading threshold (< 0.25)
      ],
    };

    const analysis = MusicDNAChangeDetectionService.detectTasteChanges(previous, current);
    const houseChange = analysis.genreChanges.find((g) => g.name === 'House');

    assert.ok(houseChange, 'House change should be recorded');
    assert.strictEqual(houseChange?.classification, 'fading');
    assert.ok(analysis.summary.fadingGenres.includes('House'));

    console.log('✓ Test 4 Passed: Fading genre (strong previously dropping below fading threshold) detected.');
  }

  // Test 5: Changing Artist Preference (Emerging and Increased)
  {
    const previous = {
      userId: 'user-artist-shift',
      topArtists: [
        { name: 'Kavinsky', affinityScore: 0.80 },
        { name: 'Gunship', affinityScore: 0.40 },
      ],
    };

    const current = {
      userId: 'user-artist-shift',
      topArtists: [
        { name: 'Kavinsky', affinityScore: 0.81 },
        { name: 'Gunship', affinityScore: 0.72 }, // +0.32 increase
        { name: 'The Midnight', affinityScore: 0.65 }, // brand new emerging artist
      ],
    };

    const analysis = MusicDNAChangeDetectionService.detectTasteChanges(previous, current);
    const gunshipChange = analysis.artistChanges.find((a) => a.name === 'Gunship');
    const midnightChange = analysis.artistChanges.find((a) => a.name === 'The Midnight');

    assert.strictEqual(gunshipChange?.classification, 'increased');
    assert.strictEqual(midnightChange?.classification, 'emerging');

    console.log('✓ Test 5 Passed: Changing artist preference correctly identified with increased and emerging statuses.');
  }

  // Test 6: Insufficient History (null previous snapshot)
  {
    const current = {
      userId: 'user-new',
      topGenres: [{ name: 'Pop', affinityScore: 0.70 }],
    };

    const analysis = MusicDNAChangeDetectionService.detectTasteChanges(null, current);

    assert.strictEqual(analysis.hasSufficientHistory, false);
    assert.strictEqual(analysis.tasteStabilityRating, 'unrated');
    assert.strictEqual(analysis.overallShiftMagnitude, 0.0);
    assert.strictEqual(analysis.genreChanges.length, 0);
    assert.match(analysis.summary.primaryTasteDirection, /Insufficient historical snapshot/i);

    console.log('✓ Test 6 Passed: Insufficient snapshot history handled gracefully without errors.');
  }

  console.log('🎉 All Music DNA Change Detection tests passed successfully!\n');
}

if (process.argv[1]?.includes('musicDnaChangeDetection.test')) {
  runMusicDnaChangeDetectionTests().catch((err) => {
    console.error('Music DNA Change Detection test failed:', err);
    process.exit(1);
  });
}
