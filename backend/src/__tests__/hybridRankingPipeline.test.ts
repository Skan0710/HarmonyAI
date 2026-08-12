import assert from 'node:assert';
import { HybridRankingPipeline } from '../services/hybridRankingPipeline.js';
import { HybridCandidate } from '../services/candidateGenerationService.js';

export function runHybridRankingPipelineTests() {
  console.log('[Hybrid Ranking Pipeline Test Suite] Starting tests...');

  // Test 1: Weighted Fusion & Descending Score Ranking
  {
    const candidates: HybridCandidate[] = [
      {
        songId: 'song_medium',
        songDoc: { title: 'Medium Track' },
        contentScore: 0.5,
        collaborativeScore: 0.5,
        popularitySignal: 100,
        recencySignal: 0.5,
        sources: ['content'],
      },
      {
        songId: 'song_top',
        songDoc: { title: 'Top Recommended Track' },
        contentScore: 0.95,
        collaborativeScore: 0.9,
        popularitySignal: 500,
        recencySignal: 0.95,
        sources: ['content', 'collaborative'],
      },
      {
        songId: 'song_low',
        songDoc: { title: 'Low Track' },
        contentScore: 0.1,
        collaborativeScore: 0.1,
        popularitySignal: 10,
        recencySignal: 0.1,
        sources: ['trending'],
      },
    ];

    const results = HybridRankingPipeline.rankCandidates(candidates, 10);

    assert.strictEqual(results.length, 3, 'All candidate items ranked');
    assert.strictEqual(results[0].song.title, 'Top Recommended Track', 'Highest score track ranked first');
    assert.strictEqual(results[2].song.title, 'Low Track', 'Lowest score track ranked last');
    assert.ok(results[0].hybridScore > results[1].hybridScore, 'Scores strictly descending');
    assert.ok(results[1].hybridScore > results[2].hybridScore, 'Scores strictly descending');

    // Individual component scores returned
    assert.ok(results[0].componentScores.contentScore > 0, 'contentScore present');
    assert.ok(results[0].componentScores.collaborativeScore > 0, 'collaborativeScore present');
    assert.ok(results[0].componentScores.popularityScore > 0, 'popularityScore present');
    assert.ok(results[0].componentScores.recencyScore > 0, 'recencyScore present');

    console.log('✓ Test 1 Passed: Weighted fusion & descending score ranking verified.');
  }

  // Test 2: Configurable Recommendation Limit
  {
    const candidates: HybridCandidate[] = Array.from({ length: 15 }, (_, i) => ({
      songId: `song_${i}`,
      songDoc: { title: `Track ${i}` },
      contentScore: (i + 1) * 0.05,
      collaborativeScore: (i + 1) * 0.05,
      popularitySignal: (i + 1) * 10,
      recencySignal: 0.5,
      sources: ['content'],
    }));

    const results = HybridRankingPipeline.rankCandidates(candidates, 5);
    assert.strictEqual(results.length, 5, 'Configurable limit of 5 respected');
    console.log('✓ Test 2 Passed: Configurable limit respected.');
  }

  // Test 3: Graceful Handling of Missing Content/Collaborative Scores
  {
    const candidates: HybridCandidate[] = [
      {
        songId: 'song_missing',
        songDoc: { title: 'Missing Scores Track' },
        contentScore: NaN,
        collaborativeScore: undefined as any,
        popularitySignal: 50,
        recencySignal: 0.5,
        sources: ['trending'],
      },
    ];

    const results = HybridRankingPipeline.rankCandidates(candidates, 10);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(isNaN(results[0].hybridScore), false, 'Hybrid score should not be NaN');
    assert.strictEqual(results[0].componentScores.contentScore, 0, 'Missing contentScore handled as 0');
    assert.strictEqual(results[0].componentScores.collaborativeScore, 0, 'Missing collaborativeScore handled as 0');
    console.log('✓ Test 3 Passed: Missing content & collaborative scores handled gracefully.');
  }

  console.log('🎉 All hybrid ranking pipeline tests completed successfully.');
}
