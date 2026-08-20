import assert from 'node:assert';
import { RecommendationPostRankingPipeline } from '../services/recommendationPostRankingPipeline.js';
import { UserTasteProfile } from '../services/userTasteProfileService.js';
import { ArtistDiversityFilteringService } from '../services/artistDiversityFilteringService.js';
import { GenreDiversityFilteringService } from '../services/genreDiversityFilteringService.js';
import { NoveltyScoringService } from '../services/noveltyScoringService.js';
import { RecommendationHistoryService } from '../services/recommendationHistoryService.js';

export function runRecommendationRankingDiagnosticsTests() {
  console.log('[Recommendation Ranking Diagnostics Test Suite] Starting tests...');

  // Mock taste profile with strong rock affinity
  const strongRockTasteProfile: UserTasteProfile = {
    userId: 'user_rock_fan',
    shortTermProfile: {
      timeframeDays: 7,
      genres: [{ genreId: 'g_rock', name: 'rock', affinityScore: 0.95 }],
      artists: [],
      preferredLanguages: ['en'],
      preferredMoods: [],
    },
    longTermProfile: {
      timeframeDays: 90,
      genres: [{ genreId: 'g_rock', name: 'rock', affinityScore: 0.90 }],
      artists: [],
      preferredLanguages: ['en'],
      preferredMoods: [],
    },
    combinedGenres: [{ genreId: 'g_rock', name: 'rock', affinityScore: 0.92 }],
    combinedArtists: [],
    preferredLanguages: ['en'],
    preferredMoods: [],
    updatedAt: new Date(),
  };

  // Test 1: Repeated Artists Spacing & Capping
  {
    const items = [
      { id: '1', score: 0.95, artist: 'artist_alpha' },
      { id: '2', score: 0.90, artist: 'artist_alpha' },
      { id: '3', score: 0.85, artist: 'artist_beta' },
      { id: '4', score: 0.80, artist: 'artist_alpha' },
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
    assert.strictEqual(result[0].artist, 'artist_alpha');
    assert.strictEqual(result[1].artist, 'artist_beta', 'Consecutive artist repetition prevented');
    assert.strictEqual(result[2].artist, 'artist_alpha');

    console.log('✓ Test 1 Passed: Repeated artists filtering and spacing verified.');
  }

  // Test 2: Repeated Genres Balancing
  {
    const items = [
      { id: '1', score: 0.95, genre: 'pop' },
      { id: '2', score: 0.90, genre: 'pop' },
      { id: '3', score: 0.88, genre: 'pop' },
      { id: '4', score: 0.85, genre: 'pop' },
      { id: '5', score: 0.80, genre: 'electronic' },
      { id: '6', score: 0.78, genre: 'jazz' },
    ];

    const result = GenreDiversityFilteringService.applyGenreDiversity({
      items,
      targetLimit: 4,
      genreExtractor: (it) => it.genre,
      scoreExtractor: (it) => it.score,
    });

    assert.strictEqual(result.length, 4);
    const popTracks = result.filter((it) => it.genre === 'pop');
    assert.strictEqual(popTracks.length, 2, 'Default genre concentration caps pop tracks at 2 of 4');
    assert.ok(result.some((it) => it.genre === 'electronic'));

    console.log('✓ Test 2 Passed: Repeated genres balancing verified.');
  }

  // Test 3: Recently Recommended Songs Receiving Cooldown Repetition Penalty
  {
    const items = [
      { songId: 'fresh_song', finalScore: 0.80 },
      { songId: 'recent_song', finalScore: 0.82 },
    ];

    const recentlyRecommended = new Map();
    recentlyRecommended.set('recent_song', {
      songId: 'recent_song',
      timestamp: new Date(Date.now() - 3600 * 1000),
      count: 1,
    });

    const result = RecommendationHistoryService.applyRepetitionControl({
      items,
      recentlyRecommended,
      recentlySkipped: new Set(),
      targetLimit: 2,
      scoreExtractor: (it) => it.finalScore,
      songIdExtractor: (it) => it.songId,
    });

    assert.strictEqual(result[0].songId, 'fresh_song', 'Fresh song ranks ahead of recently recommended song');
    assert.ok(result[1].penaltyApplied > 0, 'Repetition penalty recorded');

    console.log('✓ Test 3 Passed: Recently recommended song cooldown penalty verified.');
  }

  // Test 4: Recently Skipped Songs Being Suppressed
  {
    const items = [
      { songId: 'neutral_song', finalScore: 0.70 },
      { songId: 'skipped_song', finalScore: 0.90 },
    ];

    const recentlySkipped = new Set(['skipped_song']);

    const result = RecommendationHistoryService.applyRepetitionControl({
      items,
      recentlyRecommended: new Map(),
      recentlySkipped,
      targetLimit: 2,
      scoreExtractor: (it) => it.finalScore,
      songIdExtractor: (it) => it.songId,
    });

    assert.strictEqual(result[0].songId, 'neutral_song');
    assert.ok(result[1].adjustedScore < 0.20, 'Skipped song heavily suppressed');

    console.log('✓ Test 4 Passed: Recently skipped songs suppression verified.');
  }

  // Test 5: Novelty Boosting for Fresh Relevant Songs
  {
    const { finalScore, gatedNoveltyScore } = NoveltyScoringService.combineNoveltyWithBaseScore(
      0.85, // High relevance
      0.90, // High novelty
      { noveltyWeight: 0.20 }
    );

    assert.ok(gatedNoveltyScore > 0.6, 'Novelty boost active');
    assert.ok(finalScore >= 0.0 && finalScore <= 1.0, 'Final score strictly normalized in [0, 1]');

    console.log('✓ Test 5 Passed: Novelty boosting for fresh relevant songs verified.');
  }

  // Test 6: Highly Relevant Songs Being Preserved Despite Cooldown (Reappearance Exception)
  {
    const items = [
      { songId: 'fresh_track', finalScore: 0.75 },
      { songId: 'stellar_track', finalScore: 0.95 },
    ];

    const recentlyRecommended = new Map();
    recentlyRecommended.set('stellar_track', {
      songId: 'stellar_track',
      timestamp: new Date(Date.now() - 3600 * 1000),
      count: 1,
    });

    const result = RecommendationHistoryService.applyRepetitionControl({
      items,
      recentlyRecommended,
      recentlySkipped: new Set(),
      targetLimit: 2,
      scoreExtractor: (it) => it.finalScore,
      songIdExtractor: (it) => it.songId,
    });

    assert.strictEqual(result[0].songId, 'stellar_track', 'Stellar track (0.95) preserved in top rank');
    assert.strictEqual(result[0].isReappearanceAllowed, true);

    console.log('✓ Test 6 Passed: Highly relevant songs preserved despite cooldown verified.');
  }

  // Test 7: Users with Strong Genre Preferences
  {
    const candidates = [
      { id: '1', score: 0.95, genre: 'rock' },
      { id: '2', score: 0.92, genre: 'rock' },
      { id: '3', score: 0.90, genre: 'rock' },
      { id: '4', score: 0.85, genre: 'pop' },
    ];

    const result = GenreDiversityFilteringService.applyGenreDiversity({
      items: candidates,
      tasteProfile: strongRockTasteProfile,
      targetLimit: 3,
      genreExtractor: (it) => it.genre,
      scoreExtractor: (it) => it.score,
    });

    assert.strictEqual(result.length, 3);
    const rockCount = result.filter((it) => it.genre === 'rock').length;
    assert.ok(rockCount >= 2, 'Taste profile preference allows higher rock concentration (>= 2 of 3)');

    console.log('✓ Test 7 Passed: Users with strong genre preferences verified.');
  }

  // Test 8: Development-Only Diagnostics Tracking & Production Isolation
  {
    const candidateTracks = [
      {
        song: { _id: 's_diag_1', title: 'Diag Track', genre: { name: 'indie' }, artist: { _id: 'a1' }, playCount: 10 },
        score: 0.88,
      },
    ];

    // Case A: Dev mode with debug=true
    const oldEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    RecommendationPostRankingPipeline.executePostRanking({
      items: candidateTracks,
      targetLimit: 1,
      isDebugMode: true,
    }).then((devResults) => {
      assert.strictEqual(devResults.length, 1);
      const diag = devResults[0].diagnostics;
      assert.ok(diag !== undefined, 'Diagnostics present in dev mode');
      assert.ok(typeof diag?.originalScore === 'number', 'originalScore tracked');
      assert.ok(typeof diag?.diversityAdjustment === 'number', 'diversityAdjustment tracked');
      assert.ok(typeof diag?.noveltyAdjustment === 'number', 'noveltyAdjustment tracked');
      assert.ok(typeof diag?.repetitionPenalty === 'number', 'repetitionPenalty tracked');
      assert.ok(typeof diag?.finalScore === 'number', 'finalScore tracked');

      // Case B: Production mode with debug=true (MUST BE OMITTED)
      process.env.NODE_ENV = 'production';

      RecommendationPostRankingPipeline.executePostRanking({
        items: candidateTracks,
        targetLimit: 1,
        isDebugMode: true,
      }).then((prodResults) => {
        assert.strictEqual(prodResults.length, 1);
        assert.strictEqual(prodResults[0].diagnostics, undefined, 'Diagnostics NOT exposed in production');

        // Restore original env
        process.env.NODE_ENV = oldEnv;
        console.log('✓ Test 8 Passed: Development-only diagnostics tracking & production isolation verified.');
      });
    });
  }

  console.log('🎉 All recommendation ranking diagnostics tests completed successfully.');
}
