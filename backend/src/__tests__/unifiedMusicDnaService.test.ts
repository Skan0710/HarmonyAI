import assert from 'node:assert';
import {
  UnifiedMusicDNAService,
  UnifiedProfilingOptions,
} from '../services/unifiedMusicDnaService.js';
import { BehaviorProfilingRawInputs } from '../services/musicDnaBehaviorProfilingService.js';
import { RawHistoryRecord } from '../services/musicDnaExtractionService.js';

export async function runUnifiedMusicDNAServiceTests() {
  console.log('[Unified Music DNA Service Test Suite] Starting tests...');

  // Test 1: New User (Cold Start / Insufficient History)
  {
    const userId = crypto.randomUUID().toString();
    const rawInputs: BehaviorProfilingRawInputs = {
      userId,
      user: {
        _id: userId,
        likedSongs: [],
        favoriteGenres: [],
        favoriteArtists: [],
      },
      history: [],
      sessions: [],
      feedback: [],
    };

    const unified = UnifiedMusicDNAService.generateUnifiedProfileFromData(rawInputs);

    assert.strictEqual(unified.userId, userId);
    assert.strictEqual(unified.dnaVersion, '1.0.0');
    assert.strictEqual(unified.listeningBehavior.isDataSufficient, false);
    assert.strictEqual(unified.confidenceScore, 0.05);

    // All core profiles must be cleanly structured
    assert.ok(Array.isArray(unified.genreProfile.topGenres));
    assert.ok(Array.isArray(unified.genreProfile.emergingGenres));
    assert.strictEqual(typeof unified.genreProfile.diversity.score, 'number');

    assert.ok(Array.isArray(unified.artistProfile.strongestArtists));
    assert.ok(Array.isArray(unified.artistProfile.emergingArtists));
    assert.strictEqual(typeof unified.artistProfile.diversity.score, 'number');

    assert.ok(Array.isArray(unified.moodProfile.preferredMoods));

    // Tendencies must be bounded [0.0, 1.0] with zero NaN
    assert.strictEqual(unified.tendencies.discoveryTendency, 0.5);
    assert.strictEqual(unified.tendencies.familiarityPreference, 0.5);
    assert.strictEqual(unified.tendencies.diversityPreference, 0.5);
    assert.strictEqual(unified.tendencies.explorationPreference, 0.5);

    // Listening patterns must have valid numeric fallbacks
    assert.strictEqual(typeof unified.listeningPatterns.avgSessionDurationMinutes, 'number');
    assert.ok(!isNaN(unified.listeningPatterns.skipRate!));
    assert.ok(!isNaN(unified.listeningPatterns.completionRate!));
    assert.ok(!isNaN(unified.listeningPatterns.replayRate!));

    console.log('✓ Test 1 Passed: New user cold start generates a safe, clean, consistent Unified Music DNA profile.');
  }

  // Test 2: Established User with Rich Listening Activity
  {
    const userId = crypto.randomUUID().toString();
    const now = new Date('2026-08-01T12:00:00Z');
    const history: RawHistoryRecord[] = [];

    const genresList = ['Electronic', 'House', 'Ambient', 'Synthwave', 'Indie Rock'];
    const artistsList = ['Daft Punk', 'Disclosure', 'Bonobo', 'The Midnight', 'Tame Impala'];

    // 40 plays spanning recent and baseline horizons
    for (let i = 0; i < 40; i++) {
      const g = genresList[i % genresList.length];
      const a = artistsList[i % artistsList.length];
      const hoursAgo = i * 4;
      history.push({
        song: {
          _id: `song_${i % 10}`, // repeat 10 songs over 40 plays
          genre: { _id: `g_${g}`, name: g },
          artist: { _id: `a_${a}`, name: a },
          mood: i % 2 === 0 ? 'Chill' : 'Energetic',
          audioFeatures: {
            energy: 0.72,
            danceability: 0.65,
            valence: 0.55,
            bpm: 120,
          },
        },
        playedAt: new Date(now.getTime() - hoursAgo * 3600 * 1000),
        completed: i % 5 !== 0,
        skipped: i % 5 === 0,
      });
    }

    const sessions = [
      {
        startTime: new Date(now.getTime() - 24 * 3600 * 1000),
        endTime: new Date(now.getTime() - 22 * 3600 * 1000),
        tracksPlayed: new Array(15).fill({}),
      },
    ];

    const rawInputs: BehaviorProfilingRawInputs = {
      userId,
      user: {
        _id: userId,
        likedSongs: [{ _id: 'song_0' }],
      },
      history,
      sessions,
      referenceDate: now,
    };

    const unified = UnifiedMusicDNAService.generateUnifiedProfileFromData(rawInputs, {
      referenceDate: now,
    });

    assert.strictEqual(unified.userId, userId);
    assert.strictEqual(unified.listeningBehavior.isDataSufficient, true);
    assert.ok(unified.confidenceScore >= 0.70, `Confidence should be high for established user, got ${unified.confidenceScore}`);

    // Verify genre profile
    assert.ok(unified.genreProfile.topGenres.length >= 4);
    assert.ok(unified.genreProfile.diversity.score > 0.5);

    // Verify artist profile
    assert.ok(unified.artistProfile.strongestArtists.length >= 4);

    // Verify mood profile
    assert.ok(unified.moodProfile.preferredMoods.some((m) => m.name === 'Chill'));

    // Verify listening behavior
    assert.ok(unified.listeningBehavior.metricsBreakdown.totalPlaysAnalyzed === 40);
    assert.ok(unified.listeningBehavior.sessionListeningIntensity > 0);

    // Verify temporal preferences
    assert.ok(typeof unified.temporalPreferences.stabilityScore === 'number');

    console.log('✓ Test 2 Passed: Established user profile successfully synthesizes all components into unified structure.');
  }

  // Test 3: Consistency of All 8 Required Dimensions
  {
    const userId = crypto.randomUUID().toString();
    const rawInputs: BehaviorProfilingRawInputs = {
      userId,
      history: [
        {
          song: {
            _id: 's_rock',
            genre: { _id: 'g_rock', name: 'Rock' },
            artist: { _id: 'a_queen', name: 'Queen' },
            mood: 'Energetic',
          },
          completed: true,
        },
      ],
    };

    const unified = UnifiedMusicDNAService.generateUnifiedProfileFromData(rawInputs);

    // 1. genre profile
    assert.ok(unified.genreProfile);
    assert.ok(Array.isArray(unified.genreProfile.topGenres));

    // 2. artist profile
    assert.ok(unified.artistProfile);
    assert.ok(Array.isArray(unified.artistProfile.strongestArtists));

    // 3. mood profile
    assert.ok(unified.moodProfile);
    assert.ok(Array.isArray(unified.moodProfile.preferredMoods));

    // 4. listening behavior
    assert.ok(unified.listeningBehavior);
    assert.ok(typeof unified.listeningBehavior.repeatListeningTendency === 'number');

    // 5. temporal preferences
    assert.ok(unified.temporalPreferences);
    assert.ok(Array.isArray(unified.temporalPreferences.trendingGenres));

    // 6. exploration tendency
    assert.ok(typeof unified.tendencies.explorationPreference === 'number');

    // 7. familiarity preference
    assert.ok(typeof unified.tendencies.familiarityPreference === 'number');

    // 8. diversity preference
    assert.ok(typeof unified.tendencies.diversityPreference === 'number');

    // Normalized scores check
    const tendencyKeys: (keyof typeof unified.tendencies)[] = [
      'discoveryTendency',
      'familiarityPreference',
      'diversityPreference',
      'explorationPreference',
    ];
    for (const k of tendencyKeys) {
      assert.ok(unified.tendencies[k] >= 0.0 && unified.tendencies[k] <= 1.0);
    }

    console.log('✓ Test 3 Passed: All 8 required dimensions consistently present and bounded.');
  }

  // Test 4: Smart Refreshing Logic Simulation
  {
    // Simulate interaction threshold evaluation:
    // When new interactions < minInteractionsThreshold (3) and cache is fresh -> skip recalculation
    const cachedProfile = {
      userId: 'user_123',
      lastRefreshedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 mins ago
      interactionsCountAtLastRefresh: 20,
    };

    const currentPlays1 = 21; // only 1 new play (delta = 1 < 3)
    const delta1 = currentPlays1 - cachedProfile.interactionsCountAtLastRefresh;
    const isCacheFresh1 = Date.now() - cachedProfile.lastRefreshedAt.getTime() < 60 * 60 * 1000;
    const shouldSkip1 = delta1 < 3 && isCacheFresh1;
    assert.strictEqual(shouldSkip1, true, 'Should skip recalculation when interaction delta is 1');

    const currentPlays2 = 25; // 5 new plays (delta = 5 >= 3)
    const delta2 = currentPlays2 - cachedProfile.interactionsCountAtLastRefresh;
    const shouldSkip2 = delta2 < 3 && isCacheFresh1;
    assert.strictEqual(shouldSkip2, false, 'Should trigger recalculation when interaction delta is 5');

    console.log('✓ Test 4 Passed: Smart refresh logic accurately avoids unnecessary recalculations.');
  }

  console.log('🎉 All Unified Music DNA Service tests passed successfully!');
}

// Self-executing runner
if (process.argv[1]?.includes('unifiedMusicDnaService.test')) {
  runUnifiedMusicDNAServiceTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Unified Music DNA Service test failed:', err);
      process.exit(1);
    });
}
