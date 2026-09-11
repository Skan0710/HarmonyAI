import assert from 'node:assert';
import {
  ComfortDiscoveryScoringService,
  ComfortDiscoveryScoreResult,
} from '../services/comfortDiscoveryScoringService.js';
import {
  getComfortDiscoveryConfig,
  updateComfortDiscoveryConfig,
  resetComfortDiscoveryConfig,
} from '../config/comfortDiscoveryConfig.js';
import { UnifiedMusicDNAService } from '../services/unifiedMusicDnaService.js';
import { PersonalMusicTwinService } from '../services/personalMusicTwinService.js';
import { LayeredTemporalTasteProfileService } from '../services/layeredTemporalTasteProfileService.js';
import { RecommendationScoreCalibrationService } from '../services/recommendationScoreCalibrationService.js';

export async function runComfortDiscoveryScoringServiceTests() {
  console.log('[Comfort vs Discovery Scoring Service Test Suite] Starting tests...');

  // ---------------------------------------------------------------------------
  // Test 1: Cold Start & Insufficient Data Handling
  // ---------------------------------------------------------------------------
  console.log('\nTest 1: Sensible defaults on cold start and insufficient history');
  {
    const userId = crypto.randomUUID().toString();

    const result = ComfortDiscoveryScoringService.calculateScores({
      userId,
      musicDna: null,
      personalMusicTwin: null,
      temporalProfile: null,
      feedbackProfile: null,
      totalInteractionsCount: 0,
    });

    assert.strictEqual(result.userId, userId);
    assert.strictEqual(result.comfortScore, 0.50, 'Default comfort score must be 0.50 on cold start');
    assert.strictEqual(result.discoveryScore, 0.50, 'Default discovery score must be 0.50 on cold start');
    assert.strictEqual(result.balanceRatio, 0.0);
    assert.strictEqual(result.dominantMode, 'BALANCED');
    assert.strictEqual(result.isDataSufficient, false);
    assert.ok(result.confidenceScore <= 0.25, 'Confidence must be low on cold start');
    assert.ok(result.explanation.includes('balanced mode'));

    console.log('✓ Test 1 Passed: Cold start handled safely with calibrated 0.50/0.50 defaults.');
  }

  // ---------------------------------------------------------------------------
  // Test 2: Comfort-Dominant / Loyal Listener Profile
  // ---------------------------------------------------------------------------
  console.log('\nTest 2: Loyal Listener with high repeat listening produces high comfortScore');
  {
    const userId = crypto.randomUUID().toString();

    const mockTwin: any = {
      userId,
      isDataSufficient: true,
      listenerArchetype: 'Loyal Listener',
      explorationTendency: 0.15,
      familiarityTendency: 0.90,
      diversityPreference: 0.25,
      confidenceScore: 0.85,
      listeningBehavior: {
        repeatListeningTendency: 0.88,
        discoveryTendency: 0.20,
        skipTendency: 0.15,
      },
      genreIdentity: {
        genreDiversityScore: 0.20,
      },
      tasteStability: {
        stabilityScore: 0.85,
        stabilityRating: 'highly_stable',
      },
      tasteEvolution: {
        transformationIntensity: 0.05,
      },
      currentEmergingInterests: {
        genres: [],
        artists: [],
      },
    };

    const mockFeedback: any = {
      overallSkipRate: 0.15,
      overallLikeRate: 0.25,
    };

    const result = ComfortDiscoveryScoringService.calculateScores({
      userId,
      personalMusicTwin: mockTwin,
      feedbackProfile: mockFeedback,
      totalInteractionsCount: 40,
    });

    assert.strictEqual(result.isDataSufficient, true);
    assert.strictEqual(result.dominantMode, 'COMFORT', 'Dominant mode should be COMFORT');
    assert.ok(
      result.comfortScore >= 0.70,
      `Comfort score should be high for Loyal Listener, got: ${result.comfortScore}`
    );
    assert.ok(
      result.discoveryScore <= 0.35,
      `Discovery score should be low for Loyal Listener, got: ${result.discoveryScore}`
    );
    assert.ok(
      result.balanceRatio < -0.30,
      `Balance ratio should be strongly negative, got: ${result.balanceRatio}`
    );
    assert.ok(
      result.confidenceScore >= 0.60,
      `Confidence should be elevated with 40 interactions, got: ${result.confidenceScore}`
    );

    console.log(
      `✓ Test 2 Passed: Loyal Listener scored high comfort (${result.comfortScore}) and low discovery (${result.discoveryScore}).`
    );
  }

  // ---------------------------------------------------------------------------
  // Test 3: Discovery-Dominant / Explorer Profile
  // ---------------------------------------------------------------------------
  console.log('\nTest 3: Explorer with broad diversity and emerging tastes produces high discoveryScore');
  {
    const userId = crypto.randomUUID().toString();

    const mockTwin: any = {
      userId,
      isDataSufficient: true,
      listenerArchetype: 'Explorer',
      explorationTendency: 0.90,
      familiarityTendency: 0.15,
      diversityPreference: 0.85,
      confidenceScore: 0.88,
      listeningBehavior: {
        repeatListeningTendency: 0.15,
        discoveryTendency: 0.85,
        skipTendency: 0.10,
      },
      genreIdentity: {
        genreDiversityScore: 0.85,
      },
      tasteStability: {
        stabilityScore: 0.40, // active pivot / drift
        stabilityRating: 'rapid_transformation',
      },
      tasteEvolution: {
        transformationIntensity: 0.65,
      },
      currentEmergingInterests: {
        genres: [{ name: 'Glitch Hop' }, { name: 'Post-Rock' }],
        artists: [{ name: 'Tipper' }],
      },
    };

    const mockFeedback: any = {
      overallSkipRate: 0.12,
      overallLikeRate: 0.45,
    };

    const result = ComfortDiscoveryScoringService.calculateScores({
      userId,
      personalMusicTwin: mockTwin,
      feedbackProfile: mockFeedback,
      totalInteractionsCount: 50,
    });

    assert.strictEqual(result.isDataSufficient, true);
    assert.strictEqual(result.dominantMode, 'DISCOVERY', 'Dominant mode should be DISCOVERY');
    assert.ok(
      result.discoveryScore >= 0.70,
      `Discovery score should be high for Explorer, got: ${result.discoveryScore}`
    );
    assert.ok(
      result.comfortScore <= 0.35,
      `Comfort score should be low for Explorer, got: ${result.comfortScore}`
    );
    assert.ok(
      result.balanceRatio > 0.35,
      `Balance ratio should be strongly positive, got: ${result.balanceRatio}`
    );

    console.log(
      `✓ Test 3 Passed: Explorer scored high discovery (${result.discoveryScore}) and low comfort (${result.comfortScore}).`
    );
  }

  // ---------------------------------------------------------------------------
  // Test 4: Impact of Recent Skips (Protective Comfort Retreat)
  // ---------------------------------------------------------------------------
  console.log('\nTest 4: High recent skip rate triggers protective comfort retreat');
  {
    const userId = crypto.randomUUID().toString();

    const baseTwin: any = {
      userId,
      isDataSufficient: true,
      listenerArchetype: 'Balanced Listener',
      explorationTendency: 0.50,
      familiarityTendency: 0.50,
      confidenceScore: 0.80,
      listeningBehavior: {
        repeatListeningTendency: 0.50,
        discoveryTendency: 0.50,
      },
      tasteStability: { stabilityScore: 0.60 },
    };

    // Case A: Low skip rate (10%)
    const lowSkipResult = ComfortDiscoveryScoringService.calculateScores({
      userId,
      personalMusicTwin: baseTwin,
      feedbackProfile: { overallSkipRate: 0.10, overallLikeRate: 0.25 },
      totalInteractionsCount: 30,
    });

    // Case B: High skip rate (70% - user skipping through songs)
    const highSkipResult = ComfortDiscoveryScoringService.calculateScores({
      userId,
      personalMusicTwin: baseTwin,
      feedbackProfile: { overallSkipRate: 0.70, overallLikeRate: 0.10 },
      totalInteractionsCount: 30,
    });

    assert.ok(
      highSkipResult.comfortScore > lowSkipResult.comfortScore,
      `High skips must elevate comfort score: highSkip ${highSkipResult.comfortScore} vs lowSkip ${lowSkipResult.comfortScore}`
    );
    assert.ok(
      highSkipResult.discoveryScore < lowSkipResult.discoveryScore,
      `High skips must dampen discovery score: highSkip ${highSkipResult.discoveryScore} vs lowSkip ${lowSkipResult.discoveryScore}`
    );

    console.log(
      `✓ Test 4 Passed: Skips triggered comfort retreat (Comfort: ${lowSkipResult.comfortScore} -> ${highSkipResult.comfortScore}, Discovery: ${lowSkipResult.discoveryScore} -> ${highSkipResult.discoveryScore}).`
    );
  }

  // ---------------------------------------------------------------------------
  // Test 5: Impact of Positive Feedback (Receptive Discovery Openness)
  // ---------------------------------------------------------------------------
  console.log('\nTest 5: High positive feedback boosts discovery openness');
  {
    const userId = crypto.randomUUID().toString();

    const baseTwin: any = {
      userId,
      isDataSufficient: true,
      explorationTendency: 0.50,
      listeningBehavior: { repeatListeningTendency: 0.50, discoveryTendency: 0.50 },
      tasteStability: { stabilityScore: 0.60 },
    };

    const lowLikeResult = ComfortDiscoveryScoringService.calculateScores({
      userId,
      personalMusicTwin: baseTwin,
      feedbackProfile: { overallSkipRate: 0.20, overallLikeRate: 0.10 },
      totalInteractionsCount: 20,
    });

    const highLikeResult = ComfortDiscoveryScoringService.calculateScores({
      userId,
      personalMusicTwin: baseTwin,
      feedbackProfile: { overallSkipRate: 0.20, overallLikeRate: 0.55 },
      totalInteractionsCount: 20,
    });

    assert.ok(
      highLikeResult.discoveryScore > lowLikeResult.discoveryScore,
      `High likes must boost discovery score: highLike ${highLikeResult.discoveryScore} vs lowLike ${lowLikeResult.discoveryScore}`
    );

    console.log(
      `✓ Test 5 Passed: Positive feedback boosted discovery (${lowLikeResult.discoveryScore} -> ${highLikeResult.discoveryScore}).`
    );
  }

  // ---------------------------------------------------------------------------
  // Test 6: Taste Stability vs Active Taste Drift
  // ---------------------------------------------------------------------------
  console.log('\nTest 6: Taste stability reinforces comfort while drift reinforces discovery');
  {
    const userId = crypto.randomUUID().toString();

    const stableResult = ComfortDiscoveryScoringService.calculateScores({
      userId,
      personalMusicTwin: {
        userId,
        isDataSufficient: true,
        tasteStability: { stabilityScore: 0.90 },
      } as any,
      totalInteractionsCount: 25,
    });

    const driftingResult = ComfortDiscoveryScoringService.calculateScores({
      userId,
      personalMusicTwin: {
        userId,
        isDataSufficient: true,
        tasteStability: { stabilityScore: 0.30 },
      } as any,
      totalInteractionsCount: 25,
    });

    assert.ok(
      stableResult.comfortScore > driftingResult.comfortScore,
      `Stable taste must have higher comfort score than drifting taste`
    );
    assert.ok(
      driftingResult.discoveryScore > stableResult.discoveryScore,
      `Drifting taste must have higher discovery score than stable taste`
    );

    console.log(
      `✓ Test 6 Passed: Taste stability boosted comfort (${stableResult.comfortScore} vs ${driftingResult.comfortScore}); drift boosted discovery (${driftingResult.discoveryScore} vs ${stableResult.discoveryScore}).`
    );
  }

  // ---------------------------------------------------------------------------
  // Test 7: Runtime Config & Weight Overrides
  // ---------------------------------------------------------------------------
  console.log('\nTest 7: Config overrides and dynamic runtime adjustment');
  {
    const userId = crypto.randomUUID().toString();

    const twin: any = {
      userId,
      isDataSufficient: true,
      listeningBehavior: { repeatListeningTendency: 0.85 },
      explorationTendency: 0.20,
    };

    // Calculate with default weights
    const defaultRes = ComfortDiscoveryScoringService.calculateScores({
      userId,
      personalMusicTwin: twin,
      totalInteractionsCount: 20,
    });

    // Calculate with overridden weight prioritizing exploration even higher
    const overriddenRes = ComfortDiscoveryScoringService.calculateScores({
      userId,
      personalMusicTwin: twin,
      totalInteractionsCount: 20,
      configOverride: {
        weights: {
          ...getComfortDiscoveryConfig().weights,
          repeatListening: 0.05,
          explorationTendency: 0.45,
        },
      },
    });

    assert.notStrictEqual(defaultRes.comfortScore, overriddenRes.comfortScore);

    // Global configuration updates
    updateComfortDiscoveryConfig({ skipPenaltySensitivity: 0.40 });
    const updatedCfg = getComfortDiscoveryConfig();
    assert.strictEqual(updatedCfg.skipPenaltySensitivity, 0.40);
    resetComfortDiscoveryConfig();
    assert.strictEqual(getComfortDiscoveryConfig().skipPenaltySensitivity, 0.25);

    console.log('✓ Test 7 Passed: Config overrides and runtime dynamic adjustments verified.');
  }

  // ---------------------------------------------------------------------------
  // Test 8: Asynchronous Integration Accessor
  // ---------------------------------------------------------------------------
  console.log('\nTest 8: getUserComfortDiscoveryScores end-to-end asynchronous resolution');
  {
    const userId = crypto.randomUUID().toString();

    const originalDna = UnifiedMusicDNAService.getOrGenerateProfile;
    const originalTwin = PersonalMusicTwinService.getOrGenerateTwin;
    const originalTemporal = LayeredTemporalTasteProfileService.generateLayeredTasteProfile;
    const originalFeedback = RecommendationScoreCalibrationService.buildUserFeedbackProfile;

    try {
      UnifiedMusicDNAService.getOrGenerateProfile = async () => ({
        interactionsCountAtLastRefresh: 35,
        listeningBehavior: {
          repeatListeningTendency: 0.70,
          explorationTendency: 0.30,
          isDataSufficient: true,
        },
        confidenceScore: 0.80,
      } as any);

      PersonalMusicTwinService.getOrGenerateTwin = async () => ({
        userId,
        isDataSufficient: true,
        listenerArchetype: 'Comfort Listener',
        explorationTendency: 0.25,
        familiarityTendency: 0.85,
        confidenceScore: 0.82,
        listeningBehavior: {
          repeatListeningTendency: 0.75,
          discoveryTendency: 0.25,
        },
        tasteStability: { stabilityScore: 0.80 },
      } as any);

      LayeredTemporalTasteProfileService.generateLayeredTasteProfile = async () => ({
        tasteStabilityScore: 0.80,
      } as any);

      RecommendationScoreCalibrationService.buildUserFeedbackProfile = async () => ({
        overallSkipRate: 0.15,
        overallLikeRate: 0.25,
      } as any);

      const asyncRes = await ComfortDiscoveryScoringService.getUserComfortDiscoveryScores(userId);

      assert.strictEqual(asyncRes.userId, userId);
      assert.strictEqual(asyncRes.isDataSufficient, true);
      assert.strictEqual(asyncRes.dominantMode, 'COMFORT');
      assert.ok(asyncRes.comfortScore > asyncRes.discoveryScore);
      assert.ok(asyncRes.rationales.length > 0);
      assert.ok(asyncRes.componentBreakdown.repeatListeningContribution.weight > 0);

      console.log(`✓ Test 8 Passed: Asynchronous resolution completed with Comfort: ${asyncRes.comfortScore}, Discovery: ${asyncRes.discoveryScore}.`);
    } finally {
      UnifiedMusicDNAService.getOrGenerateProfile = originalDna;
      PersonalMusicTwinService.getOrGenerateTwin = originalTwin;
      LayeredTemporalTasteProfileService.generateLayeredTasteProfile = originalTemporal;
      RecommendationScoreCalibrationService.buildUserFeedbackProfile = originalFeedback;
    }
  }

  // ---------------------------------------------------------------------------
  // Test 9: Invalid Numeric Signals
  // ---------------------------------------------------------------------------
  console.log('\nTest 9: Non-finite and out-of-range signals are safely normalized');
  {
    const userId = crypto.randomUUID().toString();
    const result = ComfortDiscoveryScoringService.calculateScores({
      userId,
      personalMusicTwin: {
        userId,
        isDataSufficient: true,
        confidenceScore: Number.POSITIVE_INFINITY,
        explorationTendency: Number.NaN,
        diversityPreference: -1,
        listeningBehavior: {
          repeatListeningTendency: Number.NaN,
          discoveryTendency: Number.POSITIVE_INFINITY,
        },
        tasteStability: { stabilityScore: Number.NEGATIVE_INFINITY },
        tasteEvolution: { transformationIntensity: Number.NaN },
      } as any,
      feedbackProfile: { overallSkipRate: Number.NaN, overallLikeRate: Number.POSITIVE_INFINITY },
      totalInteractionsCount: Number.POSITIVE_INFINITY,
      configOverride: {
        weights: { ...getComfortDiscoveryConfig().weights, feedback: Number.NaN },
      },
    });

    for (const score of [result.comfortScore, result.discoveryScore, result.balanceRatio, result.confidenceScore]) {
      assert.ok(Number.isFinite(score), `Expected finite score, got ${score}`);
    }
    assert.ok(result.comfortScore >= 0 && result.comfortScore <= 1);
    assert.ok(result.discoveryScore >= 0 && result.discoveryScore <= 1);
    assert.ok(result.confidenceScore >= 0 && result.confidenceScore <= 1);
    console.log('✓ Test 9 Passed: Invalid numeric inputs cannot produce NaN or Infinity scores.');
  }

  console.log('\n[Comfort vs Discovery Scoring Service Test Suite] All tests passed!\n');
  return true;
}

// Standalone execution support
if (
  process.argv[1]?.endsWith('comfortDiscoveryScoringService.test.ts') ||
  process.argv[1]?.endsWith('comfortDiscoveryScoringService.test.js')
) {
  runComfortDiscoveryScoringServiceTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Test suite failed:', err);
      process.exit(1);
    });
}
