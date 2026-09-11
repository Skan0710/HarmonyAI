import assert from 'node:assert';
import {
  TasteEvolutionDiscoveryService,
  TasteEvolutionDiscoveryInputs,
} from '../services/tasteEvolutionDiscoveryService.js';
import {
  resetTasteEvolutionDiscoveryConfig,
  updateTasteEvolutionDiscoveryConfig,
} from '../config/tasteEvolutionDiscoveryConfig.js';
import { HybridCandidate } from '../services/candidateGenerationService.js';
import { AdaptiveRecommendationRankingPipeline } from '../services/adaptiveRecommendationRankingPipeline.js';

export async function runTasteEvolutionDiscoveryTests() {
  console.log('[Taste-Evolution-Aware Discovery Test Suite] Starting tests...');

  const mockUserId = crypto.randomUUID().toString();

  const songIdEmergingGenre = crypto.randomUUID().toString();
  const songIdRelatedArtist = crypto.randomUUID().toString();
  const songIdAdjacentGenre = crypto.randomUUID().toString();
  const songIdFadingGenre = crypto.randomUUID().toString();
  const songIdStableAnchor = crypto.randomUUID().toString();
  const songIdFluke = crypto.randomUUID().toString();

  // Mock candidates covering all evolutionary states
  const mockCandidates: HybridCandidate[] = [
    // 1. Verified emerging genre: Darksynth (Carpenter Brut)
    {
      songId: songIdEmergingGenre,
      songDoc: {
        _id: songIdEmergingGenre,
        title: 'Turbo Killer',
        artist: 'Carpenter Brut',
        genres: ['darksynth'],
        moods: ['dark', 'energetic'],
        energy: 0.75,
      },
      contentScore: 0.85,
      collaborativeScore: 0.80,
      userTasteAffinityScore: 0.70,
      popularitySignal: 0.7,
      recencySignal: 0.9,
      sources: ['emerging_source'],
    },
    // 2. Related artist to emerging artist: Perturbator
    {
      songId: songIdRelatedArtist,
      songDoc: {
        _id: songIdRelatedArtist,
        title: 'Future Club',
        artist: 'Perturbator',
        genres: ['electronic'],
        moods: ['dark', 'futuristic'],
        energy: 0.78,
      },
      contentScore: 0.80,
      collaborativeScore: 0.75,
      userTasteAffinityScore: 0.65,
      popularitySignal: 0.7,
      recencySignal: 0.8,
      sources: ['related_artist'],
    },
    // 3. Adjacent genre connected to emerging behavior: Cyberpunk (Scandroid)
    {
      songId: songIdAdjacentGenre,
      songDoc: {
        _id: songIdAdjacentGenre,
        title: 'Neo-Tokyo',
        artist: 'Scandroid',
        genres: ['cyberpunk'],
        moods: ['futuristic'],
        energy: 0.70,
      },
      contentScore: 0.78,
      collaborativeScore: 0.72,
      userTasteAffinityScore: 0.62,
      popularitySignal: 0.6,
      recencySignal: 0.7,
      sources: ['genre_exploration'],
    },
    // 4. Stable foundational anchor: Synthwave (The Midnight)
    {
      songId: songIdStableAnchor,
      songDoc: {
        _id: songIdStableAnchor,
        title: 'Sunset',
        artist: 'The Midnight',
        genres: ['synthwave'],
        moods: ['nostalgic'],
        energy: 0.60,
      },
      contentScore: 0.90,
      collaborativeScore: 0.85,
      userTasteAffinityScore: 0.88,
      popularitySignal: 0.85,
      recencySignal: 0.5,
      sources: ['core_history'],
    },
    // 5. Fading genre: Vaporwave (Saint Pepsi)
    {
      songId: songIdFadingGenre,
      songDoc: {
        _id: songIdFadingGenre,
        title: 'Enjoy Yourself',
        artist: 'Saint Pepsi',
        genres: ['vaporwave'],
        moods: ['nostalgic', 'mellow'],
        energy: 0.45,
      },
      contentScore: 0.70,
      collaborativeScore: 0.65,
      userTasteAffinityScore: 0.60,
      popularitySignal: 0.5,
      recencySignal: 0.3,
      sources: ['fading_history'],
    },
    // 6. Isolated fluke: Polka track played once randomly
    {
      songId: songIdFluke,
      songDoc: {
        _id: songIdFluke,
        title: 'Bavarian Polka Hop',
        artist: 'Munich Brass',
        genres: ['polka'],
        moods: ['cheerful'],
        energy: 0.90,
      },
      contentScore: 0.40,
      collaborativeScore: 0.20,
      userTasteAffinityScore: 0.30,
      popularitySignal: 0.3,
      recencySignal: 0.9,
      sources: ['random_trending'],
    },
  ];

  // Mock Emerging Taste Report
  const mockEmergingReport = {
    userId: mockUserId,
    generatedAt: new Date(),
    summary: {
      totalEmergingCount: 2,
      primaryEmergingGenre: 'darksynth',
      primaryEmergingArtist: 'Carpenter Brut',
      primaryEmergingMood: 'dark',
      narrative: 'Emerging preference shift towards heavier darksynth and cyberpunk aesthetics.',
    },
    emergingGenres: [
      {
        name: 'darksynth',
        type: 'genre' as const,
        stage: 'emerging' as const,
        recentPlayCount: 5,
        currentScore: 0.80,
        shortTermScore: 0.85,
        longTermScore: 0.35,
        momentumDelta: 0.50,
        emergenceConfidence: 0.88,
        hasPositiveFeedback: true,
        explanation: '5 recent plays with positive completions and likes.',
      },
    ],
    emergingArtists: [
      {
        name: 'Carpenter Brut',
        type: 'artist' as const,
        stage: 'emerging' as const,
        recentPlayCount: 4,
        currentScore: 0.78,
        shortTermScore: 0.82,
        longTermScore: 0.30,
        momentumDelta: 0.52,
        emergenceConfidence: 0.85,
        hasPositiveFeedback: true,
        explanation: 'Rapidly rising artist stream count.',
      },
    ],
    emergingMoods: [
      {
        name: 'dark',
        type: 'mood' as const,
        stage: 'emerging' as const,
        recentPlayCount: 4,
        currentScore: 0.70,
        shortTermScore: 0.75,
        longTermScore: 0.40,
        momentumDelta: 0.35,
        emergenceConfidence: 0.80,
        explanation: 'Increasing preference for darker, heavier tones.',
      },
    ],
    emergingBehaviors: [],
    establishedPreferences: {
      genres: ['synthwave'],
      artists: ['The Midnight'],
    },
    fadingPreferences: {
      genres: ['vaporwave'],
      artists: ['Saint Pepsi'],
    },
  };

  // Mock Personal Music Twin
  const mockTwin = {
    userId: mockUserId,
    listenerArchetype: 'explorer',
    archetypeConfidence: 0.85,
    establishedPreferences: {
      genres: ['synthwave'],
      artists: ['The Midnight'],
    },
    currentEmergingInterests: {
      genres: [{ name: 'darksynth', confidence: 0.88 }],
      artists: [
        {
          name: 'Carpenter Brut',
          confidence: 0.85,
          relatedArtists: ['Perturbator'],
        },
      ],
      moods: ['dark'],
      narrative: 'Transitioning towards dark electronic sounds.',
    },
    fadingPreferences: {
      genres: ['vaporwave'],
      artists: ['Saint Pepsi'],
    },
    tasteStability: {
      stabilityScore: 0.55,
      stabilityRating: 'moderate_drift',
      description: 'Moderate taste evolution in progress.',
    },
    tasteEvolution: {
      transformationIntensity: 0.72,
      evolutionArchetype: 'Transforming / Paradigm Shift',
      primaryTasteDirection: 'Heavy retro-electronic evolution',
      velocity: 'rapid',
    },
  };

  resetTasteEvolutionDiscoveryConfig();

  // ---------------------------------------------------------------------------
  // Test 1: Emerging Preferences & Directional Alignment
  // ---------------------------------------------------------------------------
  console.log('\nTest 1: Emerging Preferences & Directional Alignment');
  {
    const inputs: TasteEvolutionDiscoveryInputs = {
      userId: mockUserId,
      candidates: mockCandidates,
      emergingTasteReport: mockEmergingReport,
      personalMusicTwin: mockTwin,
    };

    const result = TasteEvolutionDiscoveryService.rankTasteEvolutionDiscovery(inputs);

    assert.strictEqual(result.strategyUsed, 'TASTE_EVOLUTION_DISCOVERY');
    assert.ok(result.recommendations.length > 0, 'Should return recommendations');

    // 1. Top recommendation should be the verified emerging genre track (Turbo Killer)
    const topRec = result.recommendations[0];
    assert.strictEqual(topRec.song.title, 'Turbo Killer');
    assert.strictEqual(topRec.tasteEvolutionDiscoveryDiagnostics.category, 'EMERGING_GENRE_FRONTIER');
    assert.strictEqual(topRec.tasteEvolutionDiscoveryDiagnostics.isEmergingGenre, true);
    assert.ok(
      topRec.tasteEvolutionDiscoveryDiagnostics.directionAlignmentScore >= 0.50,
      `Emerging direction score should be >= 0.50, got ${topRec.tasteEvolutionDiscoveryDiagnostics.directionAlignmentScore}`
    );

    // 2. Related artist (Perturbator) should be boosted
    const relatedRec = result.recommendations.find((r) => r.song.artist === 'Perturbator')!;
    assert.ok(relatedRec !== undefined, 'Related artist track should be recommended');
    assert.strictEqual(relatedRec.tasteEvolutionDiscoveryDiagnostics.isRelatedToEmergingArtist, true);
    assert.strictEqual(relatedRec.tasteEvolutionDiscoveryDiagnostics.category, 'RELATED_EMERGING_ARTIST');

    // 3. Adjacent genre to emerging behavior (Cyberpunk) should be boosted
    const adjacentRec = result.recommendations.find((r) => r.song.title === 'Neo-Tokyo')!;
    assert.ok(adjacentRec !== undefined, 'Adjacent genre to emerging behavior should be recommended');
    assert.strictEqual(adjacentRec.tasteEvolutionDiscoveryDiagnostics.isAdjacentToRecentBehavior, true);

    // 4. Rising mood should be detected
    assert.ok(topRec.tasteEvolutionDiscoveryDiagnostics.isRisingMood, 'Dark mood should be recognized as rising');

    console.log('✓ Emerging preferences, related artists, rising moods, and adjacent frontiers verified.');
  }

  // ---------------------------------------------------------------------------
  // Test 2: Stable Preferences (Anchor Grounding)
  // ---------------------------------------------------------------------------
  console.log('\nTest 2: Stable Preferences Continuity');
  {
    const result = TasteEvolutionDiscoveryService.rankTasteEvolutionDiscovery({
      userId: mockUserId,
      candidates: mockCandidates,
      emergingTasteReport: mockEmergingReport,
      personalMusicTwin: mockTwin,
    });

    const stableRec = result.recommendations.find((r) => r.song.title === 'Sunset')!;
    assert.ok(stableRec !== undefined, 'Stable anchor should be present in candidate evaluation');
    // Stable anchor receives foundational baseline but does not outrank verified emerging track
    assert.ok(
      result.recommendations[0].hybridScore > stableRec.hybridScore,
      'Active emerging trend should outrank static stable favorite in evolution discovery mode'
    );
    console.log('✓ Stable preferences grounded without overpowering evolution trajectory.');
  }

  // ---------------------------------------------------------------------------
  // Test 3: Fading Preferences (Attenuation Penalty)
  // ---------------------------------------------------------------------------
  console.log('\nTest 3: Fading Preferences Attenuation');
  {
    const result = TasteEvolutionDiscoveryService.rankTasteEvolutionDiscovery({
      userId: mockUserId,
      candidates: mockCandidates,
      emergingTasteReport: mockEmergingReport,
      personalMusicTwin: mockTwin,
    });

    const fadingRec = result.recommendations.find((r) => r.song.title === 'Enjoy Yourself')!;
    assert.ok(fadingRec !== undefined);
    assert.strictEqual(fadingRec.tasteEvolutionDiscoveryDiagnostics.isFadingPreference, true);
    assert.ok(result.diagnostics.fadingPenalizedCount >= 1, 'fadingPenalizedCount should be >= 1');
    assert.ok(
      result.recommendations[0].hybridScore > fadingRec.hybridScore,
      'Fading preference must rank lower than emerging preference'
    );
    console.log('✓ Fading preferences correctly penalized and attenuated.');
  }

  // ---------------------------------------------------------------------------
  // Test 4: Conflicting Long-Term vs Short-Term Preferences
  // ---------------------------------------------------------------------------
  console.log('\nTest 4: Conflicting Long-Term vs Short-Term Preferences');
  {
    // Scenario A: Short-term preference has VERIFIED evidence (>= 2 plays, positive feedback)
    // Long-term = Classic Rock, Short-term = Synthwave (rising fast)
    const verifiedShortTermCandidates: HybridCandidate[] = [
      {
        songId: crypto.randomUUID().toString(),
        songDoc: {
          _id: crypto.randomUUID().toString(),
          title: 'Comfortably Numb',
          artist: 'Pink Floyd',
          genres: ['classic rock'],
        },
        contentScore: 0.90,
        userTasteAffinityScore: 0.90, // Strong long-term affinity
      } as any,
      {
        songId: crypto.randomUUID().toString(),
        songDoc: {
          _id: crypto.randomUUID().toString(),
          title: 'Resonance',
          artist: 'HOME',
          genres: ['synthwave'],
        },
        contentScore: 0.85,
        userTasteAffinityScore: 0.70, // Newer affinity
      } as any,
    ];

    const verifiedTemporalProfile: any = {
      strongestChangingPreferences: {
        topRising: [
          {
            name: 'synthwave',
            category: 'genre',
            shortTermScore: 0.85,
            longTermScore: 0.20,
            changeDelta: 0.65,
            direction: 'rising',
            recentPlayCount: 6, // VERIFIED EVIDENCE
          },
        ],
        topDeclining: [
          {
            name: 'classic rock',
            category: 'genre',
            shortTermScore: 0.25,
            longTermScore: 0.85,
            changeDelta: -0.60,
            direction: 'declining',
          },
        ],
        topEmerging: [],
      },
    };

    const verifiedRes = TasteEvolutionDiscoveryService.rankTasteEvolutionDiscovery({
      userId: mockUserId,
      candidates: verifiedShortTermCandidates,
      temporalProfile: verifiedTemporalProfile,
    });

    // When short-term has verified evidence, the forward direction (Synthwave) wins the conflict!
    const topSongVerified = verifiedRes.recommendations[0];
    assert.strictEqual(
      topSongVerified.song.title,
      'Resonance',
      'Verified short-term preference must win conflict over declining long-term preference'
    );
    console.log('✓ Confirmed evidence scenario: forward momentum successfully wins conflict.');

    // Scenario B: Short-term preference is an ISOLATED FLUKE (1 play, no positive feedback)
    // Long-term = Classic Rock, Short-term = 1 fluke play of Polka
    const flukeCandidates: HybridCandidate[] = [
      {
        songId: crypto.randomUUID().toString(),
        songDoc: {
          _id: crypto.randomUUID().toString(),
          title: 'Comfortably Numb',
          artist: 'Pink Floyd',
          genres: ['classic rock'],
        },
        contentScore: 0.90,
        userTasteAffinityScore: 0.90,
      } as any,
      {
        songId: crypto.randomUUID().toString(),
        songDoc: {
          _id: crypto.randomUUID().toString(),
          title: 'Polka Party',
          artist: 'Accordion Kings',
          genres: ['polka'],
        },
        contentScore: 0.50,
        userTasteAffinityScore: 0.40,
      } as any,
    ];

    const flukeReport: any = {
      emergingGenres: [
        {
          name: 'polka',
          type: 'genre',
          stage: 'one_off_interaction',
          recentPlayCount: 1, // ONLY 1 PLAY -> NOT ENOUGH EVIDENCE
          momentumDelta: 0.40,
          emergenceConfidence: 0.20,
          hasPositiveFeedback: false,
        },
      ],
      establishedPreferences: {
        genres: ['classic rock'],
        artists: ['Pink Floyd'],
      },
      fadingPreferences: {
        genres: [],
        artists: [],
      },
    };

    const flukeRes = TasteEvolutionDiscoveryService.rankTasteEvolutionDiscovery({
      userId: mockUserId,
      candidates: flukeCandidates,
      emergingTasteReport: flukeReport,
    });

    // Anti-overreaction check: Polka must NOT win because evidence threshold is not met
    const topSongFluke = flukeRes.recommendations[0];
    assert.strictEqual(
      topSongFluke.song.title,
      'Comfortably Numb',
      'System must NOT overreact to isolated fluke; stable long-term taste should take precedence'
    );
    assert.ok(flukeRes.diagnostics.flukesSuppressedCount >= 1, 'Fluke should be counted as suppressed');
    console.log('✓ Anti-overreaction check: isolated fluke correctly suppressed without overreacting.');
  }

  // ---------------------------------------------------------------------------
  // Test 5: Adaptive Pipeline Integration
  // ---------------------------------------------------------------------------
  console.log('\nTest 5: Adaptive Pipeline Integration');
  {
    const pipelineRes = await AdaptiveRecommendationRankingPipeline.executePipeline({
      userId: mockUserId,
      candidates: mockCandidates,
      recommendationMode: 'TASTE_EVOLUTION_DISCOVERY',
      personalMusicTwin: mockTwin,
    });

    assert.strictEqual(pipelineRes.strategyUsed, 'TASTE_EVOLUTION_DISCOVERY');
    assert.ok(pipelineRes.recommendations.length > 0);
    assert.ok(pipelineRes.diagnostics.tasteEvolutionDiscovery !== undefined);
    assert.strictEqual(pipelineRes.diagnostics.tasteEvolutionDiscovery?.applied, true);
    assert.ok(pipelineRes.diagnostics.tasteEvolutionDiscovery?.emergingMatchesCount! > 0);
    assert.strictEqual(pipelineRes.recommendations[0].song.title, 'Turbo Killer');

    console.log('✓ Adaptive pipeline integration verified with TASTE_EVOLUTION_DISCOVERY mode.');
  }

  console.log('\n[Taste-Evolution-Aware Discovery Test Suite] All tests passed!\n');
  return true;
}

if (
  process.argv[1]?.endsWith('tasteEvolutionDiscoveryService.test.ts') ||
  process.argv[1]?.endsWith('tasteEvolutionDiscoveryService.test.js')
) {
  runTasteEvolutionDiscoveryTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Test failed:', err);
      process.exit(1);
    });
}
