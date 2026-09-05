import assert from 'node:assert';
import {
  AdaptiveRecommendationRankingPipeline,
  AdaptivePipelineOptions,
} from '../services/adaptiveRecommendationRankingPipeline.js';
import { HybridRecommendationService } from '../services/hybridRecommendationService.js';
import { HybridRankedResult } from '../services/hybridRankingPipeline.js';
import { HybridCandidate, CandidateGenerationService } from '../services/candidateGenerationService.js';
import { ColdStartDetectionService } from '../services/coldStartDetectionService.js';
import { UserFeedbackProfile } from '../services/recommendationScoreCalibrationService.js';
import { UserFamiliarityProfile } from '../services/noveltyScoringService.js';

export async function runAdaptivePipelineTests() {
  console.log('[Adaptive Recommendation Ranking Pipeline Test Suite] Starting tests...');

  // Mock sample songs conforming to HybridCandidate
  const mockCandidates: HybridCandidate[] = [
    {
      songId: 'song_the_weeknd_1',
      songDoc: {
        _id: 'song_the_weeknd_1',
        title: 'Blinding Lights',
        artist: 'The Weeknd',
        genre: 'Synthpop',
        audioFeatures: { energy: 0.80, tempo: 171, valence: 0.60, danceability: 0.75 },
        playCount: 1500,
      },
      contentScore: 0.90,
      collaborativeScore: 0.88,
      userTasteAffinityScore: 0.92,
      popularitySignal: 0.95,
      recencySignal: 0.70,
      sources: ['content', 'taste'],
    },
    {
      songId: 'song_the_weeknd_2',
      songDoc: {
        _id: 'song_the_weeknd_2',
        title: 'Save Your Tears',
        artist: 'The Weeknd',
        genre: 'Synthpop',
        audioFeatures: { energy: 0.75, tempo: 118, valence: 0.55, danceability: 0.70 },
        playCount: 1200,
      },
      contentScore: 0.87,
      collaborativeScore: 0.85,
      userTasteAffinityScore: 0.89,
      popularitySignal: 0.90,
      recencySignal: 0.75,
      sources: ['taste'],
    },
    {
      songId: 'song_dua_lipa',
      songDoc: {
        _id: 'song_dua_lipa',
        title: 'Levitating',
        artist: 'Dua Lipa',
        genre: 'Disco-Pop',
        audioFeatures: { energy: 0.85, tempo: 124, valence: 0.90, danceability: 0.80 },
        playCount: 950,
      },
      contentScore: 0.85,
      collaborativeScore: 0.84,
      userTasteAffinityScore: 0.86,
      popularitySignal: 0.88,
      recencySignal: 0.80,
      sources: ['collaborative'],
    },
    {
      songId: 'song_daft_punk',
      songDoc: {
        _id: 'song_daft_punk',
        title: 'Get Lucky',
        artist: 'Daft Punk',
        genre: 'Electronic',
        audioFeatures: { energy: 0.80, tempo: 116, valence: 0.85, danceability: 0.78 },
        playCount: 800,
      },
      contentScore: 0.80,
      collaborativeScore: 0.82,
      userTasteAffinityScore: 0.84,
      popularitySignal: 0.85,
      recencySignal: 0.65,
      sources: ['taste'],
    },
    {
      songId: 'song_discovery',
      songDoc: {
        _id: 'song_discovery',
        title: 'Neon Odyssey',
        artist: 'Indie Wave',
        genre: 'Synthwave',
        audioFeatures: { energy: 0.78, tempo: 120, valence: 0.65, danceability: 0.72 },
        playCount: 35,
      },
      contentScore: 0.82,
      collaborativeScore: 0.80,
      userTasteAffinityScore: 0.85,
      popularitySignal: 0.30,
      recencySignal: 0.95,
      sources: ['content'],
    },
    {
      songId: 'song_irrelevant',
      songDoc: {
        _id: 'song_irrelevant',
        title: 'Deathcore Blast',
        artist: 'Grindcore Legion',
        genre: 'Deathcore',
        audioFeatures: { energy: 0.99, tempo: 220, valence: 0.05, danceability: 0.10 },
        playCount: 10,
      },
      contentScore: 0.15,
      collaborativeScore: 0.10,
      userTasteAffinityScore: 0.10,
      popularitySignal: 0.10,
      recencySignal: 0.50,
      sources: ['catalog'],
    },
  ];

  // =========================================================================
  // 1. Stage Modularity & Independent Execution Test
  // =========================================================================
  {
    console.log('\n--- 1. Stage Modularity & Isolated Execution ---');

    // Stage 2: Base Recommendation Score in isolation
    const baseRanked = AdaptiveRecommendationRankingPipeline.scoreBaseCandidatesStage({
      candidates: mockCandidates,
      limit: 10,
      weights: {
        contentSimilarityWeight: 0.25,
        collaborativeWeight: 0.25,
        userTasteAffinityWeight: 0.25,
        popularityWeight: 0.125,
        recencyWeight: 0.125,
      },
    });

    assert.strictEqual(baseRanked.length, mockCandidates.length);
    assert.ok(baseRanked[0].hybridScore > baseRanked[1].hybridScore);
    console.log('  Passed: Base scoring stage computes ranked results modularly');

    // Stage 3: User-Specific Weighting in isolation
    const weightingRes = AdaptiveRecommendationRankingPipeline.applyUserSpecificWeightingStage({
      userId: 'user_active_01',
      userClassification: 'ACTIVE',
      defaultWeights: {
        contentSimilarityWeight: 0.25,
        collaborativeWeight: 0.25,
        userTasteAffinityWeight: 0.25,
        popularityWeight: 0.125,
        recencyWeight: 0.125,
      },
    });

    assert.strictEqual(weightingRes.applied, true);
    assert.ok(typeof weightingRes.effectiveWeights.userTasteAffinityWeight === 'number');
    console.log('  Passed: User-specific weighting stage executes modularly');

    // Stage 4: Feedback Adjustment in isolation
    const feedbackProfile: UserFeedbackProfile = {
      likedSongIds: new Set(['song_dua_lipa']),
      savedSongIds: new Set(),
      skippedSongIds: new Map([['song_the_weeknd_2', 1]]),
      highCompletionSongIds: new Set(),
      genrePositiveScores: new Map(),
      genreSkipCounts: new Map(),
      artistPositiveScores: new Map(),
      artistSkipCounts: new Map(),
      signalPerformance: {},
    };

    const feedbackRes = AdaptiveRecommendationRankingPipeline.applyFeedbackAdjustmentStage({
      rankedResults: baseRanked,
      feedbackProfile,
    });

    assert.strictEqual(feedbackRes.applied, true);
    const duaLipaCalibrated = feedbackRes.results.find((r) => r.song._id === 'song_dua_lipa');
    const weeknd2Calibrated = feedbackRes.results.find((r) => r.song._id === 'song_the_weeknd_2');
    assert.ok(
      duaLipaCalibrated!.finalScore! > duaLipaCalibrated!.originalScore!,
      'Liked track receives feedback boost'
    );
    assert.ok(
      weeknd2Calibrated!.finalScore! < weeknd2Calibrated!.originalScore!,
      'Skipped track receives feedback penalty'
    );
    console.log('  Passed: Feedback adjustment stage executes modularly');

    // Stage 6: Novelty Adjustment in isolation
    const familiarityProfile: UserFamiliarityProfile = {
      userId: 'user_active_01',
      songEncounterCounts: new Map([
        ['song_the_weeknd_1', 15], // Frequently heard
        ['song_the_weeknd_2', 10], // Frequently heard
        ['song_dua_lipa', 2],       // Rarely heard
        ['song_discovery', 0],      // Completely unfamiliar
      ]),
      songCategories: new Map(),
      frequentlyHeardSongIds: new Set(['song_the_weeknd_1', 'song_the_weeknd_2']),
      previouslyHeardSongIds: new Set(),
      rarelyHeardSongIds: new Set(['song_dua_lipa']),
      totalHistoryCount: 27,
    };

    const noveltyRes = AdaptiveRecommendationRankingPipeline.applyNoveltyAdjustmentStage({
      rankedResults: baseRanked,
      familiarityProfile,
    });

    assert.strictEqual(noveltyRes.applied, true);
    const discoveryItem = noveltyRes.results.find((r) => r.song._id === 'song_discovery');
    assert.ok(discoveryItem!.componentScores.noveltyScore! >= 0.85);
    console.log('  Passed: Novelty adjustment stage executes modularly');

    // Stage 7: Diversity Re-ranking in isolation
    const diversityRes = AdaptiveRecommendationRankingPipeline.applyDiversityRerankingStage({
      rankedResults: baseRanked,
      targetLimit: 5,
      diversityStrength: 0.40,
    });

    assert.strictEqual(diversityRes.applied, true);
    console.log('  Passed: Diversity re-ranking stage executes modularly');

    // Stage 8: Final Ranking & Deterministic Tie-Breaking in isolation
    const finalRes = AdaptiveRecommendationRankingPipeline.finalizeRankingStage({
      results: baseRanked,
      limit: 4,
    });

    assert.strictEqual(finalRes.finalResults.length, 4);
    assert.ok(finalRes.finalResults[0].finalScore! <= 1.0);
    assert.ok(finalRes.finalResults[0].finalScore! >= 0.0);
    console.log('  Passed: Final ranking stage executes modularly');
  }

  // =========================================================================
  // 2. End-to-End Pipeline Execution (All Stages Combined)
  // =========================================================================
  {
    console.log('\n--- 2. End-to-End Pipeline Execution ---');

    const feedbackProfile: UserFeedbackProfile = {
      likedSongIds: new Set(['song_discovery']),
      savedSongIds: new Set(),
      skippedSongIds: new Map([['song_the_weeknd_2', 1]]),
      highCompletionSongIds: new Set(),
      genrePositiveScores: new Map(),
      genreSkipCounts: new Map(),
      artistPositiveScores: new Map(),
      artistSkipCounts: new Map(),
      signalPerformance: {},
    };

    const familiarityProfile: UserFamiliarityProfile = {
      userId: '507f1f77bcf86cd799439011',
      songEncounterCounts: new Map([
        ['song_the_weeknd_1', 12],
        ['song_the_weeknd_2', 8],
        ['song_dua_lipa', 1],
        ['song_discovery', 0],
      ]),
      songCategories: new Map(),
      frequentlyHeardSongIds: new Set(['song_the_weeknd_1', 'song_the_weeknd_2']),
      previouslyHeardSongIds: new Set(),
      rarelyHeardSongIds: new Set(['song_dua_lipa']),
      totalHistoryCount: 21,
    };

    const pipelineResult = await AdaptiveRecommendationRankingPipeline.executePipeline({
      userId: '507f1f77bcf86cd799439011',
      candidates: mockCandidates,
      limit: 5,
      enableAllStages: true,
      feedbackProfile,
      familiarityProfile,
      useDiversityRanking: true,
      diversityStrength: 0.35,
    });

    assert.strictEqual(pipelineResult.strategyUsed, 'HYBRID_PERSONALIZED');
    assert.strictEqual(pipelineResult.recommendations.length, 5);

    // Verify all diagnostic stages ran
    const diag = pipelineResult.diagnostics;
    assert.strictEqual(diag.baseScoring.scoredCandidatesCount, mockCandidates.length);
    assert.strictEqual(diag.userSpecificWeighting.applied, true);
    assert.strictEqual(diag.feedbackAdjustment.applied, true);
    assert.strictEqual(diag.explorationAdjustment.applied, true);
    assert.strictEqual(diag.noveltyAdjustment.applied, true);
    assert.strictEqual(diag.diversityReranking.applied, true);
    assert.strictEqual(diag.finalRanking.finalCount, 5);

    // Check that each recommendation contains metadata and bounded finalScore
    for (const rec of pipelineResult.recommendations) {
      assert.ok(typeof rec.finalScore === 'number');
      assert.ok(rec.finalScore >= 0.0 && rec.finalScore <= 1.0);
      assert.ok(rec.metadata);
    }

    console.log('  Passed: All 8 stages executed cohesively and populated full diagnostics');
  }

  // =========================================================================
  // 3. Deterministic Ranking & Tie-Breaking
  // =========================================================================
  {
    console.log('\n--- 3. Determinism & Stable Tie-Breaking ---');

    // Create 3 candidates with the EXACT same final score to test tie-breaking
    const tiedCandidates: HybridRankedResult[] = [
      {
        song: { _id: 'song_z', title: 'Zebra Song' },
        hybridScore: 0.85,
        finalScore: 0.85,
        componentScores: { contentScore: 0.85, collaborativeScore: 0.85, userTasteAffinityScore: 0.85, popularityScore: 0.85, recencyScore: 0.85 },
        sources: ['taste'],
      },
      {
        song: { _id: 'song_a', title: 'Alpha Song' },
        hybridScore: 0.85,
        finalScore: 0.85,
        componentScores: { contentScore: 0.85, collaborativeScore: 0.85, userTasteAffinityScore: 0.85, popularityScore: 0.85, recencyScore: 0.85 },
        sources: ['taste'],
      },
      {
        song: { _id: 'song_m', title: 'Mango Song' },
        hybridScore: 0.85,
        finalScore: 0.85,
        componentScores: { contentScore: 0.85, collaborativeScore: 0.85, userTasteAffinityScore: 0.85, popularityScore: 0.85, recencyScore: 0.85 },
        sources: ['taste'],
      },
    ];

    const run1 = AdaptiveRecommendationRankingPipeline.finalizeRankingStage({
      results: [...tiedCandidates],
      limit: 3,
    });

    const run2 = AdaptiveRecommendationRankingPipeline.finalizeRankingStage({
      results: [...tiedCandidates],
      limit: 3,
    });

    // Verify identical ordering between runs
    assert.strictEqual(run1.finalResults.length, 3);
    assert.strictEqual(run1.finalResults[0].song._id, 'song_a', 'Alphabetical tie-break: song_a must be first');
    assert.strictEqual(run1.finalResults[1].song._id, 'song_m', 'Alphabetical tie-break: song_m must be second');
    assert.strictEqual(run1.finalResults[2].song._id, 'song_z', 'Alphabetical tie-break: song_z must be third');

    for (let i = 0; i < 3; i++) {
      assert.strictEqual(run1.finalResults[i].song._id, run2.finalResults[i].song._id);
      assert.strictEqual(run1.finalResults[i].finalScore, run2.finalResults[i].finalScore);
    }

    console.log('  Passed: Pipeline produces 100% deterministic ranking across identical inputs');
  }

  // =========================================================================
  // 4. Safe Handling of Missing Data & Graceful Fallbacks
  // =========================================================================
  {
    console.log('\n--- 4. Safe Handling of Missing Data ---');

    // Completely empty inputs / omitted profiles
    const safePipelineRes = await AdaptiveRecommendationRankingPipeline.executePipeline({
      userId: '507f1f77bcf86cd799439011',
      candidates: mockCandidates,
      limit: 3,
      context: null,
      sessionProfile: null,
      temporalProfile: null,
      feedbackProfile: null,
      familiarityProfile: null,
      enableAllStages: true,
    });

    assert.strictEqual(safePipelineRes.strategyUsed, 'HYBRID_PERSONALIZED');
    assert.strictEqual(safePipelineRes.recommendations.length, 3);
    assert.ok(safePipelineRes.diagnostics);

    console.log('  Passed: Pipeline safely handles missing profiles, contexts, and sessions');
  }

  // =========================================================================
  // 5. Relevance Preservation Hierarchy
  // =========================================================================
  {
    console.log('\n--- 5. Relevance Preservation Hierarchy ---');

    const result = await AdaptiveRecommendationRankingPipeline.executePipeline({
      userId: '507f1f77bcf86cd799439011',
      candidates: mockCandidates,
      limit: 6,
      enableAllStages: true,
      diversityStrength: 0.30,
    });

    const irrelevantSongResult = result.recommendations.find(
      (r) => r.song._id === 'song_irrelevant'
    );

    assert.ok(irrelevantSongResult, 'Irrelevant candidate should still be scored');
    assert.ok(
      irrelevantSongResult!.finalScore! < 0.30,
      'Irrelevant candidate must remain low-scored and never promoted over relevant tracks'
    );

    // The top recommendation must be one of the highly relevant tracks
    const topSongId = result.recommendations[0].song._id;
    assert.ok(
      ['song_the_weeknd_1', 'song_dua_lipa', 'song_discovery'].includes(topSongId),
      `Top recommended song must be a high relevance track, found: ${topSongId}`
    );

    console.log('  Passed: Relevance strictly preserved; irrelevant candidates never falsely elevated');
  }

  // =========================================================================
  // 6. Integration via HybridRecommendationService
  // =========================================================================
  {
    console.log('\n--- 6. HybridRecommendationService Integration ---');

    // When HybridRecommendationService is called with invalid ID, returns error or cold start safely
    let caughtError = false;
    try {
      await HybridRecommendationService.getHybridRecommendations({
        userId: 'invalid_id',
      });
    } catch {
      caughtError = true;
    }
    assert.strictEqual(caughtError, true, 'Invalid ID triggers expected error handling');

    // When called with valid ID, mock generation and cold start detection for offline unit test execution
    const originalDetect = ColdStartDetectionService.detectUserColdStartStatus;
    const originalGenerate = CandidateGenerationService.generateHybridCandidates;

    (ColdStartDetectionService as any).detectUserColdStartStatus = async () => ({
      isColdStart: false,
      classification: 'ACTIVE',
      historyCount: 20,
      likesCount: 10,
      sessionsCount: 3,
    });

    (CandidateGenerationService as any).generateHybridCandidates = async () => mockCandidates;

    try {
      const hybridRes = await HybridRecommendationService.getHybridRecommendations({
        userId: '507f1f77bcf86cd799439011',
        limit: 5,
        useScoreCalibration: false,
      });

      assert.strictEqual(hybridRes.strategyUsed, 'HYBRID_PERSONALIZED');
      assert.strictEqual(hybridRes.recommendations.length, 5);
      assert.ok(hybridRes.pipelineDiagnostics !== undefined);
      assert.strictEqual(hybridRes.pipelineDiagnostics?.finalRanking.finalCount, 5);
    } finally {
      ColdStartDetectionService.detectUserColdStartStatus = originalDetect;
      (CandidateGenerationService as any).generateHybridCandidates = originalGenerate;
    }

    console.log('  Passed: HybridRecommendationService delegates seamlessly with backward compatibility');
  }

  console.log('\n[Adaptive Recommendation Ranking Pipeline Test Suite] ALL TESTS PASSED! \u2714\n');
}

if (process.argv[1]?.includes('adaptiveRecommendationRankingPipeline.test')) {
  runAdaptivePipelineTests().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
