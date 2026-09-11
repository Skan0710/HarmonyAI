import assert from 'node:assert';
import {
  getEvolutionOverview,
  getEvolutionTimeline,
  getTasteStability,
  getTasteChanges,
  getEmergingTastes,
  getSnapshots,
  createSnapshot,
} from '../controllers/musicDnaEvolutionController.js';
import { UnifiedMusicDNAService } from '../services/unifiedMusicDnaService.js';
import { MusicDNASnapshotService } from '../services/musicDnaSnapshotService.js';
import { MusicDNAChangeDetectionService } from '../services/musicDnaChangeDetectionService.js';
import { EmergingTasteDetectionService } from '../services/emergingTasteDetectionService.js';
import { TasteEvolutionTimelineService } from '../services/tasteEvolutionTimelineService.js';
import { TasteStabilityTransformationService } from '../services/tasteStabilityTransformationService.js';

interface MockResponse {
  statusCode: number;
  jsonData: any;
  status: (code: number) => MockResponse;
  json: (data: any) => MockResponse;
}

function createMockResponse(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    jsonData: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.jsonData = data;
      return this;
    },
  };
  return res;
}

export async function runMusicDnaEvolutionEndpointTests() {
  console.log('[Music DNA Evolution API Endpoint Test Suite] Starting tests...\n');

  const testUserId = crypto.randomUUID().toString();
  const foreignUserId = crypto.randomUUID().toString();

  // Save original service functions
  const originalGetOrGenerate = UnifiedMusicDNAService.getOrGenerateProfile;
  const originalGetSnapshots = MusicDNASnapshotService.getSnapshots;
  const originalGetLatestSnapshot = MusicDNASnapshotService.getLatestSnapshot;
  const originalCaptureSnapshot = MusicDNASnapshotService.captureCurrentSnapshot;
  const originalDetectChanges = MusicDNAChangeDetectionService.detectTasteChanges;
  const originalDetectEmerging = EmergingTasteDetectionService.detectUserEmergingTastes;
  const originalCalculateStability = TasteStabilityTransformationService.calculateUserStabilityMetrics;
  const originalGetTimeline = TasteEvolutionTimelineService.getUserEvolutionTimeline;

  try {
    UnifiedMusicDNAService.getOrGenerateProfile = async (userId: string) => ({
      userId,
      dnaVersion: '1.0.0',
      confidenceScore: 0.85,
      lastRefreshedAt: new Date(),
      interactionsCountAtLastRefresh: 30,
      genreProfile: {
        topGenres: [{ name: 'Synthwave', score: 0.9, preferenceType: 'established' }],
        emergingGenres: [{ name: 'Cyberpunk', score: 0.8, preferenceType: 'emerging' }],
      },
      artistProfile: {
        strongestArtists: [{ name: 'The Midnight', score: 0.88, preferenceType: 'established' }],
        emergingArtists: [{ name: 'Gunship', score: 0.75, preferenceType: 'emerging' }],
      },
      moodProfile: {
        preferredMoods: [{ name: 'Euphoric', score: 0.85 }],
      },
      listeningBehavior: {
        listenerArchetype: 'Adventurous Pioneer',
        repeatListeningTendency: 0.4,
        discoveryTendency: 0.8,
      },
      tendencies: {
        explorationPreference: 0.75,
        familiarityPreference: 0.35,
        diversityPreference: 0.70,
        discoveryTendency: 0.80,
      },
    } as any);

    MusicDNASnapshotService.getSnapshots = async () => [
      {
        _id: crypto.randomUUID().toString(),
        userId: String(testUserId),
        snapshotVersion: '1.0.0',
        triggerReason: 'periodic_evolution_checkpoint',
        createdAt: new Date(),
        timestamp: new Date(),
        topGenres: [{ name: 'Synthwave', affinityScore: 0.9, playCount: 20 }],
        topArtists: [{ name: 'The Midnight', affinityScore: 0.85, playCount: 15 }],
        preferredMoods: [{ mood: 'Euphoric', affinityScore: 0.8 }],
      } as any,
      {
        _id: crypto.randomUUID().toString(),
        userId: String(testUserId),
        snapshotVersion: '1.0.0',
        triggerReason: 'initial_checkpoint',
        createdAt: new Date(Date.now() - 7 * 86400000),
        timestamp: new Date(Date.now() - 7 * 86400000),
        topGenres: [{ name: 'Classic Rock', affinityScore: 0.8, playCount: 18 }],
        topArtists: [{ name: 'Old Legend', affinityScore: 0.75, playCount: 12 }],
        preferredMoods: [{ mood: 'Chill', affinityScore: 0.7 }],
      } as any,
    ];

    MusicDNASnapshotService.getLatestSnapshot = async () => ({
      _id: crypto.randomUUID().toString(),
      userId: String(testUserId),
      snapshotVersion: '1.0.0',
      triggerReason: 'periodic_evolution_checkpoint',
      createdAt: new Date(),
      timestamp: new Date(),
      topGenres: [{ name: 'Synthwave', affinityScore: 0.9, playCount: 20 }],
      topArtists: [{ name: 'The Midnight', affinityScore: 0.85, playCount: 15 }],
      preferredMoods: [{ mood: 'Euphoric', affinityScore: 0.8 }],
    } as any);

    MusicDNASnapshotService.captureCurrentSnapshot = async (userId: string, opts?: any) => ({
      _id: crypto.randomUUID().toString(),
      userId: String(userId),
      snapshotVersion: '1.0.0',
      triggerReason: opts?.triggerReason || 'manual_api_request',
      createdAt: new Date(),
      timestamp: new Date(),
    } as any);

    MusicDNAChangeDetectionService.detectTasteChanges = () => ({
      userId: testUserId,
      hasSufficientHistory: true,
      timeframe: { currentTimestamp: new Date() },
      overallShiftMagnitude: 0.42,
      tasteStabilityRating: 'moderate',
      genreChanges: [
        { name: 'Cyberpunk', previousScore: 0.2, currentScore: 0.8, delta: 0.6, classification: 'emerging' },
        { name: 'Classic Rock', previousScore: 0.7, currentScore: 0.2, delta: -0.5, classification: 'fading' },
      ],
      artistChanges: [],
      moodChanges: [],
      tendencyChanges: [],
      behaviorChanges: [],
      summary: {
        topIncreasingGenres: ['Cyberpunk'],
        topDecreasingGenres: ['Classic Rock'],
        emergingGenres: ['Cyberpunk'],
        fadingGenres: ['Classic Rock'],
        emergingArtists: [],
        fadingArtists: [],
        primaryTasteDirection: 'Cyberpunk is emerging, while Classic Rock is fading.',
      },
    } as any);

    EmergingTasteDetectionService.detectUserEmergingTastes = async () => ({
      userId: testUserId,
      generatedAt: new Date(),
      summary: {
        totalEmergingCount: 2,
        primaryEmergingGenre: 'Cyberpunk',
        primaryEmergingArtist: 'Gunship',
        narrative: 'Identified 1 emerging genre and 1 emerging artist.',
      },
      emergingGenres: [
        { name: 'Cyberpunk', type: 'genre', stage: 'emerging', emergenceConfidence: 0.82 } as any,
      ],
      emergingArtists: [
        { name: 'Gunship', type: 'artist', stage: 'emerging', emergenceConfidence: 0.78 } as any,
      ],
      emergingMoods: [],
      emergingBehaviors: [],
      establishedPreferences: { genres: ['Synthwave'], artists: ['The Midnight'] },
      fadingPreferences: { genres: ['Classic Rock'], artists: [] },
    } as any);

    TasteStabilityTransformationService.calculateUserStabilityMetrics = async () => ({
      userId: testUserId,
      calculatedAt: new Date(),
      hasSufficientHistory: true,
      snapshotsAnalyzed: 2,
      tasteStability: 0.62,
      tasteVolatility: 0.38,
      preferencePersistence: 0.55,
      discoveryTendency: 0.72,
      transformationIntensity: 0.45,
      archetype: 'Gradual Evolver',
      description: 'User exhibits gradual, healthy taste evolution.',
      metricBreakdown: {
        topGenreRetentionRate: 0.5,
        topArtistRetentionRate: 0.5,
        consecutiveShiftVariance: 0.1,
        netBaselineDistance: 0.4,
        observedSpanDays: 7,
      },
    } as any);

    TasteEvolutionTimelineService.getUserEvolutionTimeline = async () => ({
      userId: testUserId,
      generatedAt: new Date(),
      totalEvents: 1,
      totalSnapshotsAnalyzed: 2,
      timelineRange: { startDate: new Date(Date.now() - 7 * 86400000), endDate: new Date(), totalDays: 7 },
      events: [
        {
          id: 'evt-1',
          timestamp: new Date(),
          periodLabel: 'Recent',
          eventType: 'NEW_GENRE_EMERGED',
          targetDimension: 'genre',
          itemName: 'Cyberpunk',
          significance: 0.85,
          headline: 'New Genre Emerged: Cyberpunk',
          description: 'Cyberpunk surged as an emerging favorite genre.',
        } as any,
      ],
      milestones: [],
      dominantPhases: [],
    } as any);

    // -------------------------------------------------------------------------
    // Test 1: Unauthenticated request rejection (401)
    // -------------------------------------------------------------------------
    console.log('Test 1: Authentication enforcement');
    {
      const req: any = { query: {}, headers: {} };
      const res = createMockResponse();

      await getEvolutionOverview(req, res as any);
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.jsonData.success, false);
      console.log('✓ Test 1 passed: 401 returned for unauthenticated request');
    }

    // -------------------------------------------------------------------------
    // Test 2: Authorization & user isolation (403 when requesting another user's data)
    // -------------------------------------------------------------------------
    console.log('\nTest 2: Authorization and strict user isolation');
    {
      const req: any = {
        user: { _id: testUserId },
        query: { userId: foreignUserId },
      };
      const res = createMockResponse();

      await getEvolutionOverview(req, res as any);
      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.jsonData.success, false);
      assert.ok(res.jsonData.message.includes('another user'));
      console.log('✓ Test 2 passed: 403 Forbidden returned when accessing another user data');
    }

    // -------------------------------------------------------------------------
    // Test 3: Query Parameter Validation (400 for out-of-range limits)
    // -------------------------------------------------------------------------
    console.log('\nTest 3: Query parameter validation');
    {
      const req: any = {
        user: { _id: testUserId },
        query: { limit: 150 }, // out of bounds (> 50)
      };
      const res = createMockResponse();

      await getEvolutionOverview(req, res as any);
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.jsonData.success, false);

      const timelineReq: any = {
        user: { _id: testUserId },
        query: { significanceThreshold: 2.5 }, // out of bounds (> 1.0)
      };
      const timelineRes = createMockResponse();

      await getEvolutionTimeline(timelineReq, timelineRes as any);
      assert.strictEqual(timelineRes.statusCode, 400);
      assert.strictEqual(timelineRes.jsonData.success, false);

      console.log('✓ Test 3 passed: 400 returned for out-of-range query parameters');
    }

    // -------------------------------------------------------------------------
    // Test 4: Comprehensive Evolution Overview Endpoint (200)
    // -------------------------------------------------------------------------
    console.log('\nTest 4: Evolution overview endpoint functionality');
    {
      const req: any = {
        user: { _id: testUserId },
        query: { limit: 5 },
      };
      const res = createMockResponse();

      await getEvolutionOverview(req, res as any);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.jsonData.success, true);

      const data = res.jsonData.data;
      assert.strictEqual(data.userId, testUserId);
      assert.strictEqual(data.isDataSufficient, true);
      assert.strictEqual(data.snapshotCount, 2);

      // Verify subsections
      assert.ok(data.currentMusicDna);
      assert.ok(data.recentChanges);
      assert.strictEqual(data.recentChanges.hasMeaningfulShift, true);
      assert.ok(data.emergingTastes);
      assert.strictEqual(data.emergingTastes.hasEmergingPreferences, true);
      assert.ok(data.fadingPreferences);
      assert.strictEqual(data.fadingPreferences.fadingGenres.length, 1);
      assert.ok(data.stabilityMetrics);
      assert.strictEqual(data.stabilityMetrics.archetype, 'Gradual Evolver');
      assert.ok(data.evolutionTimeline);
      assert.strictEqual(data.evolutionTimeline.totalEvents, 1);

      console.log('✓ Test 4 passed: Evolution overview returns complete unified intelligence payload');
    }

    // -------------------------------------------------------------------------
    // Test 5: Timeline Endpoint (200)
    // -------------------------------------------------------------------------
    console.log('\nTest 5: Evolution timeline endpoint');
    {
      const req: any = {
        user: { _id: testUserId },
        query: { limit: 10, windowDays: 60 },
      };
      const res = createMockResponse();

      await getEvolutionTimeline(req, res as any);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.jsonData.success, true);
      assert.ok(Array.isArray(res.jsonData.data.events));
      console.log('✓ Test 5 passed: Timeline endpoint returns structured chronological milestones');
    }

    // -------------------------------------------------------------------------
    // Test 6: Stability & Transformation Endpoint (200)
    // -------------------------------------------------------------------------
    console.log('\nTest 6: Taste stability and transformation endpoint');
    {
      const req: any = {
        user: { _id: testUserId },
        query: {},
      };
      const res = createMockResponse();

      await getTasteStability(req, res as any);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.jsonData.success, true);
      assert.strictEqual(res.jsonData.data.archetype, 'Gradual Evolver');
      console.log('✓ Test 6 passed: Stability metrics returned successfully');
    }

    // -------------------------------------------------------------------------
    // Test 7: Emerging Tastes Endpoint (200)
    // -------------------------------------------------------------------------
    console.log('\nTest 7: Emerging tastes endpoint');
    {
      const req: any = {
        user: { _id: testUserId },
        query: {},
      };
      const res = createMockResponse();

      await getEmergingTastes(req, res as any);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.jsonData.success, true);
      assert.strictEqual(res.jsonData.data.emergingGenres.length, 1);
      console.log('✓ Test 7 passed: Emerging tastes returned successfully');
    }

    // -------------------------------------------------------------------------
    // Test 8: Taste Changes Endpoint (200)
    // -------------------------------------------------------------------------
    console.log('\nTest 8: Taste changes endpoint');
    {
      const req: any = {
        user: { _id: testUserId },
        query: {},
      };
      const res = createMockResponse();

      await getTasteChanges(req, res as any);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.jsonData.success, true);
      assert.strictEqual(res.jsonData.data.hasSufficientHistory, true);
      console.log('✓ Test 8 passed: Taste changes returned successfully');
    }

    // -------------------------------------------------------------------------
    // Test 9: Snapshot Endpoints (GET 200, POST 201)
    // -------------------------------------------------------------------------
    console.log('\nTest 9: Snapshots retrieval and creation endpoints');
    {
      const getReq: any = {
        user: { _id: testUserId },
        query: { limit: 5 },
      };
      const getRes = createMockResponse();

      await getSnapshots(getReq, getRes as any);
      assert.strictEqual(getRes.statusCode, 200);
      assert.strictEqual(getRes.jsonData.data.length, 2);

      const postReq: any = {
        user: { _id: testUserId },
        query: {},
        body: { triggerReason: 'milestone_celebration' },
      };
      const postRes = createMockResponse();

      await createSnapshot(postReq, postRes as any);
      assert.strictEqual(postRes.statusCode, 201);
      assert.strictEqual(postRes.jsonData.data.triggerReason, 'milestone_celebration');
      console.log('✓ Test 9 passed: Snapshot retrieval and manual creation verified');
    }

    // -------------------------------------------------------------------------
    // Test 10: Graceful Handling for Users With Insufficient History
    // -------------------------------------------------------------------------
    console.log('\nTest 10: Graceful handling for cold-start / insufficient history user');
    {
      UnifiedMusicDNAService.getOrGenerateProfile = async (userId: string) => ({
        userId,
        dnaVersion: '1.0.0',
        confidenceScore: 0.1,
        genreProfile: { topGenres: [] },
        artistProfile: { strongestArtists: [] },
        moodProfile: { preferredMoods: [] },
        listeningBehavior: { listenerArchetype: 'Balanced Explorer' },
      } as any);

      MusicDNASnapshotService.getSnapshots = async () => [];
      MusicDNASnapshotService.getLatestSnapshot = async () => null;

      MusicDNAChangeDetectionService.detectTasteChanges = () => ({
        userId: testUserId,
        hasSufficientHistory: false,
        timeframe: { currentTimestamp: new Date() },
        overallShiftMagnitude: 0.0,
        tasteStabilityRating: 'unrated',
        genreChanges: [],
        artistChanges: [],
        moodChanges: [],
        tendencyChanges: [],
        behaviorChanges: [],
        summary: {
          topIncreasingGenres: [],
          topDecreasingGenres: [],
          emergingGenres: [],
          fadingGenres: [],
          emergingArtists: [],
          fadingArtists: [],
          primaryTasteDirection: 'Insufficient historical snapshot data to detect changes',
        },
      } as any);

      EmergingTasteDetectionService.detectUserEmergingTastes = async () => ({
        userId: testUserId,
        generatedAt: new Date(),
        summary: {
          totalEmergingCount: 0,
          primaryEmergingGenre: null,
          primaryEmergingArtist: null,
          narrative: 'No significant emerging preferences detected yet.',
        },
        emergingGenres: [],
        emergingArtists: [],
        emergingMoods: [],
        emergingBehaviors: [],
        establishedPreferences: { genres: [], artists: [] },
        fadingPreferences: { genres: [], artists: [] },
      } as any);

      TasteStabilityTransformationService.calculateUserStabilityMetrics = async () => ({
        userId: testUserId,
        calculatedAt: new Date(),
        hasSufficientHistory: false,
        snapshotsAnalyzed: 0,
        tasteStability: 0.5,
        tasteVolatility: 0.5,
        preferencePersistence: 0.5,
        discoveryTendency: 0.5,
        transformationIntensity: 0.5,
        archetype: 'Indeterminate / Insufficient Data',
        description: 'Insufficient historical snapshots to calculate stability metrics.',
        metricBreakdown: {
          topGenreRetentionRate: 0,
          topArtistRetentionRate: 0,
          consecutiveShiftVariance: 0,
          netBaselineDistance: 0,
          observedSpanDays: 0,
        },
      } as any);

      TasteEvolutionTimelineService.getUserEvolutionTimeline = async () => ({
        userId: testUserId,
        generatedAt: new Date(),
        totalEvents: 0,
        totalSnapshotsAnalyzed: 0,
        timelineRange: { startDate: new Date(), endDate: new Date(), totalDays: 0 },
        events: [],
        milestones: [],
        dominantPhases: [],
      } as any);

      const req: any = {
        user: { _id: testUserId },
        query: {},
      };
      const res = createMockResponse();

      await getEvolutionOverview(req, res as any);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.jsonData.success, true);
      assert.strictEqual(res.jsonData.data.isDataSufficient, false);
      assert.strictEqual(res.jsonData.data.snapshotCount, 0);
      assert.strictEqual(res.jsonData.data.recentChanges.hasMeaningfulShift, false);

      console.log('✓ Test 10 passed: Cold start / insufficient history gracefully handled without errors');
    }

    console.log('\n[Music DNA Evolution API Endpoint Test Suite] All tests passed!\n');
    return true;
  } finally {
    UnifiedMusicDNAService.getOrGenerateProfile = originalGetOrGenerate;
    MusicDNASnapshotService.getSnapshots = originalGetSnapshots;
    MusicDNASnapshotService.getLatestSnapshot = originalGetLatestSnapshot;
    MusicDNASnapshotService.captureCurrentSnapshot = originalCaptureSnapshot;
    MusicDNAChangeDetectionService.detectTasteChanges = originalDetectChanges;
    EmergingTasteDetectionService.detectUserEmergingTastes = originalDetectEmerging;
    TasteStabilityTransformationService.calculateUserStabilityMetrics = originalCalculateStability;
    TasteEvolutionTimelineService.getUserEvolutionTimeline = originalGetTimeline;
  }
}

// Standalone execution support
if (process.argv[1]?.endsWith('musicDnaEvolutionEndpoint.test.ts') || process.argv[1]?.endsWith('musicDnaEvolutionEndpoint.test.js')) {
  runMusicDnaEvolutionEndpointTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Test suite failed:', err);
      process.exit(1);
    });
}
