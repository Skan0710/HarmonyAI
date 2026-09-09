import assert from 'node:assert';
import { Types } from 'mongoose';
import { Song } from '../models/Song.js';
import { User } from '../models/User.js';
import { ListeningHistory } from '../models/ListeningHistory.js';
import { ListeningSession } from '../models/ListeningSession.js';
import { RecommendationInteraction } from '../models/RecommendationInteraction.js';
import { Playlist } from '../models/Playlist.js';
import { Album } from '../models/Album.js';
import { MusicDNA } from '../models/MusicDNA.js';
import { PersonalMusicTwin } from '../models/PersonalMusicTwin.js';
import { TrendingService } from '../services/trendingService.js';
import { UserSongInteractionMatrixService } from '../services/interactionMatrixService.js';
import { HistoryService } from '../services/historyService.js';
import { PlaylistService } from '../services/playlistService.js';

export async function runDatabaseIntegrityAndPerformanceTests() {
  console.log('[Database Integrity & Performance Test Suite] Starting tests...\n');

  // Helper to check if an index with given keys exists on a schema
  const hasSchemaIndex = (schema: any, keyPattern: Record<string, any>): boolean => {
    const indexes = schema.indexes();
    return indexes.some(([fields]: [Record<string, any>, any]) => {
      const fieldKeys = Object.keys(fields);
      const targetKeys = Object.keys(keyPattern);
      if (fieldKeys.length !== targetKeys.length) return false;
      return fieldKeys.every((k) => fields[k] === keyPattern[k]);
    });
  };

  // =========================================================================
  // Test 1: Song Model Index & Schema Integrity
  // =========================================================================
  {
    console.log('--- Test 1: Song Model Compound Indexes & Schema Integrity ---');
    assert.ok(hasSchemaIndex(Song.schema, { isPublished: 1, playCount: -1 }), 'Missing index: { isPublished: 1, playCount: -1 }');
    assert.ok(hasSchemaIndex(Song.schema, { isPublished: 1, createdAt: -1 }), 'Missing index: { isPublished: 1, createdAt: -1 }');
    assert.ok(hasSchemaIndex(Song.schema, { isPublished: 1, genre: 1, playCount: -1 }), 'Missing index: { isPublished: 1, genre: 1, playCount: -1 }');
    assert.ok(hasSchemaIndex(Song.schema, { isPublished: 1, artist: 1 }), 'Missing index: { isPublished: 1, artist: 1 }');
    assert.ok(hasSchemaIndex(Song.schema, { releaseYear: -1, createdAt: -1 }), 'Missing index: { releaseYear: -1, createdAt: -1 }');

    // Reference validation
    const artistPath: any = Song.schema.path('artist');
    const genrePath: any = Song.schema.path('genre');
    assert.strictEqual(artistPath.options.ref, 'Artist', 'Song artist must reference Artist model');
    assert.strictEqual(genrePath.options.ref, 'Genre', 'Song genre must reference Genre model');

    console.log('✓ Test 1 Passed: Song model indexes and references verified.');
  }

  // =========================================================================
  // Test 2: ListeningHistory Model Index & Schema Integrity
  // =========================================================================
  {
    console.log('--- Test 2: ListeningHistory Model Compound Indexes & Schema Integrity ---');
    assert.ok(hasSchemaIndex(ListeningHistory.schema, { user: 1, playedAt: -1 }), 'Missing index: { user: 1, playedAt: -1 }');
    assert.ok(hasSchemaIndex(ListeningHistory.schema, { user: 1, song: 1, playedAt: -1 }), 'Missing index: { user: 1, song: 1, playedAt: -1 }');
    assert.ok(hasSchemaIndex(ListeningHistory.schema, { user: 1, skipped: 1, playedAt: -1 }), 'Missing index: { user: 1, skipped: 1, playedAt: -1 }');
    assert.ok(hasSchemaIndex(ListeningHistory.schema, { song: 1, playedAt: -1 }), 'Missing index: { song: 1, playedAt: -1 }');

    const userPath: any = ListeningHistory.schema.path('user');
    const songPath: any = ListeningHistory.schema.path('song');
    assert.strictEqual(userPath.options.ref, 'User', 'ListeningHistory user must reference User model');
    assert.strictEqual(songPath.options.ref, 'Song', 'ListeningHistory song must reference Song model');

    console.log('✓ Test 2 Passed: ListeningHistory model compound indexes and references verified.');
  }

  // =========================================================================
  // Test 3: ListeningSession Model Index & Optimization Integrity
  // =========================================================================
  {
    console.log('--- Test 3: ListeningSession Model Compound Indexes ---');
    assert.ok(
      hasSchemaIndex(ListeningSession.schema, { user: 1, status: 1, lastActivityTime: -1 }),
      'Missing index: { user: 1, status: 1, lastActivityTime: -1 }'
    );
    assert.ok(
      hasSchemaIndex(ListeningSession.schema, { user: 1, status: 1 }),
      'Missing index: { user: 1, status: 1 }'
    );

    console.log('✓ Test 3 Passed: ListeningSession active session compound indexes verified.');
  }

  // =========================================================================
  // Test 4: RecommendationInteraction Model Index & Integrity
  // =========================================================================
  {
    console.log('--- Test 4: RecommendationInteraction Model Compound Indexes ---');
    assert.ok(
      hasSchemaIndex(RecommendationInteraction.schema, { user: 1, timestamp: -1 }),
      'Missing index: { user: 1, timestamp: -1 }'
    );
    assert.ok(
      hasSchemaIndex(RecommendationInteraction.schema, { song: 1, action: 1, timestamp: -1 }),
      'Missing index: { song: 1, action: 1, timestamp: -1 }'
    );
    assert.ok(
      hasSchemaIndex(RecommendationInteraction.schema, { user: 1, action: 1, timestamp: -1 }),
      'Missing index: { user: 1, action: 1, timestamp: -1 }'
    );

    console.log('✓ Test 4 Passed: RecommendationInteraction indexes verified.');
  }

  // =========================================================================
  // Test 5: Playlist & Album Model Index & Reference Integrity
  // =========================================================================
  {
    console.log('--- Test 5: Playlist and Album Model Compound Indexes ---');
    assert.ok(hasSchemaIndex(Playlist.schema, { owner: 1, updatedAt: -1 }), 'Missing index: { owner: 1, updatedAt: -1 }');
    assert.ok(hasSchemaIndex(Playlist.schema, { collaborators: 1, updatedAt: -1 }), 'Missing index: { collaborators: 1, updatedAt: -1 }');
    assert.ok(hasSchemaIndex(Playlist.schema, { visibility: 1, createdAt: -1 }), 'Missing index: { visibility: 1, createdAt: -1 }');

    assert.ok(hasSchemaIndex(Album.schema, { releaseYear: -1, createdAt: -1 }), 'Missing index: { releaseYear: -1, createdAt: -1 }');
    assert.ok(hasSchemaIndex(Album.schema, { artist: 1, releaseYear: -1 }), 'Missing index: { artist: 1, releaseYear: -1 }');

    console.log('✓ Test 5 Passed: Playlist and Album indexes verified.');
  }

  // =========================================================================
  // Test 6: User Model Schema & Index Integrity
  // =========================================================================
  {
    console.log('--- Test 6: User Model Schema & Index Integrity ---');
    assert.ok(hasSchemaIndex(User.schema, { createdAt: -1 }), 'Missing index: { createdAt: -1 }');

    const emailPath: any = User.schema.path('email');
    assert.strictEqual(emailPath.options.unique, true, 'User email must be unique');
    assert.strictEqual(emailPath.options.required[0], true, 'User email must be required');

    const musicDnaUserPath: any = MusicDNA.schema.path('userId');
    assert.strictEqual(musicDnaUserPath.options.unique, true, 'MusicDNA userId must be unique');

    const twinUserPath: any = PersonalMusicTwin.schema.path('userId');
    assert.strictEqual(twinUserPath.options.unique, true, 'PersonalMusicTwin userId must be unique');

    console.log('✓ Test 6 Passed: User model and profile unique constraints verified.');
  }

  // =========================================================================
  // Test 7: Interaction Matrix Query Efficiency (Single-Pass User Query)
  // =========================================================================
  {
    console.log('--- Test 7: Interaction Matrix Single-Pass User Loading ---');
    let userFindCallCount = 0;
    const originalUserFind = User.find;
    const originalSongFind = Song.find;
    const originalHistoryFind = ListeningHistory.find;

    const mockUserId = new Types.ObjectId().toString();
    const mockSongId = new Types.ObjectId().toString();

    (User as any).find = () => {
      userFindCallCount++;
      return {
        select: () => ({
          lean: async () => [{ _id: new Types.ObjectId(mockUserId), likedSongs: [new Types.ObjectId(mockSongId)] }],
        }),
      };
    };

    (Song as any).find = () => ({
      select: () => ({
        lean: async () => [{ _id: new Types.ObjectId(mockSongId) }],
      }),
    });

    (ListeningHistory as any).find = () => ({
      select: () => ({
        lean: async () => [],
      }),
    });

    try {
      const matrix = await UserSongInteractionMatrixService.buildInteractionMatrix();
      assert.strictEqual(userFindCallCount, 1, 'buildInteractionMatrix must query User collection exactly once when userIds is not passed');
      assert.strictEqual(matrix.userIds.length, 1, 'Sparse matrix must reflect users loaded');
      assert.strictEqual(matrix.songIds.length, 1, 'Sparse matrix must reflect songs loaded');
      console.log('✓ Test 7 Passed: Interaction Matrix operates with single-pass user fetching.');
    } finally {
      User.find = originalUserFind;
      Song.find = originalSongFind;
      ListeningHistory.find = originalHistoryFind;
    }
  }

  // =========================================================================
  // Test 8: Trending Service Bounded Query Execution
  // =========================================================================
  {
    console.log('--- Test 8: Trending Service Bounded Query Execution ---');
    const originalHistoryFind = ListeningHistory.find;
    const originalSongFind = Song.find;

    let queriedLimit = 0;
    const mockSong1 = { _id: new Types.ObjectId(), playCount: 50, title: 'Hit 1' };
    const mockSong2 = { _id: new Types.ObjectId(), playCount: 20, title: 'Hit 2' };

    (ListeningHistory as any).find = () => ({
      select: () => ({
        lean: async () => [
          { song: mockSong1._id, playedAt: new Date() },
        ],
      }),
    });

    (Song as any).find = (query: any) => ({
      populate: () => ({
        populate: () => ({
          populate: () => ({
            sort: () => ({
              limit: (lim: number) => {
                queriedLimit = lim;
                return {
                  lean: async () => [mockSong1, mockSong2],
                };
              },
            }),
          }),
        }),
      }),
    });

    try {
      const results = await TrendingService.getTrendingSongs(10);
      assert.ok(queriedLimit > 0, 'Song catalog query must enforce an explicit limit');
      assert.ok(queriedLimit <= 100, `Song limit ${queriedLimit} must be safely bounded`);
      assert.ok(results.length > 0, 'Trending songs must return scored candidates');
      assert.ok(results[0].trendingScore !== undefined, 'Trending songs must have computed trendingScore');
      console.log('✓ Test 8 Passed: Trending service operates with safely bounded catalog queries.');
    } finally {
      ListeningHistory.find = originalHistoryFind;
      Song.find = originalSongFind;
    }
  }

  // =========================================================================
  // Test 9: Safe Playback Recording & Deduplication (HistoryService)
  // =========================================================================
  {
    console.log('--- Test 9: Safe Playback Recording & Deduplication ---');
    const originalExists = Song.exists;
    const originalFindOne = ListeningHistory.findOne;
    const originalCreate = ListeningHistory.create;

    const mockUserId = new Types.ObjectId().toString();
    const mockSongId = new Types.ObjectId().toString();
    let savedTimestamp = false;
    let createdNewRecord = false;

    (Song as any).exists = async () => true;

    // Case A: Recent record exists within cooldown -> updates playedAt
    (ListeningHistory as any).findOne = async () => ({
      playedAt: new Date(Date.now() - 30 * 1000),
      save: async function () {
        savedTimestamp = true;
        return this;
      },
    });

    await HistoryService.recordPlayback(mockUserId, mockSongId);
    assert.strictEqual(savedTimestamp, true, 'Recent playback within cooldown must update timestamp without creating duplicate record');

    // Case B: No recent record -> creates new history record
    (ListeningHistory as any).findOne = async () => null;
    (ListeningHistory as any).create = async (doc: any) => {
      createdNewRecord = true;
      return doc;
    };

    await HistoryService.recordPlayback(mockUserId, mockSongId);
    assert.strictEqual(createdNewRecord, true, 'New playback outside cooldown must create a new record');

    Song.exists = originalExists;
    ListeningHistory.findOne = originalFindOne;
    ListeningHistory.create = originalCreate;

    console.log('✓ Test 9 Passed: Playback recording deduplication and cooldown handling verified.');
  }

  // =========================================================================
  // Test 10: Safe Atomic Playlist Modification ($addToSet / $pull)
  // =========================================================================
  {
    console.log('--- Test 10: Safe Atomic Playlist Operations ---');
    const originalFindById = Playlist.findById;
    const originalFindByIdAndUpdate = Playlist.findByIdAndUpdate;
    const originalSongExists = Song.exists;

    const mockPlaylistId = new Types.ObjectId().toString();
    const mockUserId = new Types.ObjectId().toString();
    const mockSongId = new Types.ObjectId().toString();
    let capturedUpdateOp: any = null;

    (Song as any).exists = async () => true;
    (Playlist as any).findById = async () => ({
      _id: new Types.ObjectId(mockPlaylistId),
      owner: new Types.ObjectId(mockUserId),
      collaborators: [],
      isCollaborative: false,
    });

    (Playlist as any).findByIdAndUpdate = (id: any, update: any) => {
      capturedUpdateOp = update;
      return {
        populate: () => ({
          populate: () => ({
            lean: async () => ({ _id: id, songs: [mockSongId] }),
          }),
        }),
      };
    };

    try {
      await PlaylistService.addSongToPlaylist(mockPlaylistId, mockUserId, mockSongId);
      assert.ok(capturedUpdateOp?.$addToSet, 'addSongToPlaylist must use $addToSet to prevent duplicate song entries');
      assert.strictEqual(capturedUpdateOp.$addToSet.songs, mockSongId, 'Target songId must be added via $addToSet');

      capturedUpdateOp = null;
      await PlaylistService.removeSongFromPlaylist(mockPlaylistId, mockUserId, mockSongId);
      assert.ok(capturedUpdateOp?.$pull, 'removeSongFromPlaylist must use $pull for atomic removal');
      assert.strictEqual(capturedUpdateOp.$pull.songs, mockSongId, 'Target songId must be removed via $pull');

      console.log('✓ Test 10 Passed: Playlist modifications use safe atomic $addToSet and $pull operations.');
    } finally {
      Playlist.findById = originalFindById;
      Playlist.findByIdAndUpdate = originalFindByIdAndUpdate;
      Song.exists = originalSongExists;
    }
  }

  console.log('[Database Integrity & Performance Test Suite] All 10 tests passed successfully! 🎉\n');
}
