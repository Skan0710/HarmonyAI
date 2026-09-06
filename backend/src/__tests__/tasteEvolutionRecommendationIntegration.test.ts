import assert from 'node:assert';
import { Types } from 'mongoose';
import {
  HybridRankingPipeline,
  TasteEvolutionSignal,
} from '../services/hybridRankingPipeline.js';
import {
  AdaptiveRecommendationRankingPipeline,
} from '../services/adaptiveRecommendationRankingPipeline.js';
import {
  HybridCandidate,
} from '../services/candidateGenerationService.js';
import {
  resetTasteEvolutionInfluenceConfig,
} from '../config/recommendationConfig.js';

export async function runTasteEvolutionRecommendationIntegrationTests() {
  console.log('[Taste Evolution Recommendation Integration Test Suite] Starting tests...\n');

  const createMockCandidate = (
    id: string,
    title: string,
    artistName: string,
    genreName: string,
    mood = 'Chill',
    scores: {
      content?: number;
      collaborative?: number;
      affinity?: number;
      popularity?: number;
      recency?: number;
    } = {}
  ): HybridCandidate => ({
    songId: id,
    contentScore: scores.content ?? 0.7,
    collaborativeScore: scores.collaborative ?? 0.7,
    userTasteAffinityScore: scores.affinity ?? 0.7,
    popularitySignal: scores.popularity ?? 500,
    recencySignal: scores.recency ?? 0.8,
    sources: ['hybrid_personalized'],
    songDoc: {
      _id: id,
      title,
      artist: { _id: `artist-${artistName.toLowerCase().replace(/\s+/g, '-')}`, name: artistName },
      genre: { _id: `genre-${genreName.toLowerCase().replace(/\s+/g, '-')}`, name: genreName },
      mood,
      audioFeatures: { energy: 0.6, tempo: 120 },
      playCount: scores.popularity ?? 500,
    },
  });

  const mockEvolutionSignal: TasteEvolutionSignal = {
    emergingGenres: ['Cyberpunk', 'Hyperpop'],
    fadingGenres: ['Classic Rock'],
    stableGenres: ['Indie Pop'],
    emergingArtists: ['Nova Pulse'],
    fadingArtists: ['Old Legend'],
    stableArtists: ['Steady Melody'],
    tasteStabilityRating: 'moderate_drift',
    archetype: 'Drifting / Gradual Evolution',
  };

  try {
    // -------------------------------------------------------------------------
    // Test 1: Emerging Genre and Artist Discovery Boost in Hybrid Pipeline
    // -------------------------------------------------------------------------
    console.log('Test 1: Emerging genre/artist receives boost compared to neutral track');
    {
      const emergingTrack = createMockCandidate('t1', 'Neon Lights', 'Nova Pulse', 'Cyberpunk');
      const neutralTrack = createMockCandidate('t2', 'Standard Beats', 'Random Artist', 'Jazz');

      const results = HybridRankingPipeline.rankCandidates(
        [neutralTrack, emergingTrack],
        10,
        undefined,
        null,
        undefined,
        null,
        undefined,
        null,
        null,
        undefined,
        null,
        undefined,
        mockEvolutionSignal,
        0.20
      );

      assert.strictEqual(results.length, 2);
      const rankedEmerging = results.find((r) => (r.song?._id || (r as any).songId) === 't1');
      const rankedNeutral = results.find((r) => (r.song?._id || (r as any).songId) === 't2');

      assert.ok(rankedEmerging, 'Emerging track must be present in ranked results');
      assert.ok(rankedNeutral, 'Neutral track must be present in ranked results');

      // Emerging track should have higher evolution score (> 0.50) and outrank neutral track
      assert.ok(
        (rankedEmerging.componentScores.tasteEvolutionScore || 0) > 0.50,
        `Emerging track evolution score should be > 0.50, got ${rankedEmerging.componentScores.tasteEvolutionScore}`
      );
      assert.ok(
        rankedEmerging.hybridScore > rankedNeutral.hybridScore,
        `Emerging track (${rankedEmerging.hybridScore}) should outrank neutral track (${rankedNeutral.hybridScore})`
      );

      console.log('✓ Test 1 passed: Emerging track correctly prioritized by taste evolution signal');
    }

    // -------------------------------------------------------------------------
    // Test 2: Fading Preference Attenuation
    // -------------------------------------------------------------------------
    console.log('\nTest 2: Fading genre/artist receives priority reduction compared to stable track');
    {
      const fadingTrack = createMockCandidate('t3', 'Yesterday Hits', 'Old Legend', 'Classic Rock');
      const stableTrack = createMockCandidate('t4', 'Sweet Melody', 'Steady Melody', 'Indie Pop');

      const results = HybridRankingPipeline.rankCandidates(
        [fadingTrack, stableTrack],
        10,
        undefined,
        null,
        undefined,
        null,
        undefined,
        null,
        null,
        undefined,
        null,
        undefined,
        mockEvolutionSignal,
        0.20
      );

      const rankedFading = results.find((r) => (r.song?._id || (r as any).songId) === 't3');
      const rankedStable = results.find((r) => (r.song?._id || (r as any).songId) === 't4');

      assert.ok(rankedFading && rankedStable);
      assert.ok(
        (rankedFading.componentScores.tasteEvolutionScore || 0) < 0.50,
        `Fading track evolution score should be < 0.50, got ${rankedFading.componentScores.tasteEvolutionScore}`
      );
      assert.ok(
        rankedStable.hybridScore > rankedFading.hybridScore,
        `Stable track (${rankedStable.hybridScore}) should outrank fading track (${rankedFading.hybridScore})`
      );

      console.log('✓ Test 2 passed: Fading track appropriately attenuated');
    }

    // -------------------------------------------------------------------------
    // Test 3: Backward Compatibility & Invariance When Signal is Null
    // -------------------------------------------------------------------------
    console.log('\nTest 3: Backward compatibility when taste evolution signal is null');
    {
      const trackA = createMockCandidate('ta', 'Track A', 'Artist A', 'Genre A');
      const trackB = createMockCandidate('tb', 'Track B', 'Artist B', 'Genre B');

      const resultsWithoutSignal = HybridRankingPipeline.rankCandidates([trackA, trackB], 10);

      const resultsWithNullSignal = HybridRankingPipeline.rankCandidates(
        [trackA, trackB],
        10,
        undefined,
        null,
        undefined,
        null,
        undefined,
        null,
        null,
        undefined,
        null,
        undefined,
        null,
        0.15
      );

      assert.strictEqual(resultsWithoutSignal.length, 2);
      assert.strictEqual(resultsWithNullSignal.length, 2);
      assert.strictEqual(
        resultsWithoutSignal[0].hybridScore,
        resultsWithNullSignal[0].hybridScore,
        'Hybrid scores should be identical when signal is null'
      );
      assert.strictEqual(
        resultsWithNullSignal[0].componentScores.tasteEvolutionScore,
        undefined,
        'Taste evolution score should not be assigned when signal is null'
      );

      console.log('✓ Test 3 passed: Numerical invariance confirmed when evolution signal is null');
    }

    // -------------------------------------------------------------------------
    // Test 4: Macro Modulation Layer Bounding
    // -------------------------------------------------------------------------
    console.log('\nTest 4: Macro modulation layer scaling preserves core baseline');
    {
      const candidate = createMockCandidate('c1', 'Song 1', 'Nova Pulse', 'Cyberpunk');

      // Configure excessive influence to trigger proportional capping
      const results = HybridRankingPipeline.rankCandidates(
        [candidate],
        1,
        undefined,
        'workout',
        0.40,
        null,
        0.40,
        null,
        null,
        0.40,
        null,
        0.40,
        mockEvolutionSignal,
        0.40
      );

      assert.strictEqual(results.length, 1);
      assert.ok(
        !isNaN(results[0].hybridScore) && results[0].hybridScore >= 0 && results[0].hybridScore <= 1,
        `Score must remain normalized between 0 and 1: ${results[0].hybridScore}`
      );

      console.log('✓ Test 4 passed: Multi-layer macro modulation successfully bounds and normalizes');
    }

    // -------------------------------------------------------------------------
    // Test 5: Adaptive Pipeline Integration & Diagnostics
    // -------------------------------------------------------------------------
    console.log('\nTest 5: Adaptive Recommendation Pipeline integration with taste evolution diagnostics');
    {
      const emergingTrack = createMockCandidate('e1', 'Hyper Nova', 'Nova Pulse', 'Hyperpop');
      const fadingTrack = createMockCandidate('f1', 'Old Times', 'Old Legend', 'Classic Rock');
      const neutralTrack = createMockCandidate('n1', 'Standard Sound', 'Unknown', 'Acoustic');

      const output = await AdaptiveRecommendationRankingPipeline.executePipeline({
        candidates: [emergingTrack, fadingTrack, neutralTrack],
        limit: 5,
        userId: new Types.ObjectId().toString(),
        tasteEvolutionSignal: mockEvolutionSignal,
      });

      assert.strictEqual(output.recommendations.length, 3);
      assert.ok(output.diagnostics.tasteEvolution, 'Taste evolution diagnostics must be populated');
      assert.strictEqual(output.diagnostics.tasteEvolution.applied, true);
      assert.strictEqual(output.diagnostics.tasteEvolution.emergingBoostedCount, 1);
      assert.strictEqual(output.diagnostics.tasteEvolution.fadingAttenuatedCount, 1);

      console.log('✓ Test 5 passed: Adaptive pipeline diagnostics correctly capture evolution stats');
    }

    // -------------------------------------------------------------------------
    // Test 6: Exploration Rate Modulation for Transforming vs Stable User
    // -------------------------------------------------------------------------
    console.log('\nTest 6: Exploration rate modulation adapts to user stability');
    {
      const transformingSignal: TasteEvolutionSignal = {
        ...mockEvolutionSignal,
        tasteStabilityRating: 'rapid_transformation',
      };

      const stableSignal: TasteEvolutionSignal = {
        ...mockEvolutionSignal,
        tasteStabilityRating: 'highly_stable',
      };

      const candidate = createMockCandidate('c1', 'Track 1', 'Artist 1', 'Pop');

      const transformingOutput = await AdaptiveRecommendationRankingPipeline.executePipeline({
        candidates: [candidate],
        limit: 1,
        userId: new Types.ObjectId().toString(),
        tasteEvolutionSignal: transformingSignal,
        useAdaptiveExploration: true,
      });

      const stableOutput = await AdaptiveRecommendationRankingPipeline.executePipeline({
        candidates: [candidate],
        limit: 1,
        userId: new Types.ObjectId().toString(),
        tasteEvolutionSignal: stableSignal,
        useAdaptiveExploration: true,
      });

      const transformingExpRate = transformingOutput.diagnostics.explorationAdjustment.effectiveExplorationRate ?? 0;
      const stableExpRate = stableOutput.diagnostics.explorationAdjustment.effectiveExplorationRate ?? 0;

      assert.ok(
        transformingExpRate > stableExpRate,
        `Transforming user exploration (${transformingExpRate}) should exceed stable user exploration (${stableExpRate})`
      );

      console.log(`✓ Test 6 passed: Exploration dynamically shifts (Transforming: ${transformingExpRate}, Stable: ${stableExpRate})`);
    }

    console.log('\n[Taste Evolution Recommendation Integration Test Suite] All tests passed!\n');
    return true;
  } finally {
    resetTasteEvolutionInfluenceConfig();
  }
}

// Standalone execution support
if (process.argv[1]?.endsWith('tasteEvolutionRecommendationIntegration.test.ts') || process.argv[1]?.endsWith('tasteEvolutionRecommendationIntegration.test.js')) {
  runTasteEvolutionRecommendationIntegrationTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Test suite failed:', err);
      process.exit(1);
    });
}
