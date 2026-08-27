import assert from 'node:assert';
import { HybridRankingPipeline } from '../services/hybridRankingPipeline.js';
import { HybridCandidate } from '../services/candidateGenerationService.js';
import {
  getContextInfluenceConfig,
  updateContextInfluenceConfig,
  resetContextInfluenceConfig,
} from '../config/recommendationConfig.js';

export function runRecommendationContextIntegrationTests() {
  console.log('[Recommendation Context Integration Test Suite] Starting tests...');

  // Reset config before tests
  resetContextInfluenceConfig();

  // Mock candidate pool
  const candidatePool: HybridCandidate[] = [
    {
      songId: 'song-lofi-study',
      contentScore: 0.85,
      collaborativeScore: 0.70,
      userTasteAffinityScore: 0.80,
      popularitySignal: 500,
      recencySignal: 0.75,
      sources: ['content', 'taste_profile'],
      songDoc: {
        _id: 'song-lofi-study',
        title: 'Midnight Coffee',
        artist: 'Chillhop Beats',
        genre: 'Lo-Fi',
        mood: 'Focus',
        audioFeatures: { energy: 0.28, tempo: 80 },
      },
    },
    {
      songId: 'song-edm-workout',
      contentScore: 0.80,
      collaborativeScore: 0.75,
      userTasteAffinityScore: 0.75,
      popularitySignal: 800,
      recencySignal: 0.85,
      sources: ['collaborative', 'trending'],
      songDoc: {
        _id: 'song-edm-workout',
        title: 'Neon Overdrive',
        artist: 'Electro Pulse',
        genre: 'EDM',
        mood: 'Energetic',
        audioFeatures: { energy: 0.92, tempo: 142 },
      },
    },
    {
      songId: 'song-pop-general',
      contentScore: 0.70,
      collaborativeScore: 0.65,
      userTasteAffinityScore: 0.90,
      popularitySignal: 950,
      recencySignal: 0.60,
      sources: ['taste_profile'],
      songDoc: {
        _id: 'song-pop-general',
        title: 'City Lights',
        artist: 'Pop Collective',
        genre: 'Pop',
        mood: 'Upbeat',
        audioFeatures: { energy: 0.65, tempo: 118 },
      },
    },
  ];

  // Test 1: Recommendation WITHOUT Context (Preserves 100% exact base behavior)
  {
    const noContextResults = HybridRankingPipeline.rankCandidates(candidatePool, 10);

    assert.strictEqual(noContextResults.length, 3);
    for (const res of noContextResults) {
      assert.strictEqual(res.hybridScore, res.originalScore);
      assert.strictEqual(res.hybridScore, res.finalScore);
      assert.strictEqual(res.componentScores.contextScore, undefined);
      assert.strictEqual(res.metadata, undefined);
    }

    console.log('✓ Test 1 Passed: No-context recommendations preserve 100% exact baseline personalized scores.');
  }

  // Test 2: Recommendation WITH "Workout" Context
  {
    const workoutResults = HybridRankingPipeline.rankCandidates(
      candidatePool,
      10,
      undefined,
      'workout',
      0.30 // 30% context influence
    );

    assert.strictEqual(workoutResults.length, 3);
    const edmTrack = workoutResults.find((r) => r.song._id === 'song-edm-workout')!;
    const lofiTrack = workoutResults.find((r) => r.song._id === 'song-lofi-study')!;

    assert.ok(edmTrack.componentScores.contextScore !== undefined);
    assert.ok(edmTrack.componentScores.contextScore > 0.85);
    assert.ok(lofiTrack.componentScores.contextScore! < 0.50);

    // In workout context, EDM track should have a higher finalScore than its originalScore
    assert.ok(edmTrack.finalScore! >= edmTrack.originalScore!);
    assert.strictEqual(workoutResults[0].song._id, 'song-edm-workout', 'Workout context should rank high-energy track #1');

    console.log('✓ Test 2 Passed: Workout context boosts high-energy and tempo-aligned tracks.');
  }

  // Test 3: Recommendation WITH "Study" Context
  {
    const studyResults = HybridRankingPipeline.rankCandidates(
      candidatePool,
      10,
      undefined,
      'study',
      0.30 // 30% context influence
    );

    assert.strictEqual(studyResults.length, 3);
    const lofiTrack = studyResults.find((r) => r.song._id === 'song-lofi-study')!;
    const edmTrack = studyResults.find((r) => r.song._id === 'song-edm-workout')!;

    assert.ok(lofiTrack.componentScores.contextScore! > 0.80);
    assert.ok(edmTrack.componentScores.contextScore! < 0.50);

    assert.strictEqual(studyResults[0].song._id, 'song-lofi-study', 'Study context should rank lo-fi track #1');

    console.log('✓ Test 3 Passed: Study context boosts low-energy focus tracks.');
  }

  // Test 4: Personalized Taste Preservation (Context does not override heavy taste favorites)
  {
    const heavyFavoriteCandidate: HybridCandidate = {
      songId: 'song-heavy-favorite',
      contentScore: 0.95,
      collaborativeScore: 0.95,
      userTasteAffinityScore: 1.0, // Absolute top favorite artist & genre
      popularitySignal: 900,
      recencySignal: 0.90,
      sources: ['taste_profile'],
      songDoc: {
        _id: 'song-heavy-favorite',
        title: 'Core Favorite Track',
        artist: 'Favorite Artist',
        genre: 'Synthwave',
        mood: 'Upbeat',
        audioFeatures: { energy: 0.60, tempo: 115 },
      },
    };

    const weakRandomCandidate: HybridCandidate = {
      songId: 'song-weak-random',
      contentScore: 0.10,
      collaborativeScore: 0.10,
      userTasteAffinityScore: 0.10, // Unfamiliar/unfavored
      popularitySignal: 100,
      recencySignal: 0.10,
      sources: ['catalog'],
      songDoc: {
        _id: 'song-weak-random',
        title: 'Random Workout Song',
        artist: 'Unknown',
        genre: 'EDM',
        mood: 'Energetic',
        audioFeatures: { energy: 0.90, tempo: 140 }, // Perfectly matches workout context
      },
    };

    const results = HybridRankingPipeline.rankCandidates(
      [heavyFavoriteCandidate, weakRandomCandidate],
      2,
      undefined,
      'workout',
      0.25 // Default 25% context influence
    );

    // The user's core favorite (high base personalized score ~0.95) must still outrank
    // a completely unfamiliar track with zero taste affinity (~0.10), proving personalized score is primary
    assert.strictEqual(results[0].song._id, 'song-heavy-favorite');
    assert.ok(results[0].finalScore! > results[1].finalScore! + 0.3);

    console.log('✓ Test 4 Passed: Personalized taste is preserved as primary signal; context does not wipe taste profile.');
  }

  // Test 5: Configurable Context Influence
  {
    // High influence vs Low influence scaling
    const lowInfluence = HybridRankingPipeline.rankCandidates(
      candidatePool,
      10,
      undefined,
      'workout',
      0.05
    );
    const highInfluence = HybridRankingPipeline.rankCandidates(
      candidatePool,
      10,
      undefined,
      'workout',
      0.40
    );

    const edmLow = lowInfluence.find((r) => r.song._id === 'song-edm-workout')!;
    const edmHigh = highInfluence.find((r) => r.song._id === 'song-edm-workout')!;

    // Higher context influence should produce greater boost towards contextFitScore
    assert.ok(edmHigh.finalScore! > edmLow.finalScore!);

    console.log('✓ Test 5 Passed: Context influence scaling is strictly configurable.');
  }

  console.log('🎉 All 5 Recommendation Context Integration tests completed successfully.');
}
