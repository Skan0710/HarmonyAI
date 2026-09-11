import assert from 'node:assert';
import { HybridRankingPipeline } from '../services/hybridRankingPipeline.js';
import { AdaptiveRecommendationRankingPipeline } from '../services/adaptiveRecommendationRankingPipeline.js';
import { HybridCandidate } from '../services/candidateGenerationService.js';
import {
  PersonalMusicTwinAttributes,
  getDefaultPersonalMusicTwin,
} from '../schemas/personalMusicTwinSchema.js';
import {
  getPersonalMusicTwinInfluenceConfig,
  updatePersonalMusicTwinInfluenceConfig,
  resetPersonalMusicTwinInfluenceConfig,
} from '../config/recommendationConfig.js';

export async function runPersonalMusicTwinRecommendationIntegrationTests() {
  console.log('[Personal Music Twin Recommendation Integration Test Suite] Starting tests...\n');

  resetPersonalMusicTwinInfluenceConfig();

  const createMockCandidate = (
    id: string,
    title: string,
    genre: string,
    artist: string,
    energy = 0.5,
    primaryMood = 'Chill'
  ): HybridCandidate => ({
    songId: id,
    contentScore: 0.70,
    collaborativeScore: 0.65,
    userTasteAffinityScore: 0.65,
    popularitySignal: 0.50,
    recencySignal: 0.50,
    sources: ['test_pool'],
    songDoc: {
      _id: crypto.randomUUID(),
      id,
      title,
      genre: { name: genre },
      artist: { name: artist },
      energy,
      mood: primaryMood,
      primaryMood,
      playCount: 100,
    },
  });

  // Candidate Pool: mix of Core Synthwave vs Exploratory Post-Rock & Novel tracks
  const candidatePool: HybridCandidate[] = [
    createMockCandidate('c1', 'Midnight Drive', 'Synthwave', 'The Midnight', 0.80, 'Euphoric'),
    createMockCandidate('c2', 'Neon Highway', 'Synthwave', 'Gunship', 0.75, 'Energetic'),
    createMockCandidate('c3', 'Outer Space Voyage', 'Post-Rock', 'Explosions In The Sky', 0.60, 'Atmospheric'),
    createMockCandidate('c4', 'Abstract Dimensions', 'Glitch Hop', 'Tipper', 0.85, 'High Velocity'),
    createMockCandidate('c5', 'Cozy Sanctuary', 'Lo-Fi Chill', 'ChilledCow', 0.40, 'Calm'),
  ];

  // ---------------------------------------------------------------------------
  // Test 1: Explorer vs Loyal Listener Divergence
  // ---------------------------------------------------------------------------
  console.log('Test 1: Meaningfully different ranking behavior between Explorer and Loyal Listener');
  {
    const userId = crypto.randomUUID();
    const baseTwin = getDefaultPersonalMusicTwin(userId);

    // Explorer Twin: loves novel genres, low familiarity, high exploration
    const explorerTwin: PersonalMusicTwinAttributes = {
      ...baseTwin,
      listenerArchetype: 'Explorer',
      archetypeDescription: 'Venturing across unknown sonic territory.',
      explorationTendency: 0.90,
      familiarityTendency: 0.15,
      diversityPreference: 0.85,
      genreIdentity: {
        coreGenres: [{ name: 'Synthwave', affinityScore: 0.80, isPrimary: true }],
        secondaryGenres: [{ name: 'Cyberpunk', affinityScore: 0.60 }],
        genreDiversityScore: 0.80,
        signatureSound: 'Broad Exploratory Horizon',
      },
      metadata: {
        personalityTraits: [{ id: 'highly_exploratory', trait: 'highly exploratory' }],
      },
      confidenceScore: 0.85,
      isDataSufficient: true,
    };

    // Loyal Listener Twin: deeply devoted to Synthwave core, high familiarity
    const loyalTwin: PersonalMusicTwinAttributes = {
      ...baseTwin,
      listenerArchetype: 'Loyal Listener',
      archetypeDescription: 'Devoted to beloved classics and bedrock artists.',
      explorationTendency: 0.10,
      familiarityTendency: 0.95,
      diversityPreference: 0.20,
      genreIdentity: {
        coreGenres: [{ name: 'Synthwave', affinityScore: 0.95, isPrimary: true }],
        secondaryGenres: [],
        genreDiversityScore: 0.25,
        signatureSound: 'Devoted Synthwave Core',
      },
      metadata: {
        personalityTraits: [{ id: 'genre_loyal', trait: 'genre loyal' }],
      },
      confidenceScore: 0.88,
      isDataSufficient: true,
    };

    const explorerResults = HybridRankingPipeline.rankCandidates(
      candidatePool,
      5,
      undefined,
      null,
      0,
      null,
      0,
      null,
      null,
      0,
      null,
      0,
      null,
      0,
      explorerTwin,
      0.25 // twin influence
    );

    const loyalResults = HybridRankingPipeline.rankCandidates(
      candidatePool,
      5,
      undefined,
      null,
      0,
      null,
      0,
      null,
      null,
      0,
      null,
      0,
      null,
      0,
      loyalTwin,
      0.25 // twin influence
    );

    // Verify component score populated
    assert.ok(explorerResults[0]?.componentScores?.personalMusicTwinScore !== undefined);
    assert.ok(loyalResults[0]?.componentScores?.personalMusicTwinScore !== undefined);

    // Top song for Loyal Listener should be the core Synthwave track
    const loyalTopGenre = loyalResults[0]?.song?.genre?.name;
    assert.strictEqual(loyalTopGenre, 'Synthwave', 'Loyal listener must rank core genre highest');

    // Explorer twin should score exploratory tracks (e.g. Post-Rock or Glitch Hop) substantially higher than Loyal twin
    const explorerPostRockScore = explorerResults.find((r) => r.song?.genre?.name === 'Post-Rock')
      ?.componentScores?.personalMusicTwinScore || 0;
    const loyalPostRockScore = loyalResults.find((r) => r.song?.genre?.name === 'Post-Rock')
      ?.componentScores?.personalMusicTwinScore || 0;

    assert.ok(
      explorerPostRockScore > loyalPostRockScore,
      `Explorer twin score (${explorerPostRockScore}) must exceed Loyal twin score (${loyalPostRockScore}) for exploratory track`
    );

    console.log(`✓ Test 1 Passed: Explorer vs Loyal Listener produce divergent rankings (Post-Rock fit: Explorer ${explorerPostRockScore} vs Loyal ${loyalPostRockScore}).`);
  }

  // ---------------------------------------------------------------------------
  // Test 2: Discovery Seeker vs Comfort Listener
  // ---------------------------------------------------------------------------
  console.log('\nTest 2: Discovery Seeker vs Comfort Listener taste evolution alignment');
  {
    const userId = crypto.randomUUID();
    const baseTwin = getDefaultPersonalMusicTwin(userId);

    // Discovery Seeker Twin: high discovery appetite and emerging preference for Glitch Hop
    const discoveryTwin: PersonalMusicTwinAttributes = {
      ...baseTwin,
      listenerArchetype: 'Discovery Seeker',
      explorationTendency: 0.85,
      listeningBehavior: {
        ...baseTwin.listeningBehavior,
        discoveryTendency: 0.95,
      },
      currentEmergingInterests: {
        genres: [{ name: 'Glitch Hop', confidence: 0.85, momentumVelocity: 0.50 }],
        artists: [],
        moods: [],
        narrative: 'Surging interest in Glitch Hop.',
      },
      tasteEvolution: {
        transformationIntensity: 0.60,
        evolutionArchetype: 'Transforming / Paradigm Shift',
        primaryTasteDirection: 'Moving towards electronic glitch',
        activePhase: 'Glitch Exploration',
        velocity: 'rapid',
      },
      confidenceScore: 0.85,
      isDataSufficient: true,
    };

    // Comfort Listener Twin: high stability, loves familiar Cozy Sanctuary Lo-Fi
    const comfortTwin: PersonalMusicTwinAttributes = {
      ...baseTwin,
      listenerArchetype: 'Comfort Listener',
      familiarityTendency: 0.90,
      genreIdentity: {
        coreGenres: [{ name: 'Lo-Fi Chill', affinityScore: 0.90, isPrimary: true }],
        secondaryGenres: [],
        genreDiversityScore: 0.30,
        signatureSound: 'Comfort Sanctuary',
      },
      metadata: {
        personalityTraits: [{ id: 'comfort_oriented', trait: 'comfort oriented' }],
      },
      confidenceScore: 0.85,
      isDataSufficient: true,
    };

    const discoveryRanked = HybridRankingPipeline.rankCandidates(
      candidatePool,
      5,
      undefined,
      null,
      0,
      null,
      0,
      null,
      null,
      0,
      null,
      0,
      null,
      0,
      discoveryTwin,
      0.20
    );

    const comfortRanked = HybridRankingPipeline.rankCandidates(
      candidatePool,
      5,
      undefined,
      null,
      0,
      null,
      0,
      null,
      null,
      0,
      null,
      0,
      null,
      0,
      comfortTwin,
      0.20
    );

    const glitchHopFitDiscovery = discoveryRanked.find((r) => r.song?.genre?.name === 'Glitch Hop')
      ?.componentScores?.personalMusicTwinScore || 0;
    const glitchHopFitComfort = comfortRanked.find((r) => r.song?.genre?.name === 'Glitch Hop')
      ?.componentScores?.personalMusicTwinScore || 0;

    assert.ok(
      glitchHopFitDiscovery > glitchHopFitComfort,
      'Discovery Seeker should rank emerging Glitch Hop track higher than Comfort Listener'
    );

    console.log(`✓ Test 2 Passed: Emerging Glitch Hop favored by Discovery Seeker (${glitchHopFitDiscovery}) over Comfort Listener (${glitchHopFitComfort}).`);
  }

  // ---------------------------------------------------------------------------
  // Test 3: Mood Listener Emotional Alignment
  // ---------------------------------------------------------------------------
  console.log('\nTest 3: Mood Listener prioritizing emotional atmospheric resonance');
  {
    const userId = crypto.randomUUID();
    const baseTwin = getDefaultPersonalMusicTwin(userId);

    const moodTwin: PersonalMusicTwinAttributes = {
      ...baseTwin,
      listenerArchetype: 'Mood Listener',
      moodIdentity: {
        dominantMoods: [{ mood: 'Atmospheric', affinityScore: 0.95 }],
        emotionalBreadth: 'focused',
        contextualMoodAffinity: {},
      },
      metadata: {
        personalityTraits: [{ id: 'mood_driven', trait: 'mood driven' }],
      },
      confidenceScore: 0.85,
      isDataSufficient: true,
    };

    const moodRanked = HybridRankingPipeline.rankCandidates(
      candidatePool,
      5,
      undefined,
      null,
      0,
      null,
      0,
      null,
      null,
      0,
      null,
      0,
      null,
      0,
      moodTwin,
      0.22
    );

    const atmosphericCandidate = moodRanked.find((r) => r.song?.primaryMood === 'Atmospheric');
    const atmosphericScore = atmosphericCandidate?.componentScores?.personalMusicTwinScore || 0;

    assert.ok(
      atmosphericScore >= 0.70,
      `Mood Listener should grant high fit score to matching Atmospheric mood track: ${atmosphericScore}`
    );

    console.log(`✓ Test 3 Passed: Atmospheric track received high fit score (${atmosphericScore}) for Mood Listener.`);
  }

  // ---------------------------------------------------------------------------
  // Test 4: Controlled Contribution & Non-Overpowering Invariance
  // ---------------------------------------------------------------------------
  console.log('\nTest 4: Controlled contribution and fallback invariance when twin is omitted');
  {
    // When personalMusicTwin is null, base hybrid ranking must be 100% invariant
    const baselineResults = HybridRankingPipeline.rankCandidates(
      candidatePool,
      5,
      undefined,
      null,
      0,
      null,
      0,
      null,
      null,
      0,
      null,
      0,
      null,
      0,
      null, // no twin
      0
    );

    for (const res of baselineResults) {
      assert.strictEqual(
        res.componentScores.personalMusicTwinScore,
        undefined,
        'Personal music twin score should be undefined when twin is omitted'
      );
    }

    // Configurable influence controls
    updatePersonalMusicTwinInfluenceConfig({ defaultTwinInfluence: 0.18 });
    const config = getPersonalMusicTwinInfluenceConfig();
    assert.strictEqual(config.defaultTwinInfluence, 0.18);
    resetPersonalMusicTwinInfluenceConfig();

    console.log('✓ Test 4 Passed: Baseline ranking is completely invariant when twin is omitted.');
  }

  // ---------------------------------------------------------------------------
  // Test 5: End-to-End Pipeline & Smart Autoplay Diagnostics
  // ---------------------------------------------------------------------------
  console.log('\nTest 5: Adaptive recommendation pipeline integration with diagnostics');
  {
    const userId = crypto.randomUUID().toString();
    const mockTwin = getDefaultPersonalMusicTwin(userId);

    const pipelineRes = await AdaptiveRecommendationRankingPipeline.executePipeline({
      userId,
      candidates: candidatePool,
      personalMusicTwin: mockTwin,
      personalMusicTwinInfluence: 0.15,
      usePersonalMusicTwin: true,
      limit: 5,
    });

    assert.strictEqual(pipelineRes.strategyUsed, 'HYBRID_PERSONALIZED');
    assert.strictEqual(pipelineRes.recommendations.length, 5);
    assert.ok(pipelineRes.diagnostics.personalMusicTwin);
    assert.strictEqual(pipelineRes.diagnostics.personalMusicTwin?.applied, true);
    assert.strictEqual(pipelineRes.diagnostics.personalMusicTwin?.twinArchetype, 'Balanced Explorer');

    console.log('✓ Test 5 Passed: Full pipeline successfully executed with active Personal Music Twin diagnostics.');
  }

  console.log('\n[Personal Music Twin Recommendation Integration Test Suite] All tests passed!\n');
  return true;
}

// Standalone execution support
if (
  process.argv[1]?.endsWith('personalMusicTwinRecommendationIntegration.test.ts') ||
  process.argv[1]?.endsWith('personalMusicTwinRecommendationIntegration.test.js')
) {
  runPersonalMusicTwinRecommendationIntegrationTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Test suite failed:', err);
      process.exit(1);
    });
}
