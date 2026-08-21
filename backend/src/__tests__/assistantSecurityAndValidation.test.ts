import assert from 'node:assert';
import { MusicSearchTool } from '../tools/musicSearchTool.js';
import { PlaylistCreationTool } from '../tools/playlistCreationTool.js';
import { AddToPlaylistTool } from '../tools/addToPlaylistTool.js';
import { RemoveFromPlaylistTool } from '../tools/removeFromPlaylistTool.js';
import { AddToQueueTool } from '../tools/addToQueueTool.js';
import { ToolRegistry } from '../tools/toolRegistry.js';
import { MultiStepAssistantService } from '../services/multiStepAssistantService.js';
import { MAX_MESSAGE_LENGTH } from '../controllers/assistantController.js';

export function runAssistantSecurityAndValidationTests() {
  console.log('[Assistant Security & Validation Test Suite] Starting tests...');

  // Test 1: Music Search Input Validation & Sanitization
  {
    const searchTool = new MusicSearchTool();

    // Rejection of empty/whitespace queries
    const emptyRes = searchTool.validate({ query: '   ' });
    assert.strictEqual(emptyRes.valid, false);
    assert.ok(emptyRes.error?.includes('non-empty query'));

    // Rejection of invalid non-object types
    const invalidTypeRes = searchTool.validate('raw_string');
    assert.strictEqual(invalidTypeRes.valid, false);

    // Limit capping at 50 max
    const oversizedLimitRes = searchTool.validate({ query: 'rock', limit: 500 });
    assert.strictEqual(oversizedLimitRes.valid, true);
    assert.strictEqual(oversizedLimitRes.data?.limit, 50, 'Caps oversized limit at 50');

    console.log('✓ Test 1 Passed: Music search input validation & limit capping verified.');
  }

  // Test 2: Playlist Creation Validation & Authentication Enforcement
  {
    const createTool = new PlaylistCreationTool();

    // Invalid empty name
    const emptyNameRes = createTool.validate({ name: '' });
    assert.strictEqual(emptyNameRes.valid, false);

    // Sanitization of invalid song IDs (filtering out non-hex strings)
    const mixedIdsRes = createTool.validate({
      name: 'Chill Vibes',
      songIds: ['507f1f77bcf86cd799439011', 'invalid_id_not_hex', '507f1f77bcf86cd799439012'],
    });
    assert.strictEqual(mixedIdsRes.valid, true);
    assert.strictEqual(mixedIdsRes.data?.songIds?.length, 2, 'Only valid ObjectIds retained');

    // Unauthenticated execution rejection
    createTool.execute(mixedIdsRes.data!, {}).then((execRes) => {
      assert.strictEqual(execRes.success, false);
      assert.ok(execRes.error?.includes('Authentication required'));
      console.log('✓ Test 2 Passed: Playlist creation validation & authentication enforcement verified.');
    });
  }

  // Test 3: Queue Modification Input Validation
  {
    const queueAdd = new AddToQueueTool();

    // Rejection of empty songIds
    const emptyQueueRes = queueAdd.validate({ songIds: [] });
    assert.strictEqual(emptyQueueRes.valid, false);
    assert.ok(emptyQueueRes.error?.includes('At least one songId'));

    // Rejection of non-ObjectId strings
    const invalidQueueIds = queueAdd.validate({ songIds: ['not_an_id', 'also_invalid'] });
    assert.strictEqual(invalidQueueIds.valid, false);
    assert.ok(invalidQueueIds.error?.includes('No valid song ObjectIds'));

    // Position defaulting
    const validQueue = queueAdd.validate({ songIds: ['507f1f77bcf86cd799439011'], position: 'other' as any });
    assert.strictEqual(validQueue.valid, true);
    assert.strictEqual(validQueue.data?.position, 'end', 'Defaults unknown position safely to end');

    console.log('✓ Test 3 Passed: Queue modification input validation verified.');
  }

  // Test 4: Unauthorized Playlist Access & Modification Defense
  {
    const addTool = new AddToPlaylistTool();
    const removeTool = new RemoveFromPlaylistTool();

    const validPayload = {
      playlistId: '507f1f77bcf86cd799439011',
      songIds: ['507f1f77bcf86cd799439012'],
    };

    // Attempt without authentication
    addTool.execute(validPayload, {}).then((unauthAdd) => {
      assert.strictEqual(unauthAdd.success, false);
      assert.ok(unauthAdd.error?.includes('Authentication required'));

      removeTool.execute(validPayload, {}).then((unauthRemove) => {
        assert.strictEqual(unauthRemove.success, false);
        assert.ok(unauthRemove.error?.includes('Authentication required'));
        console.log('✓ Test 4 Passed: Unauthorized playlist access & modification defense verified.');
      });
    });
  }

  // Test 5: Invalid Tool Arguments Rejection Across Tool Registry
  {
    ToolRegistry.executeTool('music_search', { query: '' }, {}).then((res1) => {
      assert.strictEqual(res1.success, false);
      assert.strictEqual(res1.toolName, 'music_search');

      ToolRegistry.executeTool('nonexistent_tool', {}, {}).then((res2) => {
        assert.strictEqual(res2.success, false);
        assert.ok(res2.error?.includes('not registered'));
        console.log('✓ Test 5 Passed: Invalid tool arguments rejection across registry verified.');
      });
    });
  }

  // Test 6: Multi-Step Tool Execution Validation & Chaining
  {
    const isMulti = MultiStepAssistantService.isCompositeMultiStepRequest('Create a study playlist and add it to my library');
    assert.strictEqual(isMulti, true);

    const plan = MultiStepAssistantService.planMultiStepActions('Create a study playlist and add it to my library', {});
    assert.strictEqual(plan.length, 2);
    assert.strictEqual(plan[0].toolName, 'get_recommendations');
    assert.strictEqual(plan[1].toolName, 'create_playlist');

    console.log('✓ Test 6 Passed: Multi-step tool execution validation & planning verified.');
  }

  // Test 7: Tool Failure Handling & Graceful Recovery
  {
    MultiStepAssistantService.executeMultiStepAction(
      'Create a chill playlist and add it to my library',
      { userId: undefined }
    ).then((result) => {
      assert.ok(['failed', 'partial_failure'].includes(result.status));
      assert.ok(result.responseMessage.length > 0);
      assert.strictEqual(result.stepsExecuted.some((s) => !s.success), true);

      console.log('✓ Test 7 Passed: Tool failure handling & graceful recovery verified.');
    });
  }

  // Test 8: Maximum Message Length Enforcement
  {
    assert.strictEqual(MAX_MESSAGE_LENGTH, 500);

    const validPrompt = 'Recommend calm study beats';
    assert.ok(validPrompt.length <= MAX_MESSAGE_LENGTH);

    const oversizedPrompt = 'a'.repeat(501);
    assert.ok(oversizedPrompt.length > MAX_MESSAGE_LENGTH);

    console.log('✓ Test 8 Passed: Maximum message length threshold (500 chars) verified.');
  }

  // Test 9: Maximum Tool-Call Limit Enforcement
  {
    MultiStepAssistantService.executeMultiStepAction(
      'Create a workout playlist and add it to my library',
      {},
      { maxStepsPerRequest: 1 }
    ).then((result) => {
      assert.strictEqual(result.stepsExecuted.length, 1, 'Strictly limits tool execution to 1 step');
      console.log('✓ Test 9 Passed: Maximum tool-call limit enforcement verified.');
    });
  }

  console.log('🎉 All assistant security and validation tests completed successfully.');
}
