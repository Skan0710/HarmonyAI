import assert from 'node:assert';
import { Types } from 'mongoose';
import {
  TasteBoundaryDetectionService,
  TasteBoundaryProfile,
} from '../services/tasteBoundaryDetectionService.js';
import {
  getTasteBoundaryConfig,
  updateTasteBoundaryConfig,
  resetTasteBoundaryConfig,
} from '../config/tasteBoundaryConfig.js';
import { UnifiedMusicDNAService } from '../services/unifiedMusicDnaService.js';
import { PersonalMusicTwinService } from '../services/personalMusicTwinService.js';
import { LayeredTemporalTasteProfileService } from '../services/layeredTemporalTasteProfileService.js';
import { RecommendationScoreCalibrationService } from '../services/recommendationScoreCalibrationService.js';

export async function runTasteBoundaryDetectionTests() {
  console.log('[Taste Boundary Detection Test Suite] Starting tests...');

  // ---------------------------------------------------------------------------
  // Test 1: Narrow Taste Profile
  // ---------------------------------------------------------------------------
  console.log('\nTest 1: Narrow taste profile (tight boundary centered around single core genre)');
  {
    const userId = new Types.ObjectId().toString();

    const narrowTwin: any = {
      userId,
      isDataSufficient: true,
      listenerArchetype: 'Loyal Listener',
      explorationTendency: 0.15,
      familiarityTendency: 0.90,
      diversityPreference: 0.18,
      confidenceScore: 0.88,
      genreIdentity: {
        coreGenres: [{ name: 'Synthwave', affinityScore: 0.95, isPrimary: true }],
        secondaryGenres: [],
        genreDiversityScore: 0.18,
      },
      metadata: {
        establishedPreferences: {
          genres: ['Synthwave'],
          artists: ['The Midnight', 'Gunship'],
        },
      },
    };

    const result = TasteBoundaryDetectionService.detectTasteBoundaries({
      userId,
      personalMusicTwin: narrowTwin,
      totalInteractionsCount: 45,
    });

    assert.strictEqual(result.userId, userId);
    assert.strictEqual(result.isDataSufficient, true);
    assert.strictEqual(result.boundaryBreadth, 'NARROW', 'Boundary breadth must be NARROW for single-genre loyalist');
    assert.ok(result.boundaryBreadthScore < 0.35, `Breadth score must be < 0.35, got ${result.boundaryBreadthScore}`);

    // Strongly preferred areas
    const coreGenres = result.stronglyPreferredAreas.filter((i) => i.type === 'genre');
    assert.strictEqual(coreGenres.length, 1);
    assert.strictEqual(coreGenres[0].name, 'Synthwave');
    assert.strictEqual(coreGenres[0].proximityScore, 1.0);

    // Adjacent sister genres (Darksynth, Retrowave, Cyberpunk)
    assert.ok(result.adjacentGenres.length > 0);
    const adjacentNames = result.adjacentGenres.map((g) => g.name);
    assert.ok(adjacentNames.includes('Darksynth'), 'Must include Darksynth as adjacent sister');
    assert.ok(adjacentNames.includes('Retrowave'), 'Must include Retrowave as adjacent sister');

    // Strategy
    assert.strictEqual(result.summary.recommendedDiscoveryStrategy, 'DEEP_DIVE');
    console.log(`✓ Test 1 Passed: Narrow taste mapped with tight boundary (Breadth: ${result.boundaryBreadthScore}, Strategy: ${result.summary.recommendedDiscoveryStrategy}).`);
  }

  // ---------------------------------------------------------------------------
  // Test 2: Diverse Taste Profile
  // ---------------------------------------------------------------------------
  console.log('\nTest 2: Diverse taste profile (wide boundary spanning multiple distinct genre clusters)');
  {
    const userId = new Types.ObjectId().toString();

    const diverseTwin: any = {
      userId,
      isDataSufficient: true,
      listenerArchetype: 'Genre Hopper',
      explorationTendency: 0.75,
      familiarityTendency: 0.35,
      diversityPreference: 0.88,
      confidenceScore: 0.90,
      genreIdentity: {
        coreGenres: [
          { name: 'Synthwave', affinityScore: 0.88, isPrimary: true },
          { name: 'Post-Rock', affinityScore: 0.82 },
          { name: 'Hip-Hop', affinityScore: 0.78 },
          { name: 'Ambient', affinityScore: 0.75 },
        ],
        secondaryGenres: [
          { name: 'Lo-Fi Chill', affinityScore: 0.65 },
        ],
        genreDiversityScore: 0.88,
      },
      metadata: {
        establishedPreferences: {
          genres: ['Synthwave', 'Post-Rock', 'Hip-Hop', 'Ambient'],
          artists: ['The Midnight', 'Explosions In The Sky', 'Kendrick Lamar', 'Brian Eno'],
        },
      },
    };

    const result = TasteBoundaryDetectionService.detectTasteBoundaries({
      userId,
      personalMusicTwin: diverseTwin,
      totalInteractionsCount: 60,
    });

    assert.strictEqual(result.isDataSufficient, true);
    assert.ok(
      result.boundaryBreadth === 'WIDE' || result.boundaryBreadth === 'EXPANSIVE',
      `Boundary breadth must be WIDE or EXPANSIVE, got ${result.boundaryBreadth}`
    );
    assert.ok(result.boundaryBreadthScore >= 0.65, `Breadth score must be >= 0.65, got ${result.boundaryBreadthScore}`);

    // Multi-genre core
    const coreGenres = result.stronglyPreferredAreas.filter((i) => i.type === 'genre');
    assert.strictEqual(coreGenres.length, 4);

    // Multi-family adjacent genres
    const adjacentNames = result.adjacentGenres.map((g) => g.name);
    assert.ok(adjacentNames.some((g) => ['Darksynth', 'Retrowave'].includes(g)));
    assert.ok(adjacentNames.some((g) => ['Shoegaze', 'Math Rock'].includes(g)));
    assert.ok(adjacentNames.some((g) => ['Boom Bap', 'Trap'].includes(g)));

    console.log(`✓ Test 2 Passed: Diverse taste mapped with wide boundary (Breadth: ${result.boundaryBreadthScore}, Core Genres: ${coreGenres.length}).`);
  }

  // ---------------------------------------------------------------------------
  // Test 3: Highly Exploratory User
  // ---------------------------------------------------------------------------
  console.log('\nTest 3: Highly exploratory user (frontiers and cross-genre expansion)');
  {
    const userId = new Types.ObjectId().toString();

    const exploratoryTwin: any = {
      userId,
      isDataSufficient: true,
      listenerArchetype: 'Explorer',
      explorationTendency: 0.92,
      familiarityTendency: 0.15,
      diversityPreference: 0.80,
      confidenceScore: 0.85,
      genreIdentity: {
        coreGenres: [{ name: 'Electronic', affinityScore: 0.85, isPrimary: true }],
        secondaryGenres: [],
        genreDiversityScore: 0.80,
      },
      currentEmergingInterests: {
        genres: [{ name: 'Glitch Hop', confidence: 0.85 }],
        artists: [{ name: 'Tipper', confidence: 0.80 }],
      },
    };

    const result = TasteBoundaryDetectionService.detectTasteBoundaries({
      userId,
      personalMusicTwin: exploratoryTwin,
      totalInteractionsCount: 50,
    });

    assert.strictEqual(result.summary.recommendedDiscoveryStrategy, 'FRONTIER_EXPLORATION');

    // Potentially interesting areas populated
    assert.ok(result.potentiallyInterestingAreas.length > 0);
    const potentialNames = result.potentiallyInterestingAreas.map((p) => p.name);
    assert.ok(potentialNames.includes('Glitch Hop'), 'Glitch Hop must be in potentially interesting new areas');

    // Discovery potential is high on frontier
    const glitchHop = result.potentiallyInterestingAreas.find((p) => p.name === 'Glitch Hop');
    assert.ok(glitchHop && glitchHop.discoveryPotential >= 0.85);

    console.log(`✓ Test 3 Passed: Exploratory user boundary emphasizes frontiers (${potentialNames.join(', ')}).`);
  }

  // ---------------------------------------------------------------------------
  // Test 4: Highly Comfort-Oriented User
  // ---------------------------------------------------------------------------
  console.log('\nTest 4: Highly comfort-oriented user (focuses on familiar underexplored catalog)');
  {
    const userId = new Types.ObjectId().toString();

    const comfortTwin: any = {
      userId,
      isDataSufficient: true,
      listenerArchetype: 'Comfort Listener',
      explorationTendency: 0.10,
      familiarityTendency: 0.92,
      diversityPreference: 0.30,
      confidenceScore: 0.85,
      genreIdentity: {
        coreGenres: [{ name: 'Synthwave', affinityScore: 0.95, isPrimary: true }],
        secondaryGenres: [{ name: 'Chillwave', affinityScore: 0.60 }],
        genreDiversityScore: 0.30,
      },
      metadata: {
        establishedPreferences: {
          genres: ['Synthwave'],
          artists: ['The Midnight'],
        },
      },
    };

    const result = TasteBoundaryDetectionService.detectTasteBoundaries({
      userId,
      personalMusicTwin: comfortTwin,
      totalInteractionsCount: 35,
    });

    assert.strictEqual(result.summary.recommendedDiscoveryStrategy, 'DEEP_DIVE');

    // Familiar underexplored areas highlighted
    assert.ok(result.familiarUnderexploredAreas.length > 0);
    const underexploredNames = result.familiarUnderexploredAreas.map((u) => u.name);
    assert.ok(underexploredNames.includes('Chillwave'));

    const chillwave = result.familiarUnderexploredAreas.find((u) => u.name === 'Chillwave');
    assert.ok(chillwave && chillwave.proximityScore >= 0.80);

    console.log(`✓ Test 4 Passed: Comfort user prioritized familiar underexplored areas (${underexploredNames.join(', ')}).`);
  }

  // ---------------------------------------------------------------------------
  // Test 5: Insufficient History (Cold Start)
  // ---------------------------------------------------------------------------
  console.log('\nTest 5: Insufficient user history (cold start safe fallback)');
  {
    const userId = new Types.ObjectId().toString();

    const result = TasteBoundaryDetectionService.detectTasteBoundaries({
      userId,
      musicDna: null,
      personalMusicTwin: null,
      totalInteractionsCount: 0,
    });

    assert.strictEqual(result.userId, userId);
    assert.strictEqual(result.isDataSufficient, false);
    assert.ok(result.confidenceScore <= 0.25);
    assert.strictEqual(result.summary.recommendedDiscoveryStrategy, 'ESTABLISH_BASELINE');
    assert.strictEqual(result.stronglyPreferredAreas.length, 0);

    // Low confidence areas flagged
    assert.ok(result.lowConfidenceAreas.length > 0);
    assert.ok(result.adjacentGenres.length > 0, 'Safe gateway starter genres provided');

    console.log('✓ Test 5 Passed: Insufficient history handled with graceful baseline and low confidence signals.');
  }

  // ---------------------------------------------------------------------------
  // Test 6: Asynchronous End-to-End Resolution
  // ---------------------------------------------------------------------------
  console.log('\nTest 6: getUserTasteBoundaries asynchronous integration');
  {
    const userId = new Types.ObjectId().toString();

    const originalDna = UnifiedMusicDNAService.getOrGenerateProfile;
    const originalTwin = PersonalMusicTwinService.getOrGenerateTwin;
    const originalTemporal = LayeredTemporalTasteProfileService.generateLayeredTasteProfile;
    const originalFeedback = RecommendationScoreCalibrationService.buildUserFeedbackProfile;

    try {
      UnifiedMusicDNAService.getOrGenerateProfile = async () => ({
        interactionsCountAtLastRefresh: 30,
        genreProfile: {
          topGenres: [{ name: 'Post-Rock', score: 0.90 }],
          diversity: 0.70,
        },
        artistProfile: {
          strongestArtists: [{ name: 'Explosions In The Sky', score: 0.92 }],
        },
        listeningBehavior: { isDataSufficient: true },
        confidenceScore: 0.85,
      } as any);

      PersonalMusicTwinService.getOrGenerateTwin = async () => ({
        userId,
        isDataSufficient: true,
        listenerArchetype: 'Explorer',
        explorationTendency: 0.75,
        familiarityTendency: 0.25,
        diversityPreference: 0.70,
        genreIdentity: {
          coreGenres: [{ name: 'Post-Rock', affinityScore: 0.90, isPrimary: true }],
          secondaryGenres: [{ name: 'Ambient Rock', affinityScore: 0.60 }],
        },
        currentEmergingInterests: {
          genres: [{ name: 'Shoegaze', confidence: 0.85 }],
          artists: [],
        },
      } as any);

      LayeredTemporalTasteProfileService.generateLayeredTasteProfile = async () => ({
        tasteStabilityScore: 0.70,
      } as any);

      RecommendationScoreCalibrationService.buildUserFeedbackProfile = async () => ({
        genreSkipCounts: new Map<string, number>([['Metal', 3]]),
      } as any);

      const asyncRes = await TasteBoundaryDetectionService.getUserTasteBoundaries(userId);

      assert.strictEqual(asyncRes.userId, userId);
      assert.strictEqual(asyncRes.isDataSufficient, true);
      assert.ok(asyncRes.stronglyPreferredAreas.some((i) => i.name === 'Post-Rock'));
      assert.ok(asyncRes.adjacentGenres.some((i) => i.name === 'Shoegaze' || i.name === 'Math Rock'));
      assert.ok(asyncRes.lowConfidenceAreas.some((i) => i.name === 'Metal'), 'Metal should be flagged as low confidence due to skips');

      console.log(`✓ Test 6 Passed: Asynchronous taste boundary resolution verified (Core: Post-Rock, Skips: Metal).`);
    } finally {
      UnifiedMusicDNAService.getOrGenerateProfile = originalDna;
      PersonalMusicTwinService.getOrGenerateTwin = originalTwin;
      LayeredTemporalTasteProfileService.generateLayeredTasteProfile = originalTemporal;
      RecommendationScoreCalibrationService.buildUserFeedbackProfile = originalFeedback;
    }
  }

  console.log('\n[Taste Boundary Detection Test Suite] All tests passed!\n');
  return true;
}

// Standalone execution support
if (
  process.argv[1]?.endsWith('tasteBoundaryDetection.test.ts') ||
  process.argv[1]?.endsWith('tasteBoundaryDetection.test.js')
) {
  runTasteBoundaryDetectionTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Test suite failed:', err);
      process.exit(1);
    });
}
