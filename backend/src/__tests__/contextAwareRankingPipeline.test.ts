import assert from 'node:assert';
import { ContextAwareRankingPipeline } from '../services/contextAwareRankingPipeline.js';
import { HybridCandidate } from '../services/candidateGenerationService.js';
import { ContextMood, ContextActivity } from '../schemas/contextPreferenceSchema.js';

export function runContextAwareRankingPipelineTests() {
  console.log('[Context-Aware Ranking Pipeline Test Suite] Starting tests...');

  // Test 1: 7-Signal Normalized Fusion & Ranking
  {
    const candidates: HybridCandidate[] = [
      {
        songId: 'song_workout_match',
        songDoc: { title: 'High Energy Workout Song', mood: 'Energetic', audioFeatures: { energy: 0.9, valence: 0.8 } },
        contentScore: 0.8,
        collaborativeScore: 0.8,
        userTasteAffinityScore: 0.8,
        popularitySignal: 100,
        recencySignal: 0.8,
        sources: ['content'],
      },
      {
        songId: 'song_chill_mismatch',
        songDoc: { title: 'Quiet Sleep Track', mood: 'Chill', audioFeatures: { energy: 0.1, valence: 0.2 } },
        contentScore: 0.5,
        collaborativeScore: 0.5,
        userTasteAffinityScore: 0.5,
        popularitySignal: 50,
        recencySignal: 0.5,
        sources: ['collaborative'],
      },
    ];

    const context = {
      mood: ContextMood.Energetic,
      activity: ContextActivity.Workout,
      energyLevel: 0.85,
    };

    const ranked = ContextAwareRankingPipeline.rankCandidatesWithContext(candidates, context, 10);

    assert.strictEqual(ranked.length, 2);
    assert.strictEqual(ranked[0].song.title, 'High Energy Workout Song', 'Workout matching song ranked first');
    assert.ok(ranked[0].contextScore > ranked[1].contextScore, 'Scores strictly descending');
    
    // Check 7 component scores presence
    const cs = ranked[0].componentScores;
    assert.ok('contentScore' in cs);
    assert.ok('collaborativeScore' in cs);
    assert.ok('userTasteAffinityScore' in cs);
    assert.ok('popularityScore' in cs);
    assert.ok('recencyScore' in cs);
    assert.ok('moodScore' in cs);
    assert.ok('activityScore' in cs);
    assert.ok(cs.moodScore > 0.6, 'High moodScore for Energetic match');

    console.log('✓ Test 1 Passed: 7-signal normalized fusion & descending ranking verified.');
  }

  // Test 2: Custom Configurable Weights
  {
    const candidates: HybridCandidate[] = [
      {
        songId: 's1',
        songDoc: { title: 'Mood Only Match', mood: 'Energetic', audioFeatures: { energy: 0.9 } },
        contentScore: 0.1,
        collaborativeScore: 0.1,
        userTasteAffinityScore: 0.1,
        popularitySignal: 10,
        recencySignal: 0.1,
        sources: ['trending'],
      },
    ];

    const context = { mood: ContextMood.Energetic };

    // Set mood weight to 1.0 and others to 0
    const customWeights = {
      contentSimilarityWeight: 0,
      collaborativeWeight: 0,
      userTasteAffinityWeight: 0,
      popularityWeight: 0,
      recencyWeight: 0,
      moodCompatibilityWeight: 1.0,
      contextActivityCompatibilityWeight: 0,
    };

    const ranked = ContextAwareRankingPipeline.rankCandidatesWithContext(candidates, context, 10, customWeights);

    assert.strictEqual(ranked.length, 1);
    assert.strictEqual(ranked[0].contextScore, ranked[0].componentScores.moodScore, 'Context score equals mood score when custom weight = 1.0');

    console.log('✓ Test 2 Passed: Custom configurable weights verified.');
  }

  console.log('🎉 All context-aware ranking pipeline tests completed successfully.');
}
