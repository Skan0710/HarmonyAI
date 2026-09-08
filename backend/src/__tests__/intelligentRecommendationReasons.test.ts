import assert from 'node:assert';
import {
  RecommendationExplanationService,
  ExplanationSignalInput,
  getExplanationThresholds,
  updateExplanationThresholds,
  resetExplanationThresholds,
} from '../services/recommendationExplanationService.js';

export function runIntelligentRecommendationReasonsTests() {
  console.log('[Intelligent Recommendation Reasons Test Suite] Starting tests...');

  // Reset any previous threshold modifications
  resetExplanationThresholds();

  // Test 1: Reason 1 - Matches your long-term taste (Temporal Profile Long-term horizon & Music DNA core)
  {
    const input: ExplanationSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439101',
        title: 'Veridis Quo',
        artist: { name: 'Daft Punk' },
        genre: { name: 'Electronic' },
      },
      temporalProfile: {
        userId: 'user_101',
        longTermHorizon: {
          topGenres: [{ name: 'Electronic', affinityScore: 0.88, playCount: 150 }],
          topArtists: [{ name: 'Daft Punk', affinityScore: 0.90, playCount: 120 }],
        },
      } as any,
    };

    const reasons = RecommendationExplanationService.extractStrongestReasons(input);
    const reason = reasons.find((r) => r.type === 'MATCHES_LONG_TERM_TASTE');

    assert.ok(reason !== undefined, 'MATCHES_LONG_TERM_TASTE should be generated');
    assert.strictEqual(reason.label, 'Matches your long-term taste');
    assert.ok(reason.message.toLowerCase().includes('long-term taste'));
    assert.ok(reason.message.includes('Electronic') || reason.message.includes('Daft Punk'));
    assert.ok(typeof reason.supportingValue === 'number' && reason.supportingValue >= 0.70, 'Supporting value should reflect affinity');
    assert.strictEqual(reason.metadata?.source, 'temporal_long_term');

    console.log('✓ Test 1 Passed: MATCHES_LONG_TERM_TASTE extracted with accurate signals.');
  }

  // Test 2: Reason 2 - Aligns with your recent listening (Short-term Horizon & Recent activity)
  {
    const input: ExplanationSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439102',
        title: 'Starboy',
        artist: { name: 'The Weeknd' },
        genre: { name: 'R&B' },
      },
      temporalProfile: {
        userId: 'user_102',
        shortTermHorizon: {
          topArtists: [{ name: 'The Weeknd', momentum: 0.85, playCount: 22 }],
          topGenres: [{ name: 'R&B', momentum: 0.75, playCount: 30 }],
        },
      } as any,
    };

    const reasons = RecommendationExplanationService.extractStrongestReasons(input);
    const reason = reasons.find((r) => r.type === 'ALIGNS_WITH_RECENT_LISTENING');

    assert.ok(reason !== undefined, 'ALIGNS_WITH_RECENT_LISTENING should be generated');
    assert.strictEqual(reason.label, 'Aligns with your recent listening');
    assert.ok(reason.message.toLowerCase().includes('recent listening'));
    assert.ok(reason.message.includes('The Weeknd'));
    assert.strictEqual(reason.metadata?.source, 'temporal_short_term');

    console.log('✓ Test 2 Passed: ALIGNS_WITH_RECENT_LISTENING verified from short-term momentum.');
  }

  // Test 3: Reason 3 - Related to an emerging preference (Taste evolution / emerging taste report)
  {
    const input: ExplanationSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439103',
        title: 'Brite Boy',
        artist: { name: 'Bladee' },
        genre: { name: 'Hyperpop' },
      },
      emergingTasteReport: {
        emergingGenres: [
          { name: 'Hyperpop', growthRate: 2.8, confidence: 0.84, recentPlays: 14 },
        ],
      } as any,
    };

    const reasons = RecommendationExplanationService.extractStrongestReasons(input);
    const reason = reasons.find((r) => r.type === 'EMERGING_PREFERENCE');

    assert.ok(reason !== undefined, 'EMERGING_PREFERENCE should be generated');
    assert.strictEqual(reason.label, 'Related to an emerging preference');
    assert.ok(reason.message.toLowerCase().includes('emerging preference'));
    assert.ok(reason.message.includes('Hyperpop'));
    assert.strictEqual(reason.metadata?.target, 'Hyperpop');
    assert.strictEqual(reason.metadata?.source, 'emerging_taste');

    console.log('✓ Test 3 Passed: EMERGING_PREFERENCE detected and structured properly.');
  }

  // Test 4: Reason 4 - Expands beyond your usual artists (Taste boundaries & exploration target)
  {
    const input: ExplanationSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439104',
        title: 'Alison',
        artist: { name: 'Slowdive' },
        genre: { name: 'Shoegaze' },
      },
      tasteBoundaries: {
        adjacentGenres: ['Shoegaze', 'Dream Pop'],
        comfortZoneThreshold: 0.65,
      } as any,
    };

    const reasons = RecommendationExplanationService.extractStrongestReasons(input);
    const reason = reasons.find((r) => r.type === 'EXPANDS_BEYOND_USUAL');

    assert.ok(reason !== undefined, 'EXPANDS_BEYOND_USUAL should be generated');
    assert.strictEqual(reason.label, 'Expands beyond your usual artists');
    assert.ok(reason.message.toLowerCase().includes('expands beyond'));
    assert.ok(reason.message.includes('Shoegaze') || reason.message.includes('Slowdive'));
    assert.strictEqual(reason.metadata?.source, 'taste_boundary');

    console.log('✓ Test 4 Passed: EXPANDS_BEYOND_USUAL validated from taste boundary signals.');
  }

  // Test 5: Reason 5 - Fits your discovery preference (Comfort-discovery profile score)
  {
    const input: ExplanationSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439105',
        title: 'New Shapes',
        artist: { name: 'Charli XCX' },
        genre: { name: 'Electropop' },
      },
      comfortDiscoveryScore: {
        discoveryTendency: 0.82,
        comfortDiscoveryRatio: 0.75,
      } as any,
    };

    const reasons = RecommendationExplanationService.extractStrongestReasons(input);
    const reason = reasons.find((r) => r.type === 'FITS_DISCOVERY_PREFERENCE');

    assert.ok(reason !== undefined, 'FITS_DISCOVERY_PREFERENCE should be generated');
    assert.strictEqual(reason.label, 'Fits your discovery preference');
    assert.ok(reason.message.toLowerCase().includes('discovery preference'));
    assert.strictEqual(reason.metadata?.source, 'comfort_discovery');

    console.log('✓ Test 5 Passed: FITS_DISCOVERY_PREFERENCE verified.');
  }

  // Test 6: Reason 6 - Matches your current listening behavior (Personal Music Twin traits & archetype)
  {
    const input: ExplanationSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439106',
        title: 'Energy Flow',
        artist: { name: 'Ryuichi Sakamoto' },
        audioFeatures: {
          acousticness: 0.88,
          energy: 0.25,
          danceability: 0.30,
          valence: 0.40,
        },
      },
      personalMusicTwin: {
        listenerArchetype: 'Acoustic Explorer',
        behavioralTraits: {
          acousticnessAffinity: 0.85,
          energyAffinity: 0.28,
        },
      } as any,
    };

    const reasons = RecommendationExplanationService.extractStrongestReasons(input);
    const reason = reasons.find((r) => r.type === 'MATCHES_LISTENING_BEHAVIOR');

    assert.ok(reason !== undefined, 'MATCHES_LISTENING_BEHAVIOR should be generated');
    assert.strictEqual(reason.label, 'Matches your current listening behavior');
    assert.ok(reason.message.toLowerCase().includes('listening behavior'));
    assert.strictEqual(reason.metadata?.source, 'personal_music_twin');

    console.log('✓ Test 6 Passed: MATCHES_LISTENING_BEHAVIOR generated from twin traits.');
  }

  // Test 7: Reason 7 - Similar to artists you frequently enjoy (Music DNA core rotation)
  {
    const input: ExplanationSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439107',
        title: 'Karma Police',
        artist: { name: 'Radiohead' },
        genre: { name: 'Alternative' },
      },
      musicDna: {
        tasteProfile: {
          coreArtists: [{ name: 'Radiohead', playCount: 88, affinity: 0.92 }],
        },
      } as any,
    };

    const reasons = RecommendationExplanationService.extractStrongestReasons(input);
    const reason = reasons.find((r) => r.type === 'SIMILAR_TO_FREQUENT_ARTISTS');

    assert.ok(reason !== undefined, 'SIMILAR_TO_FREQUENT_ARTISTS should be generated');
    assert.strictEqual(reason.label, 'Similar to artists you frequently enjoy');
    assert.ok(reason.message.includes('Radiohead'));
    assert.strictEqual(reason.metadata?.source, 'music_dna_core');

    console.log('✓ Test 7 Passed: SIMILAR_TO_FREQUENT_ARTISTS generated from Music DNA core artists.');
  }

  // Test 8: Data Grounding - No invented reasons when signals are absent
  {
    const coldStartInput: ExplanationSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439108',
        title: 'Unknown Track',
        artist: { name: 'Unknown Artist' },
        genre: { name: 'Unknown Genre' },
      },
      // No twin, no temporal profile, no emerging taste, no boundaries, no high scores
      componentScores: {
        contentScore: 0.15,
        collaborativeScore: 0.10,
        userTasteAffinityScore: 0.20,
        popularityScore: 0.30,
      },
    };

    const reasons = RecommendationExplanationService.extractStrongestReasons(coldStartInput);
    
    // Ensure none of the 7 personalized reasons are falsely invented
    const personalizedTypes = [
      'MATCHES_LONG_TERM_TASTE',
      'ALIGNS_WITH_RECENT_LISTENING',
      'EMERGING_PREFERENCE',
      'EXPANDS_BEYOND_USUAL',
      'FITS_DISCOVERY_PREFERENCE',
      'MATCHES_LISTENING_BEHAVIOR',
      'SIMILAR_TO_FREQUENT_ARTISTS',
    ];

    for (const t of personalizedTypes) {
      const found = reasons.find((r) => r.type === t);
      assert.strictEqual(found, undefined, `Should not invent reason ${t} without underlying signal`);
    }

    console.log('✓ Test 8 Passed: Signal grounding verified - no invented reasons.');
  }

  // Test 9: Contradiction Resolution - Known favorite artist suppresses contradictory boundary expansion
  {
    const contradictoryInput: ExplanationSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439109',
        title: 'Experimental Odyssey',
        artist: { name: 'Favorite Band' },
        genre: { name: 'Avant-Garde' },
      },
      tasteBoundaries: {
        adjacentGenres: ['Avant-Garde'],
      } as any,
      tasteProfile: {
        combinedArtists: [{ name: 'Favorite Band', affinityScore: 0.88 }],
      },
    };

    const explanation = RecommendationExplanationService.explainSong(contradictoryInput);

    const hasFavoriteArtist = explanation.reasons.some((r) => r.type === 'SIMILAR_ARTIST');
    const hasExpands = explanation.reasons.some((r) => r.type === 'EXPANDS_BEYOND_USUAL');

    assert.strictEqual(hasFavoriteArtist, true, 'Favorite artist reason should be preserved');
    assert.strictEqual(hasExpands, false, 'Contradictory EXPANDS_BEYOND_USUAL must be suppressed for heavy favorite artist');

    console.log('✓ Test 9 Passed: Contradiction resolution successfully filtered conflicting signals.');
  }

  // Test 10: End-to-end "Why this song?" structured response format
  {
    const input: ExplanationSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439110',
        title: 'Aerodynamic',
        artist: { name: 'Daft Punk' },
        genre: { name: 'Electronic' },
      },
      temporalProfile: {
        userId: 'user_110',
        longTermHorizon: {
          topGenres: [{ name: 'Electronic', affinityScore: 0.95 }],
        },
        shortTermHorizon: {
          topArtists: [{ name: 'Daft Punk', momentum: 0.80, playCount: 15 }],
        },
      } as any,
      comfortDiscoveryScore: {
        discoveryTendency: 0.80,
      } as any,
      sources: ['hybrid', 'temporal'],
    };

    const explanation = RecommendationExplanationService.explainSong(input);

    assert.ok(explanation.primaryExplanation.length > 0, 'Primary explanation must exist');
    assert.ok(Array.isArray(explanation.reasons), 'Reasons must be an array');
    assert.ok(explanation.reasons.length > 0, 'At least one reason should be present');
    assert.ok(explanation.confidenceScore >= 0 && explanation.confidenceScore <= 1);
    assert.ok(explanation.signalsUsed && explanation.signalsUsed.length > 0, 'Signals used must be logged');

    // Structured metadata checks
    for (const r of explanation.reasons) {
      assert.ok(r.type, 'Reason must have type');
      assert.ok(r.label, 'Reason must have label');
      assert.ok(r.message, 'Reason must have message');
      assert.ok(typeof r.supportingValue === 'number', 'Reason supportingValue must be a number');
      assert.ok(typeof r.metadata === 'object', 'Reason metadata must be machine-readable object');
    }

    console.log('✓ Test 10 Passed: Full "Why this song?" structured response validated.');
  }

  // Test 11: Configurable Thresholds for intelligent reasons
  {
    updateExplanationThresholds({
      minLongTermTasteThreshold: 0.99, // very strict threshold
    });

    const input: ExplanationSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439111',
        title: 'Short Circuit',
        artist: { name: 'Daft Punk' },
        genre: { name: 'Electronic' },
      },
      temporalProfile: {
        userId: 'user_111',
        longTermHorizon: {
          topGenres: [{ name: 'Electronic', affinityScore: 0.85 }], // Below 0.99
        },
      } as any,
    };

    const reasons = RecommendationExplanationService.extractStrongestReasons(input);
    const longTermReason = reasons.find((r) => r.type === 'MATCHES_LONG_TERM_TASTE');
    assert.strictEqual(longTermReason, undefined, 'High threshold should filter out long-term taste reason');

    // Reset thresholds
    resetExplanationThresholds();
    const thresholds = getExplanationThresholds();
    assert.strictEqual(thresholds.minLongTermTasteThreshold, 0.55);

    console.log('✓ Test 11 Passed: Explanation thresholds are configurable and reset cleanly.');
  }

  console.log('[Intelligent Recommendation Reasons Test Suite] All 11 tests passed successfully! 🎉');
}
