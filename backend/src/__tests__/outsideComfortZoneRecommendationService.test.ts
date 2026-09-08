import assert from 'node:assert';
import { Types } from 'mongoose';
import {
  OutsideComfortZoneRecommendationService,
  OutsideComfortZoneRankingInputs,
} from '../services/outsideComfortZoneRecommendationService.js';
import {
  resetOutsideComfortZoneConfig,
  updateOutsideComfortZoneConfig,
} from '../config/outsideComfortZoneConfig.js';
import { TasteBoundaryProfile } from '../services/tasteBoundaryDetectionService.js';
import { ComfortDiscoveryScoreResult } from '../services/comfortDiscoveryScoringService.js';
import { HybridCandidate } from '../services/candidateGenerationService.js';
import { AdaptiveRecommendationRankingPipeline } from '../services/adaptiveRecommendationRankingPipeline.js';
import { HybridRecommendationService } from '../services/hybridRecommendationService.js';

export async function runOutsideComfortZoneRecommendationTests() {
  console.log('[Outside-Comfort-Zone Recommendations Test Suite] Starting tests...');

  const mockUserId = new Types.ObjectId().toString();

  // Mock Music DNA for a Synthwave & Ambient listener
  const mockMusicDna = {
    userId: mockUserId,
    genres: [
      { genre: 'synthwave', weight: 0.85, confidence: 0.9 },
      { genre: 'ambient', weight: 0.65, confidence: 0.8 },
      { genre: 'electronic', weight: 0.50, confidence: 0.7 },
    ],
    audioFeatures: {
      energy: { mean: 0.60, variance: 0.05 },
      valence: { mean: 0.45, variance: 0.06 },
      danceability: { mean: 0.65, variance: 0.04 },
      acousticness: { mean: 0.20, variance: 0.03 },
      instrumentalness: { mean: 0.55, variance: 0.05 },
      tempo: { mean: 118, variance: 15 },
    },
    moods: [
      { mood: 'chill', weight: 0.8 },
      { mood: 'nostalgic', weight: 0.75 },
    ],
    tendencies: {
      diversityPreference: 0.5,
      explorationPreference: 0.6,
      noveltyPreference: 0.55,
      repeatListeningRate: 0.4,
    },
    version: 1,
    confidenceScore: 0.85,
  };

  // Mock Personal Music Twin
  const mockPersonalTwin = {
    userId: mockUserId,
    listenerArchetype: 'explorer',
    archetypeConfidence: 0.8,
    personalityTraits: [
      { trait: 'discovery_oriented', score: 0.78, confidence: 0.8 },
      { trait: 'mood_driven', score: 0.70, confidence: 0.75 },
    ],
    establishedPreferences: {
      genres: ['synthwave', 'ambient'],
      artists: ['Kavinsky', 'Tycho'],
    },
    emergingPreferences: {
      genres: ['darksynth', 'cyberpunk'],
      artists: ['Carpenter Brut'],
    },
    tasteStability: { stabilityScore: 0.72, stabilityRating: 'stable' },
  };

  // Mock Taste Boundaries
  const mockBoundaries: TasteBoundaryProfile = {
    userId: mockUserId,
    boundaryBreadth: 'MODERATE',
    boundaryBreadthScore: 0.55,
    confidenceScore: 0.85,
    isDataSufficient: true,
    stronglyPreferredAreas: [
      {
        name: 'synthwave',
        type: 'genre',
        affinityScore: 0.90,
        proximityScore: 1.0,
        discoveryPotential: 0.1,
        relation: 'Core preferred genre',
        confidenceScore: 0.9,
        rationale: 'Top genre in Music DNA',
      },
      {
        name: 'ambient',
        type: 'genre',
        affinityScore: 0.80,
        proximityScore: 1.0,
        discoveryPotential: 0.1,
        relation: 'Core preferred genre',
        confidenceScore: 0.8,
        rationale: 'Second top genre in Music DNA',
      },
      {
        name: 'Kavinsky',
        type: 'artist',
        affinityScore: 0.90,
        proximityScore: 1.0,
        discoveryPotential: 0.1,
        relation: 'Core preferred artist',
        confidenceScore: 0.9,
        rationale: 'Established preferred artist',
      },
      {
        name: 'Tycho',
        type: 'artist',
        affinityScore: 0.80,
        proximityScore: 1.0,
        discoveryPotential: 0.1,
        relation: 'Core preferred artist',
        confidenceScore: 0.8,
        rationale: 'Established preferred artist',
      },
    ],
    adjacentGenres: [
      {
        name: 'darksynth',
        type: 'genre',
        affinityScore: 0.50,
        proximityScore: 0.85,
        discoveryPotential: 0.70,
        relation: 'Adjacent sister genre to synthwave',
        anchor: 'synthwave',
        confidenceScore: 0.85,
        rationale: 'Stylistically adjacent to synthwave with darker electronic textures',
      },
      {
        name: 'cyberpunk',
        type: 'genre',
        affinityScore: 0.45,
        proximityScore: 0.80,
        discoveryPotential: 0.75,
        relation: 'Adjacent sister genre to synthwave',
        anchor: 'synthwave',
        confidenceScore: 0.80,
        rationale: 'Shares synth-driven production with futuristic aesthetic',
      },
      {
        name: 'downtempo',
        type: 'genre',
        affinityScore: 0.40,
        proximityScore: 0.78,
        discoveryPotential: 0.65,
        relation: 'Adjacent sister genre to ambient',
        anchor: 'ambient',
        confidenceScore: 0.78,
        rationale: 'Closely related to ambient with rhythmic chill beats',
      },
    ],
    adjacentArtists: [
      {
        name: 'Carpenter Brut',
        type: 'artist',
        affinityScore: 0.50,
        proximityScore: 0.82,
        discoveryPotential: 0.72,
        relation: 'Stylistic peer to Kavinsky',
        anchor: 'Kavinsky',
        confidenceScore: 0.82,
        rationale: 'Collaborator and stylistic peer to Kavinsky',
      },
      {
        name: 'Bonobo',
        type: 'artist',
        affinityScore: 0.45,
        proximityScore: 0.75,
        discoveryPotential: 0.68,
        relation: 'Similar organic chill aesthetic to Tycho',
        anchor: 'Tycho',
        confidenceScore: 0.75,
        rationale: 'Similar organic chill aesthetic to Tycho',
      },
    ],
    familiarUnderexploredAreas: [],
    potentiallyInterestingAreas: [],
    lowConfidenceAreas: [],
    summary: {
      coreAnchorDescription: 'Firmly anchored in synthwave and ambient',
      boundaryHorizonDescription: 'Darksynth and cyberpunk frontiers',
      recommendedDiscoveryStrategy: 'ADJACENT_EXPANSION',
      rationales: ['User exhibits high affinity for retro electronic synths'],
    },
    lastEvaluatedAt: new Date(),
  };

  // Mock Candidate pool
  const songIdCore = new Types.ObjectId().toString();
  const songIdAdjacent1 = new Types.ObjectId().toString();
  const songIdAdjacent2 = new Types.ObjectId().toString();
  const songIdUnrelated = new Types.ObjectId().toString();

  const mockCandidates: HybridCandidate[] = [
    // 1. Core familiar track - already in user listening history
    {
      songId: songIdCore,
      songDoc: {
        _id: songIdCore,
        title: 'Nightcall',
        artist: 'Kavinsky',
        genres: ['synthwave'],
        moods: ['nostalgic'],
        energy: 0.60,
        valence: 0.45,
        danceability: 0.65,
      },
      contentScore: 0.95,
      collaborativeScore: 0.90,
      userTasteAffinityScore: 0.95,
      popularitySignal: 0.8,
      recencySignal: 0.9,
      sources: ['content', 'history'],
    },
    // 2. Adjacent genre track - Darksynth (Carpenter Brut)
    {
      songId: songIdAdjacent1,
      songDoc: {
        _id: songIdAdjacent1,
        title: 'Turbo Killer',
        artist: 'Carpenter Brut',
        genres: ['darksynth'],
        moods: ['nostalgic', 'energetic'],
        energy: 0.68,
        valence: 0.42,
        danceability: 0.62,
      },
      contentScore: 0.82,
      collaborativeScore: 0.75,
      userTasteAffinityScore: 0.70,
      popularitySignal: 0.7,
      recencySignal: 0.8,
      sources: ['similar_artist'],
    },
    // 3. Adjacent genre track - Cyberpunk (Scandroid)
    {
      songId: songIdAdjacent2,
      songDoc: {
        _id: songIdAdjacent2,
        title: 'Neo-Tokyo',
        artist: 'Scandroid',
        genres: ['cyberpunk'],
        moods: ['chill', 'futuristic'],
        energy: 0.64,
        valence: 0.48,
        danceability: 0.60,
      },
      contentScore: 0.78,
      collaborativeScore: 0.70,
      userTasteAffinityScore: 0.68,
      popularitySignal: 0.6,
      recencySignal: 0.7,
      sources: ['genre_exploration'],
    },
    // 4. Completely unrelated song - Traditional Polka
    {
      songId: songIdUnrelated,
      songDoc: {
        _id: songIdUnrelated,
        title: 'Bavarian Beer Hall Polka',
        artist: 'Munich Oompah Brass',
        genres: ['polka', 'brass_band', 'traditional_folk'],
        moods: ['cheerful'],
        energy: 0.90,
        valence: 0.95,
        danceability: 0.20,
        acousticness: 0.90,
      },
      contentScore: 0.10,
      collaborativeScore: 0.05,
      userTasteAffinityScore: 0.05,
      popularitySignal: 0.3,
      recencySignal: 0.4,
      sources: ['trending'],
    },
  ];

  resetOutsideComfortZoneConfig();

  // ---------------------------------------------------------------------------
  // Test 1: Candidate Relevance and Novelty Evaluation
  // ---------------------------------------------------------------------------
  console.log('\nTest 1: Candidate Relevance & Novelty Evaluation');
  {
    const inputs: OutsideComfortZoneRankingInputs = {
      userId: mockUserId,
      candidates: mockCandidates,
      tasteBoundaries: mockBoundaries,
      musicDna: mockMusicDna,
      personalMusicTwin: mockPersonalTwin,
      userEncounteredSongIds: new Set([songIdCore]), // core song is already known
    };

    const result = OutsideComfortZoneRecommendationService.rankOutsideComfortZone(inputs);

    assert.strictEqual(result.strategyUsed, 'OUTSIDE_COMFORT_ZONE');
    assert.ok(result.recommendations.length > 0, 'Should have outside-comfort-zone recommendations');

    // Top recommendation must be an adjacent genre (Carpenter Brut or Scandroid)
    const topRec = result.recommendations[0];
    const topGenre = topRec.song.genres ? topRec.song.genres[0] : (topRec.song.genre?.name || topRec.song.genre);
    assert.ok(['darksynth', 'cyberpunk'].includes(topGenre), `Top genre should be adjacent, got ${topGenre}`);
    assert.ok(topRec.outsideComfortZoneDiagnostics.relevanceScore >= 0.60, 'Relevance score should be >= 0.60');
    assert.ok(topRec.outsideComfortZoneDiagnostics.noveltyScore >= 0.60, 'Novelty score should be >= 0.60');
    assert.ok(topRec.outsideComfortZoneDiagnostics.compositeScore > 0.60, 'Composite score should be > 0.60');
    assert.ok(topRec.outsideComfortZoneDiagnostics.explanation.length > 0, 'Should include descriptive explanation');

    // Polka should be rejected as unrelated
    const polkaInRecs = result.recommendations.find((r) => r.song._id.toString() === songIdUnrelated);
    assert.strictEqual(polkaInRecs, undefined, 'Completely unrelated song must be rejected');
    assert.ok(result.diagnostics.rejectedUnrelatedCount >= 1, 'rejectedUnrelatedCount must be >= 1');

    console.log('✓ Candidate relevance and novelty verified.');
  }

  // ---------------------------------------------------------------------------
  // Test 2: Exploration vs Comfort Balance Modulation
  // ---------------------------------------------------------------------------
  console.log('\nTest 2: Exploration vs Comfort Balance Modulation');
  {
    // A. Comfort-dominant mode
    const comfortScore: ComfortDiscoveryScoreResult = {
      userId: mockUserId,
      comfortScore: 0.85,
      discoveryScore: 0.25,
      dominantMode: 'COMFORT',
      balanceRatio: -0.60,
      confidenceScore: 0.85,
      isDataSufficient: true,
      componentBreakdown: {} as any,
      rationales: ['Prioritize familiar favorites'],
      explanation: 'User strongly prefers comfort zone tracks',
      lastCalculatedAt: new Date(),
    };

    const comfortRes = OutsideComfortZoneRecommendationService.rankOutsideComfortZone({
      userId: mockUserId,
      candidates: mockCandidates,
      tasteBoundaries: mockBoundaries,
      comfortDiscoveryScore: comfortScore,
      musicDna: mockMusicDna,
      personalMusicTwin: mockPersonalTwin,
    });

    assert.strictEqual(comfortRes.diagnostics.userDominantMode, 'COMFORT');
    assert.ok(
      comfortRes.diagnostics.effectiveRelevanceWeight > comfortRes.diagnostics.effectiveNoveltyWeight,
      'Relevance weight should exceed novelty weight for comfort mode'
    );
    assert.ok(
      comfortRes.diagnostics.effectiveRelevanceWeight >= 0.65,
      `Relevance weight should be >= 0.65, got ${comfortRes.diagnostics.effectiveRelevanceWeight}`
    );

    // B. Discovery-dominant mode
    const discoveryScore: ComfortDiscoveryScoreResult = {
      userId: mockUserId,
      comfortScore: 0.30,
      discoveryScore: 0.80,
      dominantMode: 'DISCOVERY',
      balanceRatio: 0.50,
      confidenceScore: 0.85,
      isDataSufficient: true,
      componentBreakdown: {} as any,
      rationales: ['Actively suggest new areas'],
      explanation: 'User is in active discovery mode',
      lastCalculatedAt: new Date(),
    };

    const discoveryRes = OutsideComfortZoneRecommendationService.rankOutsideComfortZone({
      userId: mockUserId,
      candidates: mockCandidates,
      tasteBoundaries: mockBoundaries,
      comfortDiscoveryScore: discoveryScore,
      musicDna: mockMusicDna,
      personalMusicTwin: mockPersonalTwin,
    });

    assert.strictEqual(discoveryRes.diagnostics.userDominantMode, 'DISCOVERY');
    assert.ok(
      discoveryRes.diagnostics.effectiveNoveltyWeight >= 0.45,
      `Novelty weight should be >= 0.45, got ${discoveryRes.diagnostics.effectiveNoveltyWeight}`
    );

    console.log('✓ Exploration vs Comfort balance modulation verified.');
  }

  // ---------------------------------------------------------------------------
  // Test 3: Diversity Decay across Outside Zones
  // ---------------------------------------------------------------------------
  console.log('\nTest 3: Diversity Decay across Outside Zones');
  {
    const duplicateCandidates: HybridCandidate[] = [
      {
        songId: new Types.ObjectId().toString(),
        songDoc: {
          _id: new Types.ObjectId().toString(),
          title: 'Darksynth One',
          artist: 'Artist A',
          genres: ['darksynth'],
          moods: ['chill'],
        },
        contentScore: 0.8,
        collaborativeScore: 0.8,
        userTasteAffinityScore: 0.8,
        popularitySignal: 0.5,
        recencySignal: 0.5,
        sources: ['test'],
      },
      {
        songId: new Types.ObjectId().toString(),
        songDoc: {
          _id: new Types.ObjectId().toString(),
          title: 'Darksynth Two',
          artist: 'Artist B',
          genres: ['darksynth'],
          moods: ['chill'],
        },
        contentScore: 0.79,
        collaborativeScore: 0.79,
        userTasteAffinityScore: 0.79,
        popularitySignal: 0.5,
        recencySignal: 0.5,
        sources: ['test'],
      },
      {
        songId: new Types.ObjectId().toString(),
        songDoc: {
          _id: new Types.ObjectId().toString(),
          title: 'Cyberpunk One',
          artist: 'Artist C',
          genres: ['cyberpunk'],
          moods: ['chill'],
        },
        contentScore: 0.75,
        collaborativeScore: 0.75,
        userTasteAffinityScore: 0.75,
        popularitySignal: 0.5,
        recencySignal: 0.5,
        sources: ['test'],
      },
    ];

    const result = OutsideComfortZoneRecommendationService.rankOutsideComfortZone({
      userId: mockUserId,
      candidates: duplicateCandidates,
      tasteBoundaries: mockBoundaries,
      musicDna: mockMusicDna,
      personalMusicTwin: mockPersonalTwin,
    });

    assert.strictEqual(result.recommendations.length, 3);
    const firstDarksynth = result.recommendations.find((r) => r.song.title === 'Darksynth One')!;
    const secondDarksynth = result.recommendations.find((r) => r.song.title === 'Darksynth Two')!;
    assert.ok(
      firstDarksynth.hybridScore > secondDarksynth.hybridScore,
      `First darksynth track (${firstDarksynth.hybridScore}) should rank higher than duplicate darksynth track (${secondDarksynth.hybridScore}) due to diversity decay`
    );

    console.log('✓ Diversity decay verified.');
  }

  // ---------------------------------------------------------------------------
  // Test 4: Adaptive Ranking Pipeline Integration
  // ---------------------------------------------------------------------------
  console.log('\nTest 4: Adaptive Ranking Pipeline Integration');
  {
    const pipelineRes = await AdaptiveRecommendationRankingPipeline.executePipeline({
      userId: mockUserId,
      candidates: mockCandidates,
      recommendationMode: 'OUTSIDE_COMFORT_ZONE',
      tasteBoundaries: mockBoundaries,
      musicDnaProfile: mockMusicDna,
      personalMusicTwin: mockPersonalTwin,
    });

    assert.strictEqual(pipelineRes.strategyUsed, 'OUTSIDE_COMFORT_ZONE');
    assert.ok(pipelineRes.recommendations.length > 0, 'Pipeline should return recommendations');
    assert.ok(pipelineRes.diagnostics.outsideComfortZone, 'Pipeline diagnostics should include outsideComfortZone');
    assert.strictEqual(pipelineRes.diagnostics.outsideComfortZone?.applied, true);
    assert.ok(pipelineRes.diagnostics.outsideComfortZone?.qualifiedCount! > 0);
    assert.ok(pipelineRes.diagnostics.outsideComfortZone?.rejectedUnrelatedCount! >= 1);

    for (const rec of pipelineRes.recommendations) {
      assert.ok((rec as any).outsideComfortZoneDiagnostics !== undefined);
      assert.ok((rec as any).outsideComfortZoneDiagnostics.relevanceScore >= 0.25);
    }

    console.log('✓ Adaptive ranking pipeline integration verified.');
  }

  // ---------------------------------------------------------------------------
  // Test 5: Meaningful Discovery Categories
  // ---------------------------------------------------------------------------
  console.log('\nTest 5: Discovery Categorization');
  {
    const result = OutsideComfortZoneRecommendationService.rankOutsideComfortZone({
      userId: mockUserId,
      candidates: mockCandidates,
      tasteBoundaries: mockBoundaries,
      musicDna: mockMusicDna,
      personalMusicTwin: mockPersonalTwin,
    });

    const categories = result.recommendations.map(
      (r) => r.outsideComfortZoneDiagnostics.discoveryCategory
    );
    assert.ok(categories.includes('ADJACENT_GENRE'), 'Should identify ADJACENT_GENRE category');
    console.log('✓ Discovery categorization verified.');
  }

  // ---------------------------------------------------------------------------
  // Test 6: Sensible Defaults on Insufficient History / Cold Start
  // ---------------------------------------------------------------------------
  console.log('\nTest 6: Fallback on Insufficient History');
  {
    const emptyUserId = new Types.ObjectId().toString();
    const result = OutsideComfortZoneRecommendationService.rankOutsideComfortZone({
      userId: emptyUserId,
      candidates: mockCandidates,
    });

    assert.strictEqual(result.strategyUsed, 'OUTSIDE_COMFORT_ZONE');
    assert.ok(result.recommendations !== undefined);
    assert.strictEqual(result.diagnostics.totalCandidatesEvaluated, mockCandidates.length);
    console.log('✓ Fallback on insufficient history verified.');
  }

  console.log('\n[Outside-Comfort-Zone Recommendations Test Suite] All tests passed!\n');
  return true;
}

if (
  process.argv[1]?.endsWith('outsideComfortZoneRecommendationService.test.ts') ||
  process.argv[1]?.endsWith('outsideComfortZoneRecommendationService.test.js')
) {
  runOutsideComfortZoneRecommendationTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Test failed:', err);
      process.exit(1);
    });
}
