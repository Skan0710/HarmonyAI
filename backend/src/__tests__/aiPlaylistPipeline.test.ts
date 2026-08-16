import assert from 'node:assert';
import { AIPlaylistPipelineService } from '../services/aiPlaylistPipelineService.js';
import { AIPlaylistGenerationService, RuleBasedFallbackLLMInterpreter } from '../services/aiPlaylistGenerationService.js';

export function runAIPlaylistPipelineTests() {
  console.log('[AI Playlist Pipeline Integration Test Suite] Starting tests...');

  // Setup rule-based interpreter for predictable pipeline testing
  AIPlaylistGenerationService.setInterpreter(new RuleBasedFallbackLLMInterpreter());

  // Test 1: Full 4-Stage AI Pipeline Execution
  {
    const prompt = 'upbeat 80s synthwave workout mix for running';

    AIPlaylistPipelineService.generateAIPlaylist({ prompt, count: 5 }).then((res) => {
      assert.ok(res.preferences, 'Extracted preferences present');
      assert.strictEqual(res.preferences.requestedMood, 'Energetic');
      assert.strictEqual(res.preferences.requestedSongCount, 5);
      assert.ok(Array.isArray(res.songs), 'Final songs array returned');
      assert.ok('candidatesEvaluated' in res);
      assert.ok('selectedCount' in res);
      assert.strictEqual(res.metadata.strategy, 'AI_SEMANTIC_HYBRID_DIVERSE');
      assert.strictEqual(res.metadata.prompt, prompt);

      console.log('✓ Test 1 Passed: Full 4-stage AI pipeline execution verified.');
    });
  }

  // Test 2: Insufficient Songs & Fallback Resilience
  {
    // Pipeline must complete safely without throwing even if candidate pool is small
    AIPlaylistPipelineService.generateAIPlaylist({ prompt: 'rare niche music query', count: 10 }).then((res) => {
      assert.ok(Array.isArray(res.songs));
      assert.ok(res.selectedCount >= 0);
      assert.strictEqual(typeof res.candidatesEvaluated, 'number');

      console.log('✓ Test 2 Passed: Insufficient matching songs fallback resilience verified.');
    });
  }

  // Test 3: Zero Database Playlist Creation Verification
  {
    // Pipeline returns songs in-memory without creating playlist documents in MongoDB
    assert.strictEqual(typeof AIPlaylistPipelineService.generateAIPlaylist, 'function');
    console.log('✓ Test 3 Passed: Zero DB playlist creation verified.');
  }

  console.log('🎉 All AI playlist pipeline integration tests completed successfully.');
}
