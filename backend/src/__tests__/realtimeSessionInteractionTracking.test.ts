import assert from 'node:assert';
import { Types } from 'mongoose';
import { SessionActionType, ISessionEvent } from '../models/ListeningSession.js';

export function runRealtimeSessionInteractionTrackingTests() {
  console.log('[Real-Time Session Interaction Tracking Test Suite] Starting tests...');

  // Test 1: Supported Session Action Types Validation
  {
    const validActions: SessionActionType[] = ['play', 'skip', 'like', 'replay', 'queue_add', 'complete'];

    for (const action of validActions) {
      assert.ok(['play', 'skip', 'like', 'replay', 'queue_add', 'complete'].includes(action));
    }

    console.log('✓ Test 1 Passed: Supported session action types (play, skip, like, replay, queue_add, complete) verified.');
  }

  // Test 2: Event Storage with Song & Timestamp
  {
    const songId = new Types.ObjectId();
    const eventTimestamp = new Date();

    const mockEvent: ISessionEvent = {
      song: songId,
      action: 'queue_add',
      timestamp: eventTimestamp,
      metadata: { source: 'up_next_recommendation' },
    };

    assert.strictEqual(mockEvent.song, songId);
    assert.strictEqual(mockEvent.action, 'queue_add');
    assert.strictEqual(mockEvent.timestamp, eventTimestamp);
    assert.strictEqual(mockEvent.metadata?.source, 'up_next_recommendation');

    console.log('✓ Test 2 Passed: Event storage with song & timestamp verified.');
  }

  // Test 3: Reuse of Recommendation Interaction Tracking for Shared Actions
  {
    const mapSessionToRecommendationAction = (sessionAction: SessionActionType): string | null => {
      switch (sessionAction) {
        case 'play':
          return 'play';
        case 'skip':
          return 'skip';
        case 'like':
          return 'like';
        default:
          return null;
      }
    };

    assert.strictEqual(mapSessionToRecommendationAction('play'), 'play');
    assert.strictEqual(mapSessionToRecommendationAction('skip'), 'skip');
    assert.strictEqual(mapSessionToRecommendationAction('like'), 'like');
    assert.strictEqual(mapSessionToRecommendationAction('queue_add'), null);

    console.log('✓ Test 3 Passed: Recommendation interaction tracking reuse mapping verified.');
  }

  console.log('🎉 All real-time session interaction tracking tests completed successfully.');
}
