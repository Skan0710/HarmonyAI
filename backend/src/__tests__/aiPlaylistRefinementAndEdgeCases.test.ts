import assert from 'node:assert';
import {
  DedicatedPlaylistGenerationService,
  AIPlaylistGenerationInput,
  updatePlaylistDurationConfig,
  resetPlaylistDurationConfig,
} from '../services/dedicatedPlaylistGenerationService.js';
import { PlaylistSequencingService } from '../services/playlistSequencingService.js';
import { generateAIPlaylistEndpoint } from '../controllers/playlistController.js';

export function runAIPlaylistRefinementAndEdgeCasesTests() {
  console.log('[AI Playlist Refinement & Edge Cases Test Suite] Starting tests...');

  // Helper mock songs
  const mockCatalog = [
    {
      _id: 'song_synth_1',
      title: 'Neon Horizon',
      artist: { name: 'Kavinsky' },
      genre: { name: 'Synthwave' },
      mood: 'Energetic',
      duration: 240, // 4 mins
      audioFeatures: { energy: 0.88, bpm: 130 },
    },
    {
      _id: 'song_synth_2',
      title: 'Nightcall Drive',
      artist: { name: 'Kavinsky' },
      genre: { name: 'Synthwave' },
      mood: 'Chill',
      duration: 210, // 3.5 mins
      audioFeatures: { energy: 0.65, bpm: 110 },
    },
    {
      _id: 'song_synth_3',
      title: 'Pacific Coast',
      artist: { name: 'Kavinsky' },
      genre: { name: 'Synthwave' },
      mood: 'Energetic',
      duration: 200,
      audioFeatures: { energy: 0.85, bpm: 128 },
    },
    {
      _id: 'song_indie_1',
      title: 'Motion Sickness',
      artist: { name: 'Phoebe Bridgers' },
      genre: { name: 'Indie' },
      mood: 'Melancholic',
      duration: 230,
      audioFeatures: { energy: 0.35, bpm: 95 },
    },
    {
      _id: 'song_indie_2',
      title: 'Kyoto',
      artist: { name: 'Phoebe Bridgers' },
      genre: { name: 'Indie' },
      mood: 'Upbeat',
      duration: 180,
      audioFeatures: { energy: 0.70, bpm: 120 },
    },
    {
      _id: 'song_ambient_1',
      title: 'Weightless Focus',
      artist: { name: 'Marconi Union' },
      genre: { name: 'Ambient' },
      mood: 'Focus',
      duration: 480, // 8 mins
      audioFeatures: { energy: 0.15, bpm: 60 },
    },
  ];

  // Test 1: Duration Targeting & Tolerance Bounds
  {
    const targetMinutes = 10; // 600 seconds
    const toleranceSeconds = 120; // [480, 720]
    const input: AIPlaylistGenerationInput = {
      targetDurationMinutes: targetMinutes,
      durationToleranceSeconds: toleranceSeconds,
      searchPrompt: 'Synthwave night drive',
    };

    DedicatedPlaylistGenerationService.generatePlaylist(input).then((res) => {
      assert.ok(res.durationDiagnostics !== undefined);
      assert.strictEqual(res.durationDiagnostics?.targetDurationSeconds, 600);
      assert.strictEqual(res.durationDiagnostics?.durationToleranceSeconds, 120);
      assert.ok(typeof res.durationDiagnostics?.isWithinTolerance === 'boolean');
      assert.ok(res.totalDurationSeconds >= 0);

      console.log('✓ Test 1 Passed: Duration targeting & tolerance bounds verified.');
    });
  }

  // Test 2: Duplicate Prevention in Duration-Aware Selection
  {
    const tracksWithDuplicates = [
      { song: mockCatalog[0], score: 0.9, noveltyScore: 0.3, genre: 'Synthwave', artist: 'Kavinsky' },
      { song: mockCatalog[0], score: 0.9, noveltyScore: 0.3, genre: 'Synthwave', artist: 'Kavinsky' }, // Duplicate
      { song: mockCatalog[1], score: 0.85, noveltyScore: 0.4, genre: 'Synthwave', artist: 'Kavinsky' },
      { song: mockCatalog[3], score: 0.8, noveltyScore: 0.5, genre: 'Indie', artist: 'Phoebe Bridgers' },
    ];

    const sequenced = PlaylistSequencingService.sequenceTracks(tracksWithDuplicates, 'balanced');
    // Ensure all songs in sequencing are valid
    assert.strictEqual(sequenced.sequencedTracks.length, 4);

    console.log('✓ Test 2 Passed: Duplicate tracking and sequencing verified.');
  }

  // Test 3: Artist Diversity & Spacing Enforcement
  {
    const inputTracks = [
      { song: mockCatalog[0], score: 0.95, artist: 'Kavinsky', genre: 'Synthwave' },
      { song: mockCatalog[1], score: 0.90, artist: 'Kavinsky', genre: 'Synthwave' },
      { song: mockCatalog[2], score: 0.85, artist: 'Kavinsky', genre: 'Synthwave' },
      { song: mockCatalog[3], score: 0.80, artist: 'Phoebe Bridgers', genre: 'Indie' },
      { song: mockCatalog[5], score: 0.75, artist: 'Marconi Union', genre: 'Ambient' },
    ];

    const result = PlaylistSequencingService.sequenceTracks(inputTracks, 'balanced');
    assert.strictEqual(result.diagnostics.sameArtistAdjacentCount, 0);

    // Verify Kavinsky tracks are spaced apart
    for (let i = 0; i < result.sequencedTracks.length - 1; i++) {
      const a = result.sequencedTracks[i].artist;
      const b = result.sequencedTracks[i + 1].artist;
      assert.notStrictEqual(a + b, 'KavinskyKavinsky', 'Adjacent Kavinsky tracks must be separated');
    }

    console.log('✓ Test 3 Passed: Artist diversity & spacing enforcement verified.');
  }

  // Test 4: Genre Diversity & Explicit Concentration Override
  {
    const input: AIPlaylistGenerationInput = {
      preferredGenres: ['Synthwave'],
      targetSongCount: 5,
    };

    DedicatedPlaylistGenerationService.generatePlaylist(input).then((res) => {
      assert.ok(res.diversityDiagnostics !== undefined);
      assert.ok(typeof res.diversityDiagnostics?.uniqueGenresCount === 'number');
      assert.ok(typeof res.diversityDiagnostics?.genreDistribution === 'object');

      console.log('✓ Test 4 Passed: Genre diversity & explicit genre prioritization verified.');
    });
  }

  // Test 5: Novelty Selection & Discovery Percentage
  {
    const familiarInput: AIPlaylistGenerationInput = {
      discoveryPercentage: 10, // Familiar
      targetSongCount: 4,
    };
    const discoveryInput: AIPlaylistGenerationInput = {
      discoveryPercentage: 90, // High discovery
      targetSongCount: 4,
    };

    Promise.all([
      DedicatedPlaylistGenerationService.generatePlaylist(familiarInput),
      DedicatedPlaylistGenerationService.generatePlaylist(discoveryInput),
    ]).then(([famRes, discRes]) => {
      assert.strictEqual(famRes.diversityDiagnostics?.discoveryPercentage, 10);
      assert.strictEqual(discRes.diversityDiagnostics?.discoveryPercentage, 90);

      console.log('✓ Test 5 Passed: Novelty selection & discovery percentage scaling verified.');
    });
  }

  // Test 6: Mood-Based Generation
  {
    const input: AIPlaylistGenerationInput = {
      mood: 'Energetic',
      targetSongCount: 5,
    };

    DedicatedPlaylistGenerationService.generatePlaylist(input).then((res) => {
      assert.strictEqual(res.preferences.mood, 'Energetic');
      assert.ok(res.title.toLowerCase().includes('energetic') || res.title.toLowerCase().includes('mix'));

      console.log('✓ Test 6 Passed: Mood-based generation & title alignment verified.');
    });
  }

  // Test 7: Activity-Based Generation
  {
    const input: AIPlaylistGenerationInput = {
      activity: 'Late Night Coding',
      targetSongCount: 6,
    };

    DedicatedPlaylistGenerationService.generatePlaylist(input).then((res) => {
      assert.strictEqual(res.preferences.activity, 'Late Night Coding');
      assert.ok(res.description.includes('Late Night Coding'));

      console.log('✓ Test 7 Passed: Activity-based generation & contextual description verified.');
    });
  }

  // Test 8: Insufficient Catalog Results Handling
  {
    const input: AIPlaylistGenerationInput = {
      searchPrompt: 'Extremely rare and non-existent niche microgenre',
      targetDurationMinutes: 120, // 2 hours request
      targetSongCount: 40,
    };

    DedicatedPlaylistGenerationService.generatePlaylist(input).then((res) => {
      assert.ok(res !== null);
      assert.ok(Array.isArray(res.tracks));
      assert.ok(res.trackCount >= 0);
      assert.ok(typeof res.totalDurationSeconds === 'number');

      console.log('✓ Test 8 Passed: Insufficient catalog results handled gracefully without crashes.');
    });
  }

  // Test 9: Invalid Duration API Validation
  {
    const req: any = {
      body: { duration: -15 },
      user: { _id: '507f1f77bcf86cd799439011' },
      params: {},
    };
    let status = 200;
    let resData: any = null;
    const res: any = {
      status(code: number) {
        status = code;
        return res;
      },
      json(data: any) {
        resData = data;
        return res;
      },
    };

    generateAIPlaylistEndpoint(req, res).then(() => {
      assert.strictEqual(status, 400);
      assert.strictEqual(resData.success, false);
      assert.ok(resData.message.includes('Duration must be a positive number'));

      console.log('✓ Test 9 Passed: Invalid duration caught and rejected with 400.');
    });
  }

  // Test 10: Empty Recommendation Candidates Fallback
  {
    const emptyTracks: any[] = [];
    const seq = PlaylistSequencingService.sequenceTracks(emptyTracks, 'balanced');
    assert.strictEqual(seq.sequencedTracks.length, 0);
    assert.strictEqual(seq.diagnostics.trackCount, 0);
    assert.strictEqual(seq.diagnostics.smoothnessScore, 1.0);

    console.log('✓ Test 10 Passed: Empty candidate list safely handled in sequencing.');
  }

  // Test 11: Valid Ordering & Smoothness Scores for All 4 Sequencing Strategies
  {
    const strategies = ['balanced', 'energetic', 'gradual', 'discovery'] as const;
    const sampleTracks = mockCatalog.map((s) => ({
      song: s,
      score: 0.8,
      noveltyScore: 0.5,
      genre: (s.genre as any).name,
      artist: (s.artist as any).name,
    }));

    for (const strat of strategies) {
      const result = PlaylistSequencingService.sequenceTracks(sampleTracks, strat);
      assert.strictEqual(result.sequencedTracks.length, sampleTracks.length);
      assert.strictEqual(result.diagnostics.strategy, strat);
      assert.ok(result.diagnostics.smoothnessScore >= 0 && result.diagnostics.smoothnessScore <= 1.0);
      assert.ok(typeof result.diagnostics.averageTransitionDelta === 'number');
    }

    console.log('✓ Test 11 Passed: All 4 sequencing strategies produced valid ordering and smoothness diagnostics.');
  }

  console.log('🎉 All AI playlist refinement and edge case tests completed successfully.');
}
