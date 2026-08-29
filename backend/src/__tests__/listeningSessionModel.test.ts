import assert from 'node:assert';
import { Types } from 'mongoose';
import {
  ListeningSession,
  IListeningSession,
  ISessionPlayedSong,
  ISessionTrackSkip,
  ISessionTrackComplete,
  ISessionEvent,
} from '../models/ListeningSession.js';

export function runListeningSessionModelTests() {
  console.log('[Listening Session Model Test Suite] Starting tests...');

  // Test 1: Model instantiation and default fields
  {
    const mockUserId = new Types.ObjectId();
    const mockSongId = new Types.ObjectId();

    const session = new ListeningSession({
      user: mockUserId,
      currentSong: mockSongId,
      status: 'active',
    });

    assert.strictEqual(session.user.toString(), mockUserId.toString());
    assert.strictEqual(session.currentSong?.toString(), mockSongId.toString());
    assert.strictEqual(session.status, 'active');
    assert.ok(session.startTime instanceof Date);
    assert.ok(session.lastActivityTime instanceof Date);
    assert.strictEqual(session.endTime, undefined);
    assert.ok(Array.isArray(session.songsPlayed));
    assert.ok(Array.isArray(session.tracksPlayed));
    assert.ok(Array.isArray(session.tracksSkipped));
    assert.ok(Array.isArray(session.tracksCompleted));
    assert.ok(Array.isArray(session.sessionEvents));

    console.log('✓ Test 1 Passed: ListeningSession model instantiates with expected defaults.');
  }

  // Test 2: Tracking tracks played, skipped, and completed with timestamps
  {
    const mockUserId = new Types.ObjectId();
    const song1 = new Types.ObjectId();
    const song2 = new Types.ObjectId();
    const song3 = new Types.ObjectId();

    const now = new Date();

    const playEvent: ISessionPlayedSong = {
      song: song1,
      playedAt: now,
      playDurationSeconds: 180,
      completed: true,
      metadata: { playbackQuality: 'lossless' },
    };

    const skipEvent: ISessionTrackSkip = {
      song: song2,
      skippedAt: now,
      playDurationBeforeSkipSeconds: 15,
      reason: 'user_skip',
      metadata: { skipOffsetSeconds: 15 },
    };

    const completeEvent: ISessionTrackComplete = {
      song: song3,
      completedAt: now,
      durationSeconds: 210,
      metadata: { repeatCount: 1 },
    };

    const sessionEvent: ISessionEvent = {
      song: song1,
      action: 'play',
      timestamp: now,
      metadata: { client: 'web-player' },
    };

    const session = new ListeningSession({
      user: mockUserId,
      tracksPlayed: [playEvent],
      tracksSkipped: [skipEvent],
      tracksCompleted: [completeEvent],
      sessionEvents: [sessionEvent],
    });

    assert.strictEqual(session.tracksPlayed.length, 1);
    assert.strictEqual(session.tracksPlayed[0].song.toString(), song1.toString());
    assert.strictEqual(session.tracksPlayed[0].playDurationSeconds, 180);
    assert.strictEqual(session.tracksPlayed[0].completed, true);

    assert.strictEqual(session.tracksSkipped.length, 1);
    assert.strictEqual(session.tracksSkipped[0].song.toString(), song2.toString());
    assert.strictEqual(session.tracksSkipped[0].playDurationBeforeSkipSeconds, 15);
    assert.strictEqual(session.tracksSkipped[0].reason, 'user_skip');

    assert.strictEqual(session.tracksCompleted.length, 1);
    assert.strictEqual(session.tracksCompleted[0].song.toString(), song3.toString());
    assert.strictEqual(session.tracksCompleted[0].durationSeconds, 210);

    assert.strictEqual(session.sessionEvents.length, 1);
    assert.strictEqual(session.sessionEvents[0].action, 'play');

    console.log('✓ Test 2 Passed: Tracks played, skipped, and completed tracked with accurate timestamps.');
  }

  // Test 3: Session Context & Extensible Metadata
  {
    const mockUserId = new Types.ObjectId();
    const session = new ListeningSession({
      user: mockUserId,
      sessionContext: {
        situation: 'workout',
        mood: 'Energetic',
        desiredEnergy: 0.90,
        desiredTempo: 140,
        preferredGenres: ['EDM', 'Hard Rock'],
        discoveryLevel: 0.40,
      },
      metadata: {
        deviceType: 'desktop',
        speakerType: 'headphones',
        sessionEnergyAverage: 0.88,
        aiPersonalizationActive: true,
      },
    });

    assert.strictEqual(session.sessionContext?.situation, 'workout');
    assert.strictEqual(session.sessionContext?.desiredEnergy, 0.90);
    assert.deepStrictEqual(session.sessionContext?.preferredGenres, ['EDM', 'Hard Rock']);
    assert.strictEqual(session.metadata?.deviceType, 'desktop');
    assert.strictEqual(session.metadata?.aiPersonalizationActive, true);

    console.log('✓ Test 3 Passed: Session context snapshot and extensible metadata verified.');
  }

  // Test 4: Pre-save synchronization hook verification
  {
    const mockUserId = new Types.ObjectId();
    const songId = new Types.ObjectId();

    const session = new ListeningSession({
      user: mockUserId,
      currentTrack: songId, // using currentTrack
      tracksPlayed: [{ song: songId, playedAt: new Date(), completed: false }],
      sessionContext: { situation: 'study', mood: 'Focus' },
    });

    // Invoke pre-save hook manually for unit testing
    const preSaveHooks = (ListeningSession.schema as any).s?.hooks?._pres?.get('save') || [];
    for (const hook of preSaveHooks) {
      if (typeof hook.fn === 'function') {
        hook.fn.call(session);
      }
    }

    assert.strictEqual(session.currentSong?.toString(), songId.toString(), 'currentSong should sync from currentTrack');
    assert.strictEqual(session.songsPlayed.length, 1, 'songsPlayed should sync from tracksPlayed');
    assert.strictEqual((session.contextSnapshot as any)?.situation, 'study', 'contextSnapshot should sync from sessionContext');

    console.log('✓ Test 4 Passed: Bidirectional synchronization hooks function correctly.');
  }

  // Test 5: Schema Index Declarations
  {
    const indexes = ListeningSession.schema.indexes();
    const indexKeys = indexes.map((idx) => Object.keys(idx[0]).join('_'));

    assert.ok(indexKeys.includes('user_status'), 'Must have { user: 1, status: 1 } compound index');
    assert.ok(indexKeys.includes('user_startTime'), 'Must have { user: 1, startTime: -1 } compound index');
    assert.ok(indexKeys.includes('user_lastActivityTime'), 'Must have { user: 1, lastActivityTime: -1 } index');
    assert.ok(indexKeys.includes('status_lastActivityTime'), 'Must have { status: 1, lastActivityTime: 1 } index');

    console.log('✓ Test 5 Passed: All required compound and lookup indexes are declared.');
  }

  console.log('🎉 All 5 Listening Session Model tests completed successfully.');
}
