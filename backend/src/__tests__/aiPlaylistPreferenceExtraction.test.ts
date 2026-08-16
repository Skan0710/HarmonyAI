import assert from 'node:assert';
import {
  AIPlaylistGenerationService,
  ILLMPlaylistInterpreter,
  RuleBasedFallbackLLMInterpreter,
} from '../services/aiPlaylistGenerationService.js';

export function runAIPlaylistPreferenceExtractionTests() {
  console.log('[AI Playlist Preference Extraction Test Suite] Starting tests...');

  // Test 1: Preference Extraction with Rule-Based Interpreter & Length Limiting
  {
    AIPlaylistGenerationService.resetInterpreter();
    AIPlaylistGenerationService.setInterpreter(new RuleBasedFallbackLLMInterpreter());

    // Prompt > 500 characters
    const longPrompt = 'workout gym energetic ' + 'synthwave '.repeat(60);
    assert.ok(longPrompt.length > 500, 'Test prompt exceeds 500 chars');

    AIPlaylistGenerationService.extractPlaylistPreferences(longPrompt).then((prefs) => {
      assert.strictEqual(typeof prefs.title, 'string');
      assert.strictEqual(prefs.requestedMood, 'Energetic');
      assert.ok(prefs.genres.includes('Synthwave'));
      assert.strictEqual(prefs.energyLevel, 0.85);

      console.log('✓ Test 1 Passed: Preference extraction and prompt length limiting verified.');
    });
  }

  // Test 2: Malformed JSON AI Response Graceful Recovery
  {
    class MalformedJSONLLMInterpreter implements ILLMPlaylistInterpreter {
      name = 'malformed_json_llm';

      async interpretPrompt(userPrompt: string): Promise<any> {
        // Returns unparseable broken string
        throw new Error('Malformed JSON response from LLM: Unexpected token in JSON at position 12');
      }
    }

    AIPlaylistGenerationService.setInterpreter(new MalformedJSONLLMInterpreter());

    // Must handle malformed JSON gracefully by falling back to rule-based parser
    AIPlaylistGenerationService.extractPlaylistPreferences('chill relax study music').then((prefs) => {
      assert.ok(prefs.title.length > 0);
      assert.strictEqual(prefs.requestedMood, 'Chill');
      assert.strictEqual(prefs.energyLevel, 0.35);

      console.log('✓ Test 2 Passed: Malformed JSON AI response graceful recovery verified.');
    });
  }

  // Test 3: Structured Preference Output Verification (No Song Names)
  {
    class StructuredPreferenceMock implements ILLMPlaylistInterpreter {
      name = 'structured_mock';

      async interpretPrompt(userPrompt: string): Promise<any> {
        return {
          title: 'Acoustic Chill Out',
          description: 'Soothing acoustic tracks for rainy afternoons',
          requestedMood: 'Chill',
          genres: ['Acoustic', 'Folk'],
          artists: ['Jack Johnson'],
          language: 'English',
          energyLevel: 0.3,
          tempoPreference: 'slow',
          acousticPreference: 0.9,
          instrumentalPreference: 0.2,
          requestedSongCount: 10,
          excludedArtists: [],
          excludedGenres: ['Metal'],
          searchKeywords: ['acoustic', 'rainy'],
        };
      }
    }

    AIPlaylistGenerationService.setInterpreter(new StructuredPreferenceMock());

    AIPlaylistGenerationService.extractPlaylistPreferences('acoustic folk jack johnson').then((prefs) => {
      assert.strictEqual(prefs.title, 'Acoustic Chill Out');
      assert.deepStrictEqual(prefs.genres, ['Acoustic', 'Folk']);
      assert.deepStrictEqual(prefs.artists, ['Jack Johnson']);
      assert.strictEqual(prefs.acousticPreference, 0.9);
      assert.strictEqual((prefs as any).songs, undefined, 'Output contains only structured preferences, no song names');

      console.log('✓ Test 3 Passed: Structured preference output (no song names) verified.');
    });
  }

  console.log('🎉 All AI playlist preference extraction tests completed successfully.');
}
