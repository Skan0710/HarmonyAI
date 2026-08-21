import assert from 'node:assert';
import { AssistantIntentService } from '../services/assistantIntentService.js';

export function runAssistantIntentServiceTests() {
  console.log('[Assistant Intent & Tool Selection Test Suite] Starting tests...');

  // Test 1: Intent Selection - Music Search
  {
    const intent = AssistantIntentService.selectIntentRuleBased('play Starboy by The Weeknd', {});
    assert.strictEqual(intent.type, 'tool_call');
    assert.strictEqual(intent.toolName, 'music_search');
    assert.ok(intent.input?.query !== undefined);

    console.log('✓ Test 1 Passed: Music search intent routing verified.');
  }

  // Test 2: Intent Selection - Semantic Search
  {
    const intent = AssistantIntentService.selectIntentRuleBased('find music with a late night rainy vibe', {});
    assert.strictEqual(intent.type, 'tool_call');
    assert.strictEqual(intent.toolName, 'semantic_search');
    assert.ok(intent.input?.prompt?.includes('late night rainy vibe'));

    console.log('✓ Test 2 Passed: Semantic search vibe intent routing verified.');
  }

  // Test 3: Intent Selection - Recommendations (Contextual / Hybrid)
  {
    const intent = AssistantIntentService.selectIntentRuleBased('recommend energetic workout tracks', {});
    assert.strictEqual(intent.type, 'tool_call');
    assert.strictEqual(intent.toolName, 'get_recommendations');
    assert.strictEqual(intent.input?.activity, 'Workout');

    console.log('✓ Test 3 Passed: Recommendation intent routing verified.');
  }

  // Test 4: Intent Selection - Playlist Creation
  {
    const intent = AssistantIntentService.selectIntentRuleBased('create a playlist called Chill Synthwave', {});
    assert.strictEqual(intent.type, 'tool_call');
    assert.strictEqual(intent.toolName, 'create_playlist');
    assert.strictEqual(intent.input?.name, 'Chill Synthwave');

    console.log('✓ Test 4 Passed: Playlist creation intent routing verified.');
  }

  // Test 5: Intent Selection - Queue Management (Clear / Add Next)
  {
    const clearIntent = AssistantIntentService.selectIntentRuleBased('clear the playback queue', {});
    assert.strictEqual(clearIntent.type, 'tool_call');
    assert.strictEqual(clearIntent.toolName, 'clear_queue');

    const nextIntent = AssistantIntentService.selectIntentRuleBased('play this song next', {});
    assert.strictEqual(nextIntent.type, 'tool_call');
    assert.strictEqual(nextIntent.toolName, 'add_to_queue');
    assert.strictEqual(nextIntent.input?.position, 'next');

    console.log('✓ Test 5 Passed: Queue management intent routing verified.');
  }

  // Test 6: Intent Selection - User Preference Retrieval
  {
    const intent = AssistantIntentService.selectIntentRuleBased('what are my favorite genres and music taste', {});
    assert.strictEqual(intent.type, 'tool_call');
    assert.strictEqual(intent.toolName, 'get_user_preferences');

    console.log('✓ Test 6 Passed: User preference intent routing verified.');
  }

  // Test 7: Unfulfillable Non-Music Query Explanation
  {
    const intent = AssistantIntentService.selectIntentRuleBased('what is the capital of France and what is the weather today?', {});
    assert.strictEqual(intent.type, 'unfulfillable');
    assert.ok(intent.explanation.includes('HarmonyAI Music Assistant'));

    console.log('✓ Test 7 Passed: Unfulfillable non-music query explanation verified.');
  }

  // Test 8: End-to-End Request Processing & Invalid Call Safeguards
  {
    AssistantIntentService.processAssistantRequest('what is the current weather forecast', {}).then((res) => {
      assert.strictEqual(res.intent.type, 'unfulfillable');
      assert.ok(res.responseMessage.includes('HarmonyAI Music Assistant'));

      // Unauthenticated playlist creation safeguard
      AssistantIntentService.processAssistantRequest('create a playlist called Night Vibes', {}).then((authFailRes) => {
        assert.strictEqual(authFailRes.toolExecutionResult?.success, false);
        assert.ok(authFailRes.responseMessage.includes('Authentication required'));
        console.log('✓ Test 8 Passed: End-to-end processing & invalid call safeguards verified.');
      });
    });
  }

  console.log('🎉 All assistant intent and tool selection tests completed successfully.');
}
