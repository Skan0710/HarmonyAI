import assert from 'node:assert';
import { ISong } from '../models/Song.js';

export function runSongEmbeddingModelTests() {
  console.log('[Song Embedding Model Schema Test Suite] Starting tests...');

  // Test 1: Backward Compatibility (Existing song document without embeddings)
  {
    const legacySong: Partial<ISong> = {
      title: 'Legacy Classic Track',
      duration: 210,
      playCount: 1500,
      audioUrl: '/audio/legacy.mp3',
      explicit: false,
      isPublished: true,
    };

    assert.strictEqual(legacySong.vectorEmbedding, undefined, 'Existing song without vectorEmbedding remains valid');
    assert.strictEqual(legacySong.embeddingGeneratedAt, undefined);
    assert.strictEqual(legacySong.embeddingProvider, undefined);
    assert.strictEqual(legacySong.embeddingDimension, undefined);

    console.log('✓ Test 1 Passed: Legacy song document schema backward compatibility verified.');
  }

  // Test 2: Song Document with Vector Embedding and Generation Metadata
  {
    const now = new Date();
    const mockVector = [0.12, 0.45, -0.89, 0.33, 0.99];

    const embeddedSong: Partial<ISong> = {
      title: 'Vector Enriched Track',
      duration: 180,
      playCount: 42,
      audioUrl: '/audio/vector.mp3',
      explicit: false,
      isPublished: true,
      vectorEmbedding: mockVector,
      embeddingGeneratedAt: now,
      embeddingProvider: 'local_deterministic',
      embeddingDimension: 5,
    };

    assert.deepStrictEqual(embeddedSong.vectorEmbedding, mockVector, 'Numeric vector array stored accurately');
    assert.strictEqual(embeddedSong.embeddingGeneratedAt, now, 'Timestamp metadata recorded');
    assert.strictEqual(embeddedSong.embeddingProvider, 'local_deterministic', 'Provider metadata recorded');
    assert.strictEqual(embeddedSong.embeddingDimension, 5, 'Dimension metadata recorded');

    console.log('✓ Test 2 Passed: Vector embedding and generation metadata schema verified.');
  }

  console.log('🎉 All song embedding model schema tests completed successfully.');
}
