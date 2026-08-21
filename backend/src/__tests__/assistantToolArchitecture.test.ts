import assert from 'node:assert';
import { ToolRegistry } from '../tools/toolRegistry.js';

export function runAssistantToolArchitectureTests() {
  console.log('[Assistant Tool Architecture Test Suite] Starting tests...');

  // Test 1: Tool Registry Registration & Definition Completeness
  {
    const expectedTools = [
      'music_search',
      'semantic_search',
      'get_recommendations',
      'create_playlist',
      'modify_playlist',
      'queue_management',
      'get_user_preferences',
    ];

    const definitions = ToolRegistry.getToolDefinitions();
    assert.ok(definitions.length >= 7, 'All core tools registered in registry');

    for (const toolName of expectedTools) {
      const tool = ToolRegistry.getTool(toolName);
      assert.ok(tool !== undefined, `Tool ${toolName} is registered`);
      assert.ok(typeof tool?.name === 'string' && tool.name.length > 0, `${toolName} has valid name`);
      assert.ok(typeof tool?.description === 'string' && tool.description.length > 0, `${toolName} has valid description`);
      assert.ok(tool?.parameters !== undefined && tool.parameters.type === 'object', `${toolName} has valid parameter schema`);
    }

    console.log('✓ Test 1 Passed: Tool registration & schema completeness verified.');
  }

  // Test 2: Input Schema Validation - Music Search Tool
  {
    const musicSearch = ToolRegistry.getTool('music_search')!;
    const valid = musicSearch.validate({ query: 'Daft Punk', limit: 5 });
    assert.strictEqual(valid.valid, true);
    assert.strictEqual(valid.data?.query, 'Daft Punk');
    assert.strictEqual(valid.data?.limit, 5);

    const invalid = musicSearch.validate({ query: '' });
    assert.strictEqual(invalid.valid, false);
    assert.ok(invalid.error !== undefined);

    console.log('✓ Test 2 Passed: Music search tool input validation verified.');
  }

  // Test 3: Input Schema Validation - Semantic Search Tool
  {
    const semanticSearch = ToolRegistry.getTool('semantic_search')!;
    const valid = semanticSearch.validate({ prompt: 'late night chill beats with soft piano', minSimilarity: 0.4 });
    assert.strictEqual(valid.valid, true);
    assert.strictEqual(valid.data?.prompt, 'late night chill beats with soft piano');
    assert.strictEqual(valid.data?.minSimilarity, 0.4);

    const invalid = semanticSearch.validate({});
    assert.strictEqual(invalid.valid, false);

    console.log('✓ Test 3 Passed: Semantic search tool input validation verified.');
  }

  // Test 4: Input Schema Validation - Recommendations Tool
  {
    const recsTool = ToolRegistry.getTool('get_recommendations')!;
    const valid = recsTool.validate({ strategy: 'contextual', mood: 'Chill', activity: 'Coding', energyLevel: 0.5 });
    assert.strictEqual(valid.valid, true);
    assert.strictEqual(valid.data?.strategy, 'contextual');
    assert.strictEqual(valid.data?.mood, 'Chill');
    assert.strictEqual(valid.data?.energyLevel, 0.5);

    console.log('✓ Test 4 Passed: Recommendations tool input validation verified.');
  }

  // Test 5: Input Schema Validation - Playlist Creation Tool
  {
    const playlistCreate = ToolRegistry.getTool('create_playlist')!;
    const valid = playlistCreate.validate({ name: 'Summer Vibes 2026', description: 'Chill electronic tracks' });
    assert.strictEqual(valid.valid, true);
    assert.strictEqual(valid.data?.name, 'Summer Vibes 2026');

    const invalid = playlistCreate.validate({ name: '   ' });
    assert.strictEqual(invalid.valid, false);

    console.log('✓ Test 5 Passed: Playlist creation tool input validation verified.');
  }

  // Test 6: Input Schema Validation - Playlist Modification Tool
  {
    const playlistModify = ToolRegistry.getTool('modify_playlist')!;
    const valid = playlistModify.validate({
      playlistId: '507f1f77bcf86cd799439011',
      action: 'add_songs',
      songIds: ['507f1f77bcf86cd799439012'],
    });
    assert.strictEqual(valid.valid, true);
    assert.strictEqual(valid.data?.action, 'add_songs');

    const invalidAction = playlistModify.validate({
      playlistId: '507f1f77bcf86cd799439011',
      action: 'invalid_action',
    });
    assert.strictEqual(invalidAction.valid, false);

    console.log('✓ Test 6 Passed: Playlist modification tool input validation verified.');
  }

  // Test 7: Input Schema Validation & Execution - Queue Management Tool
  {
    const queueTool = ToolRegistry.getTool('queue_management')!;
    const valid = queueTool.validate({ action: 'clear' });
    assert.strictEqual(valid.valid, true);

    ToolRegistry.executeTool('queue_management', { action: 'clear' }, {}).then((result) => {
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.toolName, 'queue_management');
      console.log('✓ Test 7 Passed: Queue management tool execution isolation verified.');
    });
  }

  // Test 8: Input Schema Validation - User Preference Retrieval Tool
  {
    const prefTool = ToolRegistry.getTool('get_user_preferences')!;
    const valid = prefTool.validate({ timeframe: 'short_term' });
    assert.strictEqual(valid.valid, true);
    assert.strictEqual(valid.data?.timeframe, 'short_term');

    // Unauthenticated execution rejection check
    ToolRegistry.executeTool('get_user_preferences', { timeframe: 'combined' }, {}).then((result) => {
      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes('Authentication required'));
      console.log('✓ Test 8 Passed: User preference tool unauthenticated rejection verified.');
    });
  }

  console.log('🎉 All assistant tool architecture tests completed successfully.');
}
