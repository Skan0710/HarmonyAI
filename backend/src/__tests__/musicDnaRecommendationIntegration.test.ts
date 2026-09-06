import assert from 'node:assert';
import { Types } from 'mongoose';
import {
  HybridRankingPipeline,
  HybridRankedResult,
} from '../services/hybridRankingPipeline.js';
import {
  AdaptiveRecommendationRankingPipeline,
  AdaptivePipelineOptions,
} from '../services/adaptiveRecommendationRankingPipeline.js';
import {
  CandidateGenerationService,
  HybridCandidate,
  computeSongTasteAffinity,
} from '../services/candidateGenerationService.js';
import {
  getMusicDNAInfluenceConfig,
  updateMusicDNAInfluenceConfig,
  resetMusicDNAInfluenceConfig,
  getRecommendationSignalConfig,
  resetRecommendationSignalConfig,
} from '../config/recommendationConfig.js';
import { UnifiedMusicDNA, MusicDNAProfileAttributes } from '../schemas/musicDnaSchema.js';

export async function runMusicDnaRecommendationIntegrationTests() {
  console.log('[Music DNA Recommendation Integration Test Suite] Starting tests...\n');

  const createMockCandidate = (
    id: string,
    title: string,
    artistName: string,
    genreName: string,
    mood = 'Chill',
    audioFeatures: { energy?: number; tempo?: number } = { energy: 0.5, tempo: 110 },
    scores: {
      content?: number;
      collaborative?: number;
      affinity?: number;
      popularity?: number;
      recency?: number;
    } = {}
  ): HybridCandidate => ({
    songId: id,
    contentScore: scores.content ?? 0.7,
    collaborativeScore: scores.collaborative ?? 0.7,
    userTasteAffinityScore: scores.affinity ?? 0.7,
    popularitySignal: scores.popularity ?? 500,
    recencySignal: scores.recency ?? 0.8,
    sources: ['hybrid_personalized'],
    songDoc: {
      _id: id,
      title,
      artist: { _id: `artist-${artistName.toLowerCase().replace(/\s+/g, '-')}`, name: artistName },
      genre: { _id: `genre-${genreName.toLowerCase().replace(/\s+/g, '-')}`, name: genreName },
      mood,
      audioFeatures,
      playCount: scores.popularity ?? 500,
    },
  });

  const createMockMusicDNA = (overrides?: Partial<UnifiedMusicDNA>): UnifiedMusicDNA => ({
    userId: new Types.ObjectId().toString(),
    dnaVersion: '1.0.0',
    confidenceScore: 0.9,
    lastRefreshedAt: new Date(),
    interactionsCountAtLastRefresh: 50,
    genreProfile: {
      topGenres: [
        {
          name: 'Ambient Electronic',
          score: 0.95,
          preferenceType: 'established',
          playCount: 40,
          shortTermScore: 0.9,
          longTermScore: 0.95,
          momentumDelta: -0.05,
          explanation: 'Established favorite genre',
        },
      ],
      emergingGenres: [
        {
          name: 'Synthwave',
          score: 0.85,
          preferenceType: 'emerging',
          playCount: 15,
          shortTermScore: 0.9,
          longTermScore: 0.3,
          momentumDelta: 0.6,
          explanation: 'Fastest growing genre',
        },
      ],
      diversity: {
        score: 0.6,
        effectiveCount: 4,
        normalizedEntropy: 0.65,
        level: 'moderate',
        summary: 'Balanced genre palette',
      },
    },
    artistProfile: {
      strongestArtists: [
        {
          name: 'Solar Fields',
          score: 0.92,
          preferenceType: 'established',
          playCount: 30,
          shortTermScore: 0.85,
          longTermScore: 0.95,
          momentumDelta: -0.1,
          explanation: 'Primary artist',
        },
      ],
      emergingArtists: [
        {
          name: 'Kavinsky',
          score: 0.80,
          preferenceType: 'emerging',
          playCount: 10,
          shortTermScore: 0.85,
          longTermScore: 0.2,
          momentumDelta: 0.65,
          explanation: 'Emerging favorite artist',
        },
      ],
      diversity: {
        score: 0.55,
        effectiveCount: 5,
        normalizedEntropy: 0.60,
        level: 'moderate',
        summary: 'Focused artist group',
      },
    },
    moodProfile: {
      preferredMoods: [
        {
          name: 'Focus',
          score: 0.9,
          preferenceType: 'established',
          playCount: 35,
          shortTermScore: 0.9,
          longTermScore: 0.9,
          momentumDelta: 0.0,
          explanation: 'Primary listening mood',
        },
      ],
    },
    listeningBehavior: {
      userId: new Types.ObjectId().toString(),
      repeatListeningTendency: 0.7,
      discoveryTendency: 0.4,
      skipTendency: 0.1,
      familiarityPreference: 0.75,
      explorationTendency: 0.35,
      diversityPreference: 0.5,
      sessionListeningIntensity: 0.6,
      preferenceStability: 0.8,
      preferenceChangeRate: 0.2,
      listenerArchetype: 'Loyalist',
      isDataSufficient: true,
      metricsBreakdown: {
        totalPlaysAnalyzed: 50,
        uniqueTracksCount: 20,
        uniqueArtistsCount: 8,
        uniqueGenresCount: 4,
        totalSessionsAnalyzed: 10,
        avgTracksPerSession: 5,
        avgSessionDurationMinutes: 25,
        skipRatio: 0.1,
        completionRatio: 0.85,
        replayRatio: 0.3,
      },
      confidenceScore: 0.9,
      generatedAt: new Date(),
    },
    temporalPreferences: {
      stabilityScore: 0.8,
      trendingGenres: ['Synthwave'],
      emergingGenres: ['Synthwave'],
    },
    tendencies: {
      discoveryTendency: 0.4,
      familiarityPreference: 0.75,
      diversityPreference: 0.5,
      explorationPreference: 0.35,
    },
    listeningPatterns: {
      audioFeaturePreferences: {
        energy: 0.45,
      },
      preferredTempo: {
        target: 105,
      },
    },
    ...overrides,
  });

  try {
    // =========================================================================
    // Test 1: Graceful Fallback & Numerical Invariance when Music DNA is Absent
    // =========================================================================
    {
      console.log('--- Test 1: Graceful Fallback & Baseline Invariance ---');
      resetRecommendationSignalConfig();
      resetMusicDNAInfluenceConfig();

      const candidateA = createMockCandidate('cand-1', 'Track One', 'Artist A', 'Rock');
      const candidateB = createMockCandidate('cand-2', 'Track Two', 'Artist B', 'Jazz');
      const candidates = [candidateA, candidateB];

      const resNoDna = HybridRankingPipeline.rankCandidates(candidates, 5);
      const resNullDna = HybridRankingPipeline.rankCandidates(
        candidates,
        5,
        undefined,
        null,
        undefined,
        null,
        undefined,
        null,
        null,
        undefined,
        null
      );
      const resUndefinedDna = HybridRankingPipeline.rankCandidates(
        candidates,
        5,
        undefined,
        null,
        undefined,
        null,
        undefined,
        null,
        null,
        undefined,
        undefined
      );

      assert.strictEqual(resNoDna.length, 2);
      assert.strictEqual(resNullDna.length, 2);
      assert.strictEqual(resUndefinedDna.length, 2);

      assert.strictEqual(
        resNoDna[0].hybridScore,
        resNullDna[0].hybridScore,
        'Omitting DNA vs passing explicit null DNA must be identical'
      );
      assert.strictEqual(
        resNoDna[0].hybridScore,
        resUndefinedDna[0].hybridScore,
        'Omitting DNA vs passing undefined DNA must be identical'
      );
      assert.strictEqual(
        resNullDna[0].componentScores.musicDnaScore,
        undefined,
        'musicDnaScore must be undefined when Music DNA is null'
      );

      console.log('✓ Test 1 Passed: Graceful fallback and 100% numerical invariance confirmed.');
    }

    // =========================================================================
    // Test 2: Personalized Preference Influence (Genre & Artist Matching)
    // =========================================================================
    {
      console.log('\n--- Test 2: Personalized Preference Influence (Genre & Artist Alignment) ---');
      const musicDna = createMockMusicDNA();

      const dnaMatchedCandidate = createMockCandidate(
        'dna-match',
        'Ambient Light',
        'Solar Fields',
        'Ambient Electronic',
        'Focus',
        { energy: 0.45, tempo: 105 },
        { content: 0.7, collaborative: 0.7, affinity: 0.7 }
      );

      const dnaUnmatchedCandidate = createMockCandidate(
        'dna-unmatch',
        'Heavy Metal Anthem',
        'Iron Forge',
        'Heavy Metal',
        'Angry',
        { energy: 0.95, tempo: 160 },
        { content: 0.7, collaborative: 0.7, affinity: 0.7 }
      );

      const pool = [dnaUnmatchedCandidate, dnaMatchedCandidate];

      // Rank with Music DNA active
      const ranked = HybridRankingPipeline.rankCandidates(
        pool,
        2,
        undefined,
        null,
        undefined,
        null,
        undefined,
        null,
        null,
        undefined,
        musicDna,
        0.20 // 20% Music DNA influence
      );

      assert.strictEqual(
        ranked[0].song._id,
        'dna-match',
        'DNA-matched candidate must rank #1 over unmatched candidate with identical baseline'
      );
      assert.ok(
        ranked[0].hybridScore > ranked[1].hybridScore,
        'DNA-matched score must be strictly greater than unmatched score'
      );
      assert.ok(
        (ranked[0].componentScores.musicDnaScore ?? 0) > (ranked[1].componentScores.musicDnaScore ?? 0),
        'DNA-matched candidate must have a higher musicDnaScore component'
      );
      assert.strictEqual(ranked[0].metadata?.musicDnaInfluence, 0.20);
      assert.strictEqual(ranked[0].metadata?.musicDnaConfidence, 0.9);

      console.log(`✓ Test 2 Passed: DNA-matched track (${ranked[0].song.title}: score ${ranked[0].hybridScore}) boosted above unmatched (${ranked[1].song.title}: score ${ranked[1].hybridScore}).`);
    }

    // =========================================================================
    // Test 3: Emerging Taste Responsiveness (Surfacing Emerging Preferences)
    // =========================================================================
    {
      console.log('\n--- Test 3: Emerging Taste Responsiveness ---');
      const musicDna = createMockMusicDNA();

      const emergingTrack = createMockCandidate(
        'emerging-track',
        'Nightcall',
        'Kavinsky',
        'Synthwave',
        'Chill',
        { energy: 0.6, tempo: 115 },
        { content: 0.7, collaborative: 0.7, affinity: 0.7 }
      );

      const unrelatedTrack = createMockCandidate(
        'unrelated-track',
        'Country Road',
        'Country Folk',
        'Country',
        'Chill',
        { energy: 0.6, tempo: 115 },
        { content: 0.7, collaborative: 0.7, affinity: 0.7 }
      );

      const ranked = HybridRankingPipeline.rankCandidates(
        [unrelatedTrack, emergingTrack],
        2,
        undefined,
        null,
        undefined,
        null,
        undefined,
        null,
        null,
        undefined,
        musicDna,
        0.20
      );

      assert.strictEqual(ranked[0].song._id, 'emerging-track');
      assert.ok(
        (ranked[0].componentScores.musicDnaScore ?? 0) > (ranked[1].componentScores.musicDnaScore ?? 0),
        'Emerging genre/artist alignment must generate higher musicDnaScore than unrelated'
      );

      console.log('✓ Test 3 Passed: Emerging preferences (Synthwave / Kavinsky) correctly boosted.');
    }

    // =========================================================================
    // Test 4: Balanced Influence (Never Overpowering Context, Session, or Baseline)
    // =========================================================================
    {
      console.log('\n--- Test 4: Balanced Influence & Baseline Preservation ---');
      const musicDna = createMockMusicDNA();

      const workoutTrack = createMockCandidate(
        'workout-1',
        'Fast Cardio Beat',
        'Gym Beats',
        'EDM',
        'Energetic',
        { energy: 0.90, tempo: 140 },
        { content: 0.7, collaborative: 0.7, affinity: 0.7 }
      );

      const chillDnaTrack = createMockCandidate(
        'dna-chill',
        'Ambient Sleep',
        'Solar Fields',
        'Ambient Electronic',
        'Focus',
        { energy: 0.20, tempo: 70 },
        { content: 0.7, collaborative: 0.7, affinity: 0.7 }
      );

      // Context = workout (requests high energy & tempo)
      const rankedContext = HybridRankingPipeline.rankCandidates(
        [chillDnaTrack, workoutTrack],
        2,
        undefined,
        { situation: 'workout', desiredEnergy: 0.95 },
        0.30, // 30% Context influence
        null,
        undefined,
        null,
        null,
        undefined,
        musicDna,
        0.15 // 15% Music DNA influence
      );

      // In workout context, workout track must outscore chill DNA track
      assert.strictEqual(
        rankedContext[0].song._id,
        'workout-1',
        'Context must appropriately guide recommendations when active without DNA overpowering it'
      );

      // Verify Session Dynamic Skip Suppression:
      // Even if track matches DNA, if it was directly skipped in the active session, session suppression applies
      const mockSession: any = {
        tracksSkipped: [{ song: 'dna-chill', skippedAt: new Date() }],
      };
      const mockSessionProfile: any = {
        sessionId: 'session-test',
        temporaryGenres: [],
        temporaryArtists: [],
        preferredGenres: [{ genre: 'EDM', score: 0.9 }],
        preferredArtists: [{ artistId: 'artist-gym-beats', score: 0.9 }],
        dominantMoods: [{ mood: 'energetic', score: 0.9 }],
        interactionSummary: { skipsCount: 2, completionsCount: 3, replaysCount: 0 },
        skippedGenreWeights: { 'Ambient Electronic': 2 },
      };

      const rankedSession = HybridRankingPipeline.rankCandidates(
        [chillDnaTrack, workoutTrack],
        2,
        undefined,
        null,
        undefined,
        mockSessionProfile,
        0.25,
        mockSession,
        null,
        undefined,
        musicDna,
        0.15
      );

      assert.strictEqual(
        rankedSession[0].song._id,
        'workout-1',
        'Session skipped penalty must suppress track despite matching Music DNA'
      );

      console.log('✓ Test 4 Passed: Balanced multi-signal co-existence strictly verified.');
    }

    // =========================================================================
    // Test 5: Dynamic Configurability & Zero-Influence Mode
    // =========================================================================
    {
      console.log('\n--- Test 5: Dynamic Configurability & Zero-Influence Mode ---');
      const musicDna = createMockMusicDNA();

      const matched = createMockCandidate('m-1', 'Track A', 'Solar Fields', 'Ambient Electronic');
      const unmatched = createMockCandidate('u-1', 'Track B', 'Other Artist', 'Country');
      const candidates = [unmatched, matched];

      // 1. With influence = 0 -> Scores must be identical (no bias)
      const zeroDnaRes = HybridRankingPipeline.rankCandidates(
        candidates,
        2,
        undefined,
        null,
        undefined,
        null,
        undefined,
        null,
        null,
        undefined,
        musicDna,
        0.0 // 0% influence
      );
      assert.strictEqual(
        zeroDnaRes[0].hybridScore,
        zeroDnaRes[1].hybridScore,
        'With customMusicDnaInfluence = 0, candidates with identical base metrics have equal score'
      );

      // 2. Tune global config
      updateMusicDNAInfluenceConfig({ defaultMusicDNAInfluence: 0.30 });
      const config = getMusicDNAInfluenceConfig();
      assert.strictEqual(config.defaultMusicDNAInfluence, 0.30);

      const tunedRes = HybridRankingPipeline.rankCandidates(
        candidates,
        2,
        undefined,
        null,
        undefined,
        null,
        undefined,
        null,
        null,
        undefined,
        musicDna
      );
      assert.strictEqual(tunedRes[0].song._id, 'm-1');
      assert.strictEqual(tunedRes[0].metadata?.musicDnaInfluence, 0.30);

      // Reset
      resetMusicDNAInfluenceConfig();
      const resetConfig = getMusicDNAInfluenceConfig();
      assert.strictEqual(resetConfig.defaultMusicDNAInfluence, 0.15);

      console.log('✓ Test 5 Passed: Dynamic runtime configurability and zero-influence mode verified.');
    }

    // =========================================================================
    // Test 6: CandidateGenerationService Taste Affinity Augmentation
    // =========================================================================
    {
      console.log('\n--- Test 6: Candidate Generation Taste Affinity Augmentation ---');
      const musicDna = createMockMusicDNA();

      const songDoc = {
        _id: 'song-test',
        genre: { name: 'Ambient Electronic' },
        artist: { name: 'Solar Fields' },
      };

      // When traditional tasteProfile is null, computeSongTasteAffinity leverages Music DNA
      const affinity = computeSongTasteAffinity(songDoc, null, musicDna);
      assert.ok(affinity > 0.8, `Affinity score should reflect Music DNA match, got: ${affinity}`);

      const unrelatedSongDoc = {
        _id: 'song-unrelated',
        genre: { name: 'Polka' },
        artist: { name: 'Polka Band' },
      };
      const zeroAffinity = computeSongTasteAffinity(unrelatedSongDoc, null, musicDna);
      assert.strictEqual(zeroAffinity, 0, 'Unrelated song must have 0 affinity');

      console.log(`✓ Test 6 Passed: Taste affinity augmented by Music DNA (matched: ${affinity}, unmatched: ${zeroAffinity}).`);
    }

    // =========================================================================
    // Test 7: Full Adaptive Recommendation Ranking Pipeline Integration
    // =========================================================================
    {
      console.log('\n--- Test 7: Full Adaptive Recommendation Ranking Pipeline Integration ---');
      const userId = new Types.ObjectId().toString();
      const musicDna = createMockMusicDNA({
        tendencies: {
          discoveryTendency: 0.4,
          familiarityPreference: 0.8,
          diversityPreference: 0.7,
          explorationPreference: 0.65,
        },
      });

      const candidates = [
        createMockCandidate('p-1', 'Ambient Echoes', 'Solar Fields', 'Ambient Electronic', 'Focus', { energy: 0.45, tempo: 105 }),
        createMockCandidate('p-2', 'Synthwave Runner', 'Kavinsky', 'Synthwave', 'Chill', { energy: 0.60, tempo: 115 }),
        createMockCandidate('p-3', 'Pop Melody', 'Pop Singer', 'Pop', 'Happy', { energy: 0.75, tempo: 125 }),
        createMockCandidate('p-4', 'Jazz Standard', 'Jazz Trio', 'Jazz', 'Chill', { energy: 0.40, tempo: 90 }),
        createMockCandidate('p-5', 'Rock Beat', 'Rock Band', 'Rock', 'Energetic', { energy: 0.85, tempo: 135 }),
      ];

      const pipelineResult = await AdaptiveRecommendationRankingPipeline.executePipeline({
        userId,
        candidates,
        limit: 5,
        musicDnaProfile: musicDna,
        userClassification: 'ACTIVE',
        enableAllStages: true,
      });

      assert.strictEqual(pipelineResult.strategyUsed, 'HYBRID_PERSONALIZED');
      assert.strictEqual(pipelineResult.recommendations.length, 5);
      assert.ok(pipelineResult.diagnostics.musicDna?.applied, 'musicDna diagnostic must be marked applied');
      assert.strictEqual(pipelineResult.diagnostics.musicDna?.confidenceScore, 0.9);
      assert.ok(
        pipelineResult.diagnostics.musicDna?.matchedCandidatesCount !== undefined &&
        pipelineResult.diagnostics.musicDna.matchedCandidatesCount >= 1,
        'Should detect at least 1 candidate matched with Music DNA'
      );

      // Verify that componentScores include musicDnaScore
      const topRec = pipelineResult.recommendations[0];
      assert.ok(topRec.componentScores.musicDnaScore !== undefined, 'componentScores must contain musicDnaScore');

      console.log('✓ Test 7 Passed: Full Adaptive Recommendation Pipeline executes seamlessly with Music DNA.');
    }

    console.log('\n🎉 ALL 7 MUSIC DNA RECOMMENDATION INTEGRATION TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Music DNA Recommendation Integration test failed:', err);
    throw err;
  }
}

// Standalone execution support
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  runMusicDnaRecommendationIntegrationTests()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
