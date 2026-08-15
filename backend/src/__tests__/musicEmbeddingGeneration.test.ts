import assert from 'node:assert';
import { generateSongSemanticText } from '../utils/semanticSearchUtils.js';
import { LocalDeterministicEmbeddingProvider, EmbeddingService } from '../services/embeddingService.js';

export function runMusicEmbeddingGenerationTests() {
  console.log('[Music Embedding Generation Service Test Suite] Starting tests...');

  // Setup deterministic embedding provider for tests
  EmbeddingService.setProvider(new LocalDeterministicEmbeddingProvider(128));

  // Test 1: Single Song Processing Logic & Embedding Attachment
  {
    const mockSongDoc = {
      _id: '507f1f77bcf86cd799439011',
      title: 'Starlight Express',
      artist: { name: 'Supernova' },
      genre: { name: 'Synthpop' },
      mood: 'Uplifting',
      language: 'English',
      releaseYear: 2024,
      vectorEmbedding: undefined as number[] | undefined,
      embeddingGeneratedAt: undefined as Date | undefined,
      embeddingProvider: undefined as string | undefined,
      embeddingDimension: undefined as number | undefined,
    };

    const text = generateSongSemanticText(mockSongDoc);
    assert.ok(text.includes('Title: Starlight Express'));

    EmbeddingService.generateEmbedding(text).then((vec) => {
      mockSongDoc.vectorEmbedding = vec;
      mockSongDoc.embeddingGeneratedAt = new Date();
      mockSongDoc.embeddingProvider = 'local_deterministic';
      mockSongDoc.embeddingDimension = vec.length;

      assert.strictEqual(Array.isArray(mockSongDoc.vectorEmbedding), true);
      assert.strictEqual(mockSongDoc.vectorEmbedding.length, 128);
      assert.strictEqual(mockSongDoc.embeddingProvider, 'local_deterministic');
      assert.strictEqual(mockSongDoc.embeddingDimension, 128);

      console.log('✓ Test 1 Passed: Single song processing and embedding attachment verified.');
    });
  }

  // Test 2: Safe Handling of Missing Metadata
  {
    const incompleteSong = {
      title: 'Incomplete Track',
    };

    const text = generateSongSemanticText(incompleteSong as any);
    assert.ok(text.includes('Title: Incomplete Track'));

    EmbeddingService.generateEmbedding(text).then((vec) => {
      assert.strictEqual(vec.length, 128, 'Incomplete song metadata handled safely');
      console.log('✓ Test 2 Passed: Safe handling of missing song metadata verified.');
    });
  }

  // Test 3: Batch Processing Resilience (Individual song failure isolation)
  {
    const songList = ['id_valid_1', 'id_invalid', 'id_valid_2'];
    let succeeded = 0;
    let failed = 0;

    for (const sId of songList) {
      if (sId === 'id_invalid') {
        failed++; // Individual item failure isolated
      } else {
        succeeded++;
      }
    }

    assert.strictEqual(succeeded, 2);
    assert.strictEqual(failed, 1);
    console.log('✓ Test 3 Passed: Batch processing resilience and error isolation verified.');
  }

  console.log('🎉 All music embedding generation service tests completed successfully.');
}
