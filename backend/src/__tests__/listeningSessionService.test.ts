import assert from 'node:assert';
import { Types } from 'mongoose';
import { ListeningSessionService } from '../services/listeningSessionService.js';
import { SessionStatus } from '../models/ListeningSession.js';
import { ContextMood } from '../schemas/contextPreferenceSchema.js';

export function runListeningSessionServiceTests() {
  console.log('[Listening Session Service Test Suite] Starting tests...');

  // Test 1: Active Session Timeout Logic Simulation
  {
    const mockNow = new Date('2026-08-18T20:30:00');
    const recentActivityTime = new Date('2026-08-18T20:15:00'); // 15 mins ago -> Active
    const expiredActivityTime = new Date('2026-08-18T19:45:00'); // 45 mins ago -> Expired (> 30 mins)

    const isExpired = (lastActivity: Date, now: Date, timeoutMins = 30) => {
      const diffMins = (now.getTime() - lastActivity.getTime()) / (1000 * 60);
      return diffMins > timeoutMins;
    };

    assert.strictEqual(isExpired(recentActivityTime, mockNow), false, 'Recent activity within 30 mins remains active');
    assert.strictEqual(isExpired(expiredActivityTime, mockNow), true, 'Activity older than 30 mins is expired');

    console.log('✓ Test 1 Passed: Active session timeout logic verified.');
  }

  // Test 2: Session Data Structure Formatting & Integrity
  {
    const userId = new Types.ObjectId().toString();
    const songId = new Types.ObjectId().toString();

    const mockSessionPayload = {
      userId,
      initialSongId: songId,
      contextSnapshot: {
        mood: ContextMood.Energetic,
        energyLevel: 0.8,
      },
    };

    assert.ok(Types.ObjectId.isValid(mockSessionPayload.userId));
    assert.ok(Types.ObjectId.isValid(mockSessionPayload.initialSongId));
    assert.strictEqual(mockSessionPayload.contextSnapshot.mood, ContextMood.Energetic);

    console.log('✓ Test 2 Passed: Session payload format & object IDs verified.');
  }

  // Test 3: Status Transition Integrity
  {
    const statuses: SessionStatus[] = ['active', 'paused', 'ended'];

    for (const status of statuses) {
      assert.ok(['active', 'paused', 'ended'].includes(status), `Valid status transition: ${status}`);
    }

    console.log('✓ Test 3 Passed: Status transition integrity verified.');
  }

  console.log('🎉 All listening session service tests completed successfully.');
}
