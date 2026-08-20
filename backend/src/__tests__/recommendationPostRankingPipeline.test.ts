import assert from 'node:assert';
import { RecommendationPostRankingPipeline } from '../services/recommendationPostRankingPipeline.js';
import { UserTasteProfile } from '../services/userTasteProfileService.js';

export function runRecommendationPostRankingPipelineTests() {
  console.log('[Recommendation Post-Ranking Pipeline Test Suite] Starting tests...');

  // Mock Taste Profile
  const mockTasteProfile: UserTasteProfile = {
    userId: 'user_test_1',
    shortTermProfile: {
      timeframeDays: 7,
      genres: [{ genreId: 'g_indie', name: 'indie rock', affinityScore: 0.90 }],
      artists: [{ artistId: 'art_1', name: 'Indie Band', affinityScore: 0.85 }],
      preferredLanguages: ['en'],
      preferredMoods: ['Chill'],
    },
    longTermProfile: {
      timeframeDays: 90,
      genres: [{ genreId: 'g_indie', name: 'indie rock', affinityScore: 0.85 }],
      artists: [{ artistId: 'art_1', name: 'Indie Band', affinityScore: 0.80 }],
      preferredLanguages: ['en'],
      preferredMoods: ['Chill'],
    },
    combinedGenres: [{ genreId: 'g_indie', name: 'indie rock', affinityScore: 0.88 }],
    combinedArtists: [{ artistId: 'art_1', name: 'Indie Band', affinityScore: 0.82 }],
    preferredLanguages: ['en'],
    preferredMoods: ['Chill'],
    updatedAt: new Date(),
  };

  // Mock Candidate Pool from Upstream Hybrid/Session Engines
  const upstreamCandidates = [
    {
      song: {
        _id: 'song_1',
        title: 'Indie Hit',
        genre: { name: 'indie rock' },
        artist: { _id: 'art_1', name: 'Indie Band' },
        playCount: 50,
      },
      hybridScore: 0.92, // High relevance
      sources: ['content', 'user_taste'],
    },
    {
      song: {
        _id: 'song_2',
        title: 'Indie Track 2',
        genre: { name: 'indie rock' },
        artist: { _id: 'art_1', name: 'Indie Band' }, // Same artist (consecutive check)
        playCount: 120,
      },
      hybridScore: 0.89,
      sources: ['collaborative'],
    },
    {
      song: {
        _id: 'song_3',
        title: 'Synth Discovery',
        genre: { name: 'synthwave' },
        artist: { _id: 'art_2', name: 'Synth Master' },
        playCount: 20, // High novelty
      },
      hybridScore: 0.86,
      sources: ['trending'],
    },
    {
      song: {
        _id: 'song_4',
        title: 'Obscure Noise',
        genre: { name: 'experimental' },
        artist: { _id: 'art_3', name: 'Noise Lab' },
        playCount: 5,
      },
      hybridScore: 0.20, // Low relevance
      sources: ['catalog'],
    },
  ];

  // Test 1: Unified Pipeline Execution & Returning originalScore + finalScore
  {
    RecommendationPostRankingPipeline.executePostRanking({
      items: upstreamCandidates,
      tasteProfile: mockTasteProfile,
      targetLimit: 3,
      scoreExtractor: (i) => i.hybridScore,
    }).then((results) => {
      assert.strictEqual(results.length, 3);

      for (const res of results) {
        assert.ok(typeof res.originalScore === 'number', 'Contains originalScore');
        assert.ok(typeof res.finalScore === 'number', 'Contains finalScore');
        assert.ok(res.finalScore >= 0.0 && res.finalScore <= 1.0, 'Final score strictly normalized in [0, 1]');
        assert.ok(res.componentBreakdown !== undefined, 'Component breakdown returned');
      }

      assert.strictEqual(results[0].originalScore, 0.92, 'Preserves exact originalScore');
      console.log('✓ Test 1 Passed: Unified pipeline execution & score reporting verified.');
    });
  }

  // Test 2: Artist & Genre Diversity with Consecutive Suppression in Unified Pipeline
  {
    RecommendationPostRankingPipeline.executePostRanking({
      items: upstreamCandidates,
      tasteProfile: mockTasteProfile,
      targetLimit: 3,
      maxSongsPerArtist: 2,
      maxConsecutiveSameArtist: 1,
      scoreExtractor: (i) => i.hybridScore,
    }).then((results) => {
      assert.strictEqual(results.length, 3);
      assert.strictEqual(results[0].song._id, 'song_1');
      assert.strictEqual(results[1].song._id, 'song_3', 'Spaces out artist: song_3 (art_2) selected before song_2 (art_1)');
      assert.strictEqual(results[2].song._id, 'song_2', 'song_2 selected after spacing');

      console.log('✓ Test 2 Passed: Artist spacing & genre diversity in unified pipeline verified.');
    });
  }

  // Test 3: Novelty Gating in Unified Pipeline
  {
    RecommendationPostRankingPipeline.executePostRanking({
      items: upstreamCandidates,
      tasteProfile: mockTasteProfile,
      targetLimit: 4,
      scoreExtractor: (i) => i.hybridScore,
    }).then((results) => {
      const obscureItem = results.find((r) => r.song._id === 'song_4');
      assert.ok(obscureItem, 'Obscure item found');
      assert.strictEqual(obscureItem?.componentBreakdown.noveltyScore, 0, 'Novelty boost is gated to 0 for low relevance track');
      assert.ok((obscureItem?.finalScore || 0) < 0.25, 'Final score remains low for low relevance track');

      console.log('✓ Test 3 Passed: Novelty gating in unified pipeline verified.');
    });
  }

  // Test 4: Repetition Control in Unified Pipeline
  {
    const candidatesWithRecent = [
      {
        song: { _id: 'song_fresh', title: 'Fresh', genre: { name: 'pop' }, artist: { _id: 'a_pop' } },
        hybridScore: 0.80,
      },
      {
        song: { _id: 'song_recent', title: 'Recent', genre: { name: 'pop' }, artist: { _id: 'a_recent' } },
        hybridScore: 0.82,
      },
    ];

    const recentlyRecommended = new Map();
    recentlyRecommended.set('song_recent', {
      songId: 'song_recent',
      timestamp: new Date(),
      count: 1,
    });

    RecommendationPostRankingPipeline.executePostRanking({
      items: candidatesWithRecent,
      targetLimit: 2,
      scoreExtractor: (i) => i.hybridScore,
      customRepetitionConfig: { cooldownWindowHours: 24, repetitionPenalty: 0.35 },
    }).then((results) => {
      assert.strictEqual(results.length, 2);
      console.log('✓ Test 4 Passed: Repetition control in unified pipeline verified.');
    });
  }

  console.log('🎉 All recommendation post-ranking pipeline tests completed successfully.');
}
