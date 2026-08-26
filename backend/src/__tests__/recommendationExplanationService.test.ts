import assert from 'node:assert';
import {
  RecommendationExplanationService,
  ExplanationSignalInput,
  getExplanationThresholds,
  updateExplanationThresholds,
  resetExplanationThresholds,
} from '../services/recommendationExplanationService.js';

export function runRecommendationExplanationServiceTests() {
  console.log('[Recommendation Explanation & Reason Extraction Test Suite] Starting tests...');

  // Test 1: Similar to Songs User Liked Reason Extraction
  {
    const input: ExplanationSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439011',
        title: 'Midnight City',
      },
      similarityScore: 0.90,
      likedSongsSample: [{ title: 'Intro (by The xx)' }],
    };

    const reasons = RecommendationExplanationService.extractStrongestReasons(input);
    const likedReason = reasons.find((r) => r.type === 'SIMILAR_TO_LIKED_SONGS');

    assert.ok(likedReason !== undefined);
    assert.ok(likedReason.message.includes('Intro (by The xx)'));
    assert.ok(likedReason.message.includes('90% match'));
    assert.strictEqual(likedReason.supportingValue, 0.90);

    console.log('✓ Test 1 Passed: Similar to liked songs reason extraction verified.');
  }

  // Test 2: Similar Artist & Favorite Artist Reason Extraction
  {
    const input: ExplanationSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439012',
        title: 'Starboy',
        artist: { name: 'The Weeknd' },
      },
      tasteProfile: {
        combinedArtists: [{ name: 'The Weeknd', affinityScore: 0.92 }],
      },
    };

    const reasons = RecommendationExplanationService.extractStrongestReasons(input);
    const artistReason = reasons.find((r) => r.type === 'SIMILAR_ARTIST');

    assert.ok(artistReason !== undefined);
    assert.ok(artistReason.message.includes('The Weeknd'));
    assert.ok(artistReason.message.includes('92% affinity'));

    console.log('✓ Test 2 Passed: Similar / favorite artist reason extraction verified.');
  }

  // Test 3: Preferred Genre Reason Extraction
  {
    const input: ExplanationSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439013',
        title: 'Nightcall',
        genre: { name: 'Synthwave' },
      },
      tasteProfile: {
        combinedGenres: [{ name: 'Synthwave', affinityScore: 0.88 }],
      },
    };

    const reasons = RecommendationExplanationService.extractStrongestReasons(input);
    const genreReason = reasons.find((r) => r.type === 'PREFERRED_GENRE');

    assert.ok(genreReason !== undefined);
    assert.ok(genreReason.message.includes('Synthwave'));
    assert.ok(genreReason.message.includes('88% affinity'));

    console.log('✓ Test 3 Passed: Preferred genre reason extraction verified.');
  }

  // Test 4: Preferred Mood and Preferred Energy Extraction (Current Mood with Explicit Session Match)
  {
    const input: ExplanationSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439014',
        title: 'Power Run',
        mood: 'Focus',
        audioFeatures: { energy: 0.85, tempo: 130 },
      },
      sessionPreferences: {
        activeMood: 'Focus',
        targetEnergy: 0.80,
      },
    };

    const reasons = RecommendationExplanationService.extractStrongestReasons(input);
    const moodReason = reasons.find((r) => r.type === 'PREFERRED_MOOD');
    const energyReason = reasons.find((r) => r.type === 'PREFERRED_ENERGY');

    assert.ok(moodReason !== undefined && moodReason.message.includes('current focus mood'));
    assert.ok(energyReason !== undefined && energyReason.message.includes('high-energy'));

    console.log('✓ Test 4 Passed: Current mood and energy reason extraction verified.');
  }

  // Test 5: Session Preference, Novelty, and Collaborative Similarity (No MOOD_MATCH when song lacks mood)
  {
    const input: ExplanationSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439015',
        title: 'Late Night Flow',
        // song has no mood attribute
      },
      sessionPreferences: {
        activeMood: 'Energetic',
      },
      componentScores: {
        sessionScore: 0.85,
        collaborativeScore: 0.80,
      },
      noveltyScore: 0.75,
    };

    const reasons = RecommendationExplanationService.extractStrongestReasons(input);
    const sessionReason = reasons.find((r) => r.type === 'SESSION_PREFERENCE');
    const noveltyReason = reasons.find((r) => r.type === 'NOVELTY');
    const collabReason = reasons.find((r) => r.type === 'COLLABORATIVE_SIMILARITY');
    const moodReason = reasons.find((r) => r.type === 'PREFERRED_MOOD');

    assert.ok(sessionReason !== undefined, 'Explicit sessionScore should emit SESSION_PREFERENCE');
    assert.ok(noveltyReason !== undefined, 'Novelty score should emit NOVELTY');
    assert.ok(collabReason !== undefined, 'Collaborative score should emit COLLABORATIVE_SIMILARITY');
    assert.strictEqual(moodReason, undefined, 'Song without a mood attribute must not emit PREFERRED_MOOD');

    console.log('✓ Test 5 Passed: Session preference, novelty, and collaborative extraction verified (with mood omitted).');
  }

  // Test 6: Discovery Opportunity Extraction
  {
    const input: ExplanationSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439016',
        title: 'Nordic Chill',
        genre: { name: 'Ambient Lo-Fi' },
      },
      isDiscoveryOpportunity: true,
      diversityAdjustment: 0.15,
    };

    const reasons = RecommendationExplanationService.extractStrongestReasons(input);
    const discoveryReason = reasons.find((r) => r.type === 'DISCOVERY_OPPORTUNITY');

    assert.ok(discoveryReason !== undefined);
    assert.ok(discoveryReason.message.includes('Ambient Lo-Fi'));

    console.log('✓ Test 6 Passed: Discovery opportunity reason extraction verified.');
  }

  // Test 7: Contradiction Avoidance (Known Favorite vs Discovery)
  {
    const contradictoryInput: ExplanationSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439017',
        title: 'Harder, Better, Faster, Stronger',
        artist: { name: 'Daft Punk' },
      },
      tasteProfile: {
        combinedArtists: [{ name: 'Daft Punk', affinityScore: 0.95 }],
      },
      isDiscoveryOpportunity: true, // artificially conflicting flag
    };

    const reasons = RecommendationExplanationService.extractStrongestReasons(contradictoryInput);
    const hasFavoriteArtist = reasons.some((r) => r.type === 'SIMILAR_ARTIST');
    const hasDiscovery = reasons.some((r) => r.type === 'DISCOVERY_OPPORTUNITY');

    // Due to contradiction suppression, familiar heavy favorite artist suppresses discovery claim
    assert.strictEqual(hasFavoriteArtist, true);
    assert.strictEqual(hasDiscovery, false, 'Known favorite artist must suppress contradictory discovery claim');

    console.log('✓ Test 7 Passed: Contradiction resolution between favorite artist and discovery verified.');
  }

  // Test 8: Rank by Importance & Return Only Top Configured Reasons
  {
    const multiSignalInput: ExplanationSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439018',
        title: 'Multi Signal Track',
        artist: { name: 'Kavinsky' },
        genre: { name: 'Synthwave' },
        mood: 'Driving',
        audioFeatures: { energy: 0.85 },
      },
      similarityScore: 0.92,
      tasteProfile: {
        combinedArtists: [{ name: 'Kavinsky', affinityScore: 0.90 }],
        combinedGenres: [{ name: 'Synthwave', affinityScore: 0.85 }],
      },
      componentScores: {
        collaborativeScore: 0.80,
        sessionScore: 0.75,
      },
      sessionPreferences: {
        activeMood: 'Driving',
        targetEnergy: 0.80,
      },
      noveltyScore: 0.70,
    };

    const topReasons = RecommendationExplanationService.extractStrongestReasons(multiSignalInput, {
      maxReasonsReturned: 3,
    });

    assert.strictEqual(topReasons.length, 3, 'Must return strictly top 3 most meaningful reasons');
    assert.ok(topReasons[0].importanceScore >= topReasons[1].importanceScore);
    assert.ok(topReasons[1].importanceScore >= topReasons[2].importanceScore);

    console.log('✓ Test 8 Passed: Reason ranking by importance and max count limit verified.');
  }

  // Test 9: Configurable Thresholds Support
  {
    const defaultThresholds = getExplanationThresholds();
    assert.strictEqual(defaultThresholds.maxReasonsReturned, 3);

    updateExplanationThresholds({ maxReasonsReturned: 2, minContentSimilarityThreshold: 0.75 });
    const updated = getExplanationThresholds();
    assert.strictEqual(updated.maxReasonsReturned, 2);
    assert.strictEqual(updated.minContentSimilarityThreshold, 0.75);

    resetExplanationThresholds();
    const restored = getExplanationThresholds();
    assert.strictEqual(restored.maxReasonsReturned, 3);

    console.log('✓ Test 9 Passed: Configurable explanation thresholds verified.');
  }

  // Test 10: Deterministic and Testable Execution
  {
    const input: ExplanationSignalInput = {
      song: { _id: '507f1f77bcf86cd799439020', title: 'Deterministic Song' },
      similarityScore: 0.82,
    };

    const run1 = RecommendationExplanationService.explainSong(input);
    const run2 = RecommendationExplanationService.explainSong(input);

    assert.strictEqual(run1.primaryExplanation, run2.primaryExplanation);
    assert.strictEqual(run1.confidenceScore, run2.confidenceScore);
    assert.strictEqual(run1.summary, run2.summary);
    assert.strictEqual(run1.reasons.length, run2.reasons.length);

    console.log('✓ Test 10 Passed: Deterministic and reproducible explanation generation verified.');
  }

  // Test 11: Regression Coverage for Scores Above 1 and Non-Finite Inputs
  {
    const outOfBoundsInput: ExplanationSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439021',
        title: 'Unbounded Track',
        artist: { name: 'Overclocker' },
        genre: { name: 'Electro' },
        mood: { name: 'Fast' },
        audioFeatures: { energy: 2.5, tempo: Infinity },
      },
      similarityScore: 1.85,
      componentScores: {
        collaborativeScore: Infinity,
        userTasteAffinityScore: NaN,
        noveltyScore: 3.2,
        sessionScore: -0.5,
      },
      tasteProfile: {
        combinedArtists: [{ name: 'Overclocker', affinityScore: 4.5 }],
        combinedGenres: [{ name: 'Electro', affinityScore: -10 }],
      },
    };

    const explanation = RecommendationExplanationService.explainSong(outOfBoundsInput);

    assert.ok(explanation.confidenceScore >= 0.0 && explanation.confidenceScore <= 1.0);
    assert.ok(Number.isFinite(explanation.confidenceScore));

    for (const item of explanation.reasons) {
      assert.ok(
        item.importanceScore >= 0.0 && item.importanceScore <= 1.0,
        `Reason ${item.type} importanceScore (${item.importanceScore}) must be clamped in [0.0, 1.0]`
      );
      assert.ok(Number.isFinite(item.importanceScore), `Reason ${item.type} importanceScore must be finite`);
      if (typeof item.supportingValue === 'number') {
        assert.ok(
          item.supportingValue >= 0.0 && item.supportingValue <= 1.0,
          `Numeric supportingValue (${item.supportingValue}) must be clamped in [0.0, 1.0]`
        );
      }
    }

    console.log('✓ Test 11 Passed: Regression coverage for out-of-bounds (>1) and non-finite scores verified.');
  }

  // Test 12: Genre-Affinity Fallback when combinedGenres exists but has no matching genre
  {
    const fallbackInput: ExplanationSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439022',
        title: 'Deep In The Night',
        genre: { name: 'House' },
      },
      tasteProfile: {
        combinedGenres: [
          { name: 'Synthwave', affinityScore: 0.90 },
          { name: 'Rock', affinityScore: 0.80 },
        ], // House is not in user's top combinedGenres
      },
      componentScores: {
        genreScore: 0.75, // Upstream candidate generator scored House as 0.75
      },
    };

    const reasons = RecommendationExplanationService.extractStrongestReasons(fallbackInput);
    const genreReason = reasons.find((r) => r.type === 'PREFERRED_GENRE');

    assert.ok(genreReason !== undefined, 'Should fall back to componentScores.genreScore when combinedGenres does not match');
    assert.ok(genreReason.message.includes('House'));
    assert.ok(genreReason.message.includes('75% affinity'));

    console.log('✓ Test 12 Passed: Genre-affinity fallback when combinedGenres exists but has no match verified.');
  }

  // Test 13: Song-Based Mood vs Current Session Mood Separation & Object Normalization
  {
    // Song-based taste profile mood match (without sessionPreferences.activeMood)
    const songMoodInput: ExplanationSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439023',
        title: 'Chill Sunset',
        mood: { name: 'Chill' }, // Object-structured mood
      },
      tasteProfile: {
        preferredMoods: [{ name: 'Chill' }, { name: 'Relaxed' }],
      },
    };

    const reasons = RecommendationExplanationService.extractStrongestReasons(songMoodInput);
    const moodReason = reasons.find((r) => r.type === 'PREFERRED_MOOD');

    assert.ok(moodReason !== undefined);
    assert.ok(moodReason.message.includes('Captures the chill mood you often enjoy'));
    assert.strictEqual(moodReason.supportingValue, 'Chill');

    console.log('✓ Test 13 Passed: Song-based mood vs current session mood separation and object mood normalization verified.');
  }

  console.log('🎉 All 13 recommendation reason extraction and validation tests completed successfully.');
}
