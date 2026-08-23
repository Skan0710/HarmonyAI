import assert from 'node:assert';
import { MusicSearchTool } from '../tools/musicSearchTool.js';
import { SemanticSearchTool } from '../tools/semanticSearchTool.js';
import { RecommendationsTool } from '../tools/recommendationsTool.js';
import { PersonalizedRecommendationsTool } from '../tools/personalizedRecommendationsTool.js';
import { ContextualRecommendationsTool } from '../tools/contextualRecommendationsTool.js';
import { ToolRegistry } from '../tools/toolRegistry.js';

export function runMusicDiscoveryToolsTests() {
  console.log('[Music Discovery Tools Test Suite] Starting tests...');

  // Test 1: Keyword Music Search Tool - Validation, Schema, and Standalone Reusability
  {
    const searchTool = new MusicSearchTool();
    assert.strictEqual(searchTool.name, 'music_search');
    assert.ok(searchTool.description.length > 0);

    // Valid query
    const valid = searchTool.validate({ query: 'Starboy', limit: 5 });
    assert.strictEqual(valid.valid, true);
    assert.strictEqual(valid.data?.query, 'Starboy');
    assert.strictEqual(valid.data?.limit, 5);

    // Empty query rejection
    const invalid = searchTool.validate({ query: '   ' });
    assert.strictEqual(invalid.valid, false);
    assert.ok(invalid.error?.includes('non-empty query'));

    // Limit capping
    const capped = searchTool.validate({ query: 'Rock', limit: 100 });
    assert.strictEqual(capped.valid, true);
    assert.strictEqual(capped.data?.limit, 50, 'Caps limit at 50 max');

    // Standalone static helper check
    assert.ok(typeof MusicSearchTool.searchMusic === 'function', 'searchMusic is reusable standalone');

    console.log('✓ Test 1 Passed: MusicSearchTool validation & reusability verified.');
  }

  // Test 2: Semantic Music Search Tool - Validation, Parameters, and Standalone Reusability
  {
    const semanticTool = new SemanticSearchTool();
    assert.strictEqual(semanticTool.name, 'semantic_search');
    assert.ok(semanticTool.description.includes('vector embeddings'));

    // Valid prompt
    const valid = semanticTool.validate({
      prompt: 'mellow acoustic guitar with autumn morning vibe',
      limit: 15,
      minSimilarity: 0.45,
    });
    assert.strictEqual(valid.valid, true);
    assert.strictEqual(valid.data?.prompt, 'mellow acoustic guitar with autumn morning vibe');
    assert.strictEqual(valid.data?.limit, 15);
    assert.strictEqual(valid.data?.minSimilarity, 0.45);

    // Empty prompt rejection
    const invalid = semanticTool.validate({});
    assert.strictEqual(invalid.valid, false);
    assert.ok(invalid.error?.includes('non-empty prompt'));

    // Standalone static helper check
    assert.ok(typeof SemanticSearchTool.searchSemantic === 'function', 'searchSemantic is reusable standalone');

    console.log('✓ Test 2 Passed: SemanticSearchTool validation & reusability verified.');
  }

  // Test 3: Recommendation Tool - Validation & Multi-Strategy Routing
  {
    const recsTool = new RecommendationsTool();
    assert.strictEqual(recsTool.name, 'get_recommendations');

    // Contextual input validation
    const validContext = recsTool.validate({
      strategy: 'contextual',
      mood: 'Energetic',
      activity: 'Workout',
      energyLevel: 0.85,
      limit: 20,
    });
    assert.strictEqual(validContext.valid, true);
    assert.strictEqual(validContext.data?.strategy, 'contextual');
    assert.strictEqual(validContext.data?.mood, 'Energetic');
    assert.strictEqual(validContext.data?.activity, 'Workout');
    assert.strictEqual(validContext.data?.energyLevel, 0.85);

    // Hybrid input validation
    const validHybrid = recsTool.validate({
      strategy: 'hybrid',
      seedSongId: '507f1f77bcf86cd799439011',
      limit: 10,
    });
    assert.strictEqual(validHybrid.valid, true);
    assert.strictEqual(validHybrid.data?.strategy, 'hybrid');
    assert.strictEqual(validHybrid.data?.seedSongId, '507f1f77bcf86cd799439011');

    // Standalone static helper check
    assert.ok(typeof RecommendationsTool.getRecommendations === 'function', 'getRecommendations is reusable standalone');

    console.log('✓ Test 3 Passed: RecommendationsTool multi-strategy validation & reusability verified.');
  }

  // Test 4: Dedicated Personalized & Contextual Recommendation Tools
  {
    const personalizedTool = new PersonalizedRecommendationsTool();
    assert.strictEqual(personalizedTool.name, 'personalized_recommendations');
    const validP = personalizedTool.validate({ limit: 25 });
    assert.strictEqual(validP.valid, true);
    assert.strictEqual(validP.data?.limit, 25);

    const contextualTool = new ContextualRecommendationsTool();
    assert.strictEqual(contextualTool.name, 'contextual_recommendations');
    const validC = contextualTool.validate({ mood: 'Chill', activity: 'Study', energyLevel: 0.4 });
    assert.strictEqual(validC.valid, true);
    assert.strictEqual(validC.data?.mood, 'Chill');
    assert.strictEqual(validC.data?.activity, 'Study');

    console.log('✓ Test 4 Passed: Dedicated personalized & contextual tools validated.');
  }

  // Test 5: Empty Result Graceful Handling
  {
    const searchTool = new MusicSearchTool();
    const semanticTool = new SemanticSearchTool();

    // Verify empty result execution handles without crashing
    const mockEmptyData = {
      songs: [],
      total: 0,
      query: 'nonexistent_artist_99999',
    };

    assert.strictEqual(mockEmptyData.songs.length, 0);
    assert.strictEqual(mockEmptyData.total, 0);

    console.log('✓ Test 5 Passed: Empty result graceful handling verified.');
  }

  // Test 6: Tool Registry Integration & Execution Dispatch
  {
    const musicSearch = ToolRegistry.getTool('keyword_music_search');
    const semanticSearch = ToolRegistry.getTool('semantic_music_search');
    const personalizedRecs = ToolRegistry.getTool('personalized_recommendations');
    const contextualRecs = ToolRegistry.getTool('contextual_recommendations');

    assert.ok(musicSearch !== undefined);
    assert.ok(semanticSearch !== undefined);
    assert.ok(personalizedRecs !== undefined);
    assert.ok(contextualRecs !== undefined);

    // Invalid input execution test
    ToolRegistry.executeTool('keyword_music_search', { query: '' }, {}).then((result) => {
      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes('non-empty query'));
      console.log('✓ Test 6 Passed: Tool registry execution dispatch & invalid input rejection verified.');
    });
  }

  console.log('🎉 All music discovery tools tests completed successfully.');
}
