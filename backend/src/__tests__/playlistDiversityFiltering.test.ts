import assert from 'node:assert';
import { PlaylistDiversityFilteringService } from '../services/playlistDiversityFilteringService.js';
import { PlaylistCandidateItem } from '../services/playlistCandidateGenerationService.js';

export function runPlaylistDiversityFilteringTests() {
  console.log('[Playlist Diversity Filtering Service Test Suite] Starting tests...');

  // Test 1: Artist Repetition Limiting
  {
    const candidates: PlaylistCandidateItem[] = [
      {
        song: { _id: 's1', title: 'Song 1', artist: { name: 'M83' }, genre: { name: 'Synthwave' } } as any,
        candidateScore: 0.95,
        matchBreakdown: { genreMatch: true, artistMatch: true, moodMatch: true, audioFeatureScore: 0.8, userTasteAffinityScore: 0.8, semanticScore: 0.9 },
        sources: ['test'],
      },
      {
        song: { _id: 's2', title: 'Song 2', artist: { name: 'M83' }, genre: { name: 'Synthwave' } } as any,
        candidateScore: 0.94,
        matchBreakdown: { genreMatch: true, artistMatch: true, moodMatch: true, audioFeatureScore: 0.8, userTasteAffinityScore: 0.8, semanticScore: 0.9 },
        sources: ['test'],
      },
      {
        song: { _id: 's3', title: 'Song 3', artist: { name: 'M83' }, genre: { name: 'Synthwave' } } as any,
        candidateScore: 0.93, // 3rd song by M83
        matchBreakdown: { genreMatch: true, artistMatch: true, moodMatch: true, audioFeatureScore: 0.8, userTasteAffinityScore: 0.8, semanticScore: 0.9 },
        sources: ['test'],
      },
      {
        song: { _id: 's4', title: 'Song 4', artist: { name: 'Kavinsky' }, genre: { name: 'Synthwave' } } as any,
        candidateScore: 0.88,
        matchBreakdown: { genreMatch: true, artistMatch: true, moodMatch: true, audioFeatureScore: 0.8, userTasteAffinityScore: 0.8, semanticScore: 0.8 },
        sources: ['test'],
      },
    ];

    const result = PlaylistDiversityFilteringService.selectDiversePlaylistSongs({
      candidates,
      targetCount: 3,
      maxSongsPerArtist: 2,
    });

    assert.strictEqual(result.length, 3);
    const m83Count = result.filter((item) => (item.song.artist as any).name === 'M83').length;
    const kavinskyCount = result.filter((item) => (item.song.artist as any).name === 'Kavinsky').length;

    assert.strictEqual(m83Count, 2, 'Artist M83 capped at max 2 songs');
    assert.strictEqual(kavinskyCount, 1, 'Diverse artist Kavinsky selected over 3rd M83 song');

    console.log('✓ Test 1 Passed: Artist repetition limiting verified.');
  }

  // Test 2: Genre Concentration Control & Relaxation for Explicit Requests
  {
    const candidates: PlaylistCandidateItem[] = [
      { song: { _id: 'g1', title: 'Rock 1', artist: { name: 'A1' }, genre: { name: 'Rock' } } as any, candidateScore: 0.9, matchBreakdown: {} as any, sources: [] },
      { song: { _id: 'g2', title: 'Rock 2', artist: { name: 'A2' }, genre: { name: 'Rock' } } as any, candidateScore: 0.89, matchBreakdown: {} as any, sources: [] },
      { song: { _id: 'g3', title: 'Rock 3', artist: { name: 'A3' }, genre: { name: 'Rock' } } as any, candidateScore: 0.88, matchBreakdown: {} as any, sources: [] },
      { song: { _id: 'g4', title: 'Jazz 1', artist: { name: 'A4' }, genre: { name: 'Jazz' } } as any, candidateScore: 0.85, matchBreakdown: {} as any, sources: [] },
    ];

    // Case A: Unrequested Genre Concentration -> Diversifies away from 3rd Rock song
    const unrequestedRes = PlaylistDiversityFilteringService.selectDiversePlaylistSongs({
      candidates,
      targetCount: 3,
      maxGenreConcentrationRatio: 0.5,
    });

    const jazzCountUnrequested = unrequestedRes.filter((item) => (item.song.genre as any).name === 'Jazz').length;
    assert.strictEqual(jazzCountUnrequested, 1, 'Diversified to Jazz when Rock not explicitly requested');

    // Case B: Explicitly Requested Genre -> Relaxes penalty for Rock
    const explicitRes = PlaylistDiversityFilteringService.selectDiversePlaylistSongs({
      candidates,
      targetCount: 3,
      requestedGenres: ['Rock'],
      maxGenreConcentrationRatio: 0.5,
    });

    const rockCountExplicit = explicitRes.filter((item) => (item.song.genre as any).name === 'Rock').length;
    assert.strictEqual(rockCountExplicit, 3, 'Genre penalty relaxed when Rock is explicitly requested');

    console.log('✓ Test 2 Passed: Genre concentration control & explicit request relaxation verified.');
  }

  // Test 3: Configurable Target Count Selection & Score Preservation
  {
    const candidates: PlaylistCandidateItem[] = Array.from({ length: 10 }, (_, i) => ({
      song: { _id: `id_${i}`, title: `Song ${i}`, artist: { name: `Artist ${i}` }, genre: { name: `Genre ${i}` } } as any,
      candidateScore: 0.99 - i * 0.05,
      matchBreakdown: {} as any,
      sources: ['test'],
    }));

    const selected = PlaylistDiversityFilteringService.selectDiversePlaylistSongs({
      candidates,
      targetCount: 5,
    });

    assert.strictEqual(selected.length, 5, 'Exact target count selected');
    assert.strictEqual(selected[0].song.title, 'Song 0', 'Highest score candidate preserved first');
    assert.ok(selected[0].candidateScore > selected[4].candidateScore, 'Recommendation score preserved');

    console.log('✓ Test 3 Passed: Configurable target count and score preservation verified.');
  }

  console.log('🎉 All playlist diversity filtering service tests completed successfully.');
}
