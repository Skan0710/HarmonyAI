import assert from 'node:assert';
import { Types } from 'mongoose';
import {
  SmartAutoplayService,
  AutoplayCandidateResult,
} from '../services/smartAutoplayService.js';
import { ListeningSession } from '../models/ListeningSession.js';
import { CandidateGenerationService } from '../services/candidateGenerationService.js';
import { Song } from '../models/Song.js';
import { User } from '../models/User.js';

export async function runSmartAutoplayServiceTests() {
  console.log('[Smart Autoplay Service Test Suite] Starting tests...');

  // Mock songs
  const currentSongId = new Types.ObjectId().toString();
  const skippedSongId = new Types.ObjectId().toString();
  const queuedSongId = new Types.ObjectId().toString();
  const candidateSong1 = new Types.ObjectId().toString();
  const candidateSong2 = new Types.ObjectId().toString();
  const candidateSong3 = new Types.ObjectId().toString();

  const mockCandidatePool = [
    {
      songId: currentSongId,
      contentScore: 0.99,
      collaborativeScore: 0.99,
      userTasteAffinityScore: 0.99,
      popularitySignal: 990,
      recencySignal: 0.99,
      sources: ['content'],
      songDoc: {
        _id: currentSongId,
        title: 'Current Playing Track',
        artist: { _id: 'artist-current', name: 'Current Artist' },
        genre: 'EDM',
        mood: 'Energetic',
        audioFeatures: { energy: 0.90, tempo: 130 },
      },
    },
    {
      songId: skippedSongId,
      contentScore: 0.85,
      collaborativeScore: 0.80,
      userTasteAffinityScore: 0.80,
      popularitySignal: 800,
      recencySignal: 0.80,
      sources: ['content'],
      songDoc: {
        _id: skippedSongId,
        title: 'Skipped Track',
        artist: { _id: 'artist-skip', name: 'Skip Artist' },
        genre: 'Rock',
        mood: 'Aggressive',
        audioFeatures: { energy: 0.95, tempo: 150 },
      },
    },
    {
      songId: queuedSongId,
      contentScore: 0.88,
      collaborativeScore: 0.85,
      userTasteAffinityScore: 0.85,
      popularitySignal: 850,
      recencySignal: 0.85,
      sources: ['collaborative'],
      songDoc: {
        _id: queuedSongId,
        title: 'Manually Queued Track',
        artist: { _id: 'artist-queue', name: 'Queue Artist' },
        genre: 'Pop',
        mood: 'Happy',
        audioFeatures: { energy: 0.75, tempo: 120 },
      },
    },
    {
      songId: candidateSong1,
      contentScore: 0.92,
      collaborativeScore: 0.88,
      userTasteAffinityScore: 0.90,
      popularitySignal: 900,
      recencySignal: 0.90,
      sources: ['taste_profile'],
      songDoc: {
        _id: candidateSong1,
        title: 'Top Autoplay Candidate 1',
        artist: { _id: 'artist-1', name: 'Great Artist 1' },
        genre: 'EDM',
        mood: 'Energetic',
        audioFeatures: { energy: 0.88, tempo: 128 },
      },
    },
    {
      songId: candidateSong2,
      contentScore: 0.86,
      collaborativeScore: 0.82,
      userTasteAffinityScore: 0.85,
      popularitySignal: 750,
      recencySignal: 0.85,
      sources: ['collaborative'],
      songDoc: {
        _id: candidateSong2,
        title: 'Top Autoplay Candidate 2',
        artist: { _id: 'artist-2', name: 'Great Artist 2' },
        genre: 'Synthwave',
        mood: 'Upbeat',
        audioFeatures: { energy: 0.80, tempo: 124 },
      },
    },
    {
      songId: candidateSong3,
      contentScore: 0.80,
      collaborativeScore: 0.78,
      userTasteAffinityScore: 0.80,
      popularitySignal: 700,
      recencySignal: 0.80,
      sources: ['content'],
      songDoc: {
        _id: candidateSong3,
        title: 'Top Autoplay Candidate 3',
        artist: { _id: 'artist-1', name: 'Great Artist 1' }, // Same artist as 1
        genre: 'EDM',
        mood: 'Energetic',
        audioFeatures: { energy: 0.85, tempo: 128 },
      },
    },
  ];

  const originalGenCandidates = CandidateGenerationService.generateHybridCandidates;
  const originalSongFind = Song.find;
  const originalUserFindById = User.findById;
  const originalSessionFindOne = ListeningSession.findOne;

  function mockDependencies() {
    CandidateGenerationService.generateHybridCandidates = async () => mockCandidatePool as any;
    (Song as any).find = () => ({
      populate: () => ({
        populate: () => ({
          lean: async () => mockCandidatePool.map((c) => c.songDoc),
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

  // Test 1: Immediate Repeat Prevention & Skipped/Queued Song Avoidance
  {
    mockDependencies();

    const userId = new Types.ObjectId().toString();
    const mockSession = new ListeningSession({
      _id: new Types.ObjectId(),
      user: new Types.ObjectId(userId),
      currentTrack: new Types.ObjectId(currentSongId),
      tracksPlayed: [{ song: new Types.ObjectId(currentSongId), playedAt: new Date(), completed: false }],
      tracksSkipped: [{ song: new Types.ObjectId(skippedSongId), skippedAt: new Date() }],
      status: 'active',
    });

    const res = await SmartAutoplayService.generateAutoplayCandidates({
      userId,
      currentTrackId: currentSongId,
      sessionDoc: mockSession,
      currentQueueSongIds: [queuedSongId],
      limit: 3,
    });

    assert.ok(res.tracks.length > 0);
    const trackIds = res.tracks.map((t) => t.song._id.toString());

    assert.ok(!trackIds.includes(currentSongId), 'Current song must not immediately repeat');
    assert.ok(!trackIds.includes(skippedSongId), 'Skipped song must be excluded');
    assert.ok(!trackIds.includes(queuedSongId), 'Queued song must be excluded to avoid overriding manual queue');
    assert.ok(trackIds.includes(candidateSong1), 'Top candidate must be selected');

    console.log('✓ Test 1 Passed: Immediate repeat, skip, and manual queue avoidance verified.');
    restoreDependencies();
  }

  // Test 2: Diversity Filtering (Prevents Consecutive Same Artist)
  {
    mockDependencies();

    const userId = new Types.ObjectId().toString();
    const res = await SmartAutoplayService.generateAutoplayCandidates({
      userId,
      limit: 3,
      lastPlayedArtistId: 'artist-1',
    });

    assert.ok(res.tracks.length >= 2);
    const firstArtistId = res.tracks[0].song.artist._id;
    assert.notStrictEqual(
      firstArtistId,
      'artist-1',
      'First autoplay track must not repeat the last played artist'
    );

    console.log('✓ Test 2 Passed: Diversity filtering prevents consecutive songs from the same artist.');
    restoreDependencies();
  }

  // Test 3: Configurable Output Limits
  {
    mockDependencies();

    const userId = new Types.ObjectId().toString();
    const [res1, res2, res3] = await Promise.all([
      SmartAutoplayService.generateAutoplayCandidates({ userId, limit: 1 }),
      SmartAutoplayService.generateAutoplayCandidates({ userId, limit: 2 }),
      SmartAutoplayService.generateAutoplayCandidates({ userId, limit: 3 }),
    ]);

    assert.strictEqual(res1.tracks.length, 1);
    assert.strictEqual(res2.tracks.length, 2);
    assert.strictEqual(res3.tracks.length, 3);

    console.log('✓ Test 3 Passed: Output track count is fully configurable.');
    restoreDependencies();
  }

  // Test 4: Ranked List with Clear Autoplay Reasons
  {
    mockDependencies();

    const userId = new Types.ObjectId().toString();
    const res = await SmartAutoplayService.generateAutoplayCandidates({
      userId,
      context: 'workout',
      limit: 2,
    });

    assert.strictEqual(res.tracks.length, 2);
    assert.ok(res.tracks[0].autoplayScore > 0);
    assert.ok(typeof res.tracks[0].reason === 'string');
    assert.ok(res.tracks[0].reason.length > 0);

    console.log('✓ Test 4 Passed: Autoplay generates ranked list with descriptive reasons.');
    restoreDependencies();
  }

  console.log('🎉 All 4 Smart Autoplay Service tests completed successfully.');
}
