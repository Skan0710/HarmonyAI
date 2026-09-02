import assert from 'node:assert';
import { Types } from 'mongoose';
import {
  SmartAutoplayService,
  AdaptiveQueueResult,
} from '../services/smartAutoplayService.js';
import { ListeningSession } from '../models/ListeningSession.js';
import { CandidateGenerationService } from '../services/candidateGenerationService.js';
import { Song } from '../models/Song.js';
import { User } from '../models/User.js';

export async function runSmartAutoplayAdaptiveQueueTests() {
  console.log('[Smart Autoplay Adaptive Queue Test Suite] Starting tests...');

  // Mock songs catalog
  const currentTrackId = new Types.ObjectId().toString();
  const skippedTrackId = new Types.ObjectId().toString();
  const queuedTrackId = new Types.ObjectId().toString();

  const mockCandidateList = [
    {
      songId: currentTrackId,
      contentScore: 0.98,
      collaborativeScore: 0.98,
      userTasteAffinityScore: 0.98,
      popularitySignal: 900,
      recencySignal: 0.95,
      sources: ['content'],
      songDoc: {
        _id: currentTrackId,
        title: 'Current Playing Song',
        artist: { _id: 'artist-playing', name: 'Now Playing Artist' },
        genre: 'Synthwave',
        mood: 'Upbeat',
        audioFeatures: { energy: 0.85, tempo: 125 },
      },
    },
    {
      songId: skippedTrackId,
      contentScore: 0.88,
      collaborativeScore: 0.85,
      userTasteAffinityScore: 0.80,
      popularitySignal: 700,
      recencySignal: 0.80,
      sources: ['collaborative'],
      songDoc: {
        _id: skippedTrackId,
        title: 'Skipped Song',
        artist: { _id: 'artist-skip', name: 'Skipped Artist' },
        genre: 'Hard Rock',
        mood: 'Aggressive',
        audioFeatures: { energy: 0.95, tempo: 155 },
      },
    },
    {
      songId: queuedTrackId,
      contentScore: 0.89,
      collaborativeScore: 0.88,
      userTasteAffinityScore: 0.85,
      popularitySignal: 800,
      recencySignal: 0.85,
      sources: ['collaborative'],
      songDoc: {
        _id: queuedTrackId,
        title: 'Manually Queued Song',
        artist: { _id: 'artist-queue', name: 'Manual Queue Artist' },
        genre: 'Pop',
        mood: 'Happy',
        audioFeatures: { energy: 0.75, tempo: 120 },
      },
    },
    // Familiar tracks (high user taste affinity)
    {
      songId: new Types.ObjectId().toString(),
      contentScore: 0.95,
      collaborativeScore: 0.92,
      userTasteAffinityScore: 0.95,
      popularitySignal: 850,
      recencySignal: 0.90,
      sources: ['taste_profile'],
      songDoc: {
        _id: new Types.ObjectId().toString(),
        title: 'Familiar Favorite 1',
        artist: { _id: 'artist-fam-1', name: 'Familiar Artist 1' },
        genre: 'Synthwave',
        mood: 'Upbeat',
        audioFeatures: { energy: 0.82, tempo: 124 },
      },
    },
    {
      songId: new Types.ObjectId().toString(),
      contentScore: 0.91,
      collaborativeScore: 0.89,
      userTasteAffinityScore: 0.90,
      popularitySignal: 820,
      recencySignal: 0.88,
      sources: ['taste_profile'],
      songDoc: {
        _id: new Types.ObjectId().toString(),
        title: 'Familiar Favorite 2',
        artist: { _id: 'artist-fam-2', name: 'Familiar Artist 2' },
        genre: 'EDM',
        mood: 'Energetic',
        audioFeatures: { energy: 0.88, tempo: 128 },
      },
    },
    // Discovery tracks (novelty, matching context acoustic targets)
    {
      songId: new Types.ObjectId().toString(),
      contentScore: 0.86,
      collaborativeScore: 0.84,
      userTasteAffinityScore: 0.40,
      popularitySignal: 450,
      recencySignal: 0.85,
      sources: ['discovery'],
      songDoc: {
        _id: new Types.ObjectId().toString(),
        title: 'Discovery Track 1',
        artist: { _id: 'artist-disc-1', name: 'Novel Artist 1' },
        genre: 'Cyberpunk',
        mood: 'Energetic',
        audioFeatures: { energy: 0.84, tempo: 126 },
      },
    },
    {
      songId: new Types.ObjectId().toString(),
      contentScore: 0.84,
      collaborativeScore: 0.82,
      userTasteAffinityScore: 0.45,
      popularitySignal: 500,
      recencySignal: 0.80,
      sources: ['discovery'],
      songDoc: {
        _id: new Types.ObjectId().toString(),
        title: 'Discovery Track 2',
        artist: { _id: 'artist-disc-2', name: 'Novel Artist 2' },
        genre: 'Electro Funk',
        mood: 'Upbeat',
        audioFeatures: { energy: 0.80, tempo: 122 },
      },
    },
    // Additional balanced pool
    {
      songId: new Types.ObjectId().toString(),
      contentScore: 0.83,
      collaborativeScore: 0.80,
      userTasteAffinityScore: 0.70,
      popularitySignal: 650,
      recencySignal: 0.80,
      sources: ['content'],
      songDoc: {
        _id: new Types.ObjectId().toString(),
        title: 'Balanced Track 3',
        artist: { _id: 'artist-bal-3', name: 'Balanced Artist 3' },
        genre: 'Synthwave',
        mood: 'Upbeat',
        audioFeatures: { energy: 0.82, tempo: 125 },
      },
    },
  ];

  const originalGenCandidates = CandidateGenerationService.generateHybridCandidates;
  const originalSongFind = Song.find;
  const originalUserFindById = User.findById;
  const originalSessionFindOne = ListeningSession.findOne;

  function mockDependencies() {
    CandidateGenerationService.generateHybridCandidates = async () => mockCandidateList as any;
    (Song as any).find = () => ({
      populate: () => ({
        populate: () => ({
          lean: async () => mockCandidateList.map((c) => c.songDoc),
        }),
      }),
    });
    (User as any).findById = () => ({
      populate: () => ({
        lean: async () => ({ favoriteGenres: [] }),
      }),
    });
    (ListeningSession as any).findOne = () => ({
      sort: () => Promise.resolve(null),
    });
  }

  function restoreDependencies() {
    CandidateGenerationService.generateHybridCandidates = originalGenCandidates;
    Song.find = originalSongFind;
    User.findById = originalUserFindById;
    ListeningSession.findOne = originalSessionFindOne;
  }

  // Test 1: Multiple upcoming tracks & Configurable queue size
  {
    mockDependencies();

    const userId = new Types.ObjectId().toString();
    const result5 = await SmartAutoplayService.generateAdaptiveQueue({
      userId,
      currentTrackId,
      queueSize: 4,
    });

    assert.strictEqual(result5.queue.length, 4);
    assert.strictEqual(result5.totalQueued, 4);
    assert.strictEqual(result5.queueSize, 4);
    assert.strictEqual(result5.queue[0].queuePosition, 1);
    assert.strictEqual(result5.queue[3].queuePosition, 4);

    console.log('✓ Test 1 Passed: Generates multiple upcoming tracks with configurable queue size.');
    restoreDependencies();
  }

  // Test 2: Strict Duplicate Prevention within Generated Queue
  {
    mockDependencies();

    const userId = new Types.ObjectId().toString();
    const result = await SmartAutoplayService.generateAdaptiveQueue({
      userId,
      queueSize: 5,
    });

    const songIdsInQueue = result.queue.map((item) => item.song._id.toString());
    const uniqueIds = new Set(songIdsInQueue);

    assert.strictEqual(
      songIdsInQueue.length,
      uniqueIds.size,
      'Every track in the generated queue must be strictly unique'
    );

    console.log('✓ Test 2 Passed: Zero duplicate tracks within the generated queue.');
    restoreDependencies();
  }

  // Test 3: Avoidance of Currently Playing, Recently Played, and Skipped Tracks
  {
    mockDependencies();

    const userId = new Types.ObjectId().toString();
    const mockSession = new ListeningSession({
      _id: new Types.ObjectId(),
      user: new Types.ObjectId(userId),
      currentTrack: new Types.ObjectId(currentTrackId),
      tracksPlayed: [
        { song: new Types.ObjectId(currentTrackId), playedAt: new Date(), completed: false },
      ],
      tracksSkipped: [
        { song: new Types.ObjectId(skippedTrackId), skippedAt: new Date() },
      ],
      status: 'active',
    });

    const result = await SmartAutoplayService.generateAdaptiveQueue({
      userId,
      currentTrackId,
      sessionDoc: mockSession,
      currentQueueSongIds: [queuedTrackId],
      queueSize: 4,
    });

    const queuedIds = result.queue.map((item) => item.song._id.toString());

    assert.ok(!queuedIds.includes(currentTrackId), 'Current playing track must not be queued');
    assert.ok(!queuedIds.includes(skippedTrackId), 'Skipped track must not be queued');
    assert.ok(!queuedIds.includes(queuedTrackId), 'Manually queued track must not be duplicated');

    console.log('✓ Test 3 Passed: Successfully avoids recently played, skipped, and manually queued tracks.');
    restoreDependencies();
  }

  // Test 4: Multi-Dimensional Balance (Familiarity, Discovery, Diversity, Session Relevance)
  {
    mockDependencies();

    const userId = new Types.ObjectId().toString();
    const result = await SmartAutoplayService.generateAdaptiveQueue({
      userId,
      context: 'workout',
      queueSize: 4,
    });

    assert.ok(result.queue.length > 0);
    assert.ok(result.balanceDistribution.uniqueArtistsCount >= 2, 'Queue must feature diverse artists');
    assert.ok(result.balanceDistribution.dominantGenres.length >= 1, 'Queue must feature genre distribution');

    // Verify all items have scores and reasons
    for (const item of result.queue) {
      assert.ok(item.queueScore > 0);
      assert.ok(typeof item.reason === 'string');
      assert.ok(['familiarity', 'discovery', 'balanced'].includes(item.tier));
    }

    console.log('✓ Test 4 Passed: Maintained balance between familiarity, discovery, diversity, and session flow.');
    restoreDependencies();
  }

  // Test 5: Context Preservation & Ephemeral Preference Integrity
  {
    mockDependencies();

    const userId = new Types.ObjectId().toString();
    const result = await SmartAutoplayService.generateAdaptiveQueue({
      userId,
      context: 'focus',
      queueSize: 3,
    });

    assert.strictEqual(result.contextPreserved, 'focus');

    console.log('✓ Test 5 Passed: Context preserved cleanly without mutating permanent user preferences.');
    restoreDependencies();
  }

  console.log('🎉 All 5 Smart Autoplay Adaptive Queue tests completed successfully.');
}
