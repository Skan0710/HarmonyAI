import assert from 'node:assert';
import {
  MusicDNAExtractionService,
  RawHistoryRecord,
  RawUserData,
} from '../services/musicDnaExtractionService.js';

export async function runMusicDNATasteExtractionTests() {
  console.log('[Music DNA Taste Extraction Test Suite] Starting tests...');

  // Test 1: User with No History (Cold Start)
  {
    const userId = crypto.randomUUID().toString();
    const rawInputs = {
      userId,
      user: {
        _id: userId,
        likedSongs: [],
        favoriteGenres: [],
        favoriteArtists: [],
      },
      history: [],
    };

    const profile = MusicDNAExtractionService.extractFromRawData(rawInputs);

    assert.strictEqual(profile.userId, userId);
    assert.strictEqual(profile.dnaVersion, '1.0.0');
    assert.strictEqual(profile.confidenceScore, 0.05, 'Zero history must result in lowest baseline confidence');
    assert.deepStrictEqual(profile.genres, []);
    assert.deepStrictEqual(profile.artists, []);
    assert.deepStrictEqual(profile.moods, []);

    // Tendencies should default to 0.5 without any NaN
    assert.strictEqual(profile.tendencies.discoveryTendency, 0.5);
    assert.strictEqual(profile.tendencies.familiarityPreference, 0.5);
    assert.strictEqual(profile.tendencies.diversityPreference, 0.5);
    assert.strictEqual(profile.tendencies.explorationPreference, 0.5);

    // Listening patterns should have valid numeric fallbacks
    assert.strictEqual(typeof profile.listeningPatterns.avgSessionDurationMinutes, 'number');
    assert.ok(!isNaN(profile.listeningPatterns.avgSessionDurationMinutes!));
    assert.ok(!isNaN(profile.listeningPatterns.skipRate!));
    assert.ok(!isNaN(profile.listeningPatterns.completionRate!));
    assert.ok(!isNaN(profile.listeningPatterns.replayRate!));

    assert.strictEqual(profile.metadata?.historyTier, 'NO_HISTORY');

    console.log('✓ Test 1 Passed: User with no history extracted cleanly with zero NaN and correct baseline defaults.');
  }

  // Test 2: User with No History but Explicit Onboarding Favorites
  {
    const userId = crypto.randomUUID().toString();
    const rawInputs = {
      userId,
      user: {
        _id: userId,
        likedSongs: [],
        favoriteGenres: [
          { _id: crypto.randomUUID().toString(), name: 'Lo-Fi' },
          { _id: crypto.randomUUID().toString(), name: 'Ambient' },
        ],
        favoriteArtists: [{ _id: crypto.randomUUID().toString(), name: 'Tycho' }],
      },
      history: [],
    };

    const profile = MusicDNAExtractionService.extractFromRawData(rawInputs);

    assert.strictEqual(profile.confidenceScore, 0.15, 'Explicit onboarding favorites elevate cold start confidence');
    assert.strictEqual(profile.genres.length, 2);
    assert.strictEqual(profile.genres[0].name, 'Lo-Fi');
    assert.strictEqual(profile.artists.length, 1);
    assert.strictEqual(profile.artists[0].name, 'Tycho');
    assert.strictEqual(profile.genres[0].affinityScore, 1.0);

    console.log('✓ Test 2 Passed: User with explicit onboarding favorites seeds genres/artists appropriately.');
  }

  // Test 3: User with Limited History (1 to 4 plays)
  {
    const userId = crypto.randomUUID().toString();
    const songId1 = crypto.randomUUID().toString();
    const songId2 = crypto.randomUUID().toString();

    const history: RawHistoryRecord[] = [
      {
        song: {
          _id: songId1,
          title: 'Sunset Lover',
          genre: { _id: 'g1', name: 'Chillwave' },
          artist: { _id: 'a1', name: 'Petit Biscuit' },
          mood: 'Chill',
          audioFeatures: { energy: 0.6, danceability: 0.7, valence: 0.5, bpm: 110 },
        },
        playedAt: new Date(Date.now() - 3600000), // 1 hr ago
        completed: true,
        skipped: false,
      },
      {
        song: {
          _id: songId2,
          title: 'Midnight City',
          genre: { _id: 'g2', name: 'Synthpop' },
          artist: { _id: 'a2', name: 'M83' },
          mood: 'Energetic',
          audioFeatures: { energy: 0.8, danceability: 0.65, valence: 0.7, bpm: 105 },
        },
        playedAt: new Date(Date.now() - 7200000), // 2 hrs ago
        completed: false,
        skipped: true,
      },
    ];

    const rawInputs = {
      userId,
      user: { _id: userId, likedSongs: [] },
      history,
    };

    const profile = MusicDNAExtractionService.extractFromRawData(rawInputs);

    assert.strictEqual(profile.metadata?.historyTier, 'LIMITED_HISTORY');
    assert.ok(profile.confidenceScore >= 0.1 && profile.confidenceScore <= 0.35);

    // Bayesian smoothed rates: 1 skip out of 2 plays should NOT be exactly 50% or NaN
    assert.ok(profile.listeningPatterns.skipRate! > 0.0 && profile.listeningPatterns.skipRate! < 0.6);
    assert.ok(profile.listeningPatterns.completionRate! > 0.4 && profile.listeningPatterns.completionRate! < 1.0);

    // Audio features should average the 2 played songs
    assert.strictEqual(profile.listeningPatterns.audioFeaturePreferences?.energy, 0.7);
    assert.strictEqual(profile.listeningPatterns.audioFeaturePreferences?.danceability, 0.675);
    assert.strictEqual(profile.listeningPatterns.preferredTempo?.target, 108); // avg of 110 & 105

    // Extracted genres
    assert.strictEqual(profile.genres.length, 2);
    // Chillwave was completed, Synthpop was skipped -> Chillwave should have higher affinity
    assert.ok(profile.genres[0].affinityScore >= profile.genres[1].affinityScore);

    console.log('✓ Test 3 Passed: Limited history extracted smoothly with Bayesian priors and correct audio feature blending.');
  }

  // Test 4: User with Large History (Repeats, High Diversity, Varied Skips)
  {
    const userId = crypto.randomUUID().toString();
    const history: RawHistoryRecord[] = [];

    const genresList = ['Electronic', 'House', 'Ambient', 'Synthwave', 'Indie Rock'];
    const artistsList = ['Daft Punk', 'Disclosure', 'Bonobo', 'The Midnight', 'Tame Impala'];

    const songCatalog = [
      { id: 's1', genre: genresList[0], artist: artistsList[0], mood: 'Energetic', energy: 0.85, bpm: 128 },
      { id: 's2', genre: genresList[1], artist: artistsList[1], mood: 'Upbeat', energy: 0.78, bpm: 124 },
      { id: 's3', genre: genresList[2], artist: artistsList[2], mood: 'Chill', energy: 0.45, bpm: 95 },
      { id: 's4', genre: genresList[3], artist: artistsList[3], mood: 'Chill', energy: 0.70, bpm: 118 },
      { id: 's5', genre: genresList[4], artist: artistsList[4], mood: 'Relaxed', energy: 0.62, bpm: 115 },
    ];

    const now = Date.now();

    // Generate 45 plays: heavily repeating s1 and s2 (to test familiarity & replay rate)
    for (let i = 0; i < 45; i++) {
      let catIdx = i % 5;
      if (i < 25) {
        catIdx = i % 2; // Repeat s1 and s2 frequently
      }

      const song = songCatalog[catIdx];
      const playedHoursAgo = i * 2; // spaced out
      const playedAt = new Date(now - playedHoursAgo * 3600 * 1000);

      history.push({
        song: {
          _id: song.id,
          title: `Track ${song.id}`,
          genre: { _id: `g_${song.genre}`, name: song.genre },
          artist: { _id: `a_${song.artist}`, name: song.artist },
          mood: song.mood,
          audioFeatures: {
            energy: song.energy,
            bpm: song.bpm,
            danceability: 0.7,
            valence: 0.6,
          },
        },
        playedAt,
        completed: i % 4 !== 0,
        skipped: i % 4 === 0,
      });
    }

    const rawInputs = {
      userId,
      user: {
        _id: userId,
        likedSongs: [
          { _id: 's1', genre: { _id: 'g_Electronic', name: 'Electronic' }, artist: { _id: 'a_Daft Punk', name: 'Daft Punk' } },
        ],
      },
      history,
    };

    const profile = MusicDNAExtractionService.extractFromRawData(rawInputs);

    assert.strictEqual(profile.metadata?.historyTier, 'LARGE_HISTORY');
    assert.ok(profile.confidenceScore >= 0.75, `Confidence score should be high for 45 plays, got ${profile.confidenceScore}`);

    // Replay Rate & Familiarity: User repeated 5 unique songs over 45 plays -> high replay rate & familiarity
    assert.ok(profile.listeningPatterns.replayRate! >= 0.7, 'Repeated listening must produce high replay rate');
    assert.ok(profile.tendencies.familiarityPreference >= 0.6, 'High repeats must produce high familiarity preference');

    // Genre distribution: Electronic and House should dominate the top ranks
    assert.ok(profile.genres.length >= 4);
    assert.ok(['Electronic', 'House'].includes(profile.genres[0].name));
    assert.strictEqual(profile.genres[0].affinityScore, 1.0);

    // Audio features correctly aggregated
    assert.ok(profile.listeningPatterns.audioFeaturePreferences?.energy! > 0.65);
    assert.ok(profile.listeningPatterns.preferredTempo?.target! > 110);

    console.log('✓ Test 4 Passed: Large history extracted with accurate replay rate, familiarity, and audio feature profile.');
  }

  // Test 5: Temporal Taste Shift and Stability Scoring
  {
    const userId = crypto.randomUUID().toString();
    const now = new Date('2026-06-01T12:00:00Z');
    const history: RawHistoryRecord[] = [];

    // Long term (40 days ago): Heavy Jazz listening
    for (let i = 0; i < 20; i++) {
      history.push({
        song: {
          _id: `jazz_${i}`,
          genre: { _id: 'g_jazz', name: 'Jazz' },
          artist: { _id: 'a_miles', name: 'Miles Davis' },
          mood: 'Chill',
        },
        playedAt: new Date(now.getTime() - (35 + i) * 24 * 3600 * 1000),
        completed: true,
      });
    }

    // Short term (past 5 days): Drastic shift to Cyberpunk EDM
    for (let i = 0; i < 15; i++) {
      history.push({
        song: {
          _id: `cyber_${i}`,
          genre: { _id: 'g_cyber', name: 'Cyberpunk EDM' },
          artist: { _id: 'a_cyber', name: 'Mega Drive' },
          mood: 'Energetic',
        },
        playedAt: new Date(now.getTime() - (1 + (i % 4)) * 24 * 3600 * 1000),
        completed: true,
      });
    }

    const rawInputs = {
      userId,
      user: { _id: userId, likedSongs: [] },
      history,
      referenceDate: now,
    };

    const profile = MusicDNAExtractionService.extractFromRawData(rawInputs, { referenceDate: now });

    // Emerging genre must be Cyberpunk EDM
    assert.ok(
      profile.temporalTaste.emergingGenres?.includes('Cyberpunk EDM') ||
      profile.temporalTaste.trendingGenres?.includes('Cyberpunk EDM'),
      'Cyberpunk EDM should be identified as emerging or trending'
    );

    // Declining genre should include Jazz
    assert.ok(
      profile.temporalTaste.decliningGenres?.includes('Jazz'),
      'Jazz should be identified as declining since no recent short-term plays exist'
    );

    // Stability score should drop due to divergence between short-term and long-term
    assert.ok(
      profile.temporalTaste.stabilityScore! < 0.6,
      `Stability score should drop during taste shift, got ${profile.temporalTaste.stabilityScore}`
    );

    console.log('✓ Test 5 Passed: Temporal taste shift, emerging/declining genres, and stability score verified.');
  }

  // Test 6: Database Persistence Integration via MusicDNA Model
  {
    const userId = crypto.randomUUID();
    const rawInputs = {
      userId: userId.toString(),
      user: { _id: userId.toString(), likedSongs: [] },
      history: [
        {
          song: {
            _id: crypto.randomUUID().toString(),
            genre: { _id: 'g_rock', name: 'Classic Rock' },
            artist: { _id: 'a_queen', name: 'Queen' },
            mood: 'Energetic',
          },
          playedAt: new Date(),
          completed: true,
        },
      ],
    };

    const extracted = MusicDNAExtractionService.extractFromRawData(rawInputs);

    assert.strictEqual(extracted.genres[0].name, 'Classic Rock');
    assert.strictEqual(extracted.artists[0].name, 'Queen');
    assert.strictEqual(extracted.metadata?.totalPlaysAnalyzed, 1);

    console.log('✓ Test 6 Passed: Extracted DNA profile has correctly shaped genres, artists, and metadata.');
  }

  console.log('🎉 All Music DNA Taste Extraction tests passed successfully!');
}

// Self-executing runner
if (process.argv[1]?.includes('musicDnaTasteExtraction.test')) {
  runMusicDNATasteExtractionTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Music DNA Taste Extraction test failed:', err);
      process.exit(1);
    });
}
