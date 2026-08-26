import assert from 'node:assert';
import { Types } from 'mongoose';
import { getRecommendationExplanation } from '../controllers/recommendationController.js';
import { Song } from '../models/Song.js';
import { User } from '../models/User.js';
import { ListeningSession } from '../models/ListeningSession.js';
import { RecommendationInteraction } from '../models/RecommendationInteraction.js';
import { UserTasteProfileService } from '../services/userTasteProfileService.js';

export async function runRecommendationExplanationEndpointTests() {
  console.log('[Recommendation Explanation Endpoint Test Suite] Starting tests...');

  // Mock Request & Response Factory
  function createMockReqRes(params: {
    user?: any;
    params?: any;
    query?: any;
    body?: any;
  }) {
    const req: any = {
      user: params.user,
      params: params.params || {},
      query: params.query || {},
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

  // Test 1: Reject Invalid Song ID with 400
  {
    const { req, res } = createMockReqRes({
      user: { _id: new Types.ObjectId(), email: 'tester@test.com' },
      params: { songId: 'invalid-hex-id' },
    });

    await getRecommendationExplanation(req, res);
    assert.strictEqual(res.getStatusCode(), 400);
    assert.ok(res.getJson().message.includes('Invalid song ID'));
    console.log('✓ Test 1 Passed: Invalid song ID rejected with 400.');
  }

  // Test 2: Return 404 for Non-Existent Song
  {
    const nonExistentId = new Types.ObjectId().toString();
    const originalFindById = Song.findById;

    (Song as any).findById = (id: any) => ({
      populate: () => ({
        populate: () => ({
          lean: async () => null,
        }),
      }),
    });

    const { req, res } = createMockReqRes({
      user: { _id: new Types.ObjectId(), email: 'tester@test.com' },
      params: { songId: nonExistentId },
    });

    try {
      await getRecommendationExplanation(req, res);
      assert.strictEqual(res.getStatusCode(), 404);
      assert.ok(res.getJson().message.includes('Song not found'));
      console.log('✓ Test 2 Passed: Non-existent song returns 404.');
    } finally {
      Song.findById = originalFindById;
    }
  }

  // Test 3: Valid Recommended Song Explanation
  {
    const mockSongId = new Types.ObjectId();
    const mockUserId = new Types.ObjectId();
    const mockArtistId = new Types.ObjectId();
    const mockGenreId = new Types.ObjectId();

    const mockSong = {
      _id: mockSongId,
      title: 'Midnight Resonance',
      artist: { _id: mockArtistId, name: 'Kavinsky' },
      genre: { _id: mockGenreId, name: 'Synthwave' },
      duration: 240,
      playCount: 15000,
      audioFeatures: { energy: 0.85, tempo: 128, danceability: 0.75 },
      mood: 'Driving',
    };

    const originalSongFindById = Song.findById;
    const originalTasteProfile = UserTasteProfileService.generateTasteProfile;
    const originalSessionFindOne = ListeningSession.findOne;
    const originalInteractionFind = RecommendationInteraction.find;
    const originalUserFindById = User.findById;

    (Song as any).findById = () => ({
      populate: () => ({
        populate: () => ({
          lean: async () => mockSong,
        }),
      }),
    });

    (UserTasteProfileService as any).generateTasteProfile = async () => ({
      userId: mockUserId.toString(),
      combinedGenres: [{ name: 'Synthwave', affinityScore: 0.92 }],
      combinedArtists: [{ name: 'Kavinsky', affinityScore: 0.88 }],
    });

    (ListeningSession as any).findOne = () => ({
      lean: async () => ({
        status: 'active',
        contextSnapshot: {
          mood: 'Driving',
          energyLevel: 0.80,
        },
      }),
    });

    (RecommendationInteraction as any).find = () => ({
      sort: () => ({
        limit: () => ({
          lean: async () => [{ recommendationSource: 'hybrid', action: 'impression' }],
        }),
      }),
    });

    (User as any).findById = () => ({
      select: () => ({
        populate: () => ({
          lean: async () => ({
            likedSongs: [
              {
                title: 'Nightcall',
                artist: { name: 'Kavinsky' },
                audioFeatures: { energy: 0.82, tempo: 125 },
              },
            ],
          }),
        }),
      }),
    });

    const { req, res } = createMockReqRes({
      user: { _id: mockUserId, email: 'tester@test.com' },
      params: { songId: mockSongId.toString() },
    });

    try {
      await getRecommendationExplanation(req, res);
      assert.strictEqual(res.getStatusCode(), 200);
      const data = res.getJson().data;

      assert.strictEqual(data.isCurrentlyRecommended, true);
      assert.strictEqual(data.song.title, 'Midnight Resonance');
      assert.ok(data.recommendationScore > 0);
      assert.ok(data.primaryExplanation.length > 0);
      assert.ok(Array.isArray(data.topReasons) && data.topReasons.length > 0);
      assert.ok(data.contributingSignals.genreAffinity >= 0.90);
      assert.ok(data.contributingSignals.artistAffinity >= 0.85);
      assert.ok(data.summary.length > 0);
      assert.ok(data.confidenceScore > 0);

      console.log('✓ Test 3 Passed: Valid recommended song explanation structure verified.');
    } finally {
      Song.findById = originalSongFindById;
      UserTasteProfileService.generateTasteProfile = originalTasteProfile;
      ListeningSession.findOne = originalSessionFindOne;
      RecommendationInteraction.find = originalInteractionFind;
      User.findById = originalUserFindById;
    }
  }

  // Test 4: Graceful Handling for Songs Not Currently Recommended
  {
    const mockSongId = new Types.ObjectId();
    const mockUserId = new Types.ObjectId();

    const mockUnrecommendedSong = {
      _id: mockSongId,
      title: 'Unrelated Opera Track',
      artist: { name: 'Classical Ensemble' },
      genre: { name: 'Opera' },
      playCount: 10,
    };

    const originalSongFindById = Song.findById;
    const originalTasteProfile = UserTasteProfileService.generateTasteProfile;
    const originalSessionFindOne = ListeningSession.findOne;
    const originalInteractionFind = RecommendationInteraction.find;
    const originalUserFindById = User.findById;

    (Song as any).findById = () => ({
      populate: () => ({
        populate: () => ({
          lean: async () => mockUnrecommendedSong,
        }),
      }),
    });

    (UserTasteProfileService as any).generateTasteProfile = async () => ({
      userId: mockUserId.toString(),
      combinedGenres: [{ name: 'Synthwave', affinityScore: 0.95 }],
      combinedArtists: [{ name: 'Daft Punk', affinityScore: 0.90 }],
    });

    (ListeningSession as any).findOne = () => ({
      lean: async () => null,
    });

    (RecommendationInteraction as any).find = () => ({
      sort: () => ({
        limit: () => ({
          lean: async () => [],
        }),
      }),
    });

    (User as any).findById = () => ({
      select: () => ({
        populate: () => ({
          lean: async () => ({ likedSongs: [] }),
        }),
      }),
    });

    const { req, res } = createMockReqRes({
      user: { _id: mockUserId, email: 'tester@test.com' },
      params: { songId: mockSongId.toString() },
    });

    try {
      await getRecommendationExplanation(req, res);
      assert.strictEqual(res.getStatusCode(), 200);
      const data = res.getJson().data;

      assert.strictEqual(data.isCurrentlyRecommended, false);
      assert.strictEqual(data.topReasons.length, 0);
      assert.ok(data.primaryExplanation.includes('not currently in your active recommendations'));

      console.log('✓ Test 4 Passed: Unrecommended song handled gracefully without errors.');
    } finally {
      Song.findById = originalSongFindById;
      UserTasteProfileService.generateTasteProfile = originalTasteProfile;
      ListeningSession.findOne = originalSessionFindOne;
      RecommendationInteraction.find = originalInteractionFind;
      User.findById = originalUserFindById;
    }
  }

  console.log('🎉 All 4 recommendation explanation endpoint tests completed successfully.');
}
