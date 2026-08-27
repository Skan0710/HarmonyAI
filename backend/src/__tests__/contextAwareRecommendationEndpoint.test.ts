import assert from 'node:assert';
import { validateAndSanitizeRecommendationContext } from '../schemas/recommendationContextSchema.js';
import { ContextPreferenceMappingService } from '../services/contextPreferenceMappingService.js';
import { HybridRankingPipeline } from '../services/hybridRankingPipeline.js';
import { RecommendationExplanationService } from '../services/recommendationExplanationService.js';

export function runContextAwareRecommendationEndpointTests() {
  console.log('[Context-Aware Recommendation API Endpoint Test Suite] Starting tests...');

  // Mock songs candidate pool
  const candidatePool = [
    {
      songId: 'song-edm-1',
      contentScore: 0.85,
      collaborativeScore: 0.80,
      userTasteAffinityScore: 0.80,
      popularitySignal: 900,
      recencySignal: 0.85,
      sources: ['collaborative'],
      songDoc: {
        _id: 'song-edm-1',
        title: 'High Energy Beat',
        artist: 'DJ Turbo',
        genre: 'EDM',
        mood: 'Energetic',
        audioFeatures: { energy: 0.92, tempo: 140 },
      },
    },
    {
      songId: 'song-ambient-1',
      contentScore: 0.80,
      collaborativeScore: 0.70,
      userTasteAffinityScore: 0.75,
      popularitySignal: 400,
      recencySignal: 0.70,
      sources: ['content'],
      songDoc: {
        _id: 'song-ambient-1',
        title: 'Gentle Rain Drops',
        artist: 'Sleep Waves',
        genre: 'Ambient',
        mood: 'Calm',
        audioFeatures: { energy: 0.12, tempo: 60 },
      },
    },
  ];

  // Test 1: Parameter Validation & Sanitization Pipeline
  {
    const rawParams = {
      situation: 'workout',
      desiredEnergy: 0.95,
      desiredTempo: 145,
      preferredGenres: ['EDM', 'Trap'],
      discoveryLevel: 0.40,
    };

    const validation = validateAndSanitizeRecommendationContext(rawParams);
    assert.strictEqual(validation.isValid, true);
    assert.strictEqual(validation.sanitized.situation, 'workout');
    assert.strictEqual(validation.sanitized.desiredEnergy, 0.95);
    assert.strictEqual(validation.sanitized.desiredTempo, 145);
    assert.deepStrictEqual(validation.sanitized.preferredGenres, ['EDM', 'Trap']);

    console.log('✓ Test 1 Passed: Request parameters validated and sanitized cleanly.');
  }

  // Test 2: Context-to-Preferences Conversion
  {
    const sanitized = {
      situation: 'study',
      desiredEnergy: 0.35,
    };

    const derived = ContextPreferenceMappingService.mapContextToPreferences(sanitized);
    assert.strictEqual(derived.situation, 'study');
    assert.strictEqual(derived.targetEnergy, 0.35); // User override
    assert.strictEqual(derived.targetMood, 'Focus'); // Default mapped
    assert.ok(derived.rankingWeights.contentWeight > 0);

    console.log('✓ Test 2 Passed: Sanitized context converted into preference weights.');
  }

  // Test 3: Recommendation Ranking & Score Attachment with Context
  {
    const rankedResults = HybridRankingPipeline.rankCandidates(
      candidatePool,
      10,
      undefined,
      'workout',
      0.30
    );

    assert.strictEqual(rankedResults.length, 2);
    assert.strictEqual(rankedResults[0].song._id, 'song-edm-1');
    assert.ok(rankedResults[0].componentScores.contextScore! > 0.85);

    // Enriched with explanations
    const enriched = rankedResults.map((item) => {
      const explanation = RecommendationExplanationService.explainSong({
        song: item.song,
        componentScores: item.componentScores,
        sources: item.sources,
        sessionPreferences: {
          activeMood: 'Energetic',
          targetEnergy: 0.90,
          targetTempo: 140,
          sessionGenres: ['EDM'],
        },
      });

      return {
        song: item.song,
        hybridScore: item.hybridScore,
        recommendationScore: item.finalScore ?? item.hybridScore,
        primaryExplanation: explanation.primaryExplanation,
        topReasons: explanation.reasons || explanation.explanations,
        componentScores: item.componentScores,
        sources: item.sources,
        metadata: item.metadata,
      };
    });

    assert.strictEqual(enriched[0].song.title, 'High Energy Beat');
    assert.ok(typeof enriched[0].primaryExplanation === 'string' && enriched[0].primaryExplanation.length > 0);
    assert.ok(Array.isArray(enriched[0].topReasons));
    assert.ok(enriched[0].recommendationScore > 0);

    console.log('✓ Test 3 Passed: Ranked results contain recommendation scores and explanation metadata.');
  }

  // Test 4: Graceful Handling of Missing / Default Context
  {
    const emptyValidation = validateAndSanitizeRecommendationContext({});
    assert.strictEqual(emptyValidation.isValid, true);
    assert.strictEqual(emptyValidation.sanitized.situation, undefined);

    const derived = ContextPreferenceMappingService.mapContextToPreferences(emptyValidation.sanitized);
    assert.strictEqual(derived.situation, 'general_listening');

    console.log('✓ Test 4 Passed: Unspecified contexts default gracefully to general_listening.');
  }

  // Test 5: Out of range parameter clamping & error detection
  {
    const invalidValidation = validateAndSanitizeRecommendationContext({
      desiredEnergy: -5.0,
      desiredTempo: 999,
      discoveryLevel: 4.5,
    });

    assert.strictEqual(invalidValidation.isValid, true);
    assert.strictEqual(invalidValidation.sanitized.desiredEnergy, 0.0);
    assert.strictEqual(invalidValidation.sanitized.desiredTempo, 250);
    assert.strictEqual(invalidValidation.sanitized.discoveryLevel, 1.0);

    console.log('✓ Test 5 Passed: Out-of-bounds parameters are clamped safely within valid numeric ranges.');
  }

  console.log('🎉 All 5 Context-Aware Recommendation API Endpoint tests completed successfully.');
}
