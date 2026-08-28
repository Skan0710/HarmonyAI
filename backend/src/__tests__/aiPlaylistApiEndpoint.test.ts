import assert from 'node:assert';
import { generateAIPlaylistEndpoint } from '../controllers/playlistController.js';

export function runAIPlaylistApiEndpointTests() {
  console.log('[AI Playlist API Endpoint Test Suite] Starting tests...');

  const mockUser = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Test Listener',
    email: 'listener@harmonyai.test',
  };

  function createMockReqRes(body: any, user: any = mockUser) {
    const req: any = {
      body,
      user,
      params: {},
      query: {},
    };

    let statusCode = 200;
    let responseData: any = null;

    const res: any = {
      status(code: number) {
        statusCode = code;
        return res;
      },
      json(data: any) {
        responseData = data;
        return res;
      },
      getStatusCode() {
        return statusCode;
      },
      getResponseData() {
        return responseData;
      },
    };

    return { req, res };
  }

  {
    const { req, res } = createMockReqRes({ prompt: 'Chill evening music' }, null);

    generateAIPlaylistEndpoint(req, res).then(() => {
      assert.strictEqual(res.getStatusCode(), 401);
      const data = res.getResponseData();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.message, 'Unauthorized access');

      console.log('✓ Test 1 Passed: Unauthenticated request rejected with 401.');
    });
  }

  // Test 2: Input Validation - Reject prompt exceeding 500 characters
  {
    const longPrompt = 'a'.repeat(501);
    const { req, res } = createMockReqRes({ prompt: longPrompt });

    generateAIPlaylistEndpoint(req, res).then(() => {
      assert.strictEqual(res.getStatusCode(), 400);
      const data = res.getResponseData();
      assert.strictEqual(data.success, false);
      assert.ok(data.message.includes('500 characters'));

      console.log('✓ Test 2 Passed: Excessively long prompt rejected with 400.');
    });
  }

  // Test 3: Input Validation - Reject invalid duration (> 360 minutes)
  {
    const { req, res } = createMockReqRes({ duration: 500 });

    generateAIPlaylistEndpoint(req, res).then(() => {
      assert.strictEqual(res.getStatusCode(), 400);
      const data = res.getResponseData();
      assert.strictEqual(data.success, false);
      assert.ok(data.message.includes('Duration must be a positive number'));

      console.log('✓ Test 3 Passed: Invalid duration rejected with 400.');
    });
  }

  // Test 4: Input Validation - Reject invalid sequencing strategy
  {
    const { req, res } = createMockReqRes({ prompt: 'Gym beats', sequencingStrategy: 'invalid_strategy' });

    generateAIPlaylistEndpoint(req, res).then(() => {
      assert.strictEqual(res.getStatusCode(), 400);
      const data = res.getResponseData();
      assert.strictEqual(data.success, false);
      assert.ok(data.message.includes('Invalid sequencing strategy'));

      console.log('✓ Test 4 Passed: Invalid sequencing strategy rejected with 400.');
    });
  }

  // Test 5: Process Natural Language Prompt with structured extraction & metadata
  {
    const { req, res } = createMockReqRes({
      prompt: 'Late night coding synthwave and electronic focus session',
      targetDurationMinutes: 30,
      discoveryLevel: 'high',
      sequencingStrategy: 'energetic',
    });

    generateAIPlaylistEndpoint(req, res).then(() => {
      assert.strictEqual(res.getStatusCode(), 200);
      const data = res.getResponseData();
      assert.strictEqual(data.success, true);
      assert.ok(data.data !== null);
      assert.ok(typeof data.data.title === 'string');
      assert.ok(Array.isArray(data.data.tracks));
      assert.ok(typeof data.data.totalDurationSeconds === 'number');
      assert.ok(typeof data.data.totalDurationFormatted === 'string');
      assert.strictEqual(data.data.metadata.requestedBy, mockUser._id);
      assert.ok(data.data.metadata.strategy.includes('ENERGETIC'));
      assert.ok(data.data.durationDiagnostics !== undefined);
      assert.ok(data.data.diversityDiagnostics !== undefined);
      assert.ok(data.data.sequencingDiagnostics !== undefined);

      console.log('✓ Test 5 Passed: Natural language prompt processed with structured extraction.');
    });
  }

  // Test 6: Explicit Parameter Overrides & Multi-Parameter Inputs
  {
    const { req, res } = createMockReqRes({
      mood: 'Melancholic',
      activity: 'Rainy Day Reading',
      genres: ['Indie', 'Acoustic'],
      artists: ['Phoebe Bridgers'],
      discoveryPercentage: 80,
      sequencingStrategy: 'gradual',
      count: 6,
    });

    generateAIPlaylistEndpoint(req, res).then(() => {
      assert.strictEqual(res.getStatusCode(), 200);
      const data = res.getResponseData();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.preferences.mood, 'Melancholic');
      assert.strictEqual(data.data.preferences.activity, 'Rainy Day Reading');
      assert.strictEqual(data.data.diversityDiagnostics?.discoveryPercentage, 80);
      assert.strictEqual(data.data.sequencingDiagnostics?.strategy, 'gradual');

      console.log('✓ Test 6 Passed: Explicit parameter overrides & multi-parameter inputs verified.');
    });
  }

  console.log('🎉 All AI playlist API endpoint tests completed successfully.');
}
