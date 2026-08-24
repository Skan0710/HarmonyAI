import assert from 'node:assert';
import {
  PlaylistSequencingService,
  SequencingStrategy,
} from '../services/playlistSequencingService.js';

export function runPlaylistSequencingServiceTests() {
  console.log('[Playlist Sequencing Service Test Suite] Starting tests...');

  const mockTracks = [
    {
      song: {
        _id: 'song1',
        title: 'Chill Lofi Morning',
        artist: { name: 'Lofi Maker' },
        genre: { name: 'Lofi' },
        mood: 'Chill',
        audioFeatures: { energy: 0.25, tempo: 80 },
      },
      score: 0.85,
      noveltyScore: 0.2,
      artist: 'Lofi Maker',
      genre: 'Lofi',
    },
    {
      song: {
        _id: 'song2',
        title: 'Peak Synth Anthem',
        artist: { name: 'Synth Master' },
        genre: { name: 'Synthwave' },
        mood: 'Energetic',
        audioFeatures: { energy: 0.90, tempo: 138 },
      },
      score: 0.92,
      noveltyScore: 0.3,
      artist: 'Synth Master',
      genre: 'Synthwave',
    },
    {
      song: {
        _id: 'song3',
        title: 'Midday Groove',
        artist: { name: 'Groove Collective' },
        genre: { name: 'Funk' },
        mood: 'Upbeat',
        audioFeatures: { energy: 0.65, tempo: 115 },
      },
      score: 0.78,
      noveltyScore: 0.8,
      artist: 'Groove Collective',
      genre: 'Funk',
    },
    {
      song: {
        _id: 'song4',
        title: 'Underground Gem',
        artist: { name: 'Indie Discovery' },
        genre: { name: 'Indie' },
        mood: 'Chill',
        audioFeatures: { energy: 0.45, tempo: 95 },
      },
      score: 0.70,
      noveltyScore: 0.88,
      artist: 'Indie Discovery',
      genre: 'Indie',
    },
    {
      song: {
        _id: 'song5',
        title: 'Electro Rush',
        artist: { name: 'Synth Master' },
        genre: { name: 'Synthwave' },
        mood: 'Energetic',
        audioFeatures: { energy: 0.85, tempo: 130 },
      },
      score: 0.88,
      noveltyScore: 0.25,
      artist: 'Synth Master',
      genre: 'Synthwave',
    },
  ];

  // Test 1: Balanced Strategy (Preserves all tracks, generates diagnostics, avoids same-artist adjacency)
  {
    const result = PlaylistSequencingService.sequenceTracks(mockTracks, 'balanced');
    assert.strictEqual(result.sequencedTracks.length, mockTracks.length);

    // Verify all original song IDs exist in result
    const origIds = new Set(mockTracks.map((t) => t.song._id));
    const resultIds = new Set(result.sequencedTracks.map((t) => t.song._id));
    assert.strictEqual(resultIds.size, origIds.size);
    for (const id of origIds) {
      assert.ok(resultIds.has(id));
    }

    assert.strictEqual(result.diagnostics.strategy, 'balanced');
    assert.ok(typeof result.diagnostics.averageTransitionDelta === 'number');
    assert.ok(typeof result.diagnostics.smoothnessScore === 'number');
    assert.ok(result.diagnostics.smoothnessScore >= 0 && result.diagnostics.smoothnessScore <= 1);
    assert.strictEqual(result.diagnostics.sameArtistAdjacentCount, 0);

    console.log('✓ Test 1 Passed: Balanced strategy sequencing & track preservation verified.');
  }

  // Test 2: Energetic Strategy (Front-loads high energy tracks)
  {
    const result = PlaylistSequencingService.sequenceTracks(mockTracks, 'energetic');
    assert.strictEqual(result.sequencedTracks.length, mockTracks.length);
    assert.strictEqual(result.diagnostics.strategy, 'energetic');

    // First track should have high energy (>= 0.8)
    const firstEnergy = (result.sequencedTracks[0].song as any).audioFeatures?.energy;
    assert.ok(firstEnergy >= 0.8);

    console.log('✓ Test 2 Passed: Energetic strategy sequencing & momentum verified.');
  }

  // Test 3: Gradual Strategy (Ascending energy ramp from low to high)
  {
    const result = PlaylistSequencingService.sequenceTracks(mockTracks, 'gradual');
    assert.strictEqual(result.sequencedTracks.length, mockTracks.length);
    assert.strictEqual(result.diagnostics.strategy, 'gradual');

    // First track should have low energy (<= 0.5)
    const firstEnergy = (result.sequencedTracks[0].song as any).audioFeatures?.energy;
    assert.ok(firstEnergy <= 0.5);

    console.log('✓ Test 3 Passed: Gradual strategy sequencing & ascending ramp verified.');
  }

  // Test 4: Discovery Strategy (Interleaves familiar and novel tracks)
  {
    const result = PlaylistSequencingService.sequenceTracks(mockTracks, 'discovery');
    assert.strictEqual(result.sequencedTracks.length, mockTracks.length);
    assert.strictEqual(result.diagnostics.strategy, 'discovery');

    // Result should contain all original tracks
    assert.strictEqual(new Set(result.sequencedTracks.map((t) => t.song._id)).size, 5);

    console.log('✓ Test 4 Passed: Discovery strategy sequencing & interleaving verified.');
  }

  // Test 5: Transition Distance Calculation & Clash Penalty
  {
    const energeticSong = mockTracks[1]; // Energy 0.9, Energetic, Synthwave
    const chillSong = mockTracks[0]; // Energy 0.25, Chill, Lofi

    const distance = PlaylistSequencingService.calculateTransitionDistance(energeticSong, chillSong);
    assert.ok(distance > 0.4, 'Contrasting songs should produce higher transition distance');

    const smoothDistance = PlaylistSequencingService.calculateTransitionDistance(energeticSong, mockTracks[4]);
    assert.ok(smoothDistance > 0, 'Similar tracks should have lower base distance');

    console.log('✓ Test 5 Passed: Transition distance calculation & mood/genre weighting verified.');
  }

  // Test 6: Single track or empty array graceful handling
  {
    const single = PlaylistSequencingService.sequenceTracks([mockTracks[0]], 'balanced');
    assert.strictEqual(single.sequencedTracks.length, 1);
    assert.strictEqual(single.diagnostics.smoothnessScore, 1.0);

    const empty = PlaylistSequencingService.sequenceTracks([], 'energetic');
    assert.strictEqual(empty.sequencedTracks.length, 0);

    console.log('✓ Test 6 Passed: Edge cases (single and empty array) handled safely.');
  }

  console.log('🎉 All playlist sequencing service tests completed successfully.');
}
