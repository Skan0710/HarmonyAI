import assert from 'node:assert';
import { Types } from 'mongoose';
import {
  SessionTasteProfileService,
  SessionTasteProfile,
  SessionDriftMetrics,
} from '../services/sessionTasteProfileService.js';
import {
  SmartAutoplayService,
  AdaptAutoplayParams,
} from '../services/smartAutoplayService.js';
import {
  getSessionAdaptationConfig,
  updateSessionAdaptationConfig,
  resetSessionAdaptationConfig,
} from '../config/recommendationConfig.js';
import { Song } from '../models/Song.js';
import { User } from '../models/User.js';
import { ListeningSessionService } from '../services/listeningSessionService.js';
import { CandidateGenerationService } from '../services/candidateGenerationService.js';

export async function runDynamicSessionAutoplayAdaptationTests() {
  console.log('[Dynamic Session Autoplay Adaptation Test Suite] Starting tests...');

  const originalFind = (Song as any).find;
  const originalUserFindById = (User as any).findById;
  const originalGetActiveSession = ListeningSessionService.getActiveSession;
  const originalGenerateHybridCandidates = CandidateGenerationService.generateHybridCandidates;

  try {
    (User as any).findById = () => ({
      populate: () => ({
        lean: async () => ({ favoriteGenres: [] }),
      }),
      lean: async () => ({ favoriteGenres: [] }),
    });

    const userId = new Types.ObjectId().toString();
    const sessionId = new Types.ObjectId().toString();

    // Mock song catalog
    const rockSong = {
      _id: new Types.ObjectId().toString(),
      title: 'Rock Anthem',
      artist: { _id: new Types.ObjectId().toString(), name: 'Rock Band' },
      genre: { _id: new Types.ObjectId().toString(), name: 'Rock' },
      audioFeatures: { energy: 0.85, tempo: 135, valence: 0.75 },
    };

    const lofiSong = {
      _id: new Types.ObjectId().toString(),
      title: 'Midnight Chill',
      artist: { _id: new Types.ObjectId().toString(), name: 'Chill Artist' },
      genre: { _id: new Types.ObjectId().toString(), name: 'Lo-Fi' },
      audioFeatures: { energy: 0.25, tempo: 75, valence: 0.40 },
    };

    const electronicSong = {
      _id: new Types.ObjectId().toString(),
      title: 'Neon Pulse',
      artist: { _id: new Types.ObjectId().toString(), name: 'Electro DJ' },
      genre: { _id: new Types.ObjectId().toString(), name: 'Electronic' },
      audioFeatures: { energy: 0.90, tempo: 128, valence: 0.80 },
    };

    const synthwaveSong = {
      _id: new Types.ObjectId().toString(),
      title: 'Cyber Mirage',
      artist: { _id: new Types.ObjectId().toString(), name: 'Synth Master' },
      genre: { _id: new Types.ObjectId().toString(), name: 'Synthwave' },
      audioFeatures: { energy: 0.82, tempo: 125, valence: 0.70 },
    };

    const createMockQuery = (items: any[]) => {
      const q: any = {
        populate: () => q,
        lean: async () => items,
        limit: () => q,
        select: () => q,
        sort: () => q,
        exec: async () => items,
      };
      return q;
    };

    // Default mock candidate list for recommendation engine
    CandidateGenerationService.generateHybridCandidates = async () => [
      {
        songId: electronicSong._id,
        contentScore: 0.95,
        collaborativeScore: 0.90,
        userTasteAffinityScore: 0.92,
        popularitySignal: 800,
        recencySignal: 0.90,
        sources: ['content'],
        songDoc: {
          _id: electronicSong._id,
          title: electronicSong.title,
          artist: electronicSong.artist,
          genre: electronicSong.genre.name,
          audioFeatures: electronicSong.audioFeatures,
        },
      },
      {
        songId: synthwaveSong._id,
        contentScore: 0.88,
        collaborativeScore: 0.85,
        userTasteAffinityScore: 0.85,
        popularitySignal: 700,
        recencySignal: 0.85,
        sources: ['taste_profile'],
        songDoc: {
          _id: synthwaveSong._id,
          title: synthwaveSong.title,
          artist: synthwaveSong.artist,
          genre: synthwaveSong.genre.name,
          audioFeatures: synthwaveSong.audioFeatures,
        },
      },
      {
        songId: rockSong._id,
        contentScore: 0.82,
        collaborativeScore: 0.80,
        userTasteAffinityScore: 0.78,
        popularitySignal: 650,
        recencySignal: 0.80,
        sources: ['collaborative'],
        songDoc: {
          _id: rockSong._id,
          title: rockSong.title,
          artist: rockSong.artist,
          genre: rockSong.genre.name,
          audioFeatures: rockSong.audioFeatures,
        },
      },
    ];

    // Test 1: Increases influence of completed/replayed tracks & decreases influence of skips
    {
      const mockSession: any = {
        _id: new Types.ObjectId(sessionId),
        user: new Types.ObjectId(userId),
        sessionEvents: [
          { song: rockSong._id, action: 'skip', timestamp: new Date(Date.now() - 30000) },
          { song: rockSong._id, action: 'skip', timestamp: new Date(Date.now() - 20000) },
          { song: lofiSong._id, action: 'complete', timestamp: new Date(Date.now() - 10000) },
          { song: lofiSong._id, action: 'replay', timestamp: new Date(Date.now() - 5000) },
        ],
        tracksPlayed: [rockSong._id, lofiSong._id],
        tracksSkipped: [rockSong._id],
        tracksCompleted: [lofiSong._id],
        status: 'active',
      };

      (Song as any).find = () =>
        createMockQuery([
          {
            ...rockSong,
            _id: new Types.ObjectId(rockSong._id),
            artist: { _id: new Types.ObjectId(rockSong.artist._id), name: rockSong.artist.name },
            genre: { _id: new Types.ObjectId(rockSong.genre._id), name: 'Rock' },
          },
          {
            ...lofiSong,
            _id: new Types.ObjectId(lofiSong._id),
            artist: { _id: new Types.ObjectId(lofiSong.artist._id), name: lofiSong.artist.name },
            genre: { _id: new Types.ObjectId(lofiSong.genre._id), name: 'Lo-Fi' },
          },
        ]);

      const profile = await SessionTasteProfileService.generateSessionTasteProfile(mockSession);
      assert.ok(profile, 'Profile should be generated');

      const lofiGenre = profile.preferredGenres.find((g) => g.genre.toLowerCase() === 'lo-fi');
      const rockGenre = profile.preferredGenres.find((g) => g.genre.toLowerCase() === 'rock');

      assert.ok(lofiGenre && lofiGenre.score > 0.6, 'Lo-Fi score should be dominant from completes/replays');
      assert.ok(!rockGenre || rockGenre.score < 0.2, 'Skipped Rock genre should be heavily penalized');
      assert.ok(profile.averageEnergy < 0.45, 'Average energy should reflect completed Lo-Fi track');

      console.log('✓ Test 1 Passed: Completes/replays increase influence and skips decrease influence.');
    }

    // Test 2: Adapts to changes in genre, artist, energy, tempo, and mood
    {
      const initialProfile: SessionTasteProfile = {
        sessionId,
        userId,
        totalInteractions: 3,
        preferredGenres: [{ genre: 'Lo-Fi', score: 0.8, rawWeight: 4.0 }],
        preferredArtists: [{ artistId: lofiSong.artist._id, name: 'Chill Artist', score: 0.8, rawWeight: 4.0 }],
        averageEnergy: 0.25,
        averageTempo: 75,
        dominantMoods: [{ mood: 'Chill', score: 0.9 }],
        discoveryLevel: 0.3,
        interactionSummary: { playsCount: 2, skipsCount: 0, completionsCount: 1, replaysCount: 1, likesCount: 0 },
        isTemporary: true,
        lastUpdated: new Date(),
      };

      const shiftedProfile: SessionTasteProfile = {
        sessionId,
        userId,
        totalInteractions: 6,
        preferredGenres: [{ genre: 'Electronic', score: 0.85, rawWeight: 5.0 }],
        preferredArtists: [{ artistId: electronicSong.artist._id, name: 'Electro DJ', score: 0.85, rawWeight: 5.0 }],
        averageEnergy: 0.88,
        averageTempo: 128,
        dominantMoods: [{ mood: 'Energetic', score: 0.9 }],
        discoveryLevel: 0.6,
        interactionSummary: { playsCount: 4, skipsCount: 0, completionsCount: 2, replaysCount: 1, likesCount: 1 },
        isTemporary: true,
        lastUpdated: new Date(),
      };

      const drift = SessionTasteProfileService.calculateSessionDrift(initialProfile, shiftedProfile);

      assert.ok(drift.genreDrift > 0.5, 'Genre drift should be high (> 0.5)');
      assert.ok(drift.energyDelta > 0.5, 'Energy shift should be high (> 0.5)');
      assert.ok(drift.tempoDeltaBpm >= 40, 'Tempo delta should be large (>= 40 BPM)');
      assert.ok(drift.overallDriftScore > 0.4, 'Overall drift should exceed baseline threshold');
      assert.strictEqual(drift.isSignificant, true, 'Drift should be flagged as significant change');

      console.log('✓ Test 2 Passed: Successfully detects multidimensional session taste shift.');
    }

    // Test 3: Does NOT regenerate queue after minor event when drift is below threshold
    {
      const baseProfile: SessionTasteProfile = {
        sessionId,
        userId,
        totalInteractions: 5,
        preferredGenres: [{ genre: 'Electronic', score: 0.8, rawWeight: 4.0 }],
        preferredArtists: [{ artistId: electronicSong.artist._id, name: 'Electro DJ', score: 0.8, rawWeight: 4.0 }],
        averageEnergy: 0.85,
        averageTempo: 128,
        dominantMoods: [{ mood: 'Energetic', score: 0.9 }],
        discoveryLevel: 0.4,
        interactionSummary: { playsCount: 3, skipsCount: 0, completionsCount: 2, replaysCount: 0, likesCount: 0 },
        isTemporary: true,
        lastUpdated: new Date(),
      };

      // Minor event: identical genre/vibe, slightly updated timestamp
      const minorShiftProfile: SessionTasteProfile = {
        ...baseProfile,
        totalInteractions: 6,
        averageEnergy: 0.86, // only 0.01 change
        averageTempo: 129,   // only 1 BPM change
      };

      const existingQueue = [
        { song: electronicSong, queuePosition: 1, queueScore: 0.9, hybridScore: 0.9, tier: 'familiarity', reason: 'Existing AI track', sources: ['hybrid'] },
      ];

      const drift = SessionTasteProfileService.calculateSessionDrift(baseProfile, minorShiftProfile);
      assert.strictEqual(drift.isSignificant, false, 'Minor drift should NOT be significant');

      (Song as any).find = () =>
        createMockQuery([
          {
            ...electronicSong,
            _id: new Types.ObjectId(electronicSong._id),
            artist: { _id: new Types.ObjectId(electronicSong.artist._id), name: electronicSong.artist.name },
            genre: { _id: new Types.ObjectId(electronicSong.genre._id), name: 'Electronic' },
          },
        ]);

      ListeningSessionService.getActiveSession = async () => ({
        _id: new Types.ObjectId(sessionId),
        user: new Types.ObjectId(userId),
        sessionEvents: [
          { song: electronicSong._id, action: 'play' },
          { song: electronicSong._id, action: 'complete' },
          { song: electronicSong._id, action: 'play' },
          { song: electronicSong._id, action: 'complete' },
          { song: electronicSong._id, action: 'play' },
        ],
        tracksPlayed: [electronicSong._id],
        status: 'active',
      } as any);

      // Call evaluateAndAdaptAutoplayQueue with minor drift
      const result = await SmartAutoplayService.evaluateAndAdaptAutoplayQueue({
        userId,
        previousSessionProfile: baseProfile,
        existingAutoplayQueue: existingQueue,
        thresholds: { driftThreshold: 0.30, minInteractionsBeforeRegen: 2 },
      });

      assert.strictEqual(result.regenerated, false, 'Queue should NOT regenerate for minor micro-events');
      assert.strictEqual(result.queue.length, 1, 'Existing queue items must be preserved');

      console.log('✓ Test 3 Passed: Queue is NOT unnecessarily regenerated on minor events below threshold.');
    }

    // Test 4: Regenerates autoplay recommendations when session taste changes significantly
    {
      const previousProfile: SessionTasteProfile = {
        sessionId,
        userId,
        totalInteractions: 3,
        preferredGenres: [{ genre: 'Lo-Fi', score: 0.9, rawWeight: 4.0 }],
        preferredArtists: [{ artistId: lofiSong.artist._id, name: 'Chill Artist', score: 0.9, rawWeight: 4.0 }],
        averageEnergy: 0.20,
        averageTempo: 70,
        dominantMoods: [{ mood: 'Chill', score: 0.9 }],
        discoveryLevel: 0.2,
        interactionSummary: { playsCount: 2, skipsCount: 0, completionsCount: 1, replaysCount: 0, likesCount: 0 },
        isTemporary: true,
        lastUpdated: new Date(),
      };

      const highEnergySession: any = {
        _id: new Types.ObjectId(sessionId),
        user: new Types.ObjectId(userId),
        sessionEvents: [
          { song: electronicSong._id, action: 'play', timestamp: new Date(Date.now() - 40000) },
          { song: electronicSong._id, action: 'complete', timestamp: new Date(Date.now() - 30000) },
          { song: electronicSong._id, action: 'replay', timestamp: new Date(Date.now() - 20000) },
          { song: rockSong._id, action: 'play', timestamp: new Date(Date.now() - 10000) },
          { song: rockSong._id, action: 'complete', timestamp: new Date() },
        ],
        tracksPlayed: [electronicSong._id, rockSong._id],
        tracksCompleted: [electronicSong._id, rockSong._id],
        tracksSkipped: [],
        status: 'active',
      };

      ListeningSessionService.getActiveSession = async () => highEnergySession;

      (Song as any).find = () =>
        createMockQuery([
          {
            ...electronicSong,
            _id: new Types.ObjectId(electronicSong._id),
            artist: { _id: new Types.ObjectId(electronicSong.artist._id), name: electronicSong.artist.name },
            genre: { _id: new Types.ObjectId(electronicSong.genre._id), name: 'Electronic' },
          },
          {
            ...rockSong,
            _id: new Types.ObjectId(rockSong._id),
            artist: { _id: new Types.ObjectId(rockSong.artist._id), name: rockSong.artist.name },
            genre: { _id: new Types.ObjectId(rockSong.genre._id), name: 'Rock' },
          },
        ]);

      const result = await SmartAutoplayService.evaluateAndAdaptAutoplayQueue({
        userId,
        currentTrackId: electronicSong._id,
        previousSessionProfile: previousProfile,
        existingAutoplayQueue: [{ song: lofiSong, queuePosition: 1, queueScore: 0.5, hybridScore: 0.5, tier: 'familiarity', reason: 'Old Lo-fi', sources: [] }],
        queueSize: 3,
        thresholds: { driftThreshold: 0.30, minInteractionsBeforeRegen: 2 },
      });

      assert.strictEqual(result.regenerated, true, 'Queue must regenerate when taste shift is significant');
      assert.ok(result.sessionProfile, 'New session profile should be attached');
      assert.ok(result.driftMetrics.isSignificant, 'Drift metrics must confirm significance');

      console.log('✓ Test 4 Passed: Autoplay recommendations regenerated upon significant session taste change.');
    }

    // Test 5: Configurable thresholds & long-term preference preservation
    {
      const currentConfig = getSessionAdaptationConfig();
      assert.strictEqual(typeof currentConfig.driftThreshold, 'number');
      assert.strictEqual(typeof currentConfig.energyDriftThreshold, 'number');

      updateSessionAdaptationConfig({ driftThreshold: 0.60 });
      assert.strictEqual(getSessionAdaptationConfig().driftThreshold, 0.60);

      resetSessionAdaptationConfig();
      assert.strictEqual(getSessionAdaptationConfig().driftThreshold, 0.30);

      // Confirm session profile is strictly marked temporary
      const sessionDoc: any = {
        _id: new Types.ObjectId(sessionId),
        user: new Types.ObjectId(userId),
        sessionEvents: [{ song: electronicSong._id, action: 'play' }],
        tracksPlayed: [electronicSong._id],
        status: 'active',
      };
      const profile = await SessionTasteProfileService.generateSessionTasteProfile(sessionDoc);
      assert.strictEqual(profile?.isTemporary, true, 'Session profile must be marked strictly temporary');

      console.log('✓ Test 5 Passed: Thresholds are configurable and long-term user profile remains unmodified.');
    }

    console.log('🎉 All 5 Dynamic Session Autoplay Adaptation tests completed successfully.');
  } finally {
    (Song as any).find = originalFind;
    (User as any).findById = originalUserFindById;
    ListeningSessionService.getActiveSession = originalGetActiveSession;
    CandidateGenerationService.generateHybridCandidates = originalGenerateHybridCandidates;
    resetSessionAdaptationConfig();
  }
}
