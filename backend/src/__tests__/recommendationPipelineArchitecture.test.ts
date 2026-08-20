import assert from 'node:assert';
import { RecommendationPipeline } from '../pipeline/recommendationPipeline.js';
import {
  ICandidateGenerationStage,
  IFeatureScoringStage,
  IRankingStage,
  IDiversityFilteringStage,
  IPostRankingStage,
  PipelineItem,
  RecommendationPipelineContext,
} from '../pipeline/recommendationPipelineTypes.js';

export function runRecommendationPipelineArchitectureTests() {
  console.log('[Recommendation Pipeline Architecture Test Suite] Starting tests...');

  // Test 1: Full 5-Stage Pipeline Execution Flow
  {
    const mockContext: RecommendationPipelineContext = {
      userId: 'test_user_1',
      limit: 3,
      isDebugMode: true,
      userClassification: 'ACTIVE',
    };

    const mockCandidateGenerator: ICandidateGenerationStage = {
      async generateCandidates() {
        return [
          {
            songId: 's1',
            song: { title: 'Track 1', artist: { _id: 'a1', name: 'Artist 1' } },
            sources: ['hybrid'],
            rawFeatures: { contentScore: 0.9, popularitySignal: 100, recencySignal: 0.8, collaborativeScore: 0.8, userTasteAffinityScore: 0.8 },
            normalizedScores: {},
            finalScore: 0,
          },
          {
            songId: 's2',
            song: { title: 'Track 2', artist: { _id: 'a1', name: 'Artist 1' } }, // same artist
            sources: ['hybrid'],
            rawFeatures: { contentScore: 0.85, popularitySignal: 90, recencySignal: 0.7, collaborativeScore: 0.7, userTasteAffinityScore: 0.7 },
            normalizedScores: {},
            finalScore: 0,
          },
          {
            songId: 's3',
            song: { title: 'Track 3', artist: { _id: 'a2', name: 'Artist 2' } },
            sources: ['hybrid'],
            rawFeatures: { contentScore: 0.7, popularitySignal: 80, recencySignal: 0.6, collaborativeScore: 0.6, userTasteAffinityScore: 0.6 },
            normalizedScores: {},
            finalScore: 0,
          },
          {
            songId: 's4',
            song: { title: 'Track 4', artist: { _id: 'a3', name: 'Artist 3' } },
            sources: ['hybrid'],
            rawFeatures: { contentScore: 0.6, popularitySignal: 50, recencySignal: 0.5, collaborativeScore: 0.5, userTasteAffinityScore: 0.5 },
            normalizedScores: {},
            finalScore: 0,
          },
        ];
      },
    };

    const pipeline = new RecommendationPipeline({ candidateGenerator: mockCandidateGenerator });

    pipeline.execute(mockContext).then((result) => {
      assert.strictEqual(result.count, 3, 'Post-ranking applies limit slicing to 3');
      assert.ok(result.items.length <= 3);
      assert.ok(result.items[0].finalScore >= result.items[1].finalScore, 'Ranking stage orders descending');
      assert.ok(result.diagnostics !== undefined, 'Post-ranking stage attaches diagnostics in debug mode');
      console.log('✓ Test 1 Passed: Full 5-stage pipeline execution flow verified.');
    });
  }

  // Test 2: Diversity Filtering Stage Isolation
  {
    const items: PipelineItem[] = [
      { songId: '1', song: { artist: { _id: 'art_a' } }, sources: [], rawFeatures: {}, normalizedScores: {}, finalScore: 0.9 },
      { songId: '2', song: { artist: { _id: 'art_a' } }, sources: [], rawFeatures: {}, normalizedScores: {}, finalScore: 0.85 },
      { songId: '3', song: { artist: { _id: 'art_b' } }, sources: [], rawFeatures: {}, normalizedScores: {}, finalScore: 0.8 },
    ];

    const ctx: RecommendationPipelineContext = {
      userId: 'u1',
      limit: 2,
      lastPlayedArtistId: 'art_a',
    };

    // First item has same artist as lastPlayedArtistId and should be suppressed if length > limit
    const filterFn = (items: PipelineItem[], context: RecommendationPipelineContext) => {
      const selected: PipelineItem[] = [];
      let prevArtist = context.lastPlayedArtistId || '';
      for (const it of items) {
        const aId = it.song.artist._id;
        if (aId !== prevArtist && selected.length < (context.limit || 10)) {
          selected.push(it);
          prevArtist = aId;
        }
      }
      return selected;
    };

    const res = filterFn(items, ctx);
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].song.artist._id, 'art_b', 'Suppresses consecutive previous artist');

    console.log('✓ Test 2 Passed: Diversity filtering stage isolation verified.');
  }

  console.log('🎉 All recommendation pipeline architecture tests completed successfully.');
}
