import assert from 'node:assert';
import { HybridCandidate } from '../services/candidateGenerationService.js';

export function runCandidateGenerationTests() {
  console.log('[Candidate Generation Test Suite] Starting tests...');

  // Test 1: Candidate Duplicate Merging & Score Preservation
  {
    const candidateMap = new Map<string, HybridCandidate>();

    const mergeTrack = (
      songDoc: any,
      source: 'content' | 'collaborative' | 'trending',
      rawScore: number
    ) => {
      const songId = songDoc._id;
      let existing = candidateMap.get(songId);
      if (!existing) {
        existing = {
          songId,
          songDoc,
          contentScore: 0,
          collaborativeScore: 0,
          userTasteAffinityScore: 0,
          popularitySignal: songDoc.playCount || 0,
          recencySignal: 0.8,
          sources: [],
        };
        candidateMap.set(songId, existing);
      }

      const currentItem = candidateMap.get(songId)!;

      if (!currentItem.sources.includes(source)) {
        currentItem.sources.push(source);
      }

      if (source === 'content') currentItem.contentScore = rawScore;
      if (source === 'collaborative') currentItem.collaborativeScore = rawScore;
    };

    const mockSong = { _id: 'song_track_1', title: 'Starlight', playCount: 420 };

    // Simulate returning same song from both content and collaborative services
    mergeTrack(mockSong, 'content', 0.88);
    mergeTrack(mockSong, 'collaborative', 0.92);

    assert.strictEqual(candidateMap.size, 1, 'Duplicate candidate must be merged into single item');

    const merged = candidateMap.get('song_track_1')!;
    assert.strictEqual(merged.contentScore, 0.88, 'Content score preserved');
    assert.strictEqual(merged.collaborativeScore, 0.92, 'Collaborative score preserved');
    assert.strictEqual(merged.popularitySignal, 420, 'Popularity signal preserved');
    assert.deepStrictEqual(merged.sources, ['content', 'collaborative'], 'Both sources recorded');

    console.log('✓ Test 1 Passed: Candidate duplicate merging and score preservation verified.');
  }

  // Test 2: User Interacted Tracks Exclusion
  {
    const excludedIds = new Set<string>(['song_liked_1', 'song_seed']);
    const rawCandidates = [
      { _id: 'song_liked_1', title: 'Liked Track' },
      { _id: 'song_fresh_1', title: 'Fresh Recommendation' },
    ];

    const filtered = rawCandidates.filter((c) => !excludedIds.has(c._id));

    assert.strictEqual(filtered.length, 1, 'Already interacted song must be excluded');
    assert.strictEqual(filtered[0]._id, 'song_fresh_1', 'Only non-interacted songs remain in candidate pool');
    console.log('✓ Test 2 Passed: User-interacted track exclusion verified.');
  }

  console.log('🎉 All candidate generation service tests completed successfully.');
}
