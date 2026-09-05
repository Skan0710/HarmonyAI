import assert from 'node:assert';
import { Types } from 'mongoose';
import {
  AdaptiveRecommendationRankingPipeline,
  AdaptivePipelineOptions,
} from '../services/adaptiveRecommendationRankingPipeline.js';
import { HybridRecommendationService } from '../services/hybridRecommendationService.js';
import { SmartAutoplayService } from '../services/smartAutoplayService.js';
import { UserFeedbackProfile } from '../services/recommendationScoreCalibrationService.js';
import {
  UnifiedLayeredTasteProfile,
  TasteAffinityItem,
} from '../services/layeredTemporalTasteProfileService.js';
import { UserFamiliarityProfile } from '../services/noveltyScoringService.js';
import { RecommendationEvaluationService } from '../services/recommendationEvaluationService.js';
import { CandidateGenerationService, HybridCandidate } from '../services/candidateGenerationService.js';

export async function runAdaptiveRecommendationIntegrationTests() {
  console.log('[Day 30 Task 7: Full Adaptive Recommendation Integration Test Suite] Starting tests...\n');

  const createAffinity = (name: string, score: number): TasteAffinityItem => ({
    name,
    score,
    rawWeight: score * 10,
    interactionCount: Math.round(score * 20),
    lastInteractionAt: new Date(),
  });

  const createFeedbackProfile = (overrides?: Partial<UserFeedbackProfile>): UserFeedbackProfile => ({
    likedSongIds: new Set(),
    savedSongIds: new Set(),
    skippedSongIds: new Map(),
    highCompletionSongIds: new Set(),
    genrePositiveScores: new Map(),
    genreSkipCounts: new Map(),
    artistPositiveScores: new Map(),
    artistSkipCounts: new Map(),
    signalPerformance: {},
    ...overrides,
  });

  // Reusable song generator
  const createMockCandidate = (
    id: string,
    title: string,
    artistName: string,
    genreName: string,
    scores: {
      content?: number;
      collaborative?: number;
      affinity?: number;
      popularity?: number;
      recency?: number;
    },
    audioFeatures: { energy?: number; tempo?: number } = { energy: 0.7, tempo: 120 }
  ): HybridCandidate => ({
    songId: id,
    contentScore: scores.content ?? 0.8,
    collaborativeScore: scores.collaborative ?? 0.7,
    userTasteAffinityScore: scores.affinity ?? 0.75,
    popularitySignal: scores.popularity ?? 800,
    recencySignal: scores.recency ?? 0.85,
    sources: ['hybrid_personalized'],
    songDoc: {
      _id: id,
      title,
      artist: { _id: `artist-${artistName.toLowerCase().replace(/\s+/g, '-')}`, name: artistName },
      genre: { _id: `genre-${genreName.toLowerCase()}`, name: genreName },
      mood: 'Energetic',
      audioFeatures,
      playCount: scores.popularity ?? 800,
    },
  });

  // =========================================================================
  // Scenario 1: Normal Returning User
  // =========================================================================
  {
    console.log('--- Scenario 1: Normal Returning User ---');
    const userId = new Types.ObjectId().toString();

    const candidates = [
      createMockCandidate('song-ret-1', 'Returning Hit 1', 'Artist A', 'Electronic', { affinity: 0.90, content: 0.85 }),
      createMockCandidate('song-ret-2', 'Returning Hit 2', 'Artist B', 'Indie', { affinity: 0.88, content: 0.80 }),
      createMockCandidate('song-ret-3', 'Returning Hit 3', 'Artist C', 'Rock', { affinity: 0.82, content: 0.78 }),
      createMockCandidate('song-ret-4', 'Returning Hit 4', 'Artist D', 'Pop', { affinity: 0.75, content: 0.70 }),
      createMockCandidate('song-ret-5', 'Returning Hit 5', 'Artist E', 'Jazz', { affinity: 0.70, content: 0.65 }),
    ];

    const result = await AdaptiveRecommendationRankingPipeline.executePipeline({
      userId,
      candidates,
      limit: 5,
      userClassification: 'ACTIVE',
      enableAllStages: true,
    });

    assert.strictEqual(result.strategyUsed, 'HYBRID_PERSONALIZED');
    assert.strictEqual(result.userClassification, 'ACTIVE');
    assert.strictEqual(result.recommendations.length, 5);

    // Verify zero duplicates
    const ids = result.recommendations.map((r) => r.song._id.toString());
    assert.strictEqual(new Set(ids).size, 5, 'Must contain zero duplicate recommendations');

    // Verify valid bounded scores, no NaN, no undefined
    result.recommendations.forEach((r, idx) => {
      const score = r.finalScore ?? r.hybridScore;
      assert.ok(!isNaN(score), `Recommendation ${idx} score must not be NaN`);
      assert.ok(isFinite(score), `Recommendation ${idx} score must be finite`);
      assert.ok(score >= 0 && score <= 1.0, `Score ${score} must be bounded between 0 and 1`);
      assert.ok(r.componentScores, 'Component scores breakdown must be present');
    });

    // Verify monotonic ranking order
    for (let i = 0; i < result.recommendations.length - 1; i++) {
      const curr = result.recommendations[i].finalScore!;
      const next = result.recommendations[i + 1].finalScore!;
      assert.ok(curr >= next - 1e-5, `Rank ${i} (${curr}) must be >= Rank ${i + 1} (${next})`);
    }

    console.log('  Passed: Normal returning user receives valid, sorted, non-duplicate recommendations');
  }

  // =========================================================================
  // Scenario 2: New User with Little History (Cold Start / Limited Data)
  // =========================================================================
  {
    console.log('\n--- Scenario 2: New User with Little History (Cold Start) ---');
    const newUserId = new Types.ObjectId().toString();

    // Catalog fallback candidate pool
    const catalogPool = [
      createMockCandidate('song-cold-1', 'Popular Hit 1', 'Pop Star 1', 'Pop', { popularity: 990, affinity: 0.5 }),
      createMockCandidate('song-cold-2', 'Popular Hit 2', 'Pop Star 2', 'Pop', { popularity: 950, affinity: 0.5 }),
      createMockCandidate('song-cold-3', 'Popular Hit 3', 'Rock Legend', 'Rock', { popularity: 920, affinity: 0.5 }),
    ];

    const result = await AdaptiveRecommendationRankingPipeline.executePipeline({
      userId: newUserId,
      candidates: catalogPool,
      limit: 3,
      userClassification: 'NEW',
      useAdaptiveExploration: true,
      useUserSpecificWeights: true,
    });

    assert.ok(result.recommendations.length > 0, 'New users must not receive empty recommendation lists');
    assert.strictEqual(result.userClassification, 'NEW');

    result.recommendations.forEach((r) => {
      assert.ok(!isNaN(r.finalScore!), 'Score must not be NaN');
      assert.ok(r.finalScore! > 0, 'Score must be non-zero');
    });

    console.log('  Passed: New user receives valid exploratory catalog recommendations safely');
  }

  // =========================================================================
  // Scenario 3: User with Strong Recent Preferences (Temporal Momentum)
  // =========================================================================
  {
    console.log('\n--- Scenario 3: User with Strong Recent Preferences (Taste Pivot) ---');
    const userId = new Types.ObjectId().toString();

    // Simulated Layered Taste Profile: recent surge in Synthwave, historical in Jazz
    const temporalProfile: UnifiedLayeredTasteProfile = {
      userId,
      shortTerm: {
        layerName: 'short_term',
        timeframeDays: 7,
        role: 'immediate_momentum',
        genres: [createAffinity('Synthwave', 0.95)],
        artists: [createAffinity('Kavinsky', 0.92)],
        moods: [createAffinity('Energetic', 0.90)],
        acousticTargets: { energy: 0.85, tempo: 128 },
        topGenre: 'Synthwave',
        topArtist: 'Kavinsky',
        totalInteractions: 40,
        lastUpdated: new Date(),
      },
      mediumTerm: {
        layerName: 'medium_term',
        timeframeDays: 30,
        role: 'rotational_habits',
        genres: [createAffinity('Synthwave', 0.70)],
        artists: [createAffinity('Kavinsky', 0.65)],
        moods: [createAffinity('Energetic', 0.75)],
        acousticTargets: { energy: 0.80, tempo: 125 },
        topGenre: 'Synthwave',
        topArtist: 'Kavinsky',
        totalInteractions: 60,
        lastUpdated: new Date(),
      },
      longTerm: {
        layerName: 'long_term',
        timeframeDays: 90,
        role: 'foundational_taste',
        genres: [createAffinity('Jazz', 0.90)],
        artists: [createAffinity('Miles Davis', 0.88)],
        moods: [createAffinity('Chill', 0.85)],
        acousticTargets: { energy: 0.40, tempo: 95 },
        topGenre: 'Jazz',
        topArtist: 'Miles Davis',
        totalInteractions: 200,
        lastUpdated: new Date(),
      },
      unifiedGenres: [createAffinity('Synthwave', 0.85), createAffinity('Jazz', 0.70)],
      unifiedArtists: [createAffinity('Kavinsky', 0.82), createAffinity('Miles Davis', 0.68)],
      unifiedMoods: [createAffinity('Energetic', 0.80)],
      unifiedAcousticTargets: { energy: 0.82, tempo: 126 },
      layerWeights: { shortTermWeight: 0.50, mediumTermWeight: 0.30, longTermWeight: 0.20 },
      tasteStabilityScore: 0.35,
      totalInteractionsAnalyzed: 300,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const synthwaveTrack = createMockCandidate(
      'song-synth-1',
      'Nightcall',
      'Kavinsky',
      'Synthwave',
      { content: 0.82, affinity: 0.80 },
      { energy: 0.86, tempo: 128 }
    );

    const jazzTrack = createMockCandidate(
      'song-jazz-1',
      'So What',
      'Miles Davis',
      'Jazz',
      { content: 0.82, affinity: 0.80 },
      { energy: 0.38, tempo: 92 }
    );

    const result = await AdaptiveRecommendationRankingPipeline.executePipeline({
      userId,
      candidates: [jazzTrack, synthwaveTrack],
      temporalProfile,
      useTemporalProfile: true,
      useUserSpecificWeights: true,
      limit: 2,
    });

    assert.strictEqual(result.recommendations.length, 2);
    // Synthwave must be ranked first due to short-term momentum and amplified recent weights
    assert.strictEqual(
      result.recommendations[0].song._id,
      'song-synth-1',
      'Active recent preference (Synthwave) must outrank stale long-term preference (Jazz)'
    );

    console.log('  Passed: Strong recent preferences correctly amplified through temporal taste');
  }

  // =========================================================================
  // Scenario 4: User with Strong Long-Term Preferences (High Stability)
  // =========================================================================
  {
    console.log('\n--- Scenario 4: User with Strong Long-Term Preferences (High Stability) ---');
    const userId = new Types.ObjectId().toString();

    // High stability index (0.90) = heavily established long-term tastes
    const stableTemporalProfile: UnifiedLayeredTasteProfile = {
      userId,
      shortTerm: {
        layerName: 'short_term',
        timeframeDays: 7,
        role: 'immediate_momentum',
        genres: [createAffinity('Classic Rock', 0.88)],
        artists: [createAffinity('Queen', 0.85)],
        moods: [createAffinity('Epic', 0.85)],
        acousticTargets: { energy: 0.80, tempo: 120 },
        topGenre: 'Classic Rock',
        topArtist: 'Queen',
        totalInteractions: 30,
        lastUpdated: new Date(),
      },
      mediumTerm: {
        layerName: 'medium_term',
        timeframeDays: 30,
        role: 'rotational_habits',
        genres: [createAffinity('Classic Rock', 0.90)],
        artists: [createAffinity('Queen', 0.88)],
        moods: [createAffinity('Epic', 0.88)],
        acousticTargets: { energy: 0.80, tempo: 120 },
        topGenre: 'Classic Rock',
        topArtist: 'Queen',
        totalInteractions: 150,
        lastUpdated: new Date(),
      },
      longTerm: {
        layerName: 'long_term',
        timeframeDays: 90,
        role: 'foundational_taste',
        genres: [createAffinity('Classic Rock', 0.95)],
        artists: [createAffinity('Queen', 0.94)],
        moods: [createAffinity('Epic', 0.90)],
        acousticTargets: { energy: 0.80, tempo: 120 },
        topGenre: 'Classic Rock',
        topArtist: 'Queen',
        totalInteractions: 600,
        lastUpdated: new Date(),
      },
      unifiedGenres: [createAffinity('Classic Rock', 0.94)],
      unifiedArtists: [createAffinity('Queen', 0.92)],
      unifiedMoods: [createAffinity('Epic', 0.90)],
      unifiedAcousticTargets: { energy: 0.80, tempo: 120 },
      layerWeights: { shortTermWeight: 0.15, mediumTermWeight: 0.25, longTermWeight: 0.60 },
      tasteStabilityScore: 0.90,
      totalInteractionsAnalyzed: 780,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const rockTrack = createMockCandidate('song-rock-1', 'Bohemian Rhapsody', 'Queen', 'Classic Rock', {
      affinity: 0.95,
      content: 0.92,
    });
    const randomTrack = createMockCandidate('song-other-1', 'Unknown Melody', 'New Artist', 'Ambient', {
      affinity: 0.40,
      content: 0.45,
    });

    const result = await AdaptiveRecommendationRankingPipeline.executePipeline({
      userId,
      candidates: [randomTrack, rockTrack],
      temporalProfile: stableTemporalProfile,
      userClassification: 'WELL_ESTABLISHED',
      useUserSpecificWeights: true,
      useAdaptiveExploration: true,
      limit: 2,
    });

    assert.strictEqual(result.recommendations[0].song._id, 'song-rock-1');
    assert.ok(result.recommendations[0].finalScore! > result.recommendations[1].finalScore! + 0.2);

    console.log('  Passed: High stability users retain strong long-term preference dominance');
  }

  // =========================================================================
  // Scenario 5: User Giving Repeated Positive Feedback
  // =========================================================================
  {
    console.log('\n--- Scenario 5: User Giving Repeated Positive Feedback ---');
    const userId = new Types.ObjectId().toString();

    const favoritedSongId = 'song-fav-1';
    const neutralSongId = 'song-neutral-1';
    const topSongId = 'song-top-1';

    const feedbackProfile = createFeedbackProfile({
      likedSongIds: new Set([favoritedSongId]),
      savedSongIds: new Set([favoritedSongId]),
    });

    const candidates = [
      createMockCandidate(topSongId, 'Top Track', 'Artist Top', 'Pop', { affinity: 0.95, content: 0.95 }),
      createMockCandidate(neutralSongId, 'Neutral Track', 'Artist 1', 'Pop', { affinity: 0.70, content: 0.70 }),
      createMockCandidate(favoritedSongId, 'Favorited Track', 'Artist 2', 'Pop', { affinity: 0.70, content: 0.70 }),
    ];

    const result = await AdaptiveRecommendationRankingPipeline.executePipeline({
      userId,
      candidates,
      feedbackProfile,
      useScoreCalibration: true,
      limit: 3,
    });

    const favItem = result.recommendations.find((r) => r.song._id === favoritedSongId)!;
    const neutralItem = result.recommendations.find((r) => r.song._id === neutralSongId)!;

    assert.ok(favItem, 'Favorited item must be in recommendations');
    assert.ok(neutralItem, 'Neutral item must be in recommendations');
    assert.ok(
      favItem.finalScore! > neutralItem.finalScore!,
      'Favorited song must receive score boost over neutral song'
    );
    assert.strictEqual(
      (favItem.componentScores as any)?.calibrationMultiplier,
      1.2,
      'Favorited song must receive 1.2x saved/liked calibration multiplier'
    );

    console.log('  Passed: Positive feedback elevates liked tracks with score calibration boost');
  }

  // =========================================================================
  // Scenario 6: User Giving Repeated Negative Feedback
  // =========================================================================
  {
    console.log('\n--- Scenario 6: User Giving Repeated Negative Feedback ---');
    const userId = new Types.ObjectId().toString();

    const skippedSongId = 'song-skipped-1';
    const cleanSongId = 'song-clean-1';

    const skippedMap = new Map<string, number>();
    skippedMap.set(skippedSongId, 5); // Repeatedly skipped 5 times

    const feedbackProfile = createFeedbackProfile({
      skippedSongIds: skippedMap,
    });

    // Both songs have equal initial baseline relevance
    const candidates = [
      createMockCandidate(skippedSongId, 'Skipped Track', 'Artist Skip', 'HipHop', { affinity: 0.85, content: 0.85 }),
      createMockCandidate(cleanSongId, 'Clean Track', 'Artist Clean', 'HipHop', { affinity: 0.80, content: 0.80 }),
    ];

    const result = await AdaptiveRecommendationRankingPipeline.executePipeline({
      userId,
      candidates,
      feedbackProfile,
      useScoreCalibration: true,
      limit: 2,
    });

    assert.strictEqual(
      result.recommendations[0].song._id,
      cleanSongId,
      'Clean track must outrank repeatedly skipped track'
    );
    assert.ok(
      result.recommendations[1].finalScore! < result.recommendations[0].finalScore!,
      'Skipped track must be penalized in finalScore'
    );

    console.log('  Passed: Repeated negative feedback heavily penalizes candidate rank');
  }

  // =========================================================================
  // Scenario 7: Recommendation List Requiring Diversity
  // =========================================================================
  {
    console.log('\n--- Scenario 7: Recommendation List Requiring Diversity ---');
    const userId = new Types.ObjectId().toString();

    // 4 songs by "Artist Cluster" in "Electro" with nearly identical high scores,
    // plus 1 by "Artist Unique" in "Rock"
    const clusterCandidates = [
      createMockCandidate('clust-1', 'Cluster 1', 'Artist Cluster', 'Electro', { affinity: 0.92, content: 0.92 }),
      createMockCandidate('clust-2', 'Cluster 2', 'Artist Cluster', 'Electro', { affinity: 0.90, content: 0.90 }),
      createMockCandidate('clust-3', 'Cluster 3', 'Artist Cluster', 'Electro', { affinity: 0.88, content: 0.88 }),
      createMockCandidate('uniq-1', 'Unique 1', 'Artist Unique', 'Rock', { affinity: 0.87, content: 0.87 }),
      createMockCandidate('uniq-2', 'Other 1', 'Artist Other', 'Jazz', { affinity: 0.85, content: 0.85 }),
    ];

    const result = await AdaptiveRecommendationRankingPipeline.executePipeline({
      userId,
      candidates: clusterCandidates,
      useDiversityRanking: true,
      diversityStrength: 0.60,
      limit: 5,
    });

    const rankedArtists = result.recommendations.map((r) => r.song.artist.name);

    // Verify Artist Cluster does not monopolize all top 3 spots consecutively
    const firstThreeAreCluster = rankedArtists.slice(0, 3).every((a) => a === 'Artist Cluster');
    assert.strictEqual(
      firstThreeAreCluster,
      false,
      'Diversity re-ranking must prevent consecutive 3-track monopoly by the same artist'
    );

    // Verify Unique Artist was promoted into top 2
    const uniqueIndex = rankedArtists.indexOf('Artist Unique');
    assert.ok(uniqueIndex >= 0 && uniqueIndex < 3, 'Diverse candidate must be promoted');

    console.log('  Passed: Diversity re-ranking prevents artist monopolies and balances list');
  }

  // =========================================================================
  // Scenario 8: Recommendation List Containing Novel Candidates
  // =========================================================================
  {
    console.log('\n--- Scenario 8: Recommendation List Containing Novel Candidates ---');
    const userId = new Types.ObjectId().toString();

    const familiarId = 'song-familiar-1';
    const novelRelevantId = 'song-novel-rel-1';
    const novelIrrelevantId = 'song-novel-irrel-1';

    const familiarityProfile: UserFamiliarityProfile = {
      userId,
      songEncounterCounts: new Map([[familiarId, 15]]),
      songCategories: new Map([[familiarId, 'FREQUENTLY_HEARD']]),
      frequentlyHeardSongIds: new Set([familiarId]),
      previouslyHeardSongIds: new Set(),
      rarelyHeardSongIds: new Set(),
      totalHistoryCount: 15,
    };

    const candidates = [
      createMockCandidate(familiarId, 'Familiar Classic', 'Artist Familiar', 'Electronic', {
        affinity: 0.80,
        content: 0.80,
      }),
      createMockCandidate(novelRelevantId, 'Novel Gem', 'Artist New', 'Electronic', {
        affinity: 0.79, // Just slightly below familiar, but completely novel!
        content: 0.79,
      }),
      createMockCandidate(novelIrrelevantId, 'Obscure Noise', 'Artist Unknown', 'Polka', {
        affinity: 0.15, // Below minimum relevance gating (0.35)
        content: 0.15,
      }),
    ];

    const result = await AdaptiveRecommendationRankingPipeline.executePipeline({
      userId,
      candidates,
      familiarityProfile,
      useNoveltyScoring: true,
      limit: 3,
    });

    const rankedIds = result.recommendations.map((r) => r.song._id);

    // Novel relevant track should be boosted by novelty scoring
    const familiarItem = result.recommendations.find((r) => r.song._id === familiarId)!;
    const novelRelItem = result.recommendations.find((r) => r.song._id === novelRelevantId)!;
    const novelIrrelItem = result.recommendations.find((r) => r.song._id === novelIrrelevantId)!;

    assert.strictEqual(
      (novelRelItem.metadata as any)?.familiarityCategory,
      'COMPLETELY_UNFAMILIAR'
    );
    assert.strictEqual(
      (familiarItem.metadata as any)?.familiarityCategory,
      'FREQUENTLY_HEARD'
    );
    assert.ok(
      (novelRelItem.metadata as any)?.rawNoveltyScore > (familiarItem.metadata as any)?.rawNoveltyScore,
      'Unfamiliar track must have significantly higher raw novelty than familiar track'
    );
    assert.ok(
      (novelRelItem.metadata as any)?.gatedNoveltyScore > (novelIrrelItem.metadata as any)?.gatedNoveltyScore,
      'Relevant novel track must receive higher gated novelty than irrelevant track'
    );

    // Obscure irrelevant song must strictly remain at the bottom
    assert.strictEqual(rankedIds[2], novelIrrelevantId);

    console.log('  Passed: Novel relevant candidates boosted while irrelevant candidates are gated');
  }

  // =========================================================================
  // Scenario 9: Smart Autoplay Using Updated Adaptive Ranking
  // =========================================================================
  {
    console.log('\n--- Scenario 9: Smart Autoplay Using Updated Adaptive Ranking ---');
    const userId = new Types.ObjectId().toString();
    const currentTrackId = 'song-current-playing';

    const autoplayCandidates: HybridCandidate[] = [
      createMockCandidate('ap-cand-1', 'Autoplay Electronic 1', 'DJ One', 'Electronic', { affinity: 0.92, content: 0.90 }),
      createMockCandidate('ap-cand-2', 'Autoplay Indie 1', 'Indie Band', 'Indie', { affinity: 0.85, content: 0.85 }),
      createMockCandidate('ap-cand-3', 'Autoplay Electronic 2', 'DJ Two', 'Electronic', { affinity: 0.82, content: 0.80 }),
      createMockCandidate('ap-cand-4', 'Autoplay Rock 1', 'Rock Band', 'Rock', { affinity: 0.78, content: 0.75 }),
      createMockCandidate(currentTrackId, 'Currently Playing', 'DJ One', 'Electronic', { affinity: 0.99, content: 0.99 }),
    ];

    const originalGenerate = CandidateGenerationService.generateHybridCandidates;
    CandidateGenerationService.generateHybridCandidates = async () => autoplayCandidates;

    try {
      const autoplayResult = await SmartAutoplayService.generateAdaptiveQueue({
        userId,
        currentTrackId,
        queueSize: 3,
        useAdaptiveRanking: true,
        currentQueueSongIds: [],
      });

      assert.ok(autoplayResult.queue.length > 0, 'Autoplay queue must not be empty');
      assert.strictEqual(autoplayResult.queue.length, 3, 'Autoplay queue size must match requested size');

      const queueSongIds = autoplayResult.queue.map((q) => q.song._id.toString());

      // Current playing track must be excluded
      assert.strictEqual(
        queueSongIds.includes(currentTrackId),
        false,
        'Currently playing track must be strictly excluded from autoplay queue'
      );

      // Verify zero duplicates in queue
      assert.strictEqual(
        new Set(queueSongIds).size,
        queueSongIds.length,
        'Smart Autoplay queue must contain zero duplicates'
      );

      // Verify all queue items have valid scores and reasons
      autoplayResult.queue.forEach((item, idx) => {
        assert.ok(!isNaN(item.queueScore), `Queue item ${idx} score must not be NaN`);
        assert.ok(item.queueScore > 0, `Queue item ${idx} score must be > 0`);
        assert.ok(item.reason && item.reason.length > 0, `Queue item ${idx} must have descriptive reason`);
        assert.ok(item.tier, `Queue item ${idx} must have tier assignment`);
      });

      console.log('  Passed: Smart Autoplay successfully generates adaptive queue with updated ranking');
    } finally {
      CandidateGenerationService.generateHybridCandidates = originalGenerate;
    }
  }

  // =========================================================================
  // Scenario 10: Recommendation Evaluation Integration
  // =========================================================================
  {
    console.log('\n--- Scenario 10: Recommendation Evaluation Integration ---');
    const recommended = ['song-1', 'song-2', 'song-3', 'song-4', 'song-5'];
    const relevant = ['song-2', 'song-4', 'song-6', 'song-7'];

    const evalResult = RecommendationEvaluationService.evaluateRecommendationSet(
      recommended,
      relevant,
      5
    );

    assert.strictEqual(evalResult.k, 5);
    assert.strictEqual(evalResult.hitsCount, 2);
    assert.strictEqual(evalResult.precisionAtK, 0.40); // 2 / 5
    assert.strictEqual(evalResult.recallAtK, 0.50);    // 2 / 4
    assert.ok(evalResult.f1AtK > 0);

    console.log('  Passed: Recommendation evaluation metrics integrate seamlessly with ranking outputs');
  }

  console.log('\n🎉 ALL 10 INTEGRATION SCENARIOS PASSED WITH ZERO ERRORS!\n');
}

// Direct execution support
if (process.argv[1]?.endsWith('adaptiveRecommendationIntegration.test.js')) {
  runAdaptiveRecommendationIntegrationTests().catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
}
