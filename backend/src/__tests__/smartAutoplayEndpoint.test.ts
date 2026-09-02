import assert from 'node:assert';
import { Types } from 'mongoose';
import { getSmartAutoplayCandidates } from '../controllers/recommendationController.js';
import { SmartAutoplayService } from '../services/smartAutoplayService.js';
import { ListeningSessionService } from '../services/listeningSessionService.js';
import { Song } from '../models/Song.js';

export async function runSmartAutoplayEndpointTests() {
  console.log('[Smart Autoplay API Endpoint Test Suite] Starting tests...');

  const validUserId = new Types.ObjectId().toString();
  const validSongId = new Types.ObjectId().toString();

  const mockSongDoc = {
    _id: new Types.ObjectId(validSongId),
    title: 'Current Energetic Song',
    artist: { _id: new Types.ObjectId(), name: 'Current Artist' },
    genre: { _id: new Types.ObjectId(), name: 'Electronic' },
  };

  const mockQueueResult = {
    queue: [
      {
        song: {
          _id: new Types.ObjectId(),
          title: 'Next Track 1',
          artist: { _id: 'a1', name: 'Artist 1' },
          genre: 'Electronic',
        },
        queuePosition: 1,
        queueScore: 0.92,
        hybridScore: 0.90,
        sessionScore: 0.85,
        contextScore: 0.88,
        tier: 'familiarity' as const,
        reason: 'Tuned for your workout session',
        sources: ['taste_profile'],
      },
      {
        song: {
          _id: new Types.ObjectId(),
          title: 'Next Track 2',
          artist: { _id: 'a2', name: 'Artist 2' },
          genre: 'Dance',
        },
        queuePosition: 2,
        queueScore: 0.87,
        hybridScore: 0.85,
        sessionScore: 0.80,
        contextScore: 0.82,
        tier: 'discovery' as const,
        reason: 'Fresh discovery aligned with your workout targets',
        sources: ['discovery'],
      },
    ],
    tracks: [
      {
        song: { _id: new Types.ObjectId(), title: 'Next Track 1' },
        autoplayScore: 0.92,
        hybridScore: 0.90,
        reason: 'Tuned for your workout session',
        sources: ['taste_profile'],
      },
    ],
    candidates: [],
    totalQueued: 2,
    queueSize: 2,
    currentTrackId: validSongId,
    sessionActive: true,
    contextPreserved: 'workout',
    balanceDistribution: {
      familiarityCount: 1,
      discoveryCount: 1,
      dominantGenres: ['Electronic', 'Dance'],
      uniqueArtistsCount: 2,
    },
  };

  const originalGenerateQueue = SmartAutoplayService.generateAdaptiveQueue;
  const originalGetActiveSession = ListeningSessionService.getActiveSession;
  const originalSongFindById = Song.findById;

  function mockHelpers() {
    SmartAutoplayService.generateAdaptiveQueue = async () => mockQueueResult as any;
    ListeningSessionService.getActiveSession = async () => ({
      _id: new Types.ObjectId(),
      status: 'active',
      currentTrack: new Types.ObjectId(validSongId),
      sessionContext: { situation: 'workout' },
    } as any);
    (Song as any).findById = () => ({
      populate: () => ({
        populate: () => ({
          lean: async () => mockSongDoc,
        }),
      }),
    });
  }

  function restoreHelpers() {
    SmartAutoplayService.generateAdaptiveQueue = originalGenerateQueue;
    ListeningSessionService.getActiveSession = originalGetActiveSession;
    Song.findById = originalSongFindById;
  }

  function createMockReqRes(query = {}, body = {}, user = { _id: validUserId }) {
    let statusCode = 200;
    let jsonBody: any = null;

    const req: any = {
      query,
      body,
      user,
      params: {},
    };

    const res: any = {
      status(code: number) {
        statusCode = code;
        return res;
      },
      json(payload: any) {
        jsonBody = payload;
        return res;
      },
    };

    return { req, res, getStatus: () => statusCode, getBody: () => jsonBody };
  }

  // Test 1: Full Autoplay Request Handling with Current Track, Context, and Queue Size
  {
    mockHelpers();

    const { req, res, getStatus, getBody } = createMockReqRes({
      currentTrack: validSongId,
      context: 'workout',
      queueSize: '2',
    });

    await getSmartAutoplayCandidates(req, res);

    assert.strictEqual(getStatus(), 200);
    const body = getBody();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.strategyUsed, 'SMART_AUTOPLAY');
    assert.strictEqual(body.currentTrackId, validSongId);
    assert.ok(body.currentTrack !== null, 'Current track details populated');
    assert.strictEqual(body.sessionActive, true);
    assert.strictEqual(body.context, 'workout');
    assert.strictEqual(body.count, 2);
    assert.strictEqual(body.queue.length, 2);

    // Verify scores & explanations present
    assert.ok(body.queue[0].queueScore > 0);
    assert.ok(body.queue[0].hybridScore > 0);
    assert.ok(typeof body.queue[0].reason === 'string');
    assert.ok(body.explanationMetadata !== undefined);
    assert.strictEqual(body.explanationMetadata.primaryReason, 'Tuned for your workout session');

    console.log('✓ Test 1 Passed: Full autoplay request handling with current track, context, and scores verified.');
    restoreHelpers();
  }

  // Test 2: Input Validation Rejects Invalid Song ID Format
  {
    mockHelpers();

    const { req, res, getStatus, getBody } = createMockReqRes({
      currentTrack: 'not-a-valid-object-id',
    });

    await getSmartAutoplayCandidates(req, res);

    assert.strictEqual(getStatus(), 400);
    const body = getBody();
    assert.strictEqual(body.success, false);
    assert.ok(body.message.includes('Invalid currentTrack ID format'));

    console.log('✓ Test 2 Passed: Invalid current track ID format rejects with 400 error.');
    restoreHelpers();
  }

  // Test 3: Graceful Missing Session Handling
  {
    mockHelpers();
    ListeningSessionService.getActiveSession = async () => null;
    SmartAutoplayService.generateAdaptiveQueue = async () => ({
      ...mockQueueResult,
      sessionActive: false,
    } as any);

    const { req, res, getStatus, getBody } = createMockReqRes({
      currentTrack: validSongId,
      queueSize: '5',
    });

    await getSmartAutoplayCandidates(req, res);

    assert.strictEqual(getStatus(), 200);
    const body = getBody();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.sessionActive, false);
    assert.ok(body.queue.length > 0, 'Autoplay continues seamlessly even without active session');

    console.log('✓ Test 3 Passed: Missing active session handled gracefully without interruption.');
    restoreHelpers();
  }

  // Test 4: Insufficient Candidates & Fallback Graceful Recovery
  {
    mockHelpers();
    SmartAutoplayService.generateAdaptiveQueue = async () => {
      throw new Error('Database connection reset');
    };

    const { req, res, getStatus, getBody } = createMockReqRes({
      currentTrack: validSongId,
    });

    await getSmartAutoplayCandidates(req, res);

    assert.strictEqual(getStatus(), 200);
    const body = getBody();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.strategyUsed, 'SMART_AUTOPLAY_FALLBACK');
    assert.strictEqual(body.count, 0);
    assert.deepStrictEqual(body.queue, []);

    console.log('✓ Test 4 Passed: Insufficient candidate failure gracefully degraded to safe fallback.');
    restoreHelpers();
  }

  // Test 5: POST Request Support with Body Parameters
  {
    mockHelpers();

    const { req, res, getStatus, getBody } = createMockReqRes(
      {},
      {
        currentTrackId: validSongId,
        context: { situation: 'study', mood: 'focus' },
        queueSize: 3,
      }
    );

    await getSmartAutoplayCandidates(req, res);

    assert.strictEqual(getStatus(), 200);
    const body = getBody();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.currentTrackId, validSongId);

    console.log('✓ Test 5 Passed: Authenticated POST endpoint with body payload verified.');
    restoreHelpers();
  }

  console.log('🎉 All 5 Smart Autoplay API Endpoint tests completed successfully.');
}
