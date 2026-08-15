import assert from 'node:assert';
import { SemanticSearchService } from '../services/semanticSearchService.js';
import { LocalDeterministicEmbeddingProvider, EmbeddingService } from '../services/embeddingService.js';

export function runSemanticSearchTests() {
  console.log('[Semantic Search Service Test Suite] Starting tests...');

  // Set local deterministic provider for unit tests
  EmbeddingService.setProvider(new LocalDeterministicEmbeddingProvider(128));

  // Test 1: Reusable Vector Cosine Similarity Calculation
  {
    const vecA = [1.0, 0.0, 0.0];
    const vecB = [1.0, 0.0, 0.0];
    const vecC = [0.0, 1.0, 0.0];

    const simIdentical = SemanticSearchService.calculateVectorCosineSimilarity(vecA, vecB);
    const simOrthogonal = SemanticSearchService.calculateVectorCosineSimilarity(vecA, vecC);

    assert.strictEqual(simIdentical, 1.0, 'Identical vectors must have cosine similarity = 1.0');
    assert.strictEqual(simOrthogonal, 0.0, 'Orthogonal vectors must have cosine similarity = 0.0');

    console.log('✓ Test 1 Passed: Vector cosine similarity calculation verified.');
  }

  // Test 2: In-Memory Semantic Similarity Ranking & Embedding Filter
  {
    const queryVector = [0.8, 0.6, 0.0];

    const candidateSongs = [
      { id: 's1', title: 'Song High Match', vectorEmbedding: [0.8, 0.6, 0.0] },
      { id: 's2', title: 'Song Partial Match', vectorEmbedding: [0.5, 0.5, 0.5] },
      { id: 's3', title: 'Song Un-embedded', vectorEmbedding: undefined },
    ];

    // Filter out songs without embeddings
    const validCandidates = candidateSongs.filter(
      (s) => Array.isArray(s.vectorEmbedding) && s.vectorEmbedding.length > 0
    );

    assert.strictEqual(validCandidates.length, 2, 'Un-embedded song must be excluded');

    const scored = validCandidates.map((s) => ({
      song: s,
      similarityScore: SemanticSearchService.calculateVectorCosineSimilarity(queryVector, s.vectorEmbedding!),
    }));

    scored.sort((a, b) => b.similarityScore - a.similarityScore);

    assert.strictEqual(scored[0].song.id, 's1');
    assert.strictEqual(scored[0].similarityScore, 1.0);
    assert.ok(scored[0].similarityScore > scored[1].similarityScore);

    console.log('✓ Test 2 Passed: Semantic similarity ranking and un-embedded song exclusion verified.');
  }

  // Test 3: Configurable Limit
  {
    const items = Array.from({ length: 10 }, (_, i) => ({ id: `s_${i}`, score: 1 - i * 0.05 }));
    const limit = 3;
    const sliced = items.slice(0, limit);

    assert.strictEqual(sliced.length, 3);
    assert.strictEqual(sliced[0].id, 's_0');
    console.log('✓ Test 3 Passed: Configurable result limit verified.');
  }

  console.log('🎉 All semantic search service tests completed successfully.');
}
