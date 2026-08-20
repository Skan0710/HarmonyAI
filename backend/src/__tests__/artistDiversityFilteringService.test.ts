import assert from 'node:assert';
import { ArtistDiversityFilteringService } from '../services/artistDiversityFilteringService.js';

export function runArtistDiversityFilteringServiceTests() {
  console.log('[Artist Diversity Filtering Service Test Suite] Starting tests...');

  // Test 1: Preventing Consecutive Recommendations from the Same Artist & Spacing Out Tracks
  {
    const items = [
      { id: '1', score: 0.95, artist: 'artist_a' },
      { id: '2', score: 0.90, artist: 'artist_a' }, // same artist as item 1
      { id: '3', score: 0.85, artist: 'artist_b' },
      { id: '4', score: 0.80, artist: 'artist_c' },
    ];

    const result = ArtistDiversityFilteringService.applyArtistDiversity({
      items,
      maxSongsPerArtist: 2,
      maxConsecutiveSameArtist: 1,
      targetLimit: 3,
      artistExtractor: (it) => it.artist,
      scoreExtractor: (it) => it.score,
    });

    assert.strictEqual(result.length, 3);
    assert.strictEqual(result[0].id, '1', 'First item is top scoring artist_a track');
    assert.strictEqual(result[1].id, '3', 'Second item is artist_b (consecutive artist_a track deferred)');
    assert.strictEqual(result[2].id, '2', 'Third item is artist_a (spaced out and preserves higher score 0.90)');

    console.log('✓ Test 1 Passed: Consecutive artist suppression and spacing verified.');
  }

  // Test 2: Maximum Songs Per Artist Constraint & Score Preservation
  {
    const items = [
      { id: 'a1', score: 0.99, artist: 'artist_heavy' },
      { id: 'a2', score: 0.95, artist: 'artist_heavy' },
      { id: 'b1', score: 0.90, artist: 'artist_other' },
      { id: 'a3', score: 0.88, artist: 'artist_heavy' }, // 3rd song by artist_heavy (exceeds maxSongsPerArtist=2)
      { id: 'c1', score: 0.85, artist: 'artist_third' },
      { id: 'd1', score: 0.80, artist: 'artist_fourth' },
    ];

    const result = ArtistDiversityFilteringService.applyArtistDiversity({
      items,
      maxSongsPerArtist: 2,
      maxConsecutiveSameArtist: 1,
      targetLimit: 4,
      artistExtractor: (it) => it.artist,
      scoreExtractor: (it) => it.score,
    });

    assert.strictEqual(result.length, 4);
    const heavySongs = result.filter((it) => it.artist === 'artist_heavy');
    assert.strictEqual(heavySongs.length, 2, 'Artist concentration capped at max 2 songs');
    assert.ok(heavySongs.some((it) => it.id === 'a1'), 'Higher scoring song a1 preserved');
    assert.ok(heavySongs.some((it) => it.id === 'a2'), 'Higher scoring song a2 preserved');
    assert.ok(!heavySongs.some((it) => it.id === 'a3'), 'Lower scoring song a3 excluded due to max limit');

    console.log('✓ Test 2 Passed: Max songs per artist & score preservation verified.');
  }

  // Test 3: Never Completely Removing an Artist & Graceful Backfilling
  {
    const items = [
      { id: '1', score: 0.9, artist: 'single_artist' },
      { id: '2', score: 0.8, artist: 'single_artist' },
      { id: '3', score: 0.7, artist: 'single_artist' },
    ];

    const result = ArtistDiversityFilteringService.applyArtistDiversity({
      items,
      maxSongsPerArtist: 1,
      targetLimit: 3,
      artistExtractor: (it) => it.artist,
      scoreExtractor: (it) => it.score,
    });

    assert.strictEqual(result.length, 3, 'Backfills remaining pool to satisfy target limit without dropping items');
    assert.strictEqual(result[0].artist, 'single_artist', 'Artist is retained and represented');

    console.log('✓ Test 3 Passed: Artist retention & graceful backfilling verified.');
  }

  console.log('🎉 All artist diversity filtering service tests completed successfully.');
}
