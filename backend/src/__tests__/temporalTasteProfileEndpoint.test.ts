import assert from 'node:assert';
import { Types } from 'mongoose';
import { getTemporalTasteProfile } from '../controllers/temporalTasteProfileController.js';
import { LayeredTemporalTasteProfileService } from '../services/layeredTemporalTasteProfileService.js';
import recommendationRouter from '../routes/recommendationRoutes.js';
import userRouter from '../routes/userRoutes.js';

export async function runTemporalTasteProfileEndpointTests() {
  console.log('[Temporal Taste Profile API Endpoint Test Suite] Starting tests...');

  const userId = new Types.ObjectId().toString();
  const now = new Date('2026-09-01T12:00:00.000Z');

  // Helper to create mock Express request & response
  const createMockReqRes = (options: {
    user?: any;
    query?: Record<string, string>;
  } = {}) => {
    const req: any = {
      user: options.user !== undefined ? options.user : { _id: new Types.ObjectId(userId) },
      query: options.query || {},
      params: {},
      body: {},
    };

    let statusCode = 200;
    let responseJson: any = null;

    const res: any = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (data: any) => {
        responseJson = data;
        return res;
      },
    };

    return {
      req,
      res,
      getStatusCode: () => statusCode,
      getResponseJson: () => responseJson,
    };
  };

  const originalGenerate = LayeredTemporalTasteProfileService.generateLayeredTasteProfile;

  try {
    // Mock sample layered taste profile
    const mockProfile: any = {
      userId,
      shortTerm: {
        layerName: 'short_term',
        timeframeDays: 14,
        role: 'immediate_momentum',
        genres: [
          { name: 'Synthwave', score: 1.0, rawWeight: 15, interactionCount: 8, lastInteractionAt: now },
          { name: 'Cyberpunk', score: 0.85, rawWeight: 10, interactionCount: 5, lastInteractionAt: now },
        ],
        artists: [
          { name: 'Kavinsky', score: 1.0, rawWeight: 12, interactionCount: 6, lastInteractionAt: now },
        ],
        moods: [
          { name: 'Energetic', score: 1.0, rawWeight: 15, interactionCount: 8, lastInteractionAt: now },
        ],
        acousticTargets: { energy: 0.85, tempo: 128, valence: 0.70 },
        topGenre: 'Synthwave',
        topArtist: 'Kavinsky',
        topMood: 'Energetic',
        totalInteractions: 19,
        lastUpdated: now,
      },
      mediumTerm: {
        layerName: 'medium_term',
        timeframeDays: 60,
        role: 'rotational_habits',
        genres: [
          { name: 'Synthwave', score: 0.80, rawWeight: 20, interactionCount: 12, lastInteractionAt: now },
          { name: 'Electronic', score: 1.0, rawWeight: 30, interactionCount: 18, lastInteractionAt: now },
        ],
        artists: [
          { name: 'Daft Punk', score: 1.0, rawWeight: 25, interactionCount: 15, lastInteractionAt: now },
        ],
        moods: [
          { name: 'Upbeat', score: 1.0, rawWeight: 28, interactionCount: 16, lastInteractionAt: now },
        ],
        acousticTargets: { energy: 0.75, tempo: 124, valence: 0.65 },
        topGenre: 'Electronic',
        topArtist: 'Daft Punk',
        topMood: 'Upbeat',
        totalInteractions: 45,
        lastUpdated: now,
      },
      longTerm: {
        layerName: 'long_term',
        timeframeDays: 180,
        role: 'foundational_taste',
        genres: [
          { name: 'Rock', score: 1.0, rawWeight: 50, interactionCount: 35, lastInteractionAt: now },
          { name: 'Synthwave', score: 0.35, rawWeight: 18, interactionCount: 12, lastInteractionAt: now },
        ],
        artists: [
          { name: 'Queen', score: 1.0, rawWeight: 45, interactionCount: 30, lastInteractionAt: now },
        ],
        moods: [
          { name: 'Classic', score: 1.0, rawWeight: 40, interactionCount: 25, lastInteractionAt: now },
        ],
        acousticTargets: { energy: 0.65, tempo: 118, valence: 0.60 },
        topGenre: 'Rock',
        topArtist: 'Queen',
        topMood: 'Classic',
        totalInteractions: 90,
        lastUpdated: now,
      },
      unifiedGenres: [
        { name: 'Synthwave', score: 1.0, rawWeight: 22, interactionCount: 20, lastInteractionAt: now },
        { name: 'Rock', score: 0.85, rawWeight: 20, interactionCount: 35, lastInteractionAt: now },
      ],
      unifiedArtists: [
        { name: 'Kavinsky', score: 1.0, rawWeight: 18, interactionCount: 15, lastInteractionAt: now },
      ],
      unifiedMoods: [
        { name: 'Energetic', score: 1.0, rawWeight: 20, interactionCount: 18, lastInteractionAt: now },
      ],
      unifiedAcousticTargets: { energy: 0.78, tempo: 125, valence: 0.68 },
      strongestChangingPreferences: {
        topRising: [
          {
            name: 'Synthwave',
            category: 'genre',
            shortTermScore: 1.0,
            longTermScore: 0.35,
            changeDelta: 0.65,
            changePercentage: 185.7,
            direction: 'rising',
            explanation: 'Surging: Synthwave grew by 65.0% above long-term affinity.',
          },
        ],
        topDeclining: [
          {
            name: 'Rock',
            category: 'genre',
            shortTermScore: 0.0,
            longTermScore: 1.0,
            changeDelta: -1.0,
            changePercentage: -100,
            direction: 'declining',
            explanation: 'Cooling down: Rock decreased by 100.0% compared to historical listening.',
          },
        ],
        topEmerging: [
          {
            name: 'Cyberpunk',
            category: 'genre',
            shortTermScore: 0.85,
            longTermScore: 0.0,
            changeDelta: 0.85,
            changePercentage: 100,
            direction: 'emerging',
            explanation: 'New discovery: Cyberpunk recently entered listening rotations with a 0.85 score.',
          },
        ],
        overallChanges: [],
        tasteShiftSummary: 'Active taste evolution: Cyberpunk recently emerged, while Synthwave is experiencing a strong listening spike.',
      },
      layerWeights: { shortTermWeight: 0.50, mediumTermWeight: 0.30, longTermWeight: 0.20 },
      tasteStabilityScore: 0.62,
      dominantTasteCategory: 'Synthwave',
      totalInteractionsAnalyzed: 154,
      createdAt: now,
      updatedAt: now,
    };

    (LayeredTemporalTasteProfileService as any).generateLayeredTasteProfile = async () => mockProfile;

    // Test 1: Authentication Requirement (401 on Missing Auth)
    {
      const { req, res, getStatusCode, getResponseJson } = createMockReqRes({ user: null });
      await getTemporalTasteProfile(req, res);

      assert.strictEqual(getStatusCode(), 401);
      assert.strictEqual(getResponseJson().success, false);
      assert.ok(getResponseJson().message.includes('Unauthorized'));

      console.log('✓ Test 1 Passed: Authentication correctly required (401 returned for unauthenticated requests).');
    }

    // Test 2: Query Parameter Validation (limit bounds)
    {
      // A. Negative limit
      const mockNegative = createMockReqRes({ query: { limit: '-5' } });
      await getTemporalTasteProfile(mockNegative.req, mockNegative.res);
      assert.strictEqual(mockNegative.getStatusCode(), 400);
      assert.ok(mockNegative.getResponseJson().message.includes('Limit query parameter must be an integer between 1 and 50'));

      // B. Limit exceeding 50
      const mockExcessive = createMockReqRes({ query: { limit: '99' } });
      await getTemporalTasteProfile(mockExcessive.req, mockExcessive.res);
      assert.strictEqual(mockExcessive.getStatusCode(), 400);
      assert.ok(mockExcessive.getResponseJson().message.includes('Limit query parameter must be an integer between 1 and 50'));

      console.log('✓ Test 2 Passed: Query parameter validation correctly enforces limits [1, 50].');
    }

    // Test 3: Successful Retrieval of All 3 Temporal Preference Layers
    {
      const { req, res, getStatusCode, getResponseJson } = createMockReqRes();
      await getTemporalTasteProfile(req, res);

      assert.strictEqual(getStatusCode(), 200);
      const json = getResponseJson();
      assert.strictEqual(json.success, true);
      const data = json.data;

      // 1. Short-term preferences
      assert.ok(data.shortTermPreferences, 'shortTermPreferences must exist');
      assert.strictEqual(data.shortTermPreferences.timeWindow, 'short_term');
      assert.strictEqual(data.shortTermPreferences.timeframeDays, 14);
      assert.strictEqual(data.shortTermPreferences.role, 'immediate_momentum');
      assert.strictEqual(data.shortTermPreferences.topGenre, 'Synthwave');
      assert.strictEqual(data.shortTermPreferences.topArtist, 'Kavinsky');
      assert.strictEqual(data.shortTermPreferences.topMood, 'Energetic');
      assert.ok(data.shortTermPreferences.genres.length > 0);

      // 2. Medium-term preferences
      assert.ok(data.mediumTermPreferences, 'mediumTermPreferences must exist');
      assert.strictEqual(data.mediumTermPreferences.timeWindow, 'medium_term');
      assert.strictEqual(data.mediumTermPreferences.timeframeDays, 60);
      assert.strictEqual(data.mediumTermPreferences.role, 'rotational_habits');
      assert.strictEqual(data.mediumTermPreferences.topGenre, 'Electronic');

      // 3. Long-term preferences
      assert.ok(data.longTermPreferences, 'longTermPreferences must exist');
      assert.strictEqual(data.longTermPreferences.timeWindow, 'long_term');
      assert.strictEqual(data.longTermPreferences.timeframeDays, 180);
      assert.strictEqual(data.longTermPreferences.role, 'foundational_taste');
      assert.strictEqual(data.longTermPreferences.topGenre, 'Rock');

      console.log('✓ Test 3 Passed: Short-term, medium-term, and long-term preference layers returned with full metadata.');
    }

    // Test 4: Strongest Changing Preferences Structure and Signals
    {
      const { req, res, getResponseJson } = createMockReqRes();
      await getTemporalTasteProfile(req, res);

      const data = getResponseJson().data;
      const changes = data.strongestChangingPreferences;
      assert.ok(changes, 'strongestChangingPreferences must exist');

      // Verify topRising
      assert.ok(changes.topRising.length > 0);
      assert.strictEqual(changes.topRising[0].name, 'Synthwave');
      assert.strictEqual(changes.topRising[0].direction, 'rising');
      assert.ok(changes.topRising[0].changeDelta > 0);

      // Verify topDeclining
      assert.ok(changes.topDeclining.length > 0);
      assert.strictEqual(changes.topDeclining[0].name, 'Rock');
      assert.strictEqual(changes.topDeclining[0].direction, 'declining');
      assert.ok(changes.topDeclining[0].changeDelta < 0);

      // Verify topEmerging
      assert.ok(changes.topEmerging.length > 0);
      assert.strictEqual(changes.topEmerging[0].name, 'Cyberpunk');
      assert.strictEqual(changes.topEmerging[0].direction, 'emerging');

      // Verify human-readable summary
      assert.ok(changes.tasteShiftSummary.length > 0);
      assert.ok(changes.tasteShiftSummary.includes('Cyberpunk'));

      console.log('✓ Test 4 Passed: Strongest changing preferences (rising, declining, emerging) accurately returned.');
    }

    // Test 5: Route Registration in Both Recommendation and User Routers
    {
      const checkRoute = (router: any, path: string, method: string) => {
        return router.stack.some((layer: any) => {
          if (layer.route) {
            const matchesPath = layer.route.path === path;
            const matchesMethod = layer.route.methods[method.toLowerCase()];
            return matchesPath && matchesMethod;
          }
          return false;
        });
      };

      // In recommendationRoutes
      assert.ok(
        checkRoute(recommendationRouter, '/temporal-taste-profile', 'GET'),
        '/temporal-taste-profile must be registered in recommendationRouter'
      );
      assert.ok(
        checkRoute(recommendationRouter, '/temporal-profile', 'GET'),
        '/temporal-profile must be registered in recommendationRouter'
      );

      // In userRoutes
      assert.ok(
        checkRoute(userRouter, '/me/temporal-taste-profile', 'GET'),
        '/me/temporal-taste-profile must be registered in userRouter'
      );
      assert.ok(
        checkRoute(userRouter, '/temporal-taste-profile', 'GET'),
        '/temporal-taste-profile must be registered in userRouter'
      );

      console.log('✓ Test 5 Passed: Endpoints correctly registered across recommendationRoutes and userRoutes.');
    }

    console.log('🎉 ALL 5 Temporal Taste Profile API Endpoint tests completed successfully.');
  } finally {
    LayeredTemporalTasteProfileService.generateLayeredTasteProfile = originalGenerate;
  }
}
