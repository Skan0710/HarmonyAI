import assert from 'node:assert';
import {
  validateAndSanitizeRecommendationContext,
  StandardListeningSituation,
} from '../schemas/recommendationContextSchema.js';
import {
  ContextPreferenceMappingService,
  DEFAULT_CONTEXT_MAPPINGS,
} from '../services/contextPreferenceMappingService.js';
import { HybridRankingPipeline } from '../services/hybridRankingPipeline.js';
import { HybridCandidate } from '../services/candidateGenerationService.js';
import { RecommendationExplanationService } from '../services/recommendationExplanationService.js';

export function runContextualRecommendationEndToEndTests() {
  console.log('[Day 25: Contextual Recommendation E2E Test Suite] Starting tests...');

  // Mock catalog candidate pool
  const candidateCatalog: HybridCandidate[] = [
    {
      songId: 'song-edm-workout',
      contentScore: 0.88,
      collaborativeScore: 0.82,
      userTasteAffinityScore: 0.80,
      popularitySignal: 950,
      recencySignal: 0.85,
      sources: ['collaborative', 'trending'],
      songDoc: {
        _id: 'song-edm-workout',
        title: 'Overdrive Beats',
        artist: 'Pulse Runner',
        genre: 'EDM',
        mood: 'Energetic',
        audioFeatures: { energy: 0.94, tempo: 145 },
      },
    },
    {
      songId: 'song-lofi-study',
      contentScore: 0.86,
      collaborativeScore: 0.72,
      userTasteAffinityScore: 0.82,
      popularitySignal: 520,
      recencySignal: 0.70,
      sources: ['content', 'taste_profile'],
      songDoc: {
        _id: 'song-lofi-study',
        title: 'Library Reverie',
        artist: 'Study Bot',
        genre: 'Lo-Fi',
        mood: 'Focus',
        audioFeatures: { energy: 0.26, tempo: 80 },
      },
    },
    {
      songId: 'song-ambient-sleep',
      contentScore: 0.80,
      collaborativeScore: 0.65,
      userTasteAffinityScore: 0.75,
      popularitySignal: 300,
      recencySignal: 0.60,
      sources: ['content'],
      songDoc: {
        _id: 'song-ambient-sleep',
        title: 'Starlight Dream',
        artist: 'Calm Waves',
        genre: 'Sleep Ambient',
        mood: 'Calm',
        audioFeatures: { energy: 0.10, tempo: 55 },
      },
    },
    {
      songId: 'song-party-anthem',
      contentScore: 0.85,
      collaborativeScore: 0.85,
      userTasteAffinityScore: 0.78,
      popularitySignal: 1000,
      recencySignal: 0.90,
      sources: ['collaborative', 'trending'],
      songDoc: {
        _id: 'song-party-anthem',
        title: 'Midnight Fever',
        artist: 'Club Kings',
        genre: 'Dance Pop',
        mood: 'Party',
        audioFeatures: { energy: 0.96, tempo: 130 },
      },
    },
    {
      songId: 'song-acoustic-relax',
      contentScore: 0.82,
      collaborativeScore: 0.70,
      userTasteAffinityScore: 0.80,
      popularitySignal: 450,
      recencySignal: 0.65,
      sources: ['content'],
      songDoc: {
        _id: 'song-acoustic-relax',
        title: 'Fireside Warmth',
        artist: 'Acoustic Soul',
        genre: 'Acoustic',
        mood: 'Relaxed',
        audioFeatures: { energy: 0.22, tempo: 75 },
      },
    },
  ];

  // Test 1: Complete Flow across all 9 Standard Contexts
  {
    const contexts = [
      StandardListeningSituation.Study,
      StandardListeningSituation.Work,
      StandardListeningSituation.Workout,
      StandardListeningSituation.Relaxation,
      StandardListeningSituation.Commute,
      StandardListeningSituation.Party,
      StandardListeningSituation.Sleep,
      StandardListeningSituation.Focus,
      StandardListeningSituation.GeneralListening,
    ];

    for (const ctx of contexts) {
      // 1. Validation
      const val = validateAndSanitizeRecommendationContext({ situation: ctx });
      assert.strictEqual(val.isValid, true);
      assert.strictEqual(val.sanitized.situation, ctx);

      // 2. Mapping
      const prefs = ContextPreferenceMappingService.mapContextToPreferences(val.sanitized);
      assert.strictEqual(prefs.situation, ctx);
      assert.ok(typeof prefs.targetEnergy === 'number');
      assert.ok(typeof prefs.targetTempo === 'number');

      // 3. Engine Ranking
      const ranked = HybridRankingPipeline.rankCandidates(candidateCatalog, 5, undefined, val.sanitized);
      assert.strictEqual(ranked.length, 5);
      assert.ok(ranked[0].hybridScore > 0);
      assert.ok(ranked[0].componentScores.contextScore !== undefined);

      // 4. Explanation Enrichment
      const explanation = RecommendationExplanationService.explainSong({
        song: ranked[0].song,
        componentScores: ranked[0].componentScores,
        sources: ranked[0].sources,
        sessionPreferences: {
          activeMood: prefs.targetMood,
          targetEnergy: prefs.targetEnergy,
          targetTempo: prefs.targetTempo,
        },
      });

      assert.ok(typeof explanation.primaryExplanation === 'string');
      assert.ok(explanation.primaryExplanation.length > 0);
    }

    console.log('✓ Test 1 Passed: Complete E2E flow verified across all 9 standard contexts.');
  }

  // Test 2: Custom Preferences Layering (Mood, Energy, Tempo, Genre, Discovery)
  {
    const customInput = {
      situation: 'study',
      mood: 'Calm',
      desiredEnergy: 0.45,
      desiredTempo: 95,
      preferredGenres: ['Neo-Classical', 'Ambient'],
      discoveryLevel: 0.70,
    };

    const val = validateAndSanitizeRecommendationContext(customInput);
    assert.strictEqual(val.sanitized.desiredEnergy, 0.45);
    assert.strictEqual(val.sanitized.desiredTempo, 95);
    assert.deepStrictEqual(val.sanitized.preferredGenres, ['Neo-Classical', 'Ambient']);

    const prefs = ContextPreferenceMappingService.mapContextToPreferences(val.sanitized);
    assert.strictEqual(prefs.targetEnergy, 0.45);
    assert.strictEqual(prefs.targetTempo, 95);
    assert.strictEqual(prefs.targetMood, 'Calm');
    assert.strictEqual(prefs.noveltyPreference, 0.70);
    assert.deepStrictEqual(prefs.preferredGenres, ['Neo-Classical', 'Ambient']);

    console.log('✓ Test 2 Passed: Custom mood, energy, tempo, genre, and discovery controls layered seamlessly.');
  }

  // Test 3: Baseline Invariance (No context preserves exact baseline scores)
  {
    const uncontextualResults = HybridRankingPipeline.rankCandidates(candidateCatalog, 5);
    for (const item of uncontextualResults) {
      assert.strictEqual(item.hybridScore, item.originalScore);
      assert.strictEqual(item.componentScores.contextScore, undefined);
      assert.strictEqual(item.metadata, undefined);
    }

    console.log('✓ Test 3 Passed: Recommendations without context are 100% invariant.');
  }

  // Test 4: Long-Term Preference Invariance (Context does not wipe core taste favorites)
  {
    const allStarFavorite: HybridCandidate = {
      songId: 'song-super-favorite',
      contentScore: 0.98,
      collaborativeScore: 0.98,
      userTasteAffinityScore: 1.00,
      popularitySignal: 950,
      recencySignal: 0.95,
      sources: ['taste_profile'],
      songDoc: {
        _id: 'song-super-favorite',
        title: 'Core Taste Favorite',
        artist: 'Favorite Artist',
        genre: 'Synthwave',
        mood: 'Upbeat',
        audioFeatures: { energy: 0.60, tempo: 115 },
      },
    };

    const randomWorkoutSong: HybridCandidate = {
      songId: 'song-random-workout',
      contentScore: 0.15,
      collaborativeScore: 0.15,
      userTasteAffinityScore: 0.10,
      popularitySignal: 200,
      recencySignal: 0.10,
      sources: ['catalog'],
      songDoc: {
        _id: 'song-random-workout',
        title: 'Random EDM Loop',
        artist: 'Anonymous',
        genre: 'EDM',
        mood: 'Energetic',
        audioFeatures: { energy: 0.92, tempo: 140 },
      },
    };

    const ranked = HybridRankingPipeline.rankCandidates(
      [allStarFavorite, randomWorkoutSong],
      2,
      undefined,
      'workout',
      0.25
    );

    assert.strictEqual(ranked[0].song._id, 'song-super-favorite');
    assert.ok(ranked[0].finalScore! > ranked[1].finalScore! + 0.30);

    console.log('✓ Test 4 Passed: Core taste favorites preserved; context does not wipe personal profile.');
  }

  // Test 5: Empty Candidates & Error Resilience
  {
    const emptyResults = HybridRankingPipeline.rankCandidates([], 5, undefined, 'workout');
    assert.deepStrictEqual(emptyResults, []);

    const invalidContextVal = validateAndSanitizeRecommendationContext({
      desiredEnergy: 99.0, // Out of bounds
      desiredTempo: -20,   // Out of bounds
    });

    assert.strictEqual(invalidContextVal.isValid, true);
    assert.strictEqual(invalidContextVal.sanitized.desiredEnergy, 1.0); // Clamped
    assert.strictEqual(invalidContextVal.sanitized.desiredTempo, 30);  // Clamped

    console.log('✓ Test 5 Passed: Empty candidate sets and out-of-bounds parameters handled safely.');
  }

  console.log('🎉 All 5 Day 25 Contextual Recommendation End-to-End tests completed successfully.');
}
