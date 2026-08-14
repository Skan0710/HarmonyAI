import assert from 'node:assert';
import { computeSongTasteAffinity } from '../services/candidateGenerationService.js';
import { HybridRankingPipeline } from '../services/hybridRankingPipeline.js';
import { UserTasteProfile } from '../services/userTasteProfileService.js';

export function runHybridTasteProfileIntegrationTests() {
  console.log('[Hybrid Taste Profile Integration Test Suite] Starting tests...');

  const mockProfile: UserTasteProfile = {
    userId: '507f1f77bcf86cd799439011',
    shortTermProfile: {
      timeframeDays: 14,
      genres: [{ genreId: 'g_synthwave', name: 'Synthwave', affinityScore: 1.0 }],
      artists: [{ artistId: 'a_m83', name: 'M83', affinityScore: 0.9 }],
      preferredLanguages: ['English'],
      preferredMoods: ['Electronic'],
    },
    longTermProfile: {
      timeframeDays: 180,
      genres: [
        { genreId: 'g_rock', name: 'Rock', affinityScore: 0.8 },
        { genreId: 'g_synthwave', name: 'Synthwave', affinityScore: 0.5 },
      ],
      artists: [
        { artistId: 'a_queen', name: 'Queen', affinityScore: 0.8 },
        { artistId: 'a_m83', name: 'M83', affinityScore: 0.4 },
      ],
      preferredLanguages: ['English'],
      preferredMoods: ['Rock', 'Electronic'],
    },
    combinedGenres: [],
    combinedArtists: [],
    preferredLanguages: ['English'],
    preferredMoods: ['Electronic', 'Rock'],
    updatedAt: new Date(),
  };

  // Test 1: Short-term vs Long-term Taste Affinity Scoring
  {
    const synthwaveSong = { _id: 's1', genre: { _id: 'g_synthwave' }, artist: { _id: 'a_m83' } };
    const rockSong = { _id: 's2', genre: { _id: 'g_rock' }, artist: { _id: 'a_queen' } };

    const scoreSynthwave = computeSongTasteAffinity(synthwaveSong, mockProfile);
    const scoreRock = computeSongTasteAffinity(rockSong, mockProfile);

    // Synthwave Genre: 0.7*1.0 + 0.3*0.5 = 0.85; M83 Artist: 0.7*0.9 + 0.3*0.4 = 0.75; Average = 0.80
    // Rock Genre: 0.7*0 + 0.3*0.8 = 0.24; Queen Artist: 0.7*0 + 0.3*0.8 = 0.24; Average = 0.24
    assert.ok(scoreSynthwave > scoreRock, 'High short-term affinity track must score higher than long-term only track');
    assert.strictEqual(scoreSynthwave, 0.8, 'Short-term boosted score should equal 0.8');
    assert.strictEqual(scoreRock, 0.24, 'Long-term stabilized score should equal 0.24');

    console.log('✓ Test 1 Passed: Short-term preferences provide stronger score signal than long-term.');
  }

  // Test 2: Preservation of All 5 Component Signals in Hybrid Ranking
  {
    const mockCandidates = [
      {
        songId: 's1',
        songDoc: { _id: 's1', title: 'Midnight City' },
        contentScore: 0.8,
        collaborativeScore: 0.7,
        userTasteAffinityScore: 0.9,
        popularitySignal: 100,
        recencySignal: 0.8,
        sources: ['content', 'taste_profile'],
      },
    ];

    const ranked = HybridRankingPipeline.rankCandidates(mockCandidates, 10);

    assert.strictEqual(ranked.length, 1);
    assert.ok('contentScore' in ranked[0].componentScores);
    assert.ok('collaborativeScore' in ranked[0].componentScores);
    assert.ok('userTasteAffinityScore' in ranked[0].componentScores);
    assert.ok('popularityScore' in ranked[0].componentScores);
    assert.ok('recencyScore' in ranked[0].componentScores);
    assert.strictEqual(ranked[0].componentScores.userTasteAffinityScore, 1.0);

    console.log('✓ Test 2 Passed: All 5 component signals preserved in final hybrid output.');
  }

  console.log('🎉 All hybrid taste profile integration tests completed successfully.');
}
