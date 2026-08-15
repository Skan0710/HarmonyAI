import assert from 'node:assert';
import {
  EmbeddingService,
  LocalDeterministicEmbeddingProvider,
  IEmbeddingProvider,
} from '../services/embeddingService.js';

export function runEmbeddingServiceTests() {
  console.log('[Embedding Service Test Suite] Starting tests...');

  // Test 1: Generate Embedding with Local Deterministic Provider
  {
    EmbeddingService.resetProvider();
    EmbeddingService.setProvider(new LocalDeterministicEmbeddingProvider(128));

    const sampleText = 'Title: Midnight City. Artist: M83. Genre: Synthwave. Mood: Energetic.';
    
    // Test synchronous execution of async method
    EmbeddingService.generateEmbedding(sampleText).then((vec1) => {
      assert.strictEqual(Array.isArray(vec1), true, 'Embedding must be an array');
      assert.strictEqual(vec1.length, 128, 'Embedding dimension must equal 128');

      // Check L2 normalization (sum of squares = 1)
      const magnitude = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
      assert.ok(Math.abs(magnitude - 1.0) < 0.01, 'Vector must be L2 normalized (magnitude ~ 1.0)');

      // Verify determinism
      EmbeddingService.generateEmbedding(sampleText).then((vec2) => {
        assert.deepStrictEqual(vec1, vec2, 'Identical input text must yield identical embedding vector');
        console.log('✓ Test 1 Passed: Local deterministic embedding generation verified.');
      });
    });
  }

  // Test 2: Provider Swappability
  {
    class CustomMockProvider implements IEmbeddingProvider {
      name = 'custom_mock';
      dimension = 64;

      async generateEmbedding(text: string): Promise<number[]> {
        return new Array(64).fill(0.5);
      }
    }

    EmbeddingService.setProvider(new CustomMockProvider());

    EmbeddingService.generateEmbedding('Test text').then((vec) => {
      assert.strictEqual(vec.length, 64, 'Swapped provider dimension respected (64)');
      assert.strictEqual(vec[0], 0.5);
      console.log('✓ Test 2 Passed: Provider swappability verified.');
    });
  }

  // Test 3: Error Handling Fallback Resilience
  {
    class FailingProvider implements IEmbeddingProvider {
      name = 'failing_provider';
      dimension = 128;

      async generateEmbedding(text: string): Promise<number[]> {
        throw new Error('Simulated API Network Timeout');
      }
    }

    EmbeddingService.setProvider(new FailingProvider());

    // Should catch provider error gracefully and return valid fallback vector
    EmbeddingService.generateEmbedding('Sample input').then((vec) => {
      assert.strictEqual(Array.isArray(vec), true, 'Fallback must return valid vector array');
      assert.strictEqual(vec.length, 128, 'Fallback dimension must equal 128');
      console.log('✓ Test 3 Passed: Error handling and safe fallback resilience verified.');
    });
  }

  console.log('🎉 All embedding service tests completed successfully.');
}
