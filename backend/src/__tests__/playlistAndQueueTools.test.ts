import assert from 'node:assert';
import { PlaylistCreationTool } from '../tools/playlistCreationTool.js';
import { AddToPlaylistTool } from '../tools/addToPlaylistTool.js';
import { RemoveFromPlaylistTool } from '../tools/removeFromPlaylistTool.js';
import { AddToQueueTool } from '../tools/addToQueueTool.js';
import { RemoveFromQueueTool } from '../tools/removeFromQueueTool.js';
import { ClearQueueTool } from '../tools/clearQueueTool.js';
import { ToolRegistry } from '../tools/toolRegistry.js';

export function runPlaylistAndQueueToolsTests() {
  console.log('[Playlist and Queue Tools Test Suite] Starting tests...');

  // Test 1: Playlist Creation Tool Validation & Authentication Requirement
  {
    const createTool = new PlaylistCreationTool();
    assert.strictEqual(createTool.name, 'create_playlist');

    // Valid input validation
    const valid = createTool.validate({
      name: 'Late Night Coding',
      description: 'Lofi and synthwave tracks',
      songIds: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
      visibility: 'private',
    });
    assert.strictEqual(valid.valid, true);
    assert.strictEqual(valid.data?.name, 'Late Night Coding');
    assert.strictEqual(valid.data?.visibility, 'private');
    assert.strictEqual(valid.data?.songIds?.length, 2);

    // Empty name invalidation
    const invalid = createTool.validate({ name: '' });
    assert.strictEqual(invalid.valid, false);
    assert.ok(invalid.error?.includes('name is required'));

    // Unauthenticated execution rejection check
    createTool.execute(valid.data!, {}).then((result) => {
      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes('Authentication required'));
      console.log('✓ Test 1 Passed: Playlist creation validation & authentication requirement verified.');
    });
  }

  // Test 2: Add to Playlist Tool Validation & Authentication Requirement
  {
    const addTool = new AddToPlaylistTool();
    assert.strictEqual(addTool.name, 'add_to_playlist');

    const valid = addTool.validate({
      playlistId: '507f1f77bcf86cd799439011',
      songIds: ['507f1f77bcf86cd799439012'],
    });
    assert.strictEqual(valid.valid, true);
    assert.strictEqual(valid.data?.playlistId, '507f1f77bcf86cd799439011');
    assert.strictEqual(valid.data?.songIds.length, 1);

    const invalid = addTool.validate({ playlistId: 'invalid_id', songIds: [] });
    assert.strictEqual(invalid.valid, false);

    // Unauthenticated check
    addTool.execute(valid.data!, {}).then((result) => {
      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes('Authentication required'));
      console.log('✓ Test 2 Passed: Add to playlist validation & authentication requirement verified.');
    });
  }

  // Test 3: Remove from Playlist Tool Validation & Authentication Requirement
  {
    const removeTool = new RemoveFromPlaylistTool();
    assert.strictEqual(removeTool.name, 'remove_from_playlist');

    const valid = removeTool.validate({
      playlistId: '507f1f77bcf86cd799439011',
      songIds: ['507f1f77bcf86cd799439012'],
    });
    assert.strictEqual(valid.valid, true);

    const invalid = removeTool.validate({ playlistId: '', songIds: [] });
    assert.strictEqual(invalid.valid, false);

    // Unauthenticated check
    removeTool.execute(valid.data!, {}).then((result) => {
      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes('Authentication required'));
      console.log('✓ Test 3 Passed: Remove from playlist validation & authentication requirement verified.');
    });
  }

  // Test 4: Add to Queue Tool (Position next vs end)
  {
    const queueAdd = new AddToQueueTool();
    assert.strictEqual(queueAdd.name, 'add_to_queue');

    const validNext = queueAdd.validate({
      songIds: ['507f1f77bcf86cd799439011'],
      position: 'next',
    });
    assert.strictEqual(validNext.valid, true);
    assert.strictEqual(validNext.data?.position, 'next');

    const validEnd = queueAdd.validate({
      songIds: ['507f1f77bcf86cd799439011'],
      position: 'end',
    });
    assert.strictEqual(validEnd.valid, true);
    assert.strictEqual(validEnd.data?.position, 'end');

    const invalid = queueAdd.validate({ songIds: [] });
    assert.strictEqual(invalid.valid, false);

    console.log('✓ Test 4 Passed: Add to queue tool position & input validation verified.');
  }

  // Test 5: Remove from Queue Tool
  {
    const queueRemove = new RemoveFromQueueTool();
    assert.strictEqual(queueRemove.name, 'remove_from_queue');

    const valid = queueRemove.validate({
      songIds: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
    });
    assert.strictEqual(valid.valid, true);
    assert.strictEqual(valid.data?.songIds.length, 2);

    queueRemove.execute(valid.data!, {}).then((result) => {
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data?.count, 2);
      console.log('✓ Test 5 Passed: Remove from queue tool execution verified.');
    });
  }

  // Test 6: Clear Queue Tool
  {
    const queueClear = new ClearQueueTool();
    assert.strictEqual(queueClear.name, 'clear_queue');

    const valid = queueClear.validate({ preserveCurrentTrack: false });
    assert.strictEqual(valid.valid, true);
    assert.strictEqual(valid.data?.preserveCurrentTrack, false);

    queueClear.execute(valid.data!, {}).then((result) => {
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data?.action, 'clear_queue');
      assert.strictEqual(result.data?.preserveCurrentTrack, false);
      console.log('✓ Test 6 Passed: Clear queue tool execution verified.');
    });
  }

  // Test 7: Tool Registry Dispatch for all Playlist & Queue tools
  {
    const expected = [
      'create_playlist',
      'add_to_playlist',
      'remove_from_playlist',
      'add_to_queue',
      'remove_from_queue',
      'clear_queue',
    ];

    for (const toolName of expected) {
      const tool = ToolRegistry.getTool(toolName);
      assert.ok(tool !== undefined, `Tool ${toolName} registered in registry`);
    }

    console.log('✓ Test 7 Passed: Tool registry completeness for playlist & queue tools verified.');
  }

  console.log('🎉 All playlist and queue tools tests completed successfully.');
}
