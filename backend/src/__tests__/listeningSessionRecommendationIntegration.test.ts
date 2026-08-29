import assert from 'node:assert';
import { HybridRankingPipeline } from '../services/hybridRankingPipeline.js';
import { HybridCandidate } from '../services/candidateGenerationService.js';
import { SessionTasteProfile } from '../services/sessionTasteProfileService.js';
import { IListeningSession } from '../models/ListeningSession.js';
import { Types } from 'mongoose';

export function runListeningSessionRecommendationIntegrationTests() {
  console.log('[Listening Session Recommendation Integration Test Suite] Starting tests...');

  // Mock Candidate Pool
  const candidateEdm1: HybridCandidate = {
    songId: 'edm-song-1',
    contentScore: 0.85,
    collaborativeScore: 0.80,
    userTasteAffinityScore: 0.82,
    popularitySignal: 800,
    recencySignal: 0.85,
    sources: ['content', 'taste_profile'],
    songDoc: {
      _id: 'edm-song-1',
      title: 'Neon Rush',
      artist: { _id: 'artist-edm', name: 'DJ Neon' },
      genre: 'EDM',
      mood: 'Energetic',
      audioFeatures: { energy: 0.92, tempo: 138 },
    },
  };

  const candidateRock1: HybridCandidate = {
    songId: 'rock-song-1',
    contentScore: 0.88,
    collaborativeScore: 0.85,
    userTasteAffinityScore: 0.85,
    popularitySignal: 900,
    recencySignal: 0.80,
    sources: ['collaborative', 'taste_profile'],
    songDoc: {
      _id: 'rock-song-1',
      title: 'Thunderstrike',
      artist: { _id: 'artist-rock', name: 'Thunder Band' },
      genre: 'Rock',
      mood: 'Energetic',
      audioFeatures: { energy: 0.88, tempo: 130 },
    },
  };

  const candidateLofi1: HybridCandidate = {
    songId: 'lofi-song-1',
    contentScore: 0.70,
    collaborativeScore: 0.65,
    userTasteAffinityScore: 0.70,
    popularitySignal: 400,
    recencySignal: 0.70,
    sources: ['content'],
    songDoc: {
      _id: 'lofi-song-1',
      title: 'Morning Rain',
      artist: { _id: 'artist-lofi', name: 'Chill Tape' },
      genre: 'Lo-Fi',
      mood: 'Calm',
      audioFeatures: { energy: 0.25, tempo: 75 },
    },
  };

  const candidatePool: HybridCandidate[] = [candidateEdm1, candidateRock1, candidateLofi1];

  // Test 1: Invariance when no session profile is supplied
  {
    const baselineResults = HybridRankingPipeline.rankCandidates(candidatePool, 3);
    assert.strictEqual(baselineResults.length, 3);
    for (const res of baselineResults) {
      assert.strictEqual(res.hybridScore, res.originalScore);
      assert.strictEqual(res.componentScores.sessionScore, undefined);
    }

    console.log('✓ Test 1 Passed: Preserves exact baseline recommendation behavior when no session exists.');
  }

  // Test 2: Active session taste profile modifies ranking in real time
  {
    const edmSessionProfile: SessionTasteProfile = {
      sessionId: new Types.ObjectId().toString(),
      userId: new Types.ObjectId().toString(),
      totalInteractions: 5,
      preferredGenres: [{ genre: 'EDM', score: 0.80, rawWeight: 4.5 }],
      preferredArtists: [{ artistId: 'artist-edm', name: 'DJ Neon', score: 0.80, rawWeight: 4.0 }],
      averageEnergy: 0.90,
      averageTempo: 140,
      dominantMoods: [{ mood: 'energetic', score: 0.90 }],
      discoveryLevel: 0.30,
      interactionSummary: {
        playsCount: 3,
        skipsCount: 0,
        completionsCount: 2,
        replaysCount: 1,
        likesCount: 1,
      },
      isTemporary: true,
      lastUpdated: new Date(),
    };

    const sessionRanked = HybridRankingPipeline.rankCandidates(
      candidatePool,
      3,
      undefined,
      undefined,
      undefined,
      edmSessionProfile,
      0.25
    );

    assert.strictEqual(sessionRanked[0].song._id, 'edm-song-1');
    assert.ok(sessionRanked[0].componentScores.sessionScore !== undefined);
    assert.ok(sessionRanked[0].componentScores.sessionScore > 0.7);

    console.log('✓ Test 2 Passed: Active session taste profile promotes aligned session tracks.');
  }

  // Test 3: Increase influence of completed/replayed tracks
  {
    const completionSessionProfile: SessionTasteProfile = {
      sessionId: new Types.ObjectId().toString(),
      userId: new Types.ObjectId().toString(),
      totalInteractions: 4,
      preferredGenres: [
        { genre: 'EDM', score: 0.70, rawWeight: 3.5 },
        { genre: 'Rock', score: 0.30, rawWeight: 1.5 },
      ],
      preferredArtists: [{ artistId: 'artist-edm', name: 'DJ Neon', score: 0.70, rawWeight: 3.0 }],
      averageEnergy: 0.90,
      averageTempo: 135,
      dominantMoods: [{ mood: 'energetic', score: 0.80 }],
      discoveryLevel: 0.20,
      interactionSummary: {
        playsCount: 2,
        skipsCount: 0,
        completionsCount: 2, // Recent completions
        replaysCount: 1,    // Recent replay
        likesCount: 0,
      },
      isTemporary: true,
      lastUpdated: new Date(),
    };

    const results = HybridRankingPipeline.rankCandidates(
      candidatePool,
      3,
      undefined,
      undefined,
      undefined,
      completionSessionProfile,
      0.30
    );

    assert.strictEqual(results[0].song._id, 'edm-song-1');
    assert.ok(results[0].hybridScore > results[1].hybridScore);

    console.log('✓ Test 3 Passed: Increased influence for tracks aligned with completed/replayed session items.');
  }

  // Test 4: Skip suppression penalizes skipped tracks
  {
    const mockSessionDoc = {
      _id: new Types.ObjectId(),
      tracksSkipped: [
        {
          song: new Types.ObjectId('600000000000000000000001'), // Rock song skipped
          skippedAt: new Date(),
        },
      ],
    } as any;

    const rockSkippedProfile: SessionTasteProfile = {
      sessionId: mockSessionDoc._id.toString(),
      userId: new Types.ObjectId().toString(),
      totalInteractions: 4,
      preferredGenres: [{ genre: 'EDM', score: 0.90, rawWeight: 4.0 }],
      preferredArtists: [],
      averageEnergy: 0.90,
      averageTempo: 138,
      dominantMoods: [],
      discoveryLevel: 0.10,
      interactionSummary: {
        playsCount: 2,
        skipsCount: 2, // Repeated skips of rock
        completionsCount: 1,
        replaysCount: 0,
        likesCount: 0,
      },
      isTemporary: true,
      lastUpdated: new Date(),
    };

    // Give rock candidate the skipped ID
    const rockCandidateWithSkippedId: HybridCandidate = {
      ...candidateRock1,
      songDoc: {
        ...candidateRock1.songDoc,
        _id: '600000000000000000000001',
      },
    };

    const results = HybridRankingPipeline.rankCandidates(
      [candidateEdm1, rockCandidateWithSkippedId],
      2,
      undefined,
      undefined,
      undefined,
      rockSkippedProfile,
      0.30,
      mockSessionDoc
    );

    assert.strictEqual(results[0].song._id, 'edm-song-1');
    assert.ok(results[1].componentScores.sessionScore! < 0.20, 'Directly skipped song must have suppressed session score');

    console.log('✓ Test 4 Passed: Repeated and direct skips properly penalize tracks during current session.');
  }

  // Test 5: Combination of long-term taste, session taste, and contextual preferences
  {
    const multiLayerProfile: SessionTasteProfile = {
      sessionId: new Types.ObjectId().toString(),
      userId: new Types.ObjectId().toString(),
      totalInteractions: 3,
      preferredGenres: [{ genre: 'EDM', score: 0.80, rawWeight: 3.0 }],
      preferredArtists: [],
      averageEnergy: 0.90,
      averageTempo: 140,
      dominantMoods: [],
      discoveryLevel: 0.20,
      interactionSummary: {
        playsCount: 2,
        skipsCount: 0,
        completionsCount: 1,
        replaysCount: 0,
        likesCount: 0,
      },
      isTemporary: true,
      lastUpdated: new Date(),
    };

    const results = HybridRankingPipeline.rankCandidates(
      candidatePool,
      3,
      undefined,
      'workout', // context
      0.20,      // context influence
      multiLayerProfile,
      0.20       // session influence
    );

    assert.strictEqual(results.length, 3);
    assert.ok(results[0].componentScores.userTasteAffinityScore > 0);
    assert.ok(results[0].componentScores.contextScore !== undefined);
    assert.ok(results[0].componentScores.sessionScore !== undefined);
    assert.ok(results[0].metadata?.contextSituation !== undefined);
    assert.ok(results[0].metadata?.sessionId !== undefined);

    console.log('✓ Test 5 Passed: Seamless three-way combination of long-term taste, session taste, and context.');
  }

  console.log('🎉 All 5 Listening Session Recommendation Integration tests completed successfully.');
}
