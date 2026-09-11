import assert from 'node:assert';
import {
  PersonalizedDiscoveryModeService,
  PersonalizedDiscoveryModeParams,
} from '../services/personalizedDiscoveryModeService.js';
import {
  getAllDiscoveryModeConfigs,
  getDiscoveryModeConfig,
  updateDiscoveryModeConfig,
  resetDiscoveryModeConfigs,
  resolvePersonalizedDiscoveryMode,
} from '../config/personalizedDiscoveryModeConfig.js';
import { HybridRecommendationService } from '../services/hybridRecommendationService.js';
import { HybridCandidate } from '../services/candidateGenerationService.js';
import { DEFAULT_MUSICAL_TRAITS } from '../schemas/personalMusicTwinSchema.js';

export async function runPersonalizedDiscoveryModeTests() {
  console.log('[Personalized Discovery Modes Test Suite] Starting tests...');

  // Always reset configs before and after tests
  resetDiscoveryModeConfigs();

  const mockUserId = crypto.randomUUID().toString();

  const songIdComfort = crypto.randomUUID().toString();
  const songIdDiscover = crypto.randomUUID().toString();
  const songIdOutside = crypto.randomUUID().toString();
  const songIdEmerging = crypto.randomUUID().toString();
  const songIdBalanced = crypto.randomUUID().toString();

  // Diverse test candidates
  const mockCandidates: HybridCandidate[] = [
    // 1. High Familiarity / Bedrock Favorite: Synthwave classic
    {
      songId: songIdComfort,
      songDoc: {
        _id: songIdComfort,
        title: 'Endless Summer',
        artist: 'The Midnight',
        genres: ['synthwave'],
        moods: ['nostalgic'],
        energy: 0.65,
        popularity: 80,
      },
      contentScore: 0.92,
      collaborativeScore: 0.85,
      userTasteAffinityScore: 0.95,
      popularitySignal: 0.8,
      recencySignal: 0.1,
      sources: ['user_favorites'],
    },
    // 2. High Novelty / Discovery gem: Fresh Electronic
    {
      songId: songIdDiscover,
      songDoc: {
        _id: songIdDiscover,
        title: 'Neon Odyssey',
        artist: 'FM Attack',
        genres: ['electronic', 'nudisco'],
        moods: ['uplifting', 'energetic'],
        energy: 0.75,
        popularity: 45,
      },
      contentScore: 0.82,
      collaborativeScore: 0.78,
      userTasteAffinityScore: 0.70,
      popularitySignal: 0.45,
      recencySignal: 0.95,
      sources: ['collaborative_discovery'],
    },
    // 3. Adjacent Frontier: Cyberpunk (Adjacent to synthwave)
    {
      songId: songIdOutside,
      songDoc: {
        _id: songIdOutside,
        title: 'Neo-Tokyo Overdrive',
        artist: 'Scandroid',
        genres: ['cyberpunk'],
        moods: ['futuristic', 'dark'],
        energy: 0.80,
        popularity: 50,
      },
      contentScore: 0.75,
      collaborativeScore: 0.70,
      userTasteAffinityScore: 0.60,
      popularitySignal: 0.5,
      recencySignal: 0.7,
      sources: ['boundary_frontier'],
    },
    // 4. Emerging Taste Momentum: Darksynth (Rising trend)
    {
      songId: songIdEmerging,
      songDoc: {
        _id: songIdEmerging,
        title: 'Turbo Killer',
        artist: 'Carpenter Brut',
        genres: ['darksynth'],
        moods: ['dark', 'intense'],
        energy: 0.85,
        popularity: 60,
      },
      contentScore: 0.80,
      collaborativeScore: 0.75,
      userTasteAffinityScore: 0.68,
      popularitySignal: 0.6,
      recencySignal: 0.9,
      sources: ['emerging_trend'],
    },
    // 5. Balanced standard track
    {
      songId: songIdBalanced,
      songDoc: {
        _id: songIdBalanced,
        title: 'Sunset Drive',
        artist: 'Timecop1983',
        genres: ['synthwave', 'chillwave'],
        moods: ['chill', 'dreamy'],
        energy: 0.55,
        popularity: 70,
      },
      contentScore: 0.85,
      collaborativeScore: 0.80,
      userTasteAffinityScore: 0.82,
      popularitySignal: 0.7,
      recencySignal: 0.6,
      sources: ['hybrid_pool'],
    },
  ];

  // Mock upstream intelligence
  const mockMusicDna = {
    userId: mockUserId,
    genreProfile: {
      topGenres: [{ id: 'synthwave', name: 'synthwave', score: 0.90 }],
    },
    artistProfile: {
      strongestArtists: [{ id: 'The Midnight', name: 'The Midnight', score: 0.95 }],
    },
    moodProfile: {
      preferredMoods: [{ id: 'nostalgic', name: 'nostalgic', score: 0.85 }],
    },
    tendencies: {
      discoveryTendency: 0.45,
      familiarityPreference: 0.80,
    },
    confidenceScore: 0.90,
  };

  const mockPersonalMusicTwin = {
    userId: mockUserId,
    listenerArchetype: 'The Faithful Loyalist',
    archetypeDescription: 'Prefers deep familiarity and signature beloved sounds.',
    dominantMusicalTraits: DEFAULT_MUSICAL_TRAITS,
    explorationTendency: 0.25,
    familiarityTendency: 0.85,
    diversityPreference: 0.35,
    listeningBehavior: {
      repeatListeningTendency: 0.85,
      discoveryTendency: 0.25,
    },
    currentEmergingInterests: {
      genres: [{ name: 'darksynth', confidence: 0.85, momentumVelocity: 0.5 }],
      artists: [{ name: 'Carpenter Brut', confidence: 0.80, momentumVelocity: 0.4 }],
      moods: ['dark'],
      narrative: 'Emerging darksynth chapter',
    },
    tasteEvolution: {
      velocity: 'moderate',
      evolutionArchetype: 'Gradual Evolver',
      transformationIntensity: 0.40,
    },
    confidenceScore: 0.88,
  };

  const mockComfortDiscoveryScore = {
    userId: mockUserId,
    comfortScore: 0.82,
    discoveryScore: 0.28,
    dominantMode: 'COMFORT' as const,
    balanceRatio: -0.54,
    confidenceScore: 0.90,
    isDataSufficient: true,
  };

  const mockTasteBoundaries = {
    userId: mockUserId,
    stronglyPreferredAreas: [
      { name: 'synthwave', type: 'genre' as const, affinityScore: 0.90, confidence: 0.95 },
      { name: 'The Midnight', type: 'artist' as const, affinityScore: 0.95, confidence: 0.95 },
    ],
    adjacentGenres: [
      {
        name: 'cyberpunk',
        type: 'genre' as const,
        affinityScore: 0.70,
        proximityScore: 0.85,
        discoveryPotential: 0.80,
        relation: 'Adjacent to synthwave',
        confidenceScore: 0.90,
        rationale: 'Adjacent to synthwave',
      },
    ],
    adjacentArtists: [],
    familiarUnderexploredAreas: [],
    potentiallyInterestingNewAreas: [],
    lowConfidenceAreas: [],
    boundaryMetrics: {
      tasteBreadthScore: 0.45,
      boundaryOpennessScore: 0.50,
      frontierExplorationRate: 0.40,
      tasteConcentrationScore: 0.70,
    },
    confidenceScore: 0.88,
    isDataSufficient: true,
  };

  // ---------------------------------------------------------------------------
  // Test 1: Mode Resolution & Canonical Mapping
  // ---------------------------------------------------------------------------
  console.log('Test 1: Testing mode resolution and alias mapping...');
  assert.strictEqual(PersonalizedDiscoveryModeService.resolveMode('for_you'), 'FOR_YOU');
  assert.strictEqual(PersonalizedDiscoveryModeService.resolveMode('FOR-YOU'), 'FOR_YOU');
  assert.strictEqual(PersonalizedDiscoveryModeService.resolveMode('comfort'), 'COMFORT');
  assert.strictEqual(PersonalizedDiscoveryModeService.resolveMode('familiar'), 'COMFORT');
  assert.strictEqual(PersonalizedDiscoveryModeService.resolveMode('discover'), 'DISCOVER');
  assert.strictEqual(PersonalizedDiscoveryModeService.resolveMode('explore'), 'DISCOVER');
  assert.strictEqual(PersonalizedDiscoveryModeService.resolveMode('outside_your_taste'), 'OUTSIDE_YOUR_TASTE');
  assert.strictEqual(PersonalizedDiscoveryModeService.resolveMode('outside_comfort_zone'), 'OUTSIDE_YOUR_TASTE');
  assert.strictEqual(PersonalizedDiscoveryModeService.resolveMode('whats_new_for_you'), 'WHATS_NEW_FOR_YOU');
  assert.strictEqual(PersonalizedDiscoveryModeService.resolveMode('taste_evolution'), 'WHATS_NEW_FOR_YOU');
  assert.strictEqual(PersonalizedDiscoveryModeService.resolveMode(undefined), 'FOR_YOU');
  assert.strictEqual(PersonalizedDiscoveryModeService.resolveMode('unrecognized_random'), 'FOR_YOU');
  console.log('✓ Test 1 Passed: Mode resolution accurately normalizes aliases and defaults to FOR_YOU.');

  // ---------------------------------------------------------------------------
  // Test 2: Available Modes Discovery
  // ---------------------------------------------------------------------------
  console.log('Test 2: Testing available discovery modes metadata retrieval...');
  const availableModes = PersonalizedDiscoveryModeService.getAvailableModes();
  assert.ok(availableModes.FOR_YOU, 'FOR_YOU mode must exist in available modes');
  assert.ok(availableModes.COMFORT, 'COMFORT mode must exist in available modes');
  assert.ok(availableModes.DISCOVER, 'DISCOVER mode must exist in available modes');
  assert.ok(availableModes.OUTSIDE_YOUR_TASTE, 'OUTSIDE_YOUR_TASTE mode must exist in available modes');
  assert.ok(availableModes.WHATS_NEW_FOR_YOU, 'WHATS_NEW_FOR_YOU mode must exist in available modes');
  assert.strictEqual(availableModes.FOR_YOU.strategyType, 'STANDARD');
  assert.strictEqual(availableModes.COMFORT.strategyType, 'STANDARD');
  assert.strictEqual(availableModes.DISCOVER.strategyType, 'STANDARD');
  assert.strictEqual(availableModes.OUTSIDE_YOUR_TASTE.strategyType, 'OUTSIDE_COMFORT_ZONE');
  assert.strictEqual(availableModes.WHATS_NEW_FOR_YOU.strategyType, 'TASTE_EVOLUTION_DISCOVERY');
  console.log('✓ Test 2 Passed: All 5 discovery modes expose complete metadata and strategy bindings.');

  // ---------------------------------------------------------------------------
  // Test 3: For You Mode Execution (Balanced Recommendations)
  // ---------------------------------------------------------------------------
  console.log('Test 3: Testing For You mode execution (balanced personalized)...');
  const forYouResult = await PersonalizedDiscoveryModeService.getRecommendationsForMode({
    userId: mockUserId,
    mode: 'FOR_YOU',
    candidates: mockCandidates,
    limit: 5,
    musicDna: mockMusicDna,
    personalMusicTwin: mockPersonalMusicTwin,
    comfortDiscoveryScore: mockComfortDiscoveryScore,
  });

  assert.strictEqual(forYouResult.mode, 'FOR_YOU');
  assert.strictEqual(forYouResult.label, 'For You');
  assert.strictEqual(forYouResult.strategyUsed, 'HYBRID_PERSONALIZED');
  assert.strictEqual(forYouResult.diagnostics.strategyType, 'STANDARD');
  assert.ok(forYouResult.recommendations.length > 0, 'Must produce recommendations');
  assert.ok(forYouResult.diagnostics.effectiveHybridWeights.userTasteAffinityWeight >= 0.25);
  console.log('✓ Test 3 Passed: For You mode delivers balanced personalized recommendations.');

  // ---------------------------------------------------------------------------
  // Test 4: Comfort Mode Execution (Strongly Familiar)
  // ---------------------------------------------------------------------------
  console.log('Test 4: Testing Comfort mode execution (strongly familiar)...');
  const comfortResult = await PersonalizedDiscoveryModeService.getRecommendationsForMode({
    userId: mockUserId,
    mode: 'COMFORT',
    candidates: mockCandidates,
    limit: 5,
    musicDna: mockMusicDna,
    personalMusicTwin: mockPersonalMusicTwin,
    comfortDiscoveryScore: mockComfortDiscoveryScore,
  });

  assert.strictEqual(comfortResult.mode, 'COMFORT');
  assert.strictEqual(comfortResult.label, 'Comfort');
  assert.strictEqual(comfortResult.strategyUsed, 'HYBRID_PERSONALIZED');
  // In comfort mode, exploration is minimal and taste affinity weight is high
  assert.ok(
    comfortResult.diagnostics.effectiveExplorationRate <= 0.05,
    'Exploration rate in Comfort mode must be tightly suppressed'
  );
  assert.ok(
    comfortResult.diagnostics.effectiveHybridWeights.userTasteAffinityWeight >= 0.35,
    'Taste affinity weight in Comfort mode must be high'
  );
  // The familiar track (The Midnight) should rank highest
  assert.strictEqual(
    comfortResult.recommendations[0].song.artist,
    'The Midnight',
    'Comfort mode must rank beloved familiar artist first'
  );
  console.log('✓ Test 4 Passed: Comfort mode prioritizes familiar favorites with suppressed exploration.');

  // ---------------------------------------------------------------------------
  // Test 5: Discover Mode Execution (More Novel, Relevant)
  // ---------------------------------------------------------------------------
  console.log('Test 5: Testing Discover mode execution (more novel)...');
  const discoverResult = await PersonalizedDiscoveryModeService.getRecommendationsForMode({
    userId: mockUserId,
    mode: 'DISCOVER',
    candidates: mockCandidates,
    limit: 5,
    musicDna: mockMusicDna,
    personalMusicTwin: {
      ...mockPersonalMusicTwin,
      explorationTendency: 0.85,
      listeningBehavior: { repeatListeningTendency: 0.2, discoveryTendency: 0.85 },
    },
    comfortDiscoveryScore: {
      ...mockComfortDiscoveryScore,
      comfortScore: 0.20,
      discoveryScore: 0.80,
      dominantMode: 'DISCOVERY',
    },
  });

  assert.strictEqual(discoverResult.mode, 'DISCOVER');
  assert.strictEqual(discoverResult.label, 'Discover');
  assert.strictEqual(discoverResult.strategyUsed, 'HYBRID_PERSONALIZED');
  assert.ok(
    discoverResult.diagnostics.effectiveExplorationRate >= 0.40,
    'Exploration rate in Discover mode must be elevated'
  );
  assert.ok(
    discoverResult.diagnostics.effectiveDiversityStrength >= 0.40,
    'Diversity strength in Discover mode must be elevated'
  );
  assert.ok(
    discoverResult.diagnostics.effectiveNoveltyWeights.noveltyWeight >= 0.35,
    'Novelty weight in Discover mode must be heightened'
  );
  console.log('✓ Test 5 Passed: Discover mode provides high exploration and novelty re-weighting.');

  // ---------------------------------------------------------------------------
  // Test 6: Outside Your Taste Mode Execution (Careful Boundary Frontier)
  // ---------------------------------------------------------------------------
  console.log('Test 6: Testing Outside Your Taste mode execution...');
  const outsideResult = await PersonalizedDiscoveryModeService.getRecommendationsForMode({
    userId: mockUserId,
    mode: 'OUTSIDE_YOUR_TASTE',
    candidates: mockCandidates,
    limit: 5,
    musicDna: mockMusicDna,
    personalMusicTwin: mockPersonalMusicTwin,
    comfortDiscoveryScore: mockComfortDiscoveryScore,
    tasteBoundaries: mockTasteBoundaries,
  });

  assert.strictEqual(outsideResult.mode, 'OUTSIDE_YOUR_TASTE');
  assert.strictEqual(outsideResult.label, 'Outside Your Taste');
  assert.strictEqual(outsideResult.strategyUsed, 'OUTSIDE_COMFORT_ZONE');
  assert.ok(
    outsideResult.diagnostics.pipelineDiagnostics?.outsideComfortZone?.applied,
    'Pipeline outsideComfortZone diagnostics must be present and applied'
  );
  // Check that adjacent frontier candidate Scandroid was evaluated
  const containsOutsideCandidate = outsideResult.recommendations.some(
    (r) => r.song.artist === 'Scandroid'
  );
  assert.ok(containsOutsideCandidate, 'Outside Your Taste mode must recommend boundary adjacent candidates');
  console.log('✓ Test 6 Passed: Outside Your Taste routes through OUTSIDE_COMFORT_ZONE strategy.');

  // ---------------------------------------------------------------------------
  // Test 7: What's New For You Mode Execution (Emerging Taste Momentum)
  // ---------------------------------------------------------------------------
  console.log("Test 7: Testing What's New For You mode execution...");
  const emergingResult = await PersonalizedDiscoveryModeService.getRecommendationsForMode({
    userId: mockUserId,
    mode: 'WHATS_NEW_FOR_YOU',
    candidates: mockCandidates,
    limit: 5,
    musicDna: mockMusicDna,
    personalMusicTwin: mockPersonalMusicTwin,
    comfortDiscoveryScore: mockComfortDiscoveryScore,
    temporalProfile: {
      userId: mockUserId,
      shortTermHorizon: {
        genreAffinities: new Map([['darksynth', 0.85]]),
        artistAffinities: new Map([['Carpenter Brut', 0.80]]),
      },
      longTermHorizon: {
        genreAffinities: new Map([['darksynth', 0.20]]),
        artistAffinities: new Map([['Carpenter Brut', 0.15]]),
      },
    } as any,
  });

  assert.strictEqual(emergingResult.mode, 'WHATS_NEW_FOR_YOU');
  assert.strictEqual(emergingResult.label, "What's New For You");
  assert.strictEqual(emergingResult.strategyUsed, 'TASTE_EVOLUTION_DISCOVERY');
  assert.ok(
    emergingResult.diagnostics.pipelineDiagnostics?.tasteEvolutionDiscovery?.applied,
    'Pipeline tasteEvolutionDiscovery diagnostics must be applied'
  );
  // Emerging candidate Carpenter Brut should rank near or at the top
  assert.strictEqual(
    emergingResult.recommendations[0].song.artist,
    'Carpenter Brut',
    "What's New For You mode must prioritize emerging taste momentum"
  );
  console.log("✓ Test 7 Passed: What's New For You routes through TASTE_EVOLUTION_DISCOVERY strategy.");

  // ---------------------------------------------------------------------------
  // Test 8: Dynamic Personal Music Twin Adaptation
  // ---------------------------------------------------------------------------
  console.log('Test 8: Testing dynamic weight adaptation with Personal Music Twin...');
  // High-comfort twin
  const highComfortTwin = {
    ...mockPersonalMusicTwin,
    familiarityTendency: 0.95,
  };
  const adaptedComfort = PersonalizedDiscoveryModeService.adaptModeParameters(
    getDiscoveryModeConfig('COMFORT'),
    highComfortTwin,
    { comfortScore: 0.90 } as any
  );
  assert.ok(
    adaptedComfort.hybridWeights.userTasteAffinityWeight > getDiscoveryModeConfig('COMFORT').hybridWeights.userTasteAffinityWeight,
    'Comfort mode must reinforce taste affinity weight when twin familiarity is very high'
  );
  assert.ok(adaptedComfort.twinAlignment.applied, 'Twin alignment must be reported as applied');

  // High-discovery twin
  const highDiscTwin = {
    ...mockPersonalMusicTwin,
    explorationTendency: 0.90,
    listeningBehavior: { repeatListeningTendency: 0.1, discoveryTendency: 0.90 },
  };
  const adaptedDiscover = PersonalizedDiscoveryModeService.adaptModeParameters(
    getDiscoveryModeConfig('DISCOVER'),
    highDiscTwin,
    { discoveryScore: 0.90 } as any
  );
  assert.ok(
    adaptedDiscover.explorationRate > getDiscoveryModeConfig('DISCOVER').explorationRate,
    'Discover mode must elevate exploration rate when twin discovery is very high'
  );
  console.log('✓ Test 8 Passed: Music Twin and Comfort Discovery scores dynamically adapt weights.');

  // ---------------------------------------------------------------------------
  // Test 9: Configurable Mode-Specific Weights Runtime Updates & Resets
  // ---------------------------------------------------------------------------
  console.log('Test 9: Testing runtime configuration updates and resets...');
  const originalComfortAffinity = getDiscoveryModeConfig('COMFORT').hybridWeights.userTasteAffinityWeight;
  updateDiscoveryModeConfig('COMFORT', {
    hybridWeights: {
      ...getDiscoveryModeConfig('COMFORT').hybridWeights,
      userTasteAffinityWeight: 0.48,
    },
    explorationRate: 0.02,
  });

  const updatedComfort = getDiscoveryModeConfig('COMFORT');
  assert.strictEqual(updatedComfort.hybridWeights.userTasteAffinityWeight, 0.48);
  assert.strictEqual(updatedComfort.explorationRate, 0.02);

  resetDiscoveryModeConfigs();
  const resetComfort = getDiscoveryModeConfig('COMFORT');
  assert.strictEqual(resetComfort.hybridWeights.userTasteAffinityWeight, originalComfortAffinity);

  const externallyMutated = getDiscoveryModeConfig('COMFORT');
  externallyMutated.hybridWeights.userTasteAffinityWeight = 0;
  const currentComfort = getDiscoveryModeConfig('COMFORT');
  assert.strictEqual(
    currentComfort.hybridWeights.userTasteAffinityWeight,
    originalComfortAffinity,
    'Configuration snapshots must not expose mutable internal nested weights'
  );
  console.log('✓ Test 9 Passed: Discovery mode configurations can be updated and reset dynamically.');

  // ---------------------------------------------------------------------------
  // Test 10: HybridRecommendationService Integration with Discovery Mode
  // ---------------------------------------------------------------------------
  console.log('Test 10: Testing HybridRecommendationService.getHybridRecommendations integration...');
  // Call getHybridRecommendations with mode parameter
  const hybridServiceResult = await HybridRecommendationService.getHybridRecommendations({
    userId: mockUserId,
    mode: 'comfort',
    candidates: mockCandidates,
    limit: 5,
    customWeights: { contentSimilarityWeight: 0.30 },
  });

  assert.ok(hybridServiceResult.discoveryModeDiagnostics, 'discoveryModeDiagnostics must be populated');
  assert.strictEqual(hybridServiceResult.discoveryModeDiagnostics.mode, 'COMFORT');
  assert.strictEqual(hybridServiceResult.discoveryModeDiagnostics.label, 'Comfort');
  console.log('✓ Test 10 Passed: HybridRecommendationService cleanly routes personalized discovery modes.');

  console.log('🎉 ALL 10 Personalized Discovery Modes tests completed successfully.');
}
