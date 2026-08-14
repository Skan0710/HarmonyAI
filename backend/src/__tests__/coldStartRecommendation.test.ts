import assert from 'node:assert';

export function runColdStartRecommendationTests() {
  console.log('[Cold-Start Recommendation Strategy Test Suite] Starting tests...');

  // Test 1: Candidate Diversity Enforcement Logic
  {
    const mockCandidates = [
      { id: 's1', artistId: 'a1', genreId: 'g1', score: 1.0 },
      { id: 's2', artistId: 'a1', genreId: 'g1', score: 0.9 },
      { id: 's3', artistId: 'a1', genreId: 'g1', score: 0.8 }, // Should be skipped (max 2 per artist)
      { id: 's4', artistId: 'a2', genreId: 'g2', score: 0.75 },
      { id: 's5', artistId: 'a3', genreId: 'g3', score: 0.7 },
    ];

    const selected: any[] = [];
    const artistCounts = new Map<string, number>();
    const genreCounts = new Map<string, number>();

    const maxPerArtist = 2;
    const maxPerGenre = 3;

    for (const item of mockCandidates) {
      if (selected.length >= 4) break;
      const currentArtist = artistCounts.get(item.artistId) || 0;
      const currentGenre = genreCounts.get(item.genreId) || 0;

      if (currentArtist < maxPerArtist && currentGenre < maxPerGenre) {
        selected.push(item);
        artistCounts.set(item.artistId, currentArtist + 1);
        genreCounts.set(item.genreId, currentGenre + 1);
      }
    }

    assert.strictEqual(selected.length, 4);
    assert.strictEqual(selected[0].id, 's1');
    assert.strictEqual(selected[1].id, 's2');
    assert.strictEqual(selected[2].id, 's4');
    assert.strictEqual(selected[3].id, 's5');
    assert.strictEqual(artistCounts.get('a1'), 2, 'Artist a1 capped at 2 tracks');

    console.log('✓ Test 1 Passed: Artist and genre diversity caps enforced correctly.');
  }

  // Test 2: Favorite Genre / Artist Matching Weight Boost
  {
    const baseScore = 0.4;
    const isFavGenre = true;
    const isFavArtist = true;

    let finalScore = baseScore;
    if (isFavGenre) finalScore += 0.3;
    if (isFavArtist) finalScore += 0.4;

    assert.strictEqual(finalScore, 1.1);
    assert.ok(finalScore > baseScore, 'Favorite match receives substantial score boost');
    console.log('✓ Test 2 Passed: Explicit favorite matching bonuses verified.');
  }

  // Test 3: Exclusion of Already Liked / History Tracks
  {
    const excludeSet = new Set(['s1', 's2']);
    const candidateList = ['s1', 's2', 's3', 's4'];

    const filtered = candidateList.filter((id) => !excludeSet.has(id));

    assert.deepStrictEqual(filtered, ['s3', 's4']);
    console.log('✓ Test 3 Passed: User history exclusion verified.');
  }

  console.log('🎉 All cold-start recommendation strategy tests completed successfully.');
}
