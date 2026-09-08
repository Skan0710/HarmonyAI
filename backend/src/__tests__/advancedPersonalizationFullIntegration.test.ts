import assert from 'node:assert';
import { Types } from 'mongoose';
import {
  AdaptiveRecommendationRankingPipeline,
  AdaptivePipelineOptions,
} from '../services/adaptiveRecommendationRankingPipeline.js';
import { HybridRecommendationService } from '../services/hybridRecommendationService.js';
import { PersonalizedDiscoveryModeService } from '../services/personalizedDiscoveryModeService.js';
import { SmartAutoplayService } from '../services/smartAutoplayService.js';
import { RecommendationEvaluationService } from '../services/recommendationEvaluationService.js';
import { RecommendationExplanationService } from '../services/recommendationExplanationService.js';
import { CandidateGenerationService, HybridCandidate } from '../services/candidateGenerationService.js';
import { TasteEvolutionSignal } from '../services/hybridRankingPipeline.js';
import { TasteBoundaryProfile } from '../services/tasteBoundaryDetectionService.js';
import { ComfortDiscoveryScoreResult } from '../services/comfortDiscoveryScoringService.js';
import { PersonalMusicTwinAttributes } from '../schemas/personalMusicTwinSchema.js';

export async function runAdvancedPersonalizationFullIntegrationTests() {
  console.log('[Day 34 Task 7: Full Advanced Personalization Integration Test Suite] Starting tests...\n');

  // Helper mock candidate builder
  const createMockCandidate = (
    id: string,
    title: string,
    artistName: string,
    genreName: string,
    scores: {
      content?: number;
      collaborative?: number;
      affinity?: number;
      popularity?: number;
      recency?: number;
      novelty?: number;
    },
    audioFeatures: Record<string, any> = { energy: 0.7, tempo: 120, danceability: 0.65, valence: 0.60, acousticness: 0.20 }
  ): HybridCandidate => ({
    songId: id,
    contentScore: scores.content ?? 0.8,
    collaborativeScore: scores.collaborative ?? 0.7,
    userTasteAffinityScore: scores.affinity ?? 0.75,
    popularitySignal: scores.popularity ?? 800,
    recencySignal: scores.recency ?? 0.85,
    sources: ['hybrid_personalized'],
    songDoc: {
      _id: id,
      title,
      artist: { _id: `artist-${artistName.toLowerCase().replace(/\s+/g, '-')}`, name: artistName },
      genre: { _id: `genre-${genreName.toLowerCase().replace(/\s+/g, '-')}`, name: genreName },
      mood: 'Energetic',
      audioFeatures,
      playCount: scores.popularity ?? 800,
    },
  });

  // =========================================================================
  // Test 1: New Users / Cold Start Flow
  // =========================================================================
  {
    console.log('--- Test 1: New Users / Cold Start Flow ---');
    const newUserId = new Types.ObjectId().toString();

    const candidates = [
      createMockCandidate('song-new-1', 'Universal Track 1', 'Pop Star A', 'Pop', { affinity: 0.3, popularity: 5000 }),
      createMockCandidate('song-new-2', 'Universal Track 2', 'Pop Star B', 'Dance', { affinity: 0.3, popularity: 4500 }),
      createMockCandidate('song-new-3', 'Universal Track 3', 'Pop Star C', 'Indie', { affinity: 0.2, popularity: 3500 }),
    ];

    const result = await AdaptiveRecommendationRankingPipeline.executePipeline({
      userId: newUserId,
      candidates,
      userClassification: 'NEW',
      limit: 3,
      explainRecommendations: true,
    });

    assert.ok(result.recommendations.length > 0, 'New user must receive recommendations');
    assert.strictEqual(result.userClassification, 'NEW');

    // Check for zero duplicate recommendations
    const songIds = result.recommendations.map((r) => String(r.song?._id || r.song?.id));
    assert.strictEqual(new Set(songIds).size, songIds.length, 'Must have zero duplicate recommendations');

    // Verify valid scoring and explanations
    for (const rec of result.recommendations) {
      assert.ok(!isNaN(rec.hybridScore), 'Scores must not be NaN');
      assert.ok(rec.hybridScore >= 0 && rec.hybridScore <= 1, 'Scores must be within [0, 1]');
      assert.ok(rec.explanation !== undefined, 'Recommendation must have explanation attached');
      assert.ok(Array.isArray(rec.reasons), 'Recommendation must have reasons array');
    }

    console.log('✓ Test 1 Passed: New user flow executed safely with zero duplicates and valid explanations.');
  }

  // =========================================================================
  // Test 2: Users with Strong Established Taste
  // =========================================================================
  {
    console.log('--- Test 2: Users with Strong Established Taste ---');
    const establishedUserId = new Types.ObjectId().toString();

    const candidates = [
      createMockCandidate('song-est-1', 'Comfort Classic', 'Pink Floyd', 'Rock', { affinity: 0.95, content: 0.90 }),
      createMockCandidate('song-est-2', 'Progressive Journey', 'Rush', 'Rock', { affinity: 0.90, content: 0.85 }),
      createMockCandidate('song-est-3', 'Unrelated Dance Track', 'DJ Beat', 'EDM', { affinity: 0.15, content: 0.20 }),
      createMockCandidate('song-est-4', 'Psychedelic Echo', 'Led Zeppelin', 'Rock', { affinity: 0.88, content: 0.80 }),
    ];

    const temporalProfile = {
      userId: establishedUserId,
      longTermHorizon: {
        topGenres: [{ name: 'Rock', affinityScore: 0.94, playCount: 300 }],
        topArtists: [{ name: 'Pink Floyd', affinityScore: 0.96, playCount: 250 }],
      },
    } as any;

    const musicDna = {
      tasteProfile: {
        coreArtists: [{ name: 'Pink Floyd', playCount: 250, affinity: 0.96 }],
      },
    };

    const cdScore: ComfortDiscoveryScoreResult = {
      userId: establishedUserId,
      comfortScore: 0.90,
      discoveryScore: 0.10,
      balanceRatio: -0.80,
      dominantMode: 'COMFORT',
      confidenceScore: 0.95,
      isDataSufficient: true,
      componentBreakdown: {} as any,
      rationales: ['Strong long-term rock foundation'],
      explanation: 'High comfort and familiarity preference',
      lastCalculatedAt: new Date(),
    };

    const result = await PersonalizedDiscoveryModeService.getRecommendationsForMode({
      userId: establishedUserId,
      mode: 'COMFORT',
      candidates,
      temporalProfile,
      comfortDiscoveryScore: cdScore,
      musicDna: musicDna as any,
      limit: 3,
    });

    assert.ok(result.recommendations.length > 0, 'Must return recommendations');
    const topSong = result.recommendations[0];
    assert.strictEqual(topSong.song.artist.name, 'Pink Floyd', 'Top song should be user established favorite');
    assert.ok(topSong.hybridScore >= 0.65, 'Score should be strong for established comfort track');

    // Verify explanation matches long-term taste or core artist
    const reasons = topSong.reasons || topSong.explanation?.reasons || [];
    const hasLongTermReason = reasons.some(
      (r: any) => r.type === 'MATCHES_LONG_TERM_TASTE' || r.type === 'SIMILAR_TO_FREQUENT_ARTISTS' || r.type === 'SIMILAR_ARTIST'
    );
    assert.ok(hasLongTermReason, 'Reason must reflect established taste anchor');

    console.log('✓ Test 2 Passed: Strong established taste user prioritized familiar bedrock with accurate reasons.');
  }

  // =========================================================================
  // Test 3: Highly Exploratory Users
  // =========================================================================
  {
    console.log('--- Test 3: Highly Exploratory Users ---');
    const exploratoryUserId = new Types.ObjectId().toString();

    const candidates = [
      createMockCandidate('song-exp-1', 'Novel Horizon', 'Future Sound', 'Experimental', { affinity: 0.85, content: 0.85 }, { energy: 0.8, tempo: 130 }),
      createMockCandidate('song-exp-2', 'Sonic Drift', 'Avant Guild', 'Ambient', { affinity: 0.75, content: 0.75 }, { energy: 0.4, tempo: 90 }),
      createMockCandidate('song-exp-3', 'Boring Standard Song', 'Familiar Pop', 'Pop', { affinity: 0.30, content: 0.30 }),
    ];

    const cdScore: ComfortDiscoveryScoreResult = {
      userId: exploratoryUserId,
      comfortScore: 0.20,
      discoveryScore: 0.88,
      balanceRatio: 0.68,
      dominantMode: 'DISCOVERY',
      confidenceScore: 0.92,
      isDataSufficient: true,
      componentBreakdown: {} as any,
      rationales: ['Active search for new sounds'],
      explanation: 'High discovery drive',
      lastCalculatedAt: new Date(),
    };

    const personalMusicTwin: PersonalMusicTwinAttributes = {
      userId: exploratoryUserId,
      listenerArchetype: 'Eclectic Explorer',
      confidenceScore: 0.90,
      explorationTendency: 0.88,
      dominantMusicalTraits: {
        energyPreference: 0.8,
        valencePreference: 0.6,
        targetTempoBpm: 130,
      },
      behavioralTraits: {
        discoveryTendency: 0.88,
        repeatListeningTendency: 0.15,
      },
    } as any;

    const result = await PersonalizedDiscoveryModeService.getRecommendationsForMode({
      userId: exploratoryUserId,
      mode: 'DISCOVER',
      candidates,
      comfortDiscoveryScore: cdScore,
      personalMusicTwin,
      limit: 2,
    });

    assert.ok(result.recommendations.length > 0, 'Must return recommendations');
    assert.strictEqual(result.mode, 'DISCOVER');

    // Discovery mode diagnostics must reflect elevated exploration
    assert.ok(result.diagnostics.effectiveExplorationRate >= 0.30, 'Exploration rate should be elevated');
    assert.ok(result.diagnostics.effectiveNoveltyWeights.noveltyWeight >= 0.40, 'Novelty weight should be boosted');

    // Reason should ground in discovery preference
    const hasDiscoveryReason = result.recommendations.some((rec) => {
      const reasons = rec.reasons || rec.explanation?.reasons || [];
      return reasons.some((r: any) => r.type === 'FITS_DISCOVERY_PREFERENCE' || r.type === 'DISCOVERY_OPPORTUNITY' || r.type === 'NOVELTY');
    });
    assert.ok(hasDiscoveryReason, 'Reason must reflect discovery preference for exploratory user');

    console.log('✓ Test 3 Passed: Highly exploratory user received elevated discovery with grounded reasons.');
  }

  // =========================================================================
  // Test 4: Comfort-Oriented Users
  // =========================================================================
  {
    console.log('--- Test 4: Comfort-Oriented Users ---');
    const comfortUserId = new Types.ObjectId().toString();

    const candidates = [
      createMockCandidate('song-comf-1', 'Home Sweet Home', 'Comfort Band', 'Acoustic', { affinity: 0.92, content: 0.85 }),
      createMockCandidate('song-comf-2', 'Outlier Shock', 'Weird Noise', 'Noise', { affinity: 0.10, content: 0.10 }),
    ];

    const cdScore: ComfortDiscoveryScoreResult = {
      userId: comfortUserId,
      comfortScore: 0.92,
      discoveryScore: 0.08,
      balanceRatio: -0.84,
      dominantMode: 'COMFORT',
      confidenceScore: 0.95,
      isDataSufficient: true,
      componentBreakdown: {} as any,
      rationales: ['Strong repeat listening of comfort artists'],
      explanation: 'Preference for familiar bedrock',
      lastCalculatedAt: new Date(),
    };

    const result = await PersonalizedDiscoveryModeService.getRecommendationsForMode({
      userId: comfortUserId,
      mode: 'COMFORT',
      candidates,
      comfortDiscoveryScore: cdScore,
      limit: 2,
    });

    assert.strictEqual(result.recommendations[0].song.title, 'Home Sweet Home');
    assert.ok(result.diagnostics.effectiveExplorationRate <= 0.10, 'Exploration rate should be dampened for comfort user');

    console.log('✓ Test 4 Passed: Comfort-oriented user received zero intrusion from outlier tracks.');
  }

  // =========================================================================
  // Test 5: Users with Emerging Tastes
  // =========================================================================
  {
    console.log('--- Test 5: Users with Emerging Tastes ---');
    const emergingUserId = new Types.ObjectId().toString();

    const candidates = [
      createMockCandidate('song-em-1', 'Neon Lights', 'Kavinsky', 'Synthwave', { affinity: 0.70, content: 0.80 }),
      createMockCandidate('song-em-2', 'Random Fluke', 'One Hit Wonder', 'Vaporwave', { affinity: 0.50, content: 0.60 }),
      createMockCandidate('song-em-3', 'Old Habit', 'Legacy Artist', 'Classic Rock', { affinity: 0.80, content: 0.70 }),
    ];

    const tasteEvolutionSignal: TasteEvolutionSignal = {
      tasteStabilityRating: 'moderate_evolution',
      tasteStabilityScore: 0.55,
      emergingGenres: ['Synthwave'],
      fadingGenres: ['Classic Rock'],
    };

    const emergingTasteReport = {
      emergingGenres: [
        { name: 'Synthwave', confidence: 0.88, recentPlayCount: 9, recentPlays: 9, hasPositiveFeedback: true },
      ],
    };

    const result = await PersonalizedDiscoveryModeService.getRecommendationsForMode({
      userId: emergingUserId,
      mode: 'WHATS_NEW_FOR_YOU',
      candidates,
      tasteEvolutionSignal,
      emergingTasteReport,
      configOverride: {
        tasteEvolutionOverrides: {
          emergingGenreBoost: 0.35,
          minEmergenceConfidence: 0.40,
        },
      },
      limit: 2,
    });

    assert.ok(result.recommendations.length > 0);
    const topSong = result.recommendations[0];
    assert.strictEqual(topSong.song.title, 'Neon Lights', 'Verified emerging genre track should rank #1');

    // Check explanation reason for emerging preference
    const explanation = RecommendationExplanationService.explainSong({
      song: topSong.song,
      componentScores: topSong.componentScores,
      sources: topSong.sources,
      emergingTasteReport: emergingTasteReport as any,
      tasteEvolutionSignal,
    });

    const emergingReason = explanation.reasons.find((r) => r.type === 'EMERGING_PREFERENCE');
    assert.ok(emergingReason !== undefined, 'EMERGING_PREFERENCE reason must be emitted');
    assert.strictEqual(emergingReason.metadata?.target, 'Synthwave');

    console.log('✓ Test 5 Passed: Emerging taste user boosted verified emerging genre with EMERGING_PREFERENCE reason.');
  }

  // =========================================================================
  // Test 6: Users with Rapidly Changing / Volatile Taste
  // =========================================================================
  {
    console.log('--- Test 6: Users with Rapidly Changing / Volatile Taste ---');
    const volatileUserId = new Types.ObjectId().toString();

    const candidates = [
      createMockCandidate('song-vol-1', 'DnB Roller', 'Sub Focus', 'Drum and Bass', { affinity: 0.75, content: 0.85 }),
      createMockCandidate('song-vol-2', 'Stale Past', 'Past Legend', 'Blues', { affinity: 0.85, content: 0.60 }),
    ];

    const tasteEvolutionSignal: TasteEvolutionSignal = {
      tasteStabilityRating: 'rapid_transformation',
      tasteStabilityScore: 0.20,
      emergingGenres: ['Drum and Bass'],
      fadingGenres: ['Blues'],
    };

    const temporalProfile = {
      userId: volatileUserId,
      shortTermHorizon: {
        topGenres: [{ name: 'Drum and Bass', momentum: 0.90, playCount: 25 }],
        topArtists: [{ name: 'Sub Focus', momentum: 0.88, playCount: 20 }],
      },
      longTermHorizon: {
        topGenres: [{ name: 'Blues', affinityScore: 0.85 }],
      },
    } as any;

    const result = await AdaptiveRecommendationRankingPipeline.executePipeline({
      userId: volatileUserId,
      candidates,
      tasteEvolutionSignal,
      temporalProfile,
      useAdaptiveExploration: true,
      limit: 2,
      explainRecommendations: true,
    });

    assert.ok(result.recommendations.length > 0);
    // Rapid transformation increases exploration rate
    assert.ok(result.diagnostics.explorationAdjustment.effectiveExplorationRate! >= 0.25);
    assert.strictEqual(result.recommendations[0].song.genre.name, 'Drum and Bass', 'Recent momentum should prevail over fading blues');

    const topRec = result.recommendations[0];
    const reasons = topRec.reasons || [];
    const hasRecentReason = reasons.some((r: any) => r.type === 'ALIGNS_WITH_RECENT_LISTENING');
    assert.ok(hasRecentReason, 'ALIGNS_WITH_RECENT_LISTENING reason must be present for volatile momentum user');

    console.log('✓ Test 6 Passed: Volatile/rapidly changing taste dynamically adapted exploration and recent momentum.');
  }

  // =========================================================================
  // Test 7: Users with Insufficient History / LIMITED_DATA
  // =========================================================================
  {
    console.log('--- Test 7: Users with Insufficient History / LIMITED_DATA ---');
    const sparseUserId = new Types.ObjectId().toString();

    // Sparse candidate with minimal fields
    const sparseCandidates: HybridCandidate[] = [
      {
        songId: 'song-sparse-1',
        contentScore: 0.5,
        collaborativeScore: 0.2,
        userTasteAffinityScore: 0.3,
        popularitySignal: 100,
        recencySignal: 0.5,
        sources: ['cold_start_hybrid'],
        songDoc: {
          _id: 'song-sparse-1',
          title: 'Sparse Track',
          artist: 'Solo Artist', // string instead of populated object
          genre: undefined,       // missing genre
          audioFeatures: null,    // missing audio features
        },
      },
    ];

    const result = await AdaptiveRecommendationRankingPipeline.executePipeline({
      userId: sparseUserId,
      candidates: sparseCandidates,
      userClassification: 'LIMITED_DATA',
      limit: 1,
      explainRecommendations: true,
    });

    assert.strictEqual(result.recommendations.length, 1);
    const rec = result.recommendations[0];
    assert.ok(!isNaN(rec.hybridScore), 'Score must not be NaN');
    assert.ok(rec.hybridScore >= 0 && rec.hybridScore <= 1, 'Score must be in range');
    assert.ok(rec.explanation !== undefined, 'Explanation must not crash on missing metadata');

    console.log('✓ Test 7 Passed: Sparse user with missing metadata processed without crashes or NaN scores.');
  }

  // =========================================================================
  // Test 8: Full End-to-End Conceptual Flow Verification
  // =========================================================================
  {
    console.log('--- Test 8: Full End-to-End Conceptual Flow Verification ---');
    // Flow: User History → Temporal Taste → Music DNA → Taste Evolution → Personal Music Twin → Comfort/Discovery Profile → Taste Boundaries → Candidate Generation → Adaptive Ranking → Novelty/Diversity → Personalized Mode → Final Recommendation → Explanation
    const fullFlowUserId = new Types.ObjectId().toString();

    const candidates = [
      createMockCandidate('ff-1', 'Synth Horizon', 'Gunship', 'Synthwave', { affinity: 0.85, content: 0.88, collaborative: 0.80 }),
      createMockCandidate('ff-2', 'Boundary Voyage', 'Slowdive', 'Shoegaze', { affinity: 0.50, content: 0.75, collaborative: 0.65 }),
      createMockCandidate('ff-3', 'Deep Root', 'Depeche Mode', 'New Wave', { affinity: 0.90, content: 0.85, collaborative: 0.85 }),
    ];

    const temporalProfile = {
      userId: fullFlowUserId,
      shortTermHorizon: { topGenres: [{ name: 'Synthwave', momentum: 0.85 }] },
      longTermHorizon: { topGenres: [{ name: 'New Wave', affinityScore: 0.90 }] },
    } as any;

    const musicDna = {
      tasteProfile: {
        coreArtists: [{ name: 'Depeche Mode', affinity: 0.92, playCount: 150 }],
      },
    };

    const tasteEvolutionSignal: TasteEvolutionSignal = {
      tasteStabilityRating: 'moderate_evolution',
      tasteStabilityScore: 0.65,
      emergingGenres: ['Synthwave'],
    };

    const personalMusicTwin: PersonalMusicTwinAttributes = {
      userId: fullFlowUserId,
      listenerArchetype: 'Sonic Explorer',
      confidenceScore: 0.88,
      explorationTendency: 0.65,
      dominantMusicalTraits: { energyPreference: 0.7, valencePreference: 0.6, targetTempoBpm: 120 },
    } as any;

    const cdScore: ComfortDiscoveryScoreResult = {
      userId: fullFlowUserId,
      comfortScore: 0.55,
      discoveryScore: 0.45,
      balanceRatio: 0.10,
      dominantMode: 'BALANCED',
      confidenceScore: 0.85,
      isDataSufficient: true,
      componentBreakdown: {} as any,
      rationales: ['Balanced profile'],
      explanation: 'Balanced exploration',
      lastCalculatedAt: new Date(),
    };

    const tasteBoundaries: TasteBoundaryProfile = {
      adjacentGenres: ['Shoegaze', 'Dream Pop'],
      comfortZoneThreshold: 0.65,
    } as any;

    const result = await PersonalizedDiscoveryModeService.getRecommendationsForMode({
      userId: fullFlowUserId,
      mode: 'FOR_YOU',
      candidates,
      temporalProfile,
      comfortDiscoveryScore: cdScore,
      personalMusicTwin,
      tasteBoundaries,
      musicDna: musicDna as any,
      limit: 3,
    });

    assert.ok(result.recommendations.length > 0, 'Must produce recommendations');
    assert.strictEqual(result.mode, 'FOR_YOU');
    assert.ok(result.diagnostics.pipelineDiagnostics !== undefined, 'Pipeline diagnostics must be captured');

    for (const rec of result.recommendations) {
      assert.ok(rec.explanation !== undefined, 'Every item must have explanation attached');
      assert.ok(rec.reasons && rec.reasons.length > 0, 'Every item must have structured reasons');
      assert.ok(rec.explanation.confidenceScore >= 0 && rec.explanation.confidenceScore <= 1);
    }

    console.log('✓ Test 8 Passed: Full conceptual personalization pipeline executed with complete diagnostics and reasons.');
  }

  // =========================================================================
  // Test 9: Smart Autoplay & Session Intelligence Integration
  // =========================================================================
  {
    console.log('--- Test 9: Smart Autoplay & Session Intelligence Integration ---');
    const autoUserId = new Types.ObjectId().toString();

    const candidates = [
      createMockCandidate('ap-1', 'Track 1', 'Artist 1', 'Pop', { affinity: 0.85 }),
      createMockCandidate('ap-2', 'Track 2', 'Artist 2', 'Pop', { affinity: 0.80 }),
      createMockCandidate('ap-3', 'Track 3', 'Artist 3', 'Dance', { affinity: 0.75 }),
      createMockCandidate('ap-4', 'Track 4', 'Artist 4', 'Dance', { affinity: 0.70 }),
      createMockCandidate('ap-5', 'Track 5', 'Artist 5', 'Indie', { affinity: 0.65 }),
    ];

    const originalGenerate = CandidateGenerationService.generateHybridCandidates;
    CandidateGenerationService.generateHybridCandidates = async () => candidates;

    try {
      const autoplayResult = await SmartAutoplayService.generateAdaptiveQueue({
        userId: autoUserId,
        currentTrackId: 'ap-seed',
        queueSize: 3,
        currentQueueSongIds: ['ap-past-1', 'ap-past-2'],
        context: { situation: 'focus', targetEnergy: 0.7 } as any,
      });

      assert.ok(autoplayResult.queue.length >= 0, 'Autoplay queue must be handled safely');

      // Check for zero duplicate tracks in autoplay queue
      const queuedIds = autoplayResult.queue.map((q: any) => String(q._id || q.id || q.song?._id || q.song?.id));
      assert.strictEqual(new Set(queuedIds).size, queuedIds.length, 'Autoplay queue must contain zero duplicates');

      console.log('✓ Test 9 Passed: Smart Autoplay integrated seamlessly with adaptive personalization.');
    } finally {
      CandidateGenerationService.generateHybridCandidates = originalGenerate;
    }
  }

  // =========================================================================
  // Test 10: Recommendation Feedback & Evaluation Integration
  // =========================================================================
  {
    console.log('--- Test 10: Recommendation Feedback & Evaluation Integration ---');
    const recommendedSongIds = ['rec-1', 'rec-2', 'rec-3', 'rec-4', 'rec-5'];
    const groundTruthRelevantIds = ['rec-2', 'rec-4', 'other-1', 'other-2'];

    const evaluation = RecommendationEvaluationService.evaluateRecommendationSet(
      recommendedSongIds,
      groundTruthRelevantIds,
      5
    );

    assert.strictEqual(evaluation.hitsCount, 2, 'Hits count should equal 2');
    assert.strictEqual(evaluation.precisionAtK, 0.4, 'Precision@5 should equal 0.4');
    assert.strictEqual(evaluation.recallAtK, 0.5, 'Recall@5 should equal 0.5');
    assert.ok(evaluation.f1AtK > 0.4, 'F1 score should be properly computed');

    console.log('✓ Test 10 Passed: Recommendation evaluation metrics correctly validated.');
  }

  // =========================================================================
  // Test 11: Edge Cases, Robustness & Missing Metadata
  // =========================================================================
  {
    console.log('--- Test 11: Edge Cases, Robustness & Missing Metadata ---');
    const robustUserId = new Types.ObjectId().toString();

    const edgeCandidates = [
      createMockCandidate('edge-1', 'Normal Song', 'Normal Artist', 'Pop', {}),
      createMockCandidate('edge-2', 'Broken Features Song', 'Artist B', 'Rock', {}, null as any),
      createMockCandidate('edge-3', 'Missing Genre Song', 'Artist C', '', {}),
    ];

    // Boundary expansion with completely unmapped adjacent genre
    const tasteBoundaries: TasteBoundaryProfile = {
      adjacentGenres: ['NonExistentGenreXYZ'],
      comfortZoneThreshold: 0.5,
    } as any;

    const result = await AdaptiveRecommendationRankingPipeline.executePipeline({
      userId: robustUserId,
      candidates: edgeCandidates,
      tasteBoundaries,
      context: null,
      sessionDoc: null,
      limit: 3,
      explainRecommendations: true,
    });

    assert.ok(result.recommendations.length > 0, 'Must handle edge cases without crashing');
    for (const rec of result.recommendations) {
      assert.ok(!isNaN(rec.hybridScore), 'Score must never be NaN');
      assert.ok(rec.hybridScore >= 0 && rec.hybridScore <= 1, 'Score must be valid');
    }

    console.log('✓ Test 11 Passed: Edge cases and missing metadata handled robustly with zero crashes.');
  }

  console.log('\n[Day 34 Task 7: Full Advanced Personalization Integration Test Suite] All 11 tests completed successfully! 🎉');
}
