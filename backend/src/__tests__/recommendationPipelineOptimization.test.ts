import assert from 'node:assert';
import { Types } from 'mongoose';
import {
  AdaptiveRecommendationRankingPipeline,
  AdaptivePipelineOptions,
} from '../services/adaptiveRecommendationRankingPipeline.js';
import {
  HybridRankingPipeline,
  TasteEvolutionSignal,
} from '../services/hybridRankingPipeline.js';
import { HybridCandidate } from '../services/candidateGenerationService.js';

export async function runRecommendationPipelineOptimizationTests(): Promise<void> {
  console.log('[Pipeline Optimization Test Suite] Starting tests...');

  const userId = new Types.ObjectId().toString();
  const testSong1 = {
    _id: new Types.ObjectId(),
    title: 'Neon Skyline',
    artist: { _id: new Types.ObjectId(), name: 'Synth Wave' },
    genre: { _id: new Types.ObjectId(), name: 'Synthpop' },
    energy: 0.8,
    danceability: 0.75,
    valence: 0.6,
  };

  const testSong2 = {
    _id: new Types.ObjectId(),
    title: 'Midnight Echoes',
    artist: { _id: new Types.ObjectId(), name: 'Echo Park' },
    genre: { _id: new Types.ObjectId(), name: 'Indie Rock' },
    energy: 0.5,
    danceability: 0.4,
    valence: 0.3,
  };

  const testSong3 = {
    _id: new Types.ObjectId(),
    title: 'Solar Flare',
    artist: { _id: new Types.ObjectId(), name: 'Sunburst' },
    genre: { _id: new Types.ObjectId(), name: 'Electronic' },
    energy: 0.9,
    danceability: 0.85,
    valence: 0.9,
  };

  // 1. Signal Connectivity & Multi-Layer Fusion
  const candidates: HybridCandidate[] = [
    {
      songId: testSong1._id.toString(),
      songDoc: testSong1,
      contentScore: 0.85,
      collaborativeScore: 0.75,
      userTasteAffinityScore: 0.9,
      popularitySignal: 0.6,
      recencySignal: 0.8,
      sources: ['content', 'user_taste'],
    },
    {
      songId: testSong2._id.toString(),
      songDoc: testSong2,
      contentScore: 0.6,
      collaborativeScore: 0.65,
      userTasteAffinityScore: 0.4,
      popularitySignal: 0.7,
      recencySignal: 0.5,
      sources: ['collaborative'],
    },
  ];

  const evoSignal: TasteEvolutionSignal = {
    emergingGenres: ['synthpop'],
    sustainedEmergingGenres: ['synthpop'],
    fadingGenres: ['indie rock'],
    tasteStabilityRating: 'ACTIVE_EXPLORATION',
    archetype: 'TRAILBLAZER',
  };

  const rankedWithEvo = HybridRankingPipeline.rankCandidates(
    candidates,
    10,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    evoSignal,
    0.3
  );

  assert.strictEqual(rankedWithEvo.length, 2, 'Should return both ranked candidates');
  assert.strictEqual(
    rankedWithEvo[0].song._id.toString(),
    testSong1._id.toString(),
    'Emerging genre track should be ranked higher due to taste evolution boost'
  );
  assert.ok(
    rankedWithEvo[0].componentScores.tasteEvolutionScore! > 0.5,
    'Emerging track should receive elevated taste evolution fit score'
  );
  console.log('✓ Test 1 Passed: Signal connectivity and taste evolution influence verified.');

  // 2. NaN and Infinity Filtering / Safe Bounds
  const noisyCandidates: HybridCandidate[] = [
    {
      songId: testSong1._id.toString(),
      songDoc: testSong1,
      contentScore: NaN,
      collaborativeScore: Infinity,
      userTasteAffinityScore: -Infinity,
      popularitySignal: NaN,
      recencySignal: 0.8,
      sources: ['content'],
    },
    {
      songId: testSong2._id.toString(),
      songDoc: testSong2,
      contentScore: 0.7,
      collaborativeScore: 0.7,
      userTasteAffinityScore: 0.7,
      popularitySignal: 0.7,
      recencySignal: 0.7,
      sources: ['collaborative'],
    },
  ];

  const sanitizedRankings = HybridRankingPipeline.rankCandidates(noisyCandidates, 10);
  for (const item of sanitizedRankings) {
    assert.ok(Number.isFinite(item.hybridScore), `Hybrid score must be finite, got ${item.hybridScore}`);
    assert.ok(!Number.isNaN(item.hybridScore), 'Hybrid score must not be NaN');
    assert.ok(item.hybridScore >= 0.0 && item.hybridScore <= 1.0, 'Score must be bounded between 0 and 1');
  }
  console.log('✓ Test 2 Passed: NaN and Infinity successfully sanitized with finite bounded scores.');

  // 3. Duplicate Candidate Filtering
  const duplicateCandidates: HybridCandidate[] = [
    {
      songId: testSong1._id.toString(),
      songDoc: testSong1,
      contentScore: 0.5,
      collaborativeScore: 0.5,
      userTasteAffinityScore: 0.5,
      popularitySignal: 0.5,
      recencySignal: 0.5,
      sources: ['source_a'],
    },
    {
      songId: testSong1._id.toString(),
      songDoc: testSong1,
      contentScore: 0.95,
      collaborativeScore: 0.95,
      userTasteAffinityScore: 0.95,
      popularitySignal: 0.95,
      recencySignal: 0.95,
      sources: ['source_b'],
    },
    {
      songId: testSong2._id.toString(),
      songDoc: testSong2,
      contentScore: 0.6,
      collaborativeScore: 0.6,
      userTasteAffinityScore: 0.6,
      popularitySignal: 0.6,
      recencySignal: 0.6,
      sources: ['source_c'],
    },
  ];

  const deduplicatedRankings = HybridRankingPipeline.rankCandidates(duplicateCandidates, 10);
  assert.strictEqual(deduplicatedRankings.length, 2, 'Duplicate song IDs must be collapsed into unique entries');
  const song1Entry = deduplicatedRankings.find(
    (item) => item.song._id.toString() === testSong1._id.toString()
  );
  assert.ok(song1Entry, 'testSong1 should be present');
  assert.ok(song1Entry.hybridScore > 0.8, 'Highest scored candidate instance must be preserved');
  console.log('✓ Test 3 Passed: Duplicate tracks successfully deduplicated.');

  // 4. Deterministic Ordering with Identical Scores
  const identicalCandidates: HybridCandidate[] = [
    {
      songId: 'bbb',
      songDoc: { _id: 'bbb', title: 'Song B' },
      contentScore: 0.7,
      collaborativeScore: 0.7,
      userTasteAffinityScore: 0.7,
      popularitySignal: 0.7,
      recencySignal: 0.7,
      sources: ['content'],
    },
    {
      songId: 'aaa',
      songDoc: { _id: 'aaa', title: 'Song A' },
      contentScore: 0.7,
      collaborativeScore: 0.7,
      userTasteAffinityScore: 0.7,
      popularitySignal: 0.7,
      recencySignal: 0.7,
      sources: ['content'],
    },
  ];

  const runA = HybridRankingPipeline.rankCandidates(identicalCandidates, 10);
  const runB = HybridRankingPipeline.rankCandidates(identicalCandidates, 10);
  assert.strictEqual(
    runA[0].song._id,
    'aaa',
    'Deterministic tie-breaker should place aaa before bbb consistently'
  );
  assert.strictEqual(
    runB[0].song._id,
    'aaa',
    'Multiple runs must produce identical ordering'
  );
  console.log('✓ Test 4 Passed: Deterministic ranking order guaranteed on tied scores.');

  // 5. Empty Profiles and Missing Metadata Handling
  const emptyOptions: AdaptivePipelineOptions = {
    userId,
    candidates: [
      {
        songId: testSong3._id.toString(),
        songDoc: testSong3,
        contentScore: 0.8,
        collaborativeScore: 0.7,
        userTasteAffinityScore: 0.6,
        popularitySignal: 0.5,
        recencySignal: 0.5,
        sources: ['content'],
      },
    ],
    temporalProfile: null,
    musicDnaProfile: null,
    personalMusicTwin: null,
    sessionProfile: null,
    context: null,
    userClassification: 'NEW',
  };

  const emptyProfileResult = await AdaptiveRecommendationRankingPipeline.executePipeline(emptyOptions);
  assert.ok(emptyProfileResult.recommendations.length > 0, 'Pipeline must gracefully produce recommendations with empty profiles');
  assert.strictEqual(emptyProfileResult.userClassification, 'NEW');
  assert.ok(Number.isFinite(emptyProfileResult.recommendations[0].finalScore));
  console.log('✓ Test 5 Passed: Empty profiles and missing metadata handled gracefully.');

  console.log('🎉 ALL 5 Recommendation Pipeline Optimization tests completed successfully.');
}
