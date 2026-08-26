import assert from 'node:assert';
import { Types } from 'mongoose';
import { submitFeedback } from '../controllers/recommendationInteractionController.js';
import { RecommendationInteraction } from '../models/RecommendationInteraction.js';

export async function runRecommendationExplanationFeedbackTests() {
  console.log('[Recommendation Explanation Feedback Test Suite] Starting tests...');

  // Mock Request & Response Factory
  function createMockReqRes(params: {
    user?: any;
    body?: any;
  }) {
    const req: any = {
      user: params.user,
      body: params.body || {},
    };

    let statusCode = 200;
    let jsonBody: any = null;

    const res: any = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        jsonBody = data;
        return this;
      },
      getStatusCode() {
        return statusCode;
      },
      getJson() {
        return jsonBody;
      },
    };

    return { req, res };
  }

  // Test 1: Reject Invalid Feedback Type with 400
  {
    const mockUserId = new Types.ObjectId();
    const mockSongId = new Types.ObjectId();

    const { req, res } = createMockReqRes({
      user: { _id: mockUserId, email: 'tester@test.com' },
      body: {
        songId: mockSongId.toString(),
        feedback: 'invalid_feedback_type',
      },
    });

    await submitFeedback(req, res);
    assert.strictEqual(res.getStatusCode(), 400);
    assert.ok(res.getJson().message.includes('valid feedback'));
    console.log('✓ Test 1 Passed: Invalid feedback type rejected with 400.');
  }

  // Test 2: Reject Invalid Song ID with 400
  {
    const mockUserId = new Types.ObjectId();

    const { req, res } = createMockReqRes({
      user: { _id: mockUserId, email: 'tester@test.com' },
      body: {
        songId: 'not-a-valid-object-id',
        feedback: 'helpful',
      },
    });

    await submitFeedback(req, res);
    assert.strictEqual(res.getStatusCode(), 400);
    assert.ok(res.getJson().message.includes('Invalid songId'));
    console.log('✓ Test 2 Passed: Invalid songId format rejected with 400.');
  }

  // Test 3: Record 'helpful' Explanation Feedback with Extensible Context
  {
    const mockUserId = new Types.ObjectId();
    const mockSongId = new Types.ObjectId();

    let savedInteraction: any = null;
    let deletedConditions: any = null;

    const originalDeleteMany = RecommendationInteraction.deleteMany;
    const originalPrototypeSave = RecommendationInteraction.prototype.save;

    (RecommendationInteraction as any).deleteMany = async (conditions: any) => {
      deletedConditions = conditions;
      return { deletedCount: 1 };
    };

    (RecommendationInteraction.prototype as any).save = async function () {
      savedInteraction = this;
      return this;
    };

    const { req, res } = createMockReqRes({
      user: { _id: mockUserId, email: 'tester@test.com' },
      body: {
        songId: mockSongId.toString(),
        feedback: 'helpful',
        recommendationSource: 'hybrid',
        explanationContext: {
          primaryReason: 'Features Synthwave, your top genre',
          confidenceScore: 0.92,
        },
      },
    });

    try {
      await submitFeedback(req, res);
      assert.strictEqual(res.getStatusCode(), 200);
      assert.strictEqual(res.getJson().success, true);

      assert.ok(savedInteraction !== null);
      assert.strictEqual(savedInteraction.explanationFeedback, 'helpful');
      assert.strictEqual(savedInteraction.action, 'explanation_feedback');
      assert.strictEqual(savedInteraction.metadata.confidenceScore, 0.92);
      assert.ok(deletedConditions !== null, 'Should clean up previous explanation feedback for same song');

      console.log('✓ Test 3 Passed: Helpful explanation feedback and metadata recorded successfully.');
    } finally {
      RecommendationInteraction.deleteMany = originalDeleteMany;
      RecommendationInteraction.prototype.save = originalPrototypeSave;
    }
  }

  // Test 4: Record 'not_my_style', 'too_similar', and 'not_relevant' Feedback Types
  {
    const mockUserId = new Types.ObjectId();
    const mockSongId = new Types.ObjectId();
    const feedbackTypes = ['not_my_style', 'too_similar', 'not_relevant'];

    const originalDeleteMany = RecommendationInteraction.deleteMany;
    const originalPrototypeSave = RecommendationInteraction.prototype.save;

    (RecommendationInteraction as any).deleteMany = async () => ({ deletedCount: 0 });
    (RecommendationInteraction.prototype as any).save = async function () {
      return this;
    };

    try {
      for (const fType of feedbackTypes) {
        const { req, res } = createMockReqRes({
          user: { _id: mockUserId, email: 'tester@test.com' },
          body: {
            songId: mockSongId.toString(),
            feedback: fType,
          },
        });

        await submitFeedback(req, res);
        assert.strictEqual(res.getStatusCode(), 200);
        assert.strictEqual(res.getJson().data.explanationFeedback, fType);
      }
      console.log('✓ Test 4 Passed: All 4 explanation feedback types validated and recorded.');
    } finally {
      RecommendationInteraction.deleteMany = originalDeleteMany;
      RecommendationInteraction.prototype.save = originalPrototypeSave;
    }
  }

  console.log('🎉 All 4 recommendation explanation feedback tests completed successfully.');
}
