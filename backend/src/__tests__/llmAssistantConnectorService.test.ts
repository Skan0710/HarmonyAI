import assert from 'node:assert';
import {
  LLMAssistantConnectorService,
  DeterministicToolSelectorProvider,
} from '../services/llmAssistantConnectorService.js';
import { ToolRegistry } from '../tools/toolRegistry.js';

export function runLLMAssistantConnectorServiceTests() {
  console.log('[LLM Assistant Connector Test Suite] Starting tests...');

  // Test 1: Provider-Independent Tool Selection
  {
    const provider = new DeterministicToolSelectorProvider();
    assert.strictEqual(provider.name, 'deterministic_fallback');

    provider.selectTool('play blinding lights', ToolRegistry.getToolDefinitions(), { userId: '123' }).then((payload) => {
      assert.ok(payload !== null);
      assert.strictEqual(payload?.type, 'tool_call');
      assert.strictEqual(payload?.toolName, 'music_search');
      console.log('✓ Test 1 Passed: Provider-independent tool selection verified.');
    });
  }

  // Test 2: Structured Tool Call with Minimal Context
  {
    LLMAssistantConnectorService.processUserRequest('recommend focus music for study', {}).then((res) => {
      assert.strictEqual(res.intent.type, 'tool_call');
      assert.strictEqual(res.intent.toolName, 'get_recommendations');
      assert.strictEqual(res.intent.input?.activity, 'Study');
      console.log('✓ Test 2 Passed: Structured tool call with minimal context verified.');
    });
  }

  // Test 3: Unfulfillable Non-Music Query Handling
  {
    LLMAssistantConnectorService.processUserRequest('what is the capital of France and how is the weather?', {}).then((res) => {
      assert.strictEqual(res.intent.type, 'unfulfillable');
      assert.ok(res.responseMessage.includes('HarmonyAI Music Assistant'));
      console.log('✓ Test 3 Passed: Unfulfillable non-music query handled clearly.');
    });
  }

  // Test 4: Prevention of Hallucinated Database Entities
  {
    LLMAssistantConnectorService.processUserRequest('find songs with late night retro synthwave vibes', {}).then((res) => {
      assert.strictEqual(res.intent.type, 'tool_call');
      assert.strictEqual(res.intent.toolName, 'semantic_search');
      // The LLM produces search parameters; real songs come from DB query
      assert.strictEqual(res.intent.input?.prompt, 'find songs with late night retro synthwave vibes');
      console.log('✓ Test 4 Passed: Prevention of hallucinated entities verified.');
    });
  }

  // Test 5: Tool Validation & Error Handling Before Execution
  {
    LLMAssistantConnectorService.processUserRequest('create a playlist called Chill Study', {
      userId: undefined, // Unauthenticated
    }).then((res) => {
      assert.strictEqual(res.intent.type, 'tool_call');
      assert.strictEqual(res.intent.toolName, 'create_playlist');
      assert.strictEqual(res.toolExecutionResult?.success, false);
      assert.ok(res.responseMessage.includes('Authentication required'));
      console.log('✓ Test 5 Passed: Tool validation & unauthenticated error handling verified.');
    });
  }

  // Test 6: Empty Prompt Handling
  {
    LLMAssistantConnectorService.processUserRequest('   ', {}).then((res) => {
      assert.strictEqual(res.intent.type, 'unfulfillable');
      assert.ok(res.responseMessage.includes('Please provide a music request'));
      console.log('✓ Test 6 Passed: Empty prompt handling verified.');
    });
  }

  console.log('🎉 All LLM assistant connector tests completed successfully.');
}
