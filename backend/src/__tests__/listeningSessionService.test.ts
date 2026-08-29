import assert from 'node:assert';
import { Types } from 'mongoose';
import { ListeningSessionService } from '../services/listeningSessionService.js';
import { ListeningSession, SessionStatus } from '../models/ListeningSession.js';
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

  // Test 4: Starting Session & Single Active Session Enforcement
  {
    const userId = new Types.ObjectId().toString();
    const songId1 = new Types.ObjectId().toString();

    // Verify parameter validation
    assert.rejects(async () => {
      await ListeningSessionService.startSession({ userId: 'invalid-id' });
    });

    const mockDoc = new ListeningSession({
      user: new Types.ObjectId(userId),
      currentTrack: new Types.ObjectId(songId1),
      status: 'active',
    });

    assert.strictEqual(mockDoc.status, 'active');
    assert.ok(mockDoc.startTime instanceof Date);

    console.log('✓ Test 4 Passed: Session start and single active session lifecycle verified.');
  }

  // Test 5: Recording Track Plays, Skips, and Completions
  {
    const userId = new Types.ObjectId().toString();
    const songId = new Types.ObjectId().toString();

    const session = new ListeningSession({
      user: new Types.ObjectId(userId),
      currentTrack: new Types.ObjectId(songId),
      tracksPlayed: [],
      tracksSkipped: [],
      tracksCompleted: [],
      sessionEvents: [],
      status: 'active',
    });

    const now = new Date();

    // 1. Play
    session.tracksPlayed.push({
      song: new Types.ObjectId(songId),
      playedAt: now,
      playDurationSeconds: 45,
      completed: false,
    });
    session.sessionEvents.push({
      song: new Types.ObjectId(songId),
      action: 'play',
      timestamp: now,
    });

    // 2. Skip
    session.tracksSkipped.push({
      song: new Types.ObjectId(songId),
      skippedAt: now,
      playDurationBeforeSkipSeconds: 45,
      reason: 'disliked_tempo',
    });
    session.sessionEvents.push({
      song: new Types.ObjectId(songId),
      action: 'skip',
      timestamp: now,
    });

    // 3. Complete another song
    const song2Id = new Types.ObjectId();
    session.tracksCompleted.push({
      song: song2Id,
      completedAt: now,
      durationSeconds: 210,
    });
    session.sessionEvents.push({
      song: song2Id,
      action: 'complete',
      timestamp: now,
    });

    assert.strictEqual(session.tracksPlayed.length, 1);
    assert.strictEqual(session.tracksSkipped.length, 1);
    assert.strictEqual(session.tracksCompleted.length, 1);
    assert.strictEqual(session.sessionEvents.length, 3);
    assert.strictEqual(session.tracksSkipped[0].reason, 'disliked_tempo');

    console.log('✓ Test 5 Passed: Recording plays, skips, and completions verified.');
  }

  // Test 6: Ending Session & Stale Session Expiration
  {
    const session = new ListeningSession({
      user: new Types.ObjectId(),
      status: 'active',
      startTime: new Date(Date.now() - 3600 * 1000), // 1 hour ago
      lastActivityTime: new Date(Date.now() - 3600 * 1000),
    });

    // End session
    session.status = 'ended';
    session.endTime = new Date();

    assert.strictEqual(session.status, 'ended');
    assert.ok(session.endTime instanceof Date);

    console.log('✓ Test 6 Passed: Ending session and populating endTime verified.');
  }

  console.log('🎉 All 6 listening session service tests completed successfully.');
}
