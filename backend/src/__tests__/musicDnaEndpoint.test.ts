import assert from 'node:assert';
import { getMusicDNAProfile, refreshMusicDNAProfile } from '../controllers/musicDnaController.js';
import { UnifiedMusicDNAService } from '../services/unifiedMusicDnaService.js';

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

export async function runMusicDnaEndpointTests() {
  console.log('[Music DNA API Endpoint Test Suite] Starting tests...');

  const originalGetOrGenerate = UnifiedMusicDNAService.getOrGenerateProfile;
  const originalRefresh = UnifiedMusicDNAService.refreshAfterInteraction;

  const sampleProfile = {
    userId: '507f1f77bcf86cd799439011',
    dnaVersion: '1.0.0',
    genreProfile: {
      topGenres: [
        { name: 'synthwave', score: 0.95 },
        { name: 'electronic', score: 0.82 },
        { name: 'ambient', score: 0.70 },
        { name: 'chillwave', score: 0.65 },
      ],
      emergingGenres: [
        { name: 'darksynth', score: 0.60 },
        { name: 'lo-fi', score: 0.45 },
      ],
      diversity: 0.78,
    },
    artistProfile: {
      strongestArtists: [
        { name: 'Kavinsky', score: 0.92 },
        { name: 'Gunship', score: 0.85 },
        { name: 'The Midnight', score: 0.76 },
      ],
      emergingArtists: [
        { name: 'FM-84', score: 0.58 },
      ],
      diversity: 0.72,
    },
    moodProfile: {
      preferredMoods: [
        { name: 'Energetic', score: 0.88 },
        { name: 'Euphoric', score: 0.74 },
        { name: 'Chill', score: 0.62 },
      ],
    },
    listeningBehavior: {
      repeatListeningTendency: 0.40,
      discoveryTendency: 0.75,
      skipTendency: 0.20,
      familiarityPreference: 0.35,
      explorationTendency: 0.80,
      diversityPreference: 0.75,
      sessionListeningIntensity: 0.68,
      preferenceStability: 0.82,
      preferenceChangeRate: 0.18,
      listenerArchetype: 'Adventurous Pioneer',
      isDataSufficient: true,
      metricsBreakdown: {
        repeatListening: { uniqueTracksRatio: 0.75 },
        discovery: { newArtistsRatio: 0.70 },
        skip: { skipRate: 0.15 },
      },
    },
    temporalPreferences: {
      shortTermDominantGenre: 'darksynth',
      mediumTermDominantGenre: 'synthwave',
      longTermDominantGenre: 'synthwave',
      tasteStabilityScore: 0.85,
    },
    tendencies: {
      discoveryTendency: 0.75,
      familiarityPreference: 0.35,
      diversityPreference: 0.75,
      explorationPreference: 0.80,
    },
    listeningPatterns: {
      preferredTempo: 124,
      preferredAcousticFeatures: { energy: 0.85, danceability: 0.72 },
    },
    confidenceScore: 0.86,
    lastRefreshedAt: new Date('2026-09-06T10:00:00.000Z'),
    interactionsCountAtLastRefresh: 42,
  };

  try {
    // 1. Unauthenticated request rejection (401)
    {
      const req: any = {
        user: undefined,
        query: {},
      };
      const res = createMockResponse();

      await getMusicDNAProfile(req, res as any);
      assert.strictEqual(res.statusCode, 401, 'Unauthenticated request should return 401');
      assert.strictEqual(res.jsonData?.success, false);
      assert.strictEqual(res.jsonData?.message, 'Unauthorized access');
      console.log('  ✓ Test 1 Passed: Unauthenticated request rejected with 401');
    }

    // 2. User isolation enforcement (403 when querying someone else's ID)
    {
      const req: any = {
        user: { _id: '507f1f77bcf86cd799439011' },
        query: { userId: '507f1f77bcf86cd799439099' }, // malicious foreign id
      };
      const res = createMockResponse();

      await getMusicDNAProfile(req, res as any);
      assert.strictEqual(res.statusCode, 403, 'Attempt to access another user\'s profile should return 403');
      assert.strictEqual(res.jsonData?.success, false);
      assert.match(res.jsonData?.message, /Cannot access another user's Music DNA profile/i);
      console.log('  ✓ Test 2 Passed: User isolation enforced with 403 forbidden for foreign userId');
    }

    // 3. Query validation (invalid limit & invalid forceRefresh)
    {
      // Invalid limit < 1
      const reqLowLimit: any = {
        user: { _id: '507f1f77bcf86cd799439011' },
        query: { limit: '0' },
      };
      const resLow = createMockResponse();
      await getMusicDNAProfile(reqLowLimit, resLow as any);
      assert.strictEqual(resLow.statusCode, 400, 'Limit 0 should return 400');

      // Invalid limit > 50
      const reqHighLimit: any = {
        user: { _id: '507f1f77bcf86cd799439011' },
        query: { limit: '99' },
      };
      const resHigh = createMockResponse();
      await getMusicDNAProfile(reqHighLimit, resHigh as any);
      assert.strictEqual(resHigh.statusCode, 400, 'Limit 99 should return 400');

      // Invalid forceRefresh
      const reqInvalidRefresh: any = {
        user: { _id: '507f1f77bcf86cd799439011' },
        query: { forceRefresh: 'not-a-boolean' },
      };
      const resInvalidRefresh = createMockResponse();
      await getMusicDNAProfile(reqInvalidRefresh, resInvalidRefresh as any);
      assert.strictEqual(resInvalidRefresh.statusCode, 400, 'Invalid forceRefresh should return 400');

      console.log('  ✓ Test 3 Passed: Query parameters validated with 400 bad request');
    }

    // 4. Successful Music DNA retrieval with comprehensive fields
    {
      UnifiedMusicDNAService.getOrGenerateProfile = async (userId: string, opts?: any) => {
        assert.strictEqual(userId, '507f1f77bcf86cd799439011');
        return sampleProfile as any;
      };

      const req: any = {
        user: { _id: '507f1f77bcf86cd799439011' },
        query: {},
      };
      const res = createMockResponse();

      await getMusicDNAProfile(req, res as any);
      assert.strictEqual(res.statusCode, 200, 'Valid request should return 200');
      assert.strictEqual(res.jsonData?.success, true);
      assert.strictEqual(res.jsonData?.message, 'Music DNA profile retrieved successfully');

      const data = res.jsonData?.data;
      assert.ok(data, 'Data payload should be present');
      assert.strictEqual(data.userId, '507f1f77bcf86cd799439011');
      assert.strictEqual(data.dnaVersion, '1.0.0');
      assert.strictEqual(data.confidenceScore, 0.86);

      // Verify top taste dimensions
      assert.strictEqual(Array.isArray(data.topGenres), true);
      assert.strictEqual(data.topGenres[0].name, 'synthwave');
      assert.strictEqual(Array.isArray(data.topArtists), true);
      assert.strictEqual(data.topArtists[0].name, 'Kavinsky');
      assert.strictEqual(Array.isArray(data.preferredMoods), true);
      assert.strictEqual(data.preferredMoods[0].name, 'Energetic');

      // Verify core tendencies
      assert.strictEqual(data.explorationTendency, 0.80);
      assert.strictEqual(data.familiarityPreference, 0.35);
      assert.strictEqual(data.diversityPreference, 0.75);
      assert.strictEqual(data.discoveryTendency, 0.75);

      // Verify listening behavior
      assert.ok(data.listeningBehavior, 'listeningBehavior must be present');
      assert.strictEqual(data.listeningBehavior.repeatListeningTendency, 0.40);
      assert.strictEqual(data.listeningBehavior.skipTendency, 0.20);
      assert.strictEqual(data.listeningBehavior.listenerArchetype, 'Adventurous Pioneer');
      assert.strictEqual(data.listeningBehavior.preferenceStability, 0.82);

      // Verify established & emerging preferences
      assert.ok(data.establishedPreferences, 'establishedPreferences must be present');
      assert.strictEqual(data.establishedPreferences.genres.length, 4);
      assert.strictEqual(data.establishedPreferences.artists[0].name, 'Kavinsky');
      assert.ok(data.emergingPreferences, 'emergingPreferences must be present');
      assert.strictEqual(data.emergingPreferences.genres[0].name, 'darksynth');
      assert.strictEqual(data.emergingPreferences.artists[0].name, 'FM-84');

      console.log('  ✓ Test 4 Passed: Authenticated profile retrieval returned all required Music DNA fields');
    }

    // 5. Query limit parameter truncation
    {
      UnifiedMusicDNAService.getOrGenerateProfile = async () => sampleProfile as any;

      const req: any = {
        user: { _id: '507f1f77bcf86cd799439011' },
        query: { limit: '2' },
      };
      const res = createMockResponse();

      await getMusicDNAProfile(req, res as any);
      assert.strictEqual(res.statusCode, 200);
      const data = res.jsonData?.data;
      assert.strictEqual(data.topGenres.length, 2, 'Top genres should be limited to 2');
      assert.strictEqual(data.topArtists.length, 2, 'Top artists should be limited to 2');
      assert.strictEqual(data.preferredMoods.length, 2, 'Preferred moods should be limited to 2');
      assert.strictEqual(data.establishedPreferences.genres.length, 2);

      console.log('  ✓ Test 5 Passed: Query parameter limit correctly bounds returned arrays');
    }

    // 6. Refresh endpoint
    {
      let refreshCalledWith: string | null = null;
      UnifiedMusicDNAService.refreshAfterInteraction = async (userId: string, opts?: any) => {
        refreshCalledWith = userId;
        return {
          refreshed: true,
          reason: 'Forced refresh request',
          profile: sampleProfile,
        } as any;
      };

      const req: any = {
        user: { _id: '507f1f77bcf86cd799439011' },
        query: {},
      };
      const res = createMockResponse();

      await refreshMusicDNAProfile(req, res as any);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(refreshCalledWith, '507f1f77bcf86cd799439011');
      assert.strictEqual(res.jsonData?.data?.refreshed, true);

      console.log('  ✓ Test 6 Passed: Music DNA refresh endpoint triggers refresh and returns result');
    }
  } finally {
    UnifiedMusicDNAService.getOrGenerateProfile = originalGetOrGenerate;
    UnifiedMusicDNAService.refreshAfterInteraction = originalRefresh;
  }

  console.log('[Music DNA API Endpoint Test Suite] All tests passed!\n');
}

if (process.argv[1]?.includes('musicDnaEndpoint.test')) {
  runMusicDnaEndpointTests().catch((err) => {
    console.error('Test suite failed:', err);
    process.exit(1);
  });
}
