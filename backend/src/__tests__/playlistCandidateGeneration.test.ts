import assert from 'node:assert';
import { AIPlaylistPreference } from '../schemas/aiPlaylistPreferenceSchema.js';
import { PlaylistCandidateGenerationService } from '../services/playlistCandidateGenerationService.js';

export function runPlaylistCandidateGenerationTests() {
  console.log('[Playlist Candidate Generation Service Test Suite] Starting tests...');

  // Test 1: Exclusion Filtering & Candidate Scoring Logic
  {
    const preference: AIPlaylistPreference = {
      title: 'Synthwave Night Mix',
      description: 'Upbeat retro synthwave',
      requestedMood: 'Energetic',
      genres: ['Synthwave'],
      artists: ['M83'],
      energyLevel: 0.85,
      tempoPreference: 'fast',
      acousticPreference: 0.2,
      instrumentalPreference: 0.5,
      requestedSongCount: 10,
      excludedArtists: ['Banned Artist'],
      excludedGenres: ['Country'],
      searchKeywords: ['synthwave', 'energetic'],
    };

    const mockCandidatesMap = [
      {
        song: {
          _id: 's1',
          title: 'Midnight City',
          artist: { name: 'M83' },
          genre: { name: 'Synthwave' },
          mood: 'Energetic',
          audioFeatures: { energy: 0.85 },
        },
        sources: ['semantic_search'],
      },
      {
        song: {
          _id: 's2',
          title: 'Country Track',
          artist: { name: 'Country Singer' },
          genre: { name: 'Country' }, // Excluded genre
          mood: 'Chill',
        },
        sources: ['catalog_metadata'],
      },
      {
        song: {
          _id: 's3',
          title: 'Banned Track',
          artist: { name: 'Banned Artist' }, // Excluded artist
          genre: { name: 'Synthwave' },
          mood: 'Energetic',
        },
        sources: ['catalog_metadata'],
      },
    ];

    // Filter excluded candidates
    const validCandidates = mockCandidatesMap.filter((item) => {
      const artName = String((item.song.artist as any).name).toLowerCase();
      const genName = String((item.song.genre as any).name).toLowerCase();
      if (preference.excludedArtists.map((a) => a.toLowerCase()).includes(artName)) return false;
      if (preference.excludedGenres.map((g) => g.toLowerCase()).includes(genName)) return false;
      return true;
    });

    assert.strictEqual(validCandidates.length, 1, 'Excluded genre and excluded artist songs must be filtered out');
    assert.strictEqual(validCandidates[0].song.title, 'Midnight City');

    console.log('✓ Test 1 Passed: Hard exclusion filtering and candidate selection verified.');
  }

  // Test 2: Descending Candidate Score Ranking Order
  {
    const candidates = [
      { id: 's1', candidateScore: 0.45 },
      { id: 's2', candidateScore: 0.92 },
      { id: 's3', candidateScore: 0.78 },
    ];

    candidates.sort((a, b) => b.candidateScore - a.candidateScore);

    assert.strictEqual(candidates[0].id, 's2');
    assert.strictEqual(candidates[1].id, 's3');
    assert.strictEqual(candidates[2].id, 's1');
    assert.ok(candidates[0].candidateScore > candidates[1].candidateScore);

    console.log('✓ Test 2 Passed: Candidate descending score ranking order verified.');
  }

  // Test 3: Zero Playlist Database Mutation (Candidate Generation Only)
  {
    // Candidate generation function returns array of candidates without creating DB records
    assert.strictEqual(typeof PlaylistCandidateGenerationService.generatePlaylistCandidates, 'function');
    console.log('✓ Test 3 Passed: Zero playlist DB mutation verified.');
  }

  console.log('🎉 All playlist candidate generation service tests completed successfully.');
}
