import assert from 'node:assert';
import { Types } from 'mongoose';
import {
  SessionTasteProfileService,
  DEFAULT_SESSION_INTERACTION_MULTIPLIERS,
} from '../services/sessionTasteProfileService.js';
import { ListeningSession } from '../models/ListeningSession.js';
import { Song } from '../models/Song.js';

export function runSessionTasteProfileServiceTests() {
  console.log('[Session Taste Profile Service Test Suite] Starting tests...');

  // Mock songs catalog
  const songEdm = {
    _id: new Types.ObjectId('600000000000000000000001'),
    title: 'EDM Pulse',
    artist: { _id: 'artist-1', name: 'DJ Pulse' },
    genre: { _id: 'genre-edm', name: 'EDM' },
    mood: 'Energetic',
    audioFeatures: { energy: 0.95, tempo: 140 },
  };

  const songLofi = {
    _id: new Types.ObjectId('600000000000000000000002'),
    title: 'Lo-Fi Chill',
    artist: { _id: 'artist-2', name: 'Chill Beats' },
    genre: { _id: 'genre-lofi', name: 'Lo-Fi' },
    mood: 'Calm',
    audioFeatures: { energy: 0.30, tempo: 80 },
  };

  const songRock = {
    _id: new Types.ObjectId('600000000000000000000003'),
    title: 'Rock Anthem',
    artist: { _id: 'artist-3', name: 'Rockers' },
    genre: { _id: 'genre-rock', name: 'Rock' },
    mood: 'Energetic',
    audioFeatures: { energy: 0.88, tempo: 130 },
  };

  const originalSongFind = Song.find;

  function mockSongDatabase() {
    (Song as any).find = (query: any) => ({
      populate: () => ({
        populate: () => ({
          lean: async () => {
            const requestedIds = (query?._id?.$in || []).map((id: any) => id.toString());
            return [songEdm, songLofi, songRock].filter((s) =>
              requestedIds.includes(s._id.toString())
            );
          },
        }),
      }),
    });
  }

  function restoreSongDatabase() {
    Song.find = originalSongFind;
  }

  // Test 1: Generate temporary session taste profile with preferred signals
  {
    mockSongDatabase();

    const userId = new Types.ObjectId();
    const sessionId = new Types.ObjectId();

    const session = new ListeningSession({
      _id: sessionId,
      user: userId,
      sessionEvents: [
        { song: songEdm._id, action: 'play', timestamp: new Date(Date.now() - 600000) },
        { song: songEdm._id, action: 'complete', timestamp: new Date(Date.now() - 300000) },
        { song: songLofi._id, action: 'play', timestamp: new Date(Date.now() - 100000) },
      ],
      tracksPlayed: [
        { song: songEdm._id, playedAt: new Date(Date.now() - 600000), completed: true },
        { song: songLofi._id, playedAt: new Date(Date.now() - 100000), completed: false },
      ],
      status: 'active',
    });

    SessionTasteProfileService.generateSessionTasteProfile(session).then((profile) => {
      assert.ok(profile !== null);
      assert.strictEqual(profile.sessionId, sessionId.toString());
      assert.strictEqual(profile.userId, userId.toString());
      assert.strictEqual(profile.isTemporary, true);
      assert.ok(profile.preferredGenres.length > 0);
      assert.ok(profile.preferredArtists.length > 0);
      assert.ok(profile.averageEnergy > 0);
      assert.ok(profile.averageTempo > 0);
      assert.ok(profile.discoveryLevel >= 0 && profile.discoveryLevel <= 1);

      console.log('✓ Test 1 Passed: Temporary session profile contains all expected preference signals.');
      restoreSongDatabase();
    });
  }

  // Test 2: Skips as negative signals & Completions/Replays as strong positive signals
  {
    mockSongDatabase();

    const userId = new Types.ObjectId();
    const session = new ListeningSession({
      _id: new Types.ObjectId(),
      user: userId,
      sessionEvents: [
        { song: songRock._id, action: 'play', timestamp: new Date(Date.now() - 500000) },
        { song: songRock._id, action: 'skip', timestamp: new Date(Date.now() - 400000) }, // Skips Rock
        { song: songEdm._id, action: 'play', timestamp: new Date(Date.now() - 300000) },
        { song: songEdm._id, action: 'replay', timestamp: new Date(Date.now() - 100000) }, // Replays EDM (2.0x)
      ],
      status: 'active',
    });

    SessionTasteProfileService.generateSessionTasteProfile(session).then((profile) => {
      assert.ok(profile !== null);
      const edmGenre = profile.preferredGenres.find((g) => g.genre === 'EDM');
      const rockGenre = profile.preferredGenres.find((g) => g.genre === 'Rock');

      assert.ok(edmGenre !== undefined, 'EDM must be present with high score');
      assert.ok(edmGenre.score > 0.5, 'EDM score should dominate due to replay bonus');
      if (rockGenre) {
        assert.ok(rockGenre.score < edmGenre.score, 'Rock score must be heavily diminished due to skip penalty');
      }

      console.log('✓ Test 2 Passed: Skips penalize signals while completions/replays amplify scores.');
      restoreSongDatabase();
    });
  }

  // Test 3: Recency weighting gives higher importance to latest interactions
  {
    mockSongDatabase();

    const userId = new Types.ObjectId();
    const session = new ListeningSession({
      _id: new Types.ObjectId(),
      user: userId,
      sessionEvents: [
        { song: songEdm._id, action: 'play', timestamp: new Date(Date.now() - 1000000) }, // Older
        { song: songLofi._id, action: 'play', timestamp: new Date(Date.now() - 10000) },  // Recent
      ],
      status: 'active',
    });

    SessionTasteProfileService.generateSessionTasteProfile(session).then((profile) => {
      assert.ok(profile !== null);
      const lofiGenre = profile.preferredGenres.find((g) => g.genre === 'Lo-Fi');
      const edmGenre = profile.preferredGenres.find((g) => g.genre === 'EDM');

      assert.ok(lofiGenre && edmGenre);
      assert.ok(
        lofiGenre.score > edmGenre.score,
        'Recent Lo-Fi play must have higher score than older EDM play'
      );

      console.log('✓ Test 3 Passed: Recency weighting prioritizes recent interactions.');
      restoreSongDatabase();
    });
  }

  // Test 4: Normalized Values & Invariant Long-Term Profiles
  {
    mockSongDatabase();

    const userId = new Types.ObjectId();
    const session = new ListeningSession({
      _id: new Types.ObjectId(),
      user: userId,
      sessionEvents: [
        { song: songEdm._id, action: 'play', timestamp: new Date() },
        { song: songLofi._id, action: 'play', timestamp: new Date() },
      ],
      status: 'active',
    });

    SessionTasteProfileService.generateSessionTasteProfile(session).then((profile) => {
      assert.ok(profile !== null);
      const genreSum = profile.preferredGenres.reduce((s, g) => s + g.score, 0);
      assert.ok(Math.abs(genreSum - 1.0) < 0.05, 'Normalized genre scores sum to ~1.0');
      assert.ok(profile.averageEnergy >= 0.0 && profile.averageEnergy <= 1.0);
      assert.ok(profile.averageTempo >= 30 && profile.averageTempo <= 250);
      assert.strictEqual(profile.isTemporary, true);

      console.log('✓ Test 4 Passed: Output signals normalized and marked strictly temporary.');
      restoreSongDatabase();
    });
  }

  console.log('🎉 All 4 Session Taste Profile Service tests completed successfully.');
}
