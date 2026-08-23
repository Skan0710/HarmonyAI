import assert from 'node:assert';
import {
  MultiStepAssistantService,
  getMultiStepConfig,
  updateMultiStepConfig,
  resetMultiStepConfig,
} from '../services/multiStepAssistantService.js';

export function runMultiStepAssistantServiceTests() {
  console.log('[Multi-Step Assistant Actions Test Suite] Starting tests...');

  // Test 1: Composite Multi-Step Request Detection
  {
    assert.strictEqual(
      MultiStepAssistantService.isCompositeMultiStepRequest('Create a study playlist and add it to my library'),
      true,
      'Detects create study playlist composite request'
    );

    assert.strictEqual(
      MultiStepAssistantService.isCompositeMultiStepRequest(
        'Create a playlist for late night coding and add 15 suitable songs'
      ),
      true,
      'Detects create playlist for late night coding with 15 songs'
    );

    assert.strictEqual(
      MultiStepAssistantService.isCompositeMultiStepRequest('Find synthwave songs and queue them up'),
      true,
      'Detects find and queue composite request'
    );

    assert.strictEqual(
      MultiStepAssistantService.isCompositeMultiStepRequest('play Starboy'),
      false,
      'Identifies simple single-step request'
    );

    console.log('✓ Test 1 Passed: Composite multi-step request detection verified.');
  }

  // Test 2: Multi-Step Action Planning (Understand -> Recommend -> Create -> Add)
  {
    const plan = MultiStepAssistantService.planMultiStepActions(
      'Create a playlist for late night coding and add 15 suitable songs',
      {}
    );

    assert.strictEqual(plan.length, 2, 'Generates 2-step plan');
    assert.strictEqual(plan[0].toolName, 'get_recommendations', 'Step 1 is recommendation discovery');
    assert.strictEqual(plan[0].input.activity, 'Coding');
    assert.strictEqual(plan[0].input.limit, 15, 'Extracts requested count of 15 songs');
    assert.strictEqual(plan[1].toolName, 'create_playlist', 'Step 2 is playlist creation');
    assert.strictEqual(plan[1].input.name, 'Late Night Coding');

    console.log('✓ Test 2 Passed: Multi-step action planning verified.');
  }

  // Test 3: Safe Halt on Step Failure
  {
    MultiStepAssistantService.executeMultiStepAction(
      'Create a workout playlist and add it to my library',
      {} // Context without DB or authentication
    ).then((result) => {
      assert.strictEqual(result.isMultiStep, true);
      assert.ok(['failed', 'partial_failure'].includes(result.status), 'Reports failed or partial_failure status');
      assert.ok(result.stepsExecuted.length >= 1, 'At least 1 step executed before halt');
      assert.ok(result.responseMessage.includes('failed') || result.responseMessage.includes('halted safely'));

      console.log('✓ Test 3 Passed: Safe halt on step failure verified.');
    });
  }

  // Test 4: Maximum Tool-Call Limit & Infinite Loop Prevention
  {
    const initialConfig = getMultiStepConfig();
    assert.strictEqual(initialConfig.maxStepsPerRequest, 5);

    const updated = updateMultiStepConfig({ maxStepsPerRequest: 1 });
    assert.strictEqual(updated.maxStepsPerRequest, 1);

    // With maxStepsPerRequest=1, only 1 step should be executed even if plan has 2 steps
    MultiStepAssistantService.executeMultiStepAction(
      'Create a chill playlist and add it to my library',
      {},
      { maxStepsPerRequest: 1 }
    ).then((result) => {
      assert.strictEqual(result.stepsExecuted.length, 1, 'Strictly limits tool calls to maxStepsPerRequest');

      resetMultiStepConfig();
      assert.strictEqual(getMultiStepConfig().maxStepsPerRequest, 5);

      console.log('✓ Test 4 Passed: Configurable step limit & loop prevention verified.');
    });
  }

  // Test 5: Search and Queue Multi-Step Action Planning & Execution
  {
    const plan = MultiStepAssistantService.planMultiStepActions('Search lofi chill beats and queue next', {});
    assert.strictEqual(plan.length, 2);
    assert.strictEqual(plan[0].toolName, 'semantic_search');
    assert.strictEqual(plan[1].toolName, 'add_to_queue');
    assert.strictEqual(plan[1].input.position, 'next');

    console.log('✓ Test 5 Passed: Search and queue multi-step action planning verified.');
  }

  console.log('🎉 All multi-step assistant actions tests completed successfully.');
}
