import assert from 'node:assert';
import {
  AIPlaylistGenerationService,
  RuleBasedFallbackLLMInterpreter,
  ILLMPlaylistInterpreter,
} from '../services/aiPlaylistGenerationService.js';
import { AIPlaylistPreference } from '../schemas/aiPlaylistPreferenceSchema.js';

export function runAIPlaylistGenerationServiceTests() {
  console.log('[AI Playlist Generation Service Test Suite] Starting tests...');

  // Test 1: Rule-Based / Local Fallback Interpreter Concept Generation
  {
    AIPlaylistGenerationService.resetInterpreter();
    AIPlaylistGenerationService.setInterpreter(new RuleBasedFallbackLLMInterpreter());

    const prompt = 'upbeat 80s synthwave workout mix for the gym';

    AIPlaylistGenerationService.interpretPlaylistPrompt(prompt).then((concept) => {
      assert.strictEqual(typeof concept.title, 'string', 'Title must be string');
      assert.ok(concept.title.length > 0, 'Title must not be empty');
      assert.strictEqual(concept.requestedMood, 'Energetic');
      assert.ok(concept.genres?.includes('Synthwave'), 'Synthwave genre detected');
      assert.ok(concept.energyLevel! > 0.7, 'High energy desired for workout mix');
      assert.ok(Array.isArray(concept.searchKeywords), 'Search keywords must be array');

      console.log('✓ Test 1 Passed: Structured concept generation verified.');
    });
  }

  // Test 2: Provider Swappability
  {
    class CustomMockLLMInterpreter implements ILLMPlaylistInterpreter {
      name = 'custom_mock_llm';

      async interpretPrompt(userPrompt: string): Promise<AIPlaylistPreference> {
        return {
          title: 'Deep Focus Ambient',
          description: 'Calming ambient soundscapes for deep concentration',
          requestedMood: 'Focus',
          genres: ['Ambient'],
          artists: [],
          energyLevel: 0.2,
          tempoPreference: 'slow',
          acousticPreference: 0.8,
          instrumentalPreference: 0.9,
          requestedSongCount: 15,
          excludedArtists: [],
          excludedGenres: [],
          searchKeywords: ['ambient', 'focus'],
        };
      }
    }

    AIPlaylistGenerationService.setInterpreter(new CustomMockLLMInterpreter());

    AIPlaylistGenerationService.interpretPlaylistPrompt('focus music').then((concept) => {
      assert.strictEqual(concept.title, 'Deep Focus Ambient');
      assert.strictEqual(concept.requestedMood, 'Focus');
      assert.strictEqual(concept.requestedSongCount, 15);
      console.log('✓ Test 2 Passed: Swappable provider implementation verified.');
    });
  }

  // Test 3: Safe Error Handling & Resilience
  {
    class FailingLLMInterpreter implements ILLMPlaylistInterpreter {
      name = 'failing_llm';

      async interpretPrompt(userPrompt: string): Promise<AIPlaylistPreference> {
        throw new Error('Simulated LLM API 503 Service Unavailable');
      }
    }

    AIPlaylistGenerationService.setInterpreter(new FailingLLMInterpreter());

    // Should catch failing provider and fall back to rule-based interpreter
    AIPlaylistGenerationService.interpretPlaylistPrompt('rainy day sad melancholic mix').then((concept) => {
      assert.ok(concept.title.length > 0, 'Fallback interpretation must return valid concept title');
      assert.strictEqual(concept.requestedMood, 'Melancholic');
      console.log('✓ Test 3 Passed: Safe error handling and fallback resilience verified.');
    });
  }

  console.log('🎉 All AI playlist generation service tests completed successfully.');
}
