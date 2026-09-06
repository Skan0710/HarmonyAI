import assert from 'node:assert';
import { Types } from 'mongoose';
import {
  MusicDNABehaviorProfilingService,
  BehaviorProfilingRawInputs,
} from '../services/musicDnaBehaviorProfilingService.js';
import {
  MusicDNAExtractionService,
  RawHistoryRecord,
} from '../services/musicDnaExtractionService.js';

export async function runMusicDNABehaviorProfilingTests() {
  console.log('[Music DNA Behavior Profiling Test Suite] Starting tests...');

  // Test 1: The Loyalist / Heavy Repeater Pattern
  {
    const userId = new Types.ObjectId().toString();
    const history: RawHistoryRecord[] = [];

    // Repeat 3 tracks heavily over 36 plays
    const favSongs = [
      { id: 'fav_1', genre: 'Dream Pop', artist: 'Beach House' },
      { id: 'fav_2', genre: 'Shoegaze', artist: 'Slowdive' },
      { id: 'fav_3', genre: 'Dream Pop', artist: 'Cocteau Twins' },
    ];

    for (let i = 0; i < 36; i++) {
      const s = favSongs[i % 3];
      history.push({
        song: {
          _id: s.id,
          genre: { _id: `g_${s.genre}`, name: s.genre },
          artist: { _id: `a_${s.artist}`, name: s.artist },
        },
        playedAt: new Date(Date.now() - i * 3600 * 1000),
        completed: true,
      });
    }

    const rawInputs: BehaviorProfilingRawInputs = {
      userId,
      user: {
        _id: userId,
        likedSongs: [{ _id: 'fav_1' }],
        favoriteArtists: [{ _id: 'a_Beach House', name: 'Beach House' }],
      },
      history,
    };

    const profile = MusicDNABehaviorProfilingService.profileListeningBehaviorFromData(rawInputs);

    assert.strictEqual(profile.userId, userId);
    assert.strictEqual(profile.isDataSufficient, true);
    assert.ok(profile.repeatListeningTendency >= 0.65, `Repeat tendency should be >= 0.65, got ${profile.repeatListeningTendency}`);
    assert.ok(profile.familiarityPreference >= 0.50, `Familiarity preference should be >= 0.50, got ${profile.familiarityPreference}`);
    assert.ok(profile.discoveryTendency <= 0.40, `Discovery tendency should be low for heavy repeats, got ${profile.discoveryTendency}`);
    assert.strictEqual(profile.listenerArchetype, 'Loyalist');
    assert.ok(profile.metricsBreakdown.replayRatio >= 0.85);

    console.log('✓ Test 1 Passed: The Loyalist behavior pattern accurately profiled with high repeat/familiarity.');
  }

  // Test 2: The Adventurer / Explorer Pattern
  {
    const userId = new Types.ObjectId().toString();
    const history: RawHistoryRecord[] = [];

    // 35 completely distinct songs, each by a different artist
    for (let i = 0; i < 35; i++) {
      history.push({
        song: {
          _id: `unique_song_${i}`,
          genre: { _id: `g_${i % 10}`, name: `Genre ${i % 10}` },
          artist: { _id: `unique_artist_${i}`, name: `Artist ${i}` },
        },
        playedAt: new Date(Date.now() - i * 1800 * 1000),
        completed: true,
      });
    }

    const rawInputs: BehaviorProfilingRawInputs = {
      userId,
      user: { _id: userId, likedSongs: [] },
      history,
    };

    const profile = MusicDNABehaviorProfilingService.profileListeningBehaviorFromData(rawInputs);

    assert.ok(profile.discoveryTendency >= 0.70, `Discovery tendency should be high, got ${profile.discoveryTendency}`);
    assert.ok(profile.explorationTendency >= 0.60, `Exploration tendency should be high, got ${profile.explorationTendency}`);
    assert.ok(profile.repeatListeningTendency <= 0.15, `Repeat tendency should be near zero, got ${profile.repeatListeningTendency}`);
    assert.ok(profile.listenerArchetype === 'Adventurer' || profile.listenerArchetype === 'Eclectic Nomad');

    // Also check through MusicDNAExtractionService unified wrapper
    const extractedWrapper = MusicDNAExtractionService.profileListeningBehaviorFromData(rawInputs);
    assert.strictEqual(extractedWrapper.listenerArchetype, profile.listenerArchetype);

    console.log('✓ Test 2 Passed: The Adventurer/Explorer behavior pattern accurately profiled with high discovery/exploration.');
  }

  // Test 3: The Restless Searcher (High Skip Tendency)
  {
    const userId = new Types.ObjectId().toString();
    const history: RawHistoryRecord[] = [];

    // 25 plays with 18 skips (rapid skimming)
    for (let i = 0; i < 25; i++) {
      history.push({
        song: {
          _id: `skim_${i}`,
          genre: { _id: 'g1', name: 'Pop' },
          artist: { _id: 'a1', name: 'Pop Artist' },
        },
        playedAt: new Date(Date.now() - i * 300 * 1000),
        skipped: i < 18,
        completed: i >= 18,
      });
    }

    const profile = MusicDNABehaviorProfilingService.profileListeningBehaviorFromData({
      userId,
      history,
    });

    assert.ok(profile.skipTendency >= 0.50, `Skip tendency should be elevated, got ${profile.skipTendency}`);
    assert.strictEqual(profile.listenerArchetype, 'Restless Searcher');
    assert.ok(profile.metricsBreakdown.skipRatio >= 0.70);

    console.log('✓ Test 3 Passed: The Restless Searcher accurately detected from high skip frequency.');
  }

  // Test 4: Marathon Session Listening Intensity
  {
    const userId = new Types.ObjectId().toString();

    // 3 long multi-hour sessions with high track density
    const sessions = [
      {
        startTime: new Date('2026-06-01T14:00:00Z'),
        endTime: new Date('2026-06-01T16:30:00Z'), // 150 mins
        tracksPlayed: new Array(28).fill({}),
      },
      {
        startTime: new Date('2026-06-02T18:00:00Z'),
        endTime: new Date('2026-06-02T20:00:00Z'), // 120 mins
        tracksPlayed: new Array(22).fill({}),
      },
      {
        startTime: new Date('2026-06-03T10:00:00Z'),
        endTime: new Date('2026-06-03T12:00:00Z'), // 120 mins
        tracksPlayed: new Array(24).fill({}),
      },
    ];

    const history: RawHistoryRecord[] = [];
    for (let i = 0; i < 74; i++) {
      history.push({
        song: {
          _id: `marathon_${i}`,
          genre: { _id: 'g_ambient', name: 'Ambient' },
          artist: { _id: 'a_eno', name: 'Brian Eno' },
        },
        completed: true,
      });
    }

    const profile = MusicDNABehaviorProfilingService.profileListeningBehaviorFromData({
      userId,
      history,
      sessions,
    });

    assert.ok(
      profile.sessionListeningIntensity >= 0.75,
      `Session listening intensity should be high for 2+ hour marathon sessions, got ${profile.sessionListeningIntensity}`
    );
    assert.ok(profile.metricsBreakdown.avgTracksPerSession >= 20);
    assert.ok(profile.metricsBreakdown.avgSessionDurationMinutes >= 100);

    console.log('✓ Test 4 Passed: Marathon session listening intensity accurately measured from session telemetry.');
  }

  // Test 5: Preference Stability and Change Rate under Taste Drift
  {
    const userId = new Types.ObjectId().toString();
    const now = new Date('2026-08-01T12:00:00Z');
    const history: RawHistoryRecord[] = [];

    // Long-term baseline (30-60 days ago): Heavy Classical listening
    for (let i = 0; i < 20; i++) {
      history.push({
        song: {
          _id: `classical_${i}`,
          genre: { _id: 'g_classical', name: 'Classical' },
          artist: { _id: 'a_bach', name: 'J.S. Bach' },
        },
        playedAt: new Date(now.getTime() - (30 + i) * 24 * 3600 * 1000),
        completed: true,
      });
    }

    // Short-term recent listening (past 5 days): Complete drift to Cyberpunk EDM
    for (let i = 0; i < 18; i++) {
      history.push({
        song: {
          _id: `edm_${i}`,
          genre: { _id: 'g_edm', name: 'Cyberpunk EDM' },
          artist: { _id: 'a_mega', name: 'Mega Drive' },
        },
        playedAt: new Date(now.getTime() - (1 + (i % 4)) * 24 * 3600 * 1000),
        completed: true,
      });
    }

    const profile = MusicDNABehaviorProfilingService.profileListeningBehaviorFromData(
      {
        userId,
        history,
      },
      { referenceDate: now }
    );

    // With zero overlap between recent and baseline genres, stability should be low and change rate high
    assert.ok(
      profile.preferenceStability <= 0.35,
      `Preference stability should drop during total taste shift, got ${profile.preferenceStability}`
    );
    assert.ok(
      profile.preferenceChangeRate >= 0.65,
      `Preference change rate should be elevated during total taste shift, got ${profile.preferenceChangeRate}`
    );

    console.log('✓ Test 5 Passed: Preference stability and change rate accurately reflect taste drift velocity.');
  }

  // Test 6: Zero History Handling (No Fake Data)
  {
    const userId = new Types.ObjectId().toString();
    const profile = MusicDNABehaviorProfilingService.profileListeningBehaviorFromData({
      userId,
      history: [],
      sessions: [],
      feedback: [],
    });

    assert.strictEqual(profile.isDataSufficient, false);
    assert.strictEqual(profile.confidenceScore, 0.0);
    assert.strictEqual(profile.repeatListeningTendency, 0.0);
    assert.strictEqual(profile.discoveryTendency, 0.0);
    assert.strictEqual(profile.skipTendency, 0.0);
    assert.strictEqual(profile.metricsBreakdown.totalPlaysAnalyzed, 0);
    assert.strictEqual(profile.metadata?.status, 'NO_DATA');

    console.log('✓ Test 6 Passed: Zero history handled safely without generating fake data.');
  }

  // Test 7: Normalized Boundaries [0.0, 1.0] across all 9 metrics
  {
    const userId = new Types.ObjectId().toString();
    const history: RawHistoryRecord[] = [
      {
        song: {
          _id: 's1',
          genre: { _id: 'g1', name: 'Jazz' },
          artist: { _id: 'a1', name: 'Coltrane' },
        },
        completed: true,
      },
      {
        song: {
          _id: 's2',
          genre: { _id: 'g2', name: 'Soul' },
          artist: { _id: 'a2', name: 'Aretha' },
        },
        skipped: true,
      },
      {
        song: {
          _id: 's1',
          genre: { _id: 'g1', name: 'Jazz' },
          artist: { _id: 'a1', name: 'Coltrane' },
        },
        completed: true,
      },
    ];

    const profile = MusicDNABehaviorProfilingService.profileListeningBehaviorFromData({
      userId,
      history,
    });

    const metrics = [
      profile.repeatListeningTendency,
      profile.discoveryTendency,
      profile.skipTendency,
      profile.familiarityPreference,
      profile.explorationTendency,
      profile.diversityPreference,
      profile.sessionListeningIntensity,
      profile.preferenceStability,
      profile.preferenceChangeRate,
      profile.confidenceScore,
    ];

    for (const m of metrics) {
      assert.ok(typeof m === 'number');
      assert.ok(!isNaN(m));
      assert.ok(m >= 0.0 && m <= 1.0, `Metric ${m} must be bounded within [0.0, 1.0]`);
    }

    console.log('✓ Test 7 Passed: All 9 behavioral metrics strictly bounded within [0.0, 1.0].');
  }

  console.log('🎉 All Music DNA Listening Behavior Profiling tests passed successfully!');
}

// Self-executing runner
if (process.argv[1]?.includes('musicDnaBehaviorProfiling.test')) {
  runMusicDNABehaviorProfilingTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Music DNA Behavior Profiling test failed:', err);
      process.exit(1);
    });
}
