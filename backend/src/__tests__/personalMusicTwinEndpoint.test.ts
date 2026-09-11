import assert from 'node:assert';
import {
  getPersonalMusicTwin,
  refreshPersonalMusicTwin,
  formatPersonalMusicTwinResponse,
} from '../controllers/personalMusicTwinController.js';
import { PersonalMusicTwinService } from '../services/personalMusicTwinService.js';
import { getDefaultPersonalMusicTwin } from '../schemas/personalMusicTwinSchema.js';
import userRoutes from '../routes/userRoutes.js';
import recommendationRoutes from '../routes/recommendationRoutes.js';

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

export async function runPersonalMusicTwinEndpointTests() {
  console.log('[Personal Music Twin API Endpoint Test Suite] Starting tests...');

  const originalGetOrGenerate = PersonalMusicTwinService.getOrGenerateTwin;
  const originalRefresh = PersonalMusicTwinService.refreshMusicTwin;

  const validUserId = crypto.randomUUID().toString();
  const otherUserId = crypto.randomUUID().toString();

  const mockTwinAttributes = {
    ...getDefaultPersonalMusicTwin(validUserId),
    listenerArchetype: 'Explorer',
    archetypeDescription: 'Venturing across unknown sonic territory with high curiosity.',
    confidenceScore: 0.88,
    explorationTendency: 0.85,
    familiarityTendency: 0.20,
    diversityPreference: 0.80,
    genreIdentity: {
      coreGenres: [{ name: 'Synthwave', affinityScore: 0.90, isPrimary: true }],
      secondaryGenres: [{ name: 'Post-Rock', affinityScore: 0.70 }],
      genreDiversityScore: 0.80,
      signatureSound: 'Retro-Atmospheric Horizon',
    },
    moodIdentity: {
      dominantMoods: [{ mood: 'Atmospheric', affinityScore: 0.92 }],
      emotionalBreadth: 'broad' as const,
      contextualMoodAffinity: {},
    },
    tasteStability: {
      stabilityScore: 0.72,
      volatilityScore: 0.28,
      preferencePersistence: 0.75,
      stabilityRating: 'moderate_drift' as const,
      description: 'Developing emerging interests in instrumental post-rock.',
    },
    tasteEvolution: {
      transformationIntensity: 0.45,
      evolutionArchetype: 'Gradual Evolver',
      primaryTasteDirection: 'Broadening from Synthwave to Post-Rock',
      activePhase: 'Instrumental Exploration',
      velocity: 'moderate' as const,
    },
    currentEmergingInterests: {
      genres: [{ name: 'Post-Rock', confidence: 0.85, momentumVelocity: 0.60 }],
      artists: [{ name: 'Explosions In The Sky', confidence: 0.80 }],
      moods: ['Atmospheric'],
      narrative: 'Surging interest in atmospheric post-rock soundscapes.',
    },
    personalityProfile: {
      personaName: 'The Cosmic Nomad',
      tagline: 'Journeying across vast synth and ambient soundscapes',
      bio: 'An explorer who finds beauty in deep reverbs and driving rhythms.',
      vibeKeywords: ['exploratory', 'atmospheric', 'cinematic'],
      rarityScore: 0.85,
    },
    compatibilityDimensions: {
      opennessScore: 0.90,
      intensityScore: 0.75,
      eclecticismScore: 0.80,
      tasteVector: [0.85, 0.70, 0.65, 0.90, 0.80],
    },
    metadata: {
      personalityTraits: [
        { id: 'highly_exploratory', trait: 'highly exploratory', category: 'openness', confidence: 0.90 },
        { id: 'mood_driven', trait: 'mood driven', category: 'emotionality', confidence: 0.85 },
      ],
      establishedPreferences: {
        genres: ['Synthwave', 'Electronic'],
        artists: ['The Midnight', 'Gunship'],
      },
      fadingPreferences: {
        genres: ['Commercial EDM'],
        artists: [],
      },
    },
    isDataSufficient: true,
  };

  try {
    // ---------------------------------------------------------------------------
    // Test 1: Unauthenticated request rejection (401)
    // ---------------------------------------------------------------------------
    {
      const req: any = { user: undefined, query: {} };
      const res = createMockResponse();

      await getPersonalMusicTwin(req, res as any);
      assert.strictEqual(res.statusCode, 401, 'Unauthenticated request should return 401');
      assert.strictEqual(res.jsonData?.success, false);
      assert.strictEqual(res.jsonData?.message, 'Unauthorized access');
      console.log('✓ Test 1 Passed: Unauthenticated request rejected with 401');
    }

    // ---------------------------------------------------------------------------
    // Test 2: Invalid user ID rejection (400)
    // ---------------------------------------------------------------------------
    {
      const req: any = {
        user: { _id: 'invalid-object-id' },
        query: {},
      };
      const res = createMockResponse();

      await getPersonalMusicTwin(req, res as any);
      assert.strictEqual(res.statusCode, 400, 'Invalid user ID should return 400');
      assert.strictEqual(res.jsonData?.success, false);
      assert.strictEqual(res.jsonData?.message, 'Invalid user ID in authentication token');
      console.log('✓ Test 2 Passed: Invalid user ID rejected with 400');
    }

    // ---------------------------------------------------------------------------
    // Test 3: User isolation enforcement (403 when querying another user's twin)
    // ---------------------------------------------------------------------------
    {
      // GET request attempting to query another user's twin
      const reqGet: any = {
        user: { _id: validUserId },
        query: { userId: otherUserId },
      };
      const resGet = createMockResponse();

      await getPersonalMusicTwin(reqGet, resGet as any);
      assert.strictEqual(resGet.statusCode, 403, 'Attempt to access another user twin must return 403');
      assert.strictEqual(resGet.jsonData?.success, false);
      assert.strictEqual(resGet.jsonData?.message, "Cannot access another user's Personal Music Twin");

      // POST refresh request attempting to refresh another user's twin
      const reqPost: any = {
        user: { _id: validUserId },
        query: {},
        body: { userId: otherUserId },
      };
      const resPost = createMockResponse();

      await refreshPersonalMusicTwin(reqPost, resPost as any);
      assert.strictEqual(resPost.statusCode, 403, 'Attempt to refresh another user twin must return 403');
      assert.strictEqual(resPost.jsonData?.success, false);
      assert.strictEqual(resPost.jsonData?.message, "Cannot refresh another user's Personal Music Twin");

      console.log('✓ Test 3 Passed: User isolation strictly enforced (403 on cross-user queries)');
    }

    // ---------------------------------------------------------------------------
    // Test 4: Query parameter and body validation (400 on out-of-bounds inputs)
    // ---------------------------------------------------------------------------
    {
      // Limit out of bounds (< 1)
      const reqInvalidLimitLow: any = {
        user: { _id: validUserId },
        query: { limit: '0' },
      };
      const resLow = createMockResponse();
      await getPersonalMusicTwin(reqInvalidLimitLow, resLow as any);
      assert.strictEqual(resLow.statusCode, 400, 'Limit < 1 must return 400');

      // Limit out of bounds (> 50)
      const reqInvalidLimitHigh: any = {
        user: { _id: validUserId },
        query: { limit: '51' },
      };
      const resHigh = createMockResponse();
      await getPersonalMusicTwin(reqInvalidLimitHigh, resHigh as any);
      assert.strictEqual(resHigh.statusCode, 400, 'Limit > 50 must return 400');

      // Invalid forceRefresh boolean
      const reqInvalidBool: any = {
        user: { _id: validUserId },
        query: { forceRefresh: 'not_a_bool' },
      };
      const resBool = createMockResponse();
      await getPersonalMusicTwin(reqInvalidBool, resBool as any);
      assert.strictEqual(resBool.statusCode, 400, 'Invalid forceRefresh param must return 400');

      // Invalid maxAgeMinutes in refresh
      const reqInvalidMaxAge: any = {
        user: { _id: validUserId },
        body: { maxAgeMinutes: -10 },
      };
      const resMaxAge = createMockResponse();
      await refreshPersonalMusicTwin(reqInvalidMaxAge, resMaxAge as any);
      assert.strictEqual(resMaxAge.statusCode, 400, 'Negative maxAgeMinutes must return 400');

      console.log('✓ Test 4 Passed: Input validation prevents malformed queries and payloads');
    }

    // ---------------------------------------------------------------------------
    // Test 5: Successful retrieval of authenticated user's Personal Music Twin
    // ---------------------------------------------------------------------------
    {
      PersonalMusicTwinService.getOrGenerateTwin = async (uid: any) => {
        assert.strictEqual(uid.toString(), validUserId);
        return mockTwinAttributes as any;
      };

      const req: any = {
        user: { _id: validUserId },
        query: { limit: '5' },
      };
      const res = createMockResponse();

      await getPersonalMusicTwin(req, res as any);
      assert.strictEqual(res.statusCode, 200, 'Valid request should return 200');
      assert.strictEqual(res.jsonData?.success, true);

      const data = res.jsonData?.data;
      assert.ok(data, 'Response data must exist');
      assert.strictEqual(data.userId, validUserId);

      // Verify all required dimensions from the specification
      assert.strictEqual(data.listenerArchetype, 'Explorer');
      assert.strictEqual(data.confidence, 0.88);
      assert.ok(Array.isArray(data.personalityTraits) && data.personalityTraits.length === 2);
      assert.strictEqual(data.personalityTraits[0].trait, 'highly exploratory');

      assert.ok(Array.isArray(data.dominantGenres));
      assert.strictEqual(data.dominantGenres[0].name, 'Synthwave');

      assert.ok(Array.isArray(data.dominantMoods));
      assert.strictEqual(data.dominantMoods[0].mood, 'Atmospheric');

      assert.ok(Array.isArray(data.importantArtists));
      assert.strictEqual(data.importantArtists[0], 'The Midnight');

      assert.strictEqual(data.explorationTendency, 0.85);
      assert.strictEqual(data.familiarityPreference, 0.20);
      assert.strictEqual(data.diversityPreference, 0.80);

      assert.ok(data.establishedPreferences);
      assert.ok(data.establishedPreferences.genres.includes('Synthwave'));
      assert.ok(data.establishedPreferences.artists.includes('The Midnight'));

      assert.ok(data.emergingPreferences);
      assert.strictEqual(data.emergingPreferences.genres[0].name, 'Post-Rock');
      assert.strictEqual(data.emergingPreferences.artists[0].name, 'Explosions In The Sky');

      assert.ok(data.fadingPreferences);
      assert.ok(data.fadingPreferences.genres.includes('Commercial EDM'));

      assert.ok(data.tasteStability);
      assert.strictEqual(data.tasteStability.stabilityRating, 'moderate_drift');
      assert.strictEqual(data.tasteStability.stabilityScore, 0.72);

      assert.ok(data.tasteEvolution);
      assert.strictEqual(data.tasteEvolution.evolutionArchetype, 'Gradual Evolver');
      assert.strictEqual(data.tasteEvolution.transformationIntensity, 0.45);

      assert.ok(data.currentMusicalIdentity);
      assert.strictEqual(data.currentMusicalIdentity.personaName, 'The Cosmic Nomad');
      assert.strictEqual(data.currentMusicalIdentity.signatureSound, 'Retro-Atmospheric Horizon');
      assert.ok(data.currentMusicalIdentity.vibeKeywords.includes('atmospheric'));

      console.log('✓ Test 5 Passed: Successfully retrieved full structured Personal Music Twin');
    }

    // ---------------------------------------------------------------------------
    // Test 6: Successful refresh of Personal Music Twin via POST endpoint
    // ---------------------------------------------------------------------------
    {
      let refreshCalledWithUserId = '';
      PersonalMusicTwinService.refreshMusicTwin = async (uid: any, opts: any) => {
        refreshCalledWithUserId = uid.toString();
        assert.strictEqual(opts.forceRefresh, true);
        return {
          ...mockTwinAttributes,
          lastUpdatedTimestamp: new Date(),
          tasteEvolution: {
            ...mockTwinAttributes.tasteEvolution,
            activePhase: 'Evolved Horizon Era',
          },
        } as any;
      };

      const req: any = {
        user: { _id: validUserId },
        body: { maxAgeMinutes: 15 },
      };
      const res = createMockResponse();

      await refreshPersonalMusicTwin(req, res as any);
      assert.strictEqual(res.statusCode, 200, 'Refresh request should return 200');
      assert.strictEqual(res.jsonData?.success, true);
      assert.strictEqual(refreshCalledWithUserId, validUserId);
      assert.strictEqual(res.jsonData?.data?.tasteEvolution?.activePhase, 'Evolved Horizon Era');

      console.log('✓ Test 6 Passed: Successfully refreshed Personal Music Twin via POST');
    }

    // ---------------------------------------------------------------------------
    // Test 7: Route Registration Verification
    // ---------------------------------------------------------------------------
    {
      const extractRoutes = (router: any): { method: string; path: string }[] => {
        const routes: { method: string; path: string }[] = [];
        router.stack.forEach((middleware: any) => {
          if (middleware.route) {
            const path = middleware.route.path;
            const methods = Object.keys(middleware.route.methods);
            methods.forEach((method) => {
              routes.push({ method: method.toUpperCase(), path });
            });
          }
        });
        return routes;
      };

      const uRoutes = extractRoutes(userRoutes);
      const rRoutes = extractRoutes(recommendationRoutes);

      // Verify userRoutes has Personal Music Twin endpoints
      assert.ok(
        uRoutes.some((r) => r.method === 'GET' && r.path === '/me/personal-music-twin'),
        'userRoutes must register GET /me/personal-music-twin'
      );
      assert.ok(
        uRoutes.some((r) => r.method === 'GET' && r.path === '/personal-music-twin'),
        'userRoutes must register GET /personal-music-twin'
      );
      assert.ok(
        uRoutes.some((r) => r.method === 'POST' && r.path === '/me/personal-music-twin/refresh'),
        'userRoutes must register POST /me/personal-music-twin/refresh'
      );
      assert.ok(
        uRoutes.some((r) => r.method === 'POST' && r.path === '/personal-music-twin/refresh'),
        'userRoutes must register POST /personal-music-twin/refresh'
      );

      // Verify recommendationRoutes has Personal Music Twin endpoints
      assert.ok(
        rRoutes.some((r) => r.method === 'GET' && r.path === '/personal-music-twin'),
        'recommendationRoutes must register GET /personal-music-twin'
      );
      assert.ok(
        rRoutes.some((r) => r.method === 'POST' && r.path === '/personal-music-twin/refresh'),
        'recommendationRoutes must register POST /personal-music-twin/refresh'
      );

      console.log('✓ Test 7 Passed: All Personal Music Twin routes registered correctly across routers');
    }

    console.log('\n[Personal Music Twin API Endpoint Test Suite] All tests passed!\n');
    return true;
  } finally {
    // Restore original methods
    PersonalMusicTwinService.getOrGenerateTwin = originalGetOrGenerate;
    PersonalMusicTwinService.refreshMusicTwin = originalRefresh;
  }
}

// Standalone execution support
if (
  process.argv[1]?.endsWith('personalMusicTwinEndpoint.test.ts') ||
  process.argv[1]?.endsWith('personalMusicTwinEndpoint.test.js')
) {
  runPersonalMusicTwinEndpointTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Test suite failed:', err);
      process.exit(1);
    });
}
