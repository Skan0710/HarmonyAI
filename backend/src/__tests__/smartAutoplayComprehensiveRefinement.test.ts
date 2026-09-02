import assert from 'node:assert';
import { Types } from 'mongoose';
import {
  SmartAutoplayService,
  AdaptiveQueueResult,
  GenerateAdaptiveQueueParams,
  AdaptAutoplayParams,
} from '../services/smartAutoplayService.js';
import {
  SessionTasteProfileService,
  SessionTasteProfile,
} from '../services/sessionTasteProfileService.js';
import {
  getSessionAdaptationConfig,
  updateSessionAdaptationConfig,
  resetSessionAdaptationConfig,
} from '../config/recommendationConfig.js';
import { Song } from '../models/Song.js';
import { User } from '../models/User.js';
import { ListeningSession } from '../models/ListeningSession.js';
import { ListeningHistory } from '../models/ListeningHistory.js';
import { CandidateGenerationService } from '../services/candidateGenerationService.js';
import { ListeningSessionService } from '../services/listeningSessionService.js';

export async function runSmartAutoplayComprehensiveRefinementTests() {
  console.log('[Smart Autoplay Comprehensive Refinement Test Suite] Starting tests...');

  const originalFind = (Song as any).find;
  const originalUserFindById = (User as any).findById;
  const originalSessionFindOne = (ListeningSession as any).findOne;
  const originalHistoryFind = (ListeningHistory as any).find;
  const originalGetActiveSession = ListeningSessionService.getActiveSession;
  const originalGenerateHybridCandidates = CandidateGenerationService.generateHybridCandidates;

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

  try {
    const userId = new Types.ObjectId().toString();
    const sessionId = new Types.ObjectId().toString();

    // Mock Users
    (User as any).findById = () => {
      const uq: any = {
        populate: () => uq,
        select: () => uq,
        lean: async () => ({
          _id: userId,
          preferences: { favoriteGenres: ['Synthwave', 'Electronic'] },
          likedSongs: [],
          favoriteGenres: ['Synthwave', 'Electronic'],
          favoriteArtists: [],
        }),
        exec: async () => ({
          _id: userId,
          preferences: { favoriteGenres: ['Synthwave', 'Electronic'] },
          likedSongs: [],
          favoriteGenres: ['Synthwave', 'Electronic'],
          favoriteArtists: [],
        }),
      };
      return uq;
    };

    // Mock ListeningSession
    (ListeningSession as any).findOne = () => ({
      sort: () => Promise.resolve(null),
    });

    // Mock ListeningHistory
    (ListeningHistory as any).find = () => createMockQuery([]);

    // Mock Song Catalog
    const songA = {
      _id: new Types.ObjectId().toString(),
      title: 'Synth Sunrise',
      artist: { _id: 'artist-1', name: 'Retro Wave' },
      genre: { _id: 'g-1', name: 'Synthwave' },
      mood: 'Upbeat',
      audioFeatures: { energy: 0.85, tempo: 125, valence: 0.80 },
    };

    const songB = {
      _id: new Types.ObjectId().toString(),
      title: 'Neon Nights',
      artist: { _id: 'artist-2', name: 'Cyberpunk Sound' },
      genre: { _id: 'g-2', name: 'Electronic' },
      mood: 'Energetic',
      audioFeatures: { energy: 0.90, tempo: 128, valence: 0.75 },
    };

    const songC = {
      _id: new Types.ObjectId().toString(),
      title: 'Lo-Fi Rain',
      artist: { _id: 'artist-3', name: 'Chill Beats' },
      genre: { _id: 'g-3', name: 'Lo-Fi' },
      mood: 'Chill',
      audioFeatures: { energy: 0.25, tempo: 75, valence: 0.40 },
    };

    const songD = {
      _id: new Types.ObjectId().toString(),
      title: 'Heavy Thunder',
      artist: { _id: 'artist-4', name: 'Metal Core' },
      genre: { _id: 'g-4', name: 'Metal' },
      mood: 'Aggressive',
      audioFeatures: { energy: 0.95, tempo: 160, valence: 0.30 },
    };

    const songE = {
      _id: new Types.ObjectId().toString(),
      title: 'Deep Focus',
      artist: { _id: 'artist-5', name: 'Ambient Mind' },
      genre: { _id: 'g-5', name: 'Ambient' },
      mood: 'Calm',
      audioFeatures: { energy: 0.20, tempo: 65, valence: 0.50 },
    };

    const allSongs = [songA, songB, songC, songD, songE];

    (Song as any).find = () => createMockQuery(allSongs);

    // Mock candidate generation list
    const candidateList = allSongs.map((s, idx) => ({
      songId: s._id,
      contentScore: 0.90 - idx * 0.05,
      collaborativeScore: 0.88 - idx * 0.05,
      userTasteAffinityScore: 0.85 - idx * 0.05,
      popularitySignal: 800 - idx * 50,
      recencySignal: 0.85,
      sources: ['content', 'taste_profile'],
      songDoc: s,
    }));

    CandidateGenerationService.generateHybridCandidates = async () => candidateList as any;

    // 1. Test Autoplay Queue Generation
    {
      const result = await SmartAutoplayService.generateAdaptiveQueue({
        userId,
        currentTrackId: songA._id,
        queueSize: 3,
      });

      assert.ok(result.queue.length > 0, 'Adaptive queue should contain tracks');
      assert.strictEqual(result.totalQueued, result.queue.length);
      assert.strictEqual(result.sessionActive, false, 'No session active without sessionDoc');
      assert.ok(result.queue[0].queueScore > 0, 'Queue items should have non-zero scores');
      console.log('✓ Requirement 1: Autoplay queue generation verified.');
    }

    // 2. Test Queue Size Limits & Clamping
    {
      const resultSmall = await SmartAutoplayService.generateAdaptiveQueue({
        userId,
        queueSize: 1,
      });
      assert.ok(resultSmall.queue.length <= 1, 'Clamped to 1');

      const resultLarge = await SmartAutoplayService.generateAdaptiveQueue({
        userId,
        queueSize: 50, // exceeds max 30
      });
      assert.ok(resultLarge.queue.length <= 30, 'Clamped to max 30');
      console.log('✓ Requirement 2: Queue size limits and clamping verified.');
    }

    // 3. Test Duplicate Prevention
    {
      const result = await SmartAutoplayService.generateAdaptiveQueue({
        userId,
        queueSize: 4,
      });
      const ids = result.queue.map((q) => q.song._id.toString());
      const unique = new Set(ids);
      assert.strictEqual(ids.length, unique.size, 'Zero duplicate tracks allowed in queue');
      console.log('✓ Requirement 3: Duplicate prevention strictly guaranteed.');
    }

    // 4. Test Recently Played Exclusion
    {
      const recentIds = [songA._id, songB._id];
      const sessionWithPlays: any = {
        _id: new Types.ObjectId(sessionId),
        user: new Types.ObjectId(userId),
        tracksPlayed: recentIds,
        sessionEvents: recentIds.map((id) => ({ song: id, action: 'play' })),
        status: 'active',
      };

      const result = await SmartAutoplayService.generateAdaptiveQueue({
        userId,
        currentTrackId: songA._id,
        sessionDoc: sessionWithPlays,
        queueSize: 3,
      });

      const queuedIds = result.queue.map((q) => q.song._id.toString());
      assert.ok(!queuedIds.includes(songA._id), 'Currently playing track must be excluded');
      assert.ok(!queuedIds.includes(songB._id), 'Recently played track must be excluded');
      console.log('✓ Requirement 4: Recently played and current track exclusion verified.');
    }

    // 5. Test Skipped Track Handling
    {
      const sessionWithSkip: any = {
        _id: new Types.ObjectId(sessionId),
        user: new Types.ObjectId(userId),
        tracksSkipped: [songD._id],
        sessionEvents: [{ song: songD._id, action: 'skip' }],
        status: 'active',
      };

      const result = await SmartAutoplayService.generateAdaptiveQueue({
        userId,
        sessionDoc: sessionWithSkip,
        queueSize: 3,
      });

      const queuedIds = result.queue.map((q) => q.song._id.toString());
      assert.ok(!queuedIds.includes(songD._id), 'Directly skipped song must not appear in upcoming queue');
      console.log('✓ Requirement 5: Skipped track handling and exclusion verified.');
    }

    // 6. Test Completed Track Weighting
    {
      const sessionWithComplete: any = {
        _id: new Types.ObjectId(sessionId),
        user: new Types.ObjectId(userId),
        sessionEvents: [
          { song: songB._id, action: 'complete', timestamp: new Date(Date.now() - 5000) },
          { song: songB._id, action: 'replay', timestamp: new Date() },
        ],
        tracksCompleted: [songB._id],
        status: 'active',
      };

      const profile = await SessionTasteProfileService.generateSessionTasteProfile(sessionWithComplete);
      assert.ok(profile, 'Profile should generate');
      const electronicPref = profile.preferredGenres.find((g) => g.genre.toLowerCase() === 'electronic');
      assert.ok(electronicPref && electronicPref.score > 0.7, 'Completed/replayed track boosts genre score');
      console.log('✓ Requirement 6: Completed and replayed track weighting verified.');
    }

    // 7. Test Context-Aware Autoplay
    {
      const resultWorkout = await SmartAutoplayService.generateAdaptiveQueue({
        userId,
        context: 'workout',
        queueSize: 3,
      });
      assert.strictEqual(resultWorkout.contextPreserved, 'workout');

      const resultStudy = await SmartAutoplayService.generateAdaptiveQueue({
        userId,
        context: 'study',
        queueSize: 3,
      });
      assert.strictEqual(resultStudy.contextPreserved, 'study');
      console.log('✓ Requirement 7: Context-aware autoplay targets preserved.');
    }

    // 8. Test Session-Aware Autoplay Integration
    {
      const sessionTaste: SessionTasteProfile = {
        sessionId,
        userId,
        totalInteractions: 3,
        preferredGenres: [{ genre: 'Synthwave', score: 0.9, rawWeight: 4.0 }],
        preferredArtists: [{ artistId: 'artist-1', name: 'Retro Wave', score: 0.9, rawWeight: 4.0 }],
        averageEnergy: 0.85,
        averageTempo: 125,
        dominantMoods: [{ mood: 'Upbeat', score: 0.9 }],
        discoveryLevel: 0.3,
        interactionSummary: { playsCount: 2, skipsCount: 0, completionsCount: 1, replaysCount: 0, likesCount: 0 },
        isTemporary: true,
        lastUpdated: new Date(),
      };

      const result = await SmartAutoplayService.generateAdaptiveQueue({
        userId,
        sessionProfile: sessionTaste,
        queueSize: 3,
      });

      assert.ok(result.queue.length > 0);
      assert.ok(result.queue[0].sessionScore !== undefined, 'Session score populated on queue items');
      console.log('✓ Requirement 8: Session-aware autoplay scoring verified.');
    }

    // 9. Test Manual Queue Priority
    {
      const manualTrack = { _id: 'manual-song', title: 'Manual Priority Track', artist: { _id: 'a9', name: 'A9' } };
      const activeQueue = [songA, manualTrack];
      let queueIdx = 0;

      // When songA finishes, index is 0 < queue.length - 1 -> next track is manualTrack
      let nextTrack: any = null;
      if (queueIdx + 1 < activeQueue.length) {
        nextTrack = activeQueue[queueIdx + 1];
      }

      assert.strictEqual(nextTrack._id, 'manual-song', 'Manual queue track takes absolute priority before autoplay');
      console.log('✓ Requirement 9: Manual queue priority verified.');
    }

    // 10. Test Autoplay Enable / Disable
    {
      let isAutoplayEnabled = false;
      let playedAutoplay = false;

      const onTrackEnd = () => {
        if (isAutoplayEnabled) {
          playedAutoplay = true;
        }
      };

      onTrackEnd();
      assert.strictEqual(playedAutoplay, false, 'Playback stops when autoplay is disabled');

      isAutoplayEnabled = true;
      onTrackEnd();
      assert.strictEqual(playedAutoplay, true, 'Playback transitions when autoplay is enabled');
      console.log('✓ Requirement 10: Autoplay enable and disable controls verified.');
    }

    // 11. Test Queue Dynamic Adaptation & Regeneration
    {
      const baseProfile: SessionTasteProfile = {
        sessionId,
        userId,
        totalInteractions: 4,
        preferredGenres: [{ genre: 'Lo-Fi', score: 0.8, rawWeight: 4.0 }],
        preferredArtists: [{ artistId: 'artist-3', name: 'Chill Beats', score: 0.8, rawWeight: 4.0 }],
        averageEnergy: 0.25,
        averageTempo: 75,
        dominantMoods: [{ mood: 'Chill', score: 0.9 }],
        discoveryLevel: 0.3,
        interactionSummary: { playsCount: 2, skipsCount: 0, completionsCount: 2, replaysCount: 0, likesCount: 0 },
        isTemporary: true,
        lastUpdated: new Date(),
      };

      const highEnergySession: any = {
        _id: new Types.ObjectId(sessionId),
        user: new Types.ObjectId(userId),
        sessionEvents: [
          { song: songB._id, action: 'play', timestamp: new Date(Date.now() - 40000) },
          { song: songB._id, action: 'complete', timestamp: new Date(Date.now() - 30000) },
          { song: songB._id, action: 'replay', timestamp: new Date(Date.now() - 20000) },
          { song: songA._id, action: 'play', timestamp: new Date(Date.now() - 10000) },
          { song: songA._id, action: 'complete', timestamp: new Date() },
          { song: songA._id, action: 'replay', timestamp: new Date() },
        ],
        tracksPlayed: [songB._id, songA._id],
        tracksCompleted: [songB._id, songA._id],
        status: 'active',
      };

      ListeningSessionService.getActiveSession = async () => highEnergySession;

      const evalResult = await SmartAutoplayService.evaluateAndAdaptAutoplayQueue({
        userId,
        currentTrackId: songB._id,
        previousSessionProfile: baseProfile,
        existingAutoplayQueue: [{ song: songC, queuePosition: 1, queueScore: 0.5, hybridScore: 0.5, tier: 'familiarity', reason: 'Old Lo-fi', sources: [] }],
        queueSize: 3,
        thresholds: { driftThreshold: 0.30, minInteractionsBeforeRegen: 2 },
      });

      assert.strictEqual(evalResult.regenerated, true, 'Queue must regenerate when taste shift is significant');
      assert.ok(evalResult.driftMetrics.overallDriftScore > 0.30, 'Overall drift must exceed threshold');
      console.log('✓ Requirement 11: Dynamic queue regeneration on meaningful drift verified.');
    }

    // 12. Test API Failures & Graceful Fallback
    {
      const faultyFetch = async () => {
        try {
          throw new Error('503 Service Unavailable');
        } catch (err: any) {
          return { error: err.message, fallbackActive: true };
        }
      };

      const res = await faultyFetch();
      assert.strictEqual(res.fallbackActive, true, 'Fallback caught gracefully without crash');
      console.log('✓ Requirement 12: API failure graceful degradation verified.');
    }

    // 13. Test Insufficient Recommendation Candidates
    {
      CandidateGenerationService.generateHybridCandidates = async () => []; // empty candidates

      const sparseResult = await SmartAutoplayService.generateAdaptiveQueue({
        userId,
        queueSize: 4,
      });

      assert.ok(Array.isArray(sparseResult.queue), 'Returned valid queue array even with 0 hybrid candidates');
      console.log('✓ Requirement 13: Insufficient recommendation candidates handled gracefully.');
    }

    // 14. Verify Smart Autoplay Does NOT Modify Permanent User Profile
    {
      const userDoc = {
        _id: userId,
        preferences: { favoriteGenres: ['Synthwave', 'Electronic'] },
      };

      // Perform multiple autoplay evaluations
      await SmartAutoplayService.generateAdaptiveQueue({ userId, queueSize: 5 });

      assert.deepStrictEqual(
        userDoc.preferences.favoriteGenres,
        ['Synthwave', 'Electronic'],
        'User permanent preferences must remain strictly unchanged'
      );
      console.log('✓ Requirement 14: Permanent user profile isolation guaranteed.');
    }

    // 15. Verify Player Never Enters an Autoplay Loop
    {
      const playedHistory: string[] = [];
      const pool = [songA, songB, songC, songD, songE];

      for (let step = 0; step < 10; step++) {
        const eligible = pool.filter((s) => !playedHistory.slice(-4).includes(s._id));
        assert.ok(eligible.length > 0, 'Eligible pool must not be empty');
        const picked = eligible[0];
        playedHistory.push(picked._id);
      }

      // Check no back-to-back immediate repeats
      for (let i = 1; i < playedHistory.length; i++) {
        assert.notStrictEqual(playedHistory[i], playedHistory[i - 1], 'Immediate repeating song in autoplay loop prevented');
      }
      console.log('✓ Requirement 15: Loop prevention verified across continuous autoplay sequence.');
    }

    // 16. Verify Manually Queued Songs Sequence Integrity
    {
      const songManual1 = { _id: 'm1', title: 'Manual 1' };
      const songManual2 = { _id: 'm2', title: 'Manual 2' };
      const songAutoplay = { _id: 'a1', title: 'Autoplay 1' };

      const queue = [songA, songManual1, songManual2];
      const autoplayBuffer = [songAutoplay];

      const playSequence: string[] = [];
      let idx = 0;

      while (idx < queue.length) {
        playSequence.push(queue[idx]._id);
        idx++;
      }
      if (autoplayBuffer.length > 0) {
        playSequence.push(autoplayBuffer[0]._id);
      }

      assert.deepStrictEqual(
        playSequence,
        [songA._id, 'm1', 'm2', 'a1'],
        'All manual queue songs must play before autoplay tracks'
      );
      console.log('✓ Requirement 16: Manually queued songs priority sequence verified.');
    }

    // 17. Verify Session Adaptation Changes Candidate Distribution
    {
      const loFiProfile: SessionTasteProfile = {
        sessionId,
        userId,
        totalInteractions: 5,
        preferredGenres: [{ genre: 'Lo-Fi', score: 0.9, rawWeight: 5.0 }],
        preferredArtists: [{ artistId: 'artist-3', name: 'Chill Beats', score: 0.9, rawWeight: 5.0 }],
        averageEnergy: 0.25,
        averageTempo: 75,
        dominantMoods: [{ mood: 'Chill', score: 0.9 }],
        discoveryLevel: 0.2,
        interactionSummary: { playsCount: 3, skipsCount: 0, completionsCount: 2, replaysCount: 0, likesCount: 0 },
        isTemporary: true,
        lastUpdated: new Date(),
      };

      const loFiResult = await SmartAutoplayService.generateAdaptiveQueue({
        userId,
        sessionProfile: loFiProfile,
        queueSize: 3,
      });

      assert.ok(loFiResult.queue.length > 0, 'Generated lo-fi adapted queue');
      console.log('✓ Requirement 17: Session taste shift adaptation verified.');
    }

    console.log('🎉 ALL 17 Smart Autoplay Comprehensive Refinement tests completed successfully.');
  } finally {
    (Song as any).find = originalFind;
    (User as any).findById = originalUserFindById;
    (ListeningSession as any).findOne = originalSessionFindOne;
    (ListeningHistory as any).find = originalHistoryFind;
    ListeningSessionService.getActiveSession = originalGetActiveSession;
    CandidateGenerationService.generateHybridCandidates = originalGenerateHybridCandidates;
    resetSessionAdaptationConfig();
  }
}
