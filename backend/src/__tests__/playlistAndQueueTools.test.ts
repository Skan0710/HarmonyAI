import assert from 'node:assert';
import { PlaylistCreationTool } from '../tools/playlistCreationTool.js';
import { PlaylistModificationTool } from '../tools/playlistModificationTool.js';
import { QueueManagementTool } from '../tools/queueManagementTool.js';
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

  // Test 2: Playlist Modification Tool - Add Songs
  {
    const playlistMod = new PlaylistModificationTool();
    assert.strictEqual(playlistMod.name, 'modify_playlist');

    const valid = playlistMod.validate({
      playlistId: '507f1f77bcf86cd799439011',
      action: 'add_songs',
      songIds: ['507f1f77bcf86cd799439012'],
    });
    assert.strictEqual(valid.valid, true);
    assert.strictEqual(valid.data?.playlistId, '507f1f77bcf86cd799439011');
    assert.strictEqual(valid.data?.songIds?.length, 1);
    assert.strictEqual(valid.data?.action, 'add_songs');

    // Invalid playlist ID
    const invalid = playlistMod.validate({ playlistId: 'invalid_id', action: 'add_songs', songIds: [] });
    assert.strictEqual(invalid.valid, false);

    // Unauthenticated check
    playlistMod.execute(valid.data!, {}).then((result) => {
      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes('Authentication required'));
      console.log('✓ Test 2 Passed: Playlist modification (add songs) validation & auth requirement verified.');
    });
  }

  // Test 3: Playlist Modification Tool - Remove Songs
  {
    const playlistMod = new PlaylistModificationTool();

    const valid = playlistMod.validate({
      playlistId: '507f1f77bcf86cd799439011',
      action: 'remove_songs',
      songIds: ['507f1f77bcf86cd799439012'],
    });
    assert.strictEqual(valid.valid, true);
    assert.strictEqual(valid.data?.action, 'remove_songs');

    const invalid = playlistMod.validate({ playlistId: '', action: 'remove_songs', songIds: [] });
    assert.strictEqual(invalid.valid, false);

    // Unauthenticated check
    playlistMod.execute(valid.data!, {}).then((result) => {
      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes('Authentication required'));
      console.log('✓ Test 3 Passed: Playlist modification (remove songs) validation & auth requirement verified.');
    });
  }

  // Test 4: Queue Management Tool - Add Songs (Position next vs end)
  {
    const queueTool = new QueueManagementTool();
    assert.strictEqual(queueTool.name, 'queue_management');

    const validNext = queueTool.validate({
      action: 'add_next',
      songIds: ['507f1f77bcf86cd799439011'],
    });
    assert.strictEqual(validNext.valid, true);
    assert.strictEqual(validNext.data?.action, 'add_next');

    const validEnd = queueTool.validate({
      action: 'add',
      songIds: ['507f1f77bcf86cd799439011'],
    });
    assert.strictEqual(validEnd.valid, true);
    assert.strictEqual(validEnd.data?.action, 'add');

    const invalid = queueTool.validate({ action: 'add', songIds: [] });
    assert.strictEqual(invalid.valid, false);

    console.log('✓ Test 4 Passed: Queue management tool position & input validation verified.');
  }

  // Test 5: Queue Management Tool - Remove Songs
  {
    const queueTool = new QueueManagementTool();

    const valid = queueTool.validate({
      action: 'remove',
      songIds: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
    });
    assert.strictEqual(valid.valid, true);
    assert.strictEqual(valid.data?.songIds?.length, 2);

    queueTool.execute(valid.data!, {}).then((result) => {
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data?.count, 2);
      console.log('✓ Test 5 Passed: Queue management (remove) tool execution verified.');
    });
  }

  // Test 6: Queue Management Tool - Clear
  {
    const queueTool = new QueueManagementTool();

    const valid = queueTool.validate({ action: 'clear', preserveCurrentTrack: false });
    assert.strictEqual(valid.valid, true);
    assert.strictEqual(valid.data?.preserveCurrentTrack, false);

    queueTool.execute(valid.data!, {}).then((result) => {
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data?.action, 'clear');
      assert.strictEqual(result.data?.preserveCurrentTrack, false);
      console.log('✓ Test 6 Passed: Queue management (clear) tool execution verified.');
    });
  }

  // Test 7: Tool Registry Dispatch for all Playlist & Queue tools
  {
    const expected = [
      'create_playlist',
      'modify_playlist',
      'add_to_playlist',
      'remove_from_playlist',
      'queue_management',
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
