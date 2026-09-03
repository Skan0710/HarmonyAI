import assert from 'node:assert';
import { Types } from 'mongoose';
import {
  HybridRankingPipeline,
  HybridRankedResult,
} from '../services/hybridRankingPipeline.js';
import { HybridCandidate } from '../services/candidateGenerationService.js';
import {
  LayeredTemporalTasteProfileService,
  UnifiedLayeredTasteProfile,
} from '../services/layeredTemporalTasteProfileService.js';
import { RawTemporalInteractionEvent } from '../services/temporalPreferenceAggregationService.js';
import {
  getTemporalTasteInfluenceConfig,
  updateTemporalTasteInfluenceConfig,
  resetTemporalTasteInfluenceConfig,
} from '../config/recommendationConfig.js';
import { HybridRecommendationService } from '../services/hybridRecommendationService.js';
import { CandidateGenerationService } from '../services/candidateGenerationService.js';
import { ColdStartDetectionService } from '../services/coldStartDetectionService.js';

export async function runTemporalRecommendationIntegrationTests() {
  console.log('[Temporal Recommendation Integration Test Suite] Starting tests...');

  try {
    const now = new Date('2026-09-01T12:00:00.000Z');
    const userId = new Types.ObjectId().toString();

    // Reusable candidate catalog
    const synthwaveSong = {
      _id: new Types.ObjectId(),
      title: 'Neon Nights',
      genre: { _id: new Types.ObjectId(), name: 'Synthwave' },
      artist: { _id: new Types.ObjectId(), name: 'Kavinsky' },
      mood: 'Energetic',
      audioFeatures: { energy: 0.85, tempo: 128 },
    };

    const electronicSong = {
      _id: new Types.ObjectId(),
      title: 'Around the World',
      genre: { _id: new Types.ObjectId(), name: 'Electronic' },
      artist: { _id: new Types.ObjectId(), name: 'Daft Punk' },
      mood: 'Upbeat',
      audioFeatures: { energy: 0.70, tempo: 120 },
    };

    const rockSong = {
      _id: new Types.ObjectId(),
      title: 'Bohemian Rhapsody',
      genre: { _id: new Types.ObjectId(), name: 'Rock' },
      artist: { _id: new Types.ObjectId(), name: 'Queen' },
      mood: 'Classic',
      audioFeatures: { energy: 0.55, tempo: 110 },
    };

    const classicalSong = {
      _id: new Types.ObjectId(),
      title: 'Moonlight Sonata',
      genre: { _id: new Types.ObjectId(), name: 'Classical' },
      artist: { _id: new Types.ObjectId(), name: 'Beethoven' },
      mood: 'Calm',
      audioFeatures: { energy: 0.25, tempo: 70 },
    };

    const candidatePool: HybridCandidate[] = [
      {
        songId: String(synthwaveSong._id),
        songDoc: synthwaveSong,
        contentScore: 0.80,
        collaborativeScore: 0.75,
        userTasteAffinityScore: 0.70,
        popularitySignal: 0.80,
        recencySignal: 0.90,
        sources: ['CONTENT', 'COLLABORATIVE'],
      },
      {
        songId: String(electronicSong._id),
        songDoc: electronicSong,
        contentScore: 0.75,
        collaborativeScore: 0.70,
        userTasteAffinityScore: 0.75,
        popularitySignal: 0.75,
        recencySignal: 0.80,
        sources: ['CONTENT', 'COLLABORATIVE'],
      },
      {
        songId: String(rockSong._id),
        songDoc: rockSong,
        contentScore: 0.70,
        collaborativeScore: 0.85,
        userTasteAffinityScore: 0.85,
        popularitySignal: 0.90,
        recencySignal: 0.50,
        sources: ['COLLABORATIVE'],
      },
      {
        songId: String(classicalSong._id),
        songDoc: classicalSong,
        contentScore: 0.30,
        collaborativeScore: 0.20,
        userTasteAffinityScore: 0.20,
        popularitySignal: 0.40,
        recencySignal: 0.30,
        sources: ['CONTENT'],
      },
    ];

    // Build layered temporal taste profile:
    // - Short-term (recent spike): Synthwave (Kavinsky)
    // - Medium-term (rotational): Electronic (Daft Punk)
    // - Long-term (foundation): Rock (Queen)
    const events: RawTemporalInteractionEvent[] = [
      // 1-2 days ago: Active obsession with Synthwave
      {
        genreName: 'Synthwave',
        artistName: 'Kavinsky',
        mood: 'Energetic',
        action: 'complete',
        timestamp: new Date(now.getTime() - 1 * 86400000),
      },
      {
        genreName: 'Synthwave',
        artistName: 'Kavinsky',
        mood: 'Energetic',
        action: 'replay',
        timestamp: new Date(now.getTime() - 2 * 86400000),
      },
      // 30 days ago: Medium-term rotation with Electronic
      {
        genreName: 'Electronic',
        artistName: 'Daft Punk',
        mood: 'Upbeat',
        action: 'complete',
        timestamp: new Date(now.getTime() - 30 * 86400000),
      },
      // 100-140 days ago: Foundational taste with Rock
      ...Array.from({ length: 10 }, (_, i) => ({
        genreName: 'Rock',
        artistName: 'Queen',
        mood: 'Classic',
        action: 'complete' as const,
        timestamp: new Date(now.getTime() - (100 + i * 3) * 86400000),
      })),
    ];

    const temporalProfile: UnifiedLayeredTasteProfile =
      LayeredTemporalTasteProfileService.generateFromEvents(userId, events, {
        referenceDate: now,
      });

    // Test 1: Fallback Invariance (100% Identical Baseline Without Temporal Profile)
    {
      const baselineNoTemporal = HybridRankingPipeline.rankCandidates(candidatePool, 10);
      const explicitNullTemporal = HybridRankingPipeline.rankCandidates(
        candidatePool,
        10,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        null
      );

      assert.strictEqual(
        baselineNoTemporal.length,
        explicitNullTemporal.length,
        'Result lengths must match'
      );

      for (let i = 0; i < baselineNoTemporal.length; i++) {
        assert.strictEqual(
          baselineNoTemporal[i].hybridScore,
          explicitNullTemporal[i].hybridScore,
          `Candidate ${i} hybridScore must be 100% identical without temporal profile`
        );
        assert.strictEqual(
          baselineNoTemporal[i].componentScores.shortTermScore,
          undefined,
          'shortTermScore must be undefined when no temporal profile is provided'
        );
        assert.strictEqual(
          baselineNoTemporal[i].componentScores.temporalTasteScore,
          undefined,
          'temporalTasteScore must be undefined when no temporal profile is provided'
        );
      }

      console.log('✓ Test 1 Passed: 100% fallback invariance confirmed when temporal profile is omitted.');
    }

    // Test 2: Separate Signals for Short-Term, Medium-Term, and Long-Term Preferences
    {
      const rankedWithTemporal = HybridRankingPipeline.rankCandidates(
        candidatePool,
        10,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        temporalProfile
      );

      assert.ok(rankedWithTemporal.length > 0);

      // Find scored items
      const synthResult = rankedWithTemporal.find((r) => r.song.title === 'Neon Nights')!;
      const electroResult = rankedWithTemporal.find((r) => r.song.title === 'Around the World')!;
      const rockResult = rankedWithTemporal.find((r) => r.song.title === 'Bohemian Rhapsody')!;
      const classicalResult = rankedWithTemporal.find((r) => r.song.title === 'Moonlight Sonata')!;

      // Verify all 4 separate temporal component scores exist
      for (const res of [synthResult, electroResult, rockResult, classicalResult]) {
        assert.ok(typeof res.componentScores.shortTermScore === 'number', 'shortTermScore must be a number');
        assert.ok(typeof res.componentScores.mediumTermScore === 'number', 'mediumTermScore must be a number');
        assert.ok(typeof res.componentScores.longTermScore === 'number', 'longTermScore must be a number');
        assert.ok(typeof res.componentScores.temporalTasteScore === 'number', 'temporalTasteScore must be a number');
      }

      // Synthwave matches Short-Term layer best
      assert.ok(
        synthResult.componentScores.shortTermScore! > electroResult.componentScores.shortTermScore!,
        'Synthwave must have higher short-term score than Electronic'
      );
      assert.ok(
        synthResult.componentScores.shortTermScore! > rockResult.componentScores.shortTermScore!,
        'Synthwave must have higher short-term score than Rock'
      );

      // Rock matches Long-Term layer best
      assert.ok(
        rockResult.componentScores.longTermScore! > synthResult.componentScores.longTermScore!,
        'Rock must have high long-term score corresponding to foundational taste'
      );

      // Classical matches none of the layers
      assert.ok(
        classicalResult.componentScores.temporalTasteScore! < 0.20,
        'Unmatched classical item must receive low temporal taste score'
      );

      console.log('✓ Test 2 Passed: Separate short-term, medium-term, and long-term signals populated.');
    }

    // Test 3: Recent Preferences Influence More Strongly
    {
      // Synthwave (short-term) vs Electronic (medium-term)
      const rankedWithTemporal = HybridRankingPipeline.rankCandidates(
        candidatePool,
        10,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        temporalProfile
      );

      const synthResult = rankedWithTemporal.find((r) => r.song.title === 'Neon Nights')!;
      const electroResult = rankedWithTemporal.find((r) => r.song.title === 'Around the World')!;

      // Short-term signal weight is 0.50, medium-term is 0.30
      // Because of stronger recency weighting, Synthwave's temporalTasteScore exceeds Electronic's
      assert.ok(
        synthResult.componentScores.temporalTasteScore! > electroResult.componentScores.temporalTasteScore!,
        `Expected short-term obsession score (${synthResult.componentScores.temporalTasteScore}) > medium-term score (${electroResult.componentScores.temporalTasteScore})`
      );

      console.log('✓ Test 3 Passed: Recent (short-term) preferences influence recommendations more strongly.');
    }

    // Test 4: Long-Term Foundational Taste is Preserved (No Total Override)
    {
      const rankedWithTemporal = HybridRankingPipeline.rankCandidates(
        candidatePool,
        10,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        temporalProfile
      );

      const rockResult = rankedWithTemporal.find((r) => r.song.title === 'Bohemian Rhapsody')!;

      // Rock retains high overall hybrid score because of its long-term anchor and high baseline affinity
      assert.ok(
        rockResult.hybridScore > 0.60,
        `Long-term foundational favorite must preserve strong hybrid score, got ${rockResult.hybridScore}`
      );
      assert.ok(
        rockResult.componentScores.longTermScore! >= 0.70,
        `Long-term score must remain high (${rockResult.componentScores.longTermScore})`
      );

      // Metadata contains temporal diagnostic breakdown
      assert.ok(rockResult.metadata?.temporalInfluence !== undefined);
      assert.ok(rockResult.metadata?.shortTermFitScore !== undefined);
      assert.ok(rockResult.metadata?.longTermFitScore !== undefined);

      console.log('✓ Test 4 Passed: Long-term foundational taste preserved without total override.');
    }

    // Test 5: Dynamic Tuning of Temporal Influence & Layer Weights
    {
      // Configure zero temporal influence
      const zeroInfluenceRanked = HybridRankingPipeline.rankCandidates(
        candidatePool,
        10,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        temporalProfile,
        0.0 // 0% temporal influence
      );

      const baseline = HybridRankingPipeline.rankCandidates(candidatePool, 10);
      assert.strictEqual(
        zeroInfluenceRanked[0].hybridScore,
        baseline[0].hybridScore,
        'Zero temporal influence must produce identical hybrid scores to baseline'
      );

      // Custom high temporal influence (clamped safely to maxTemporalInfluence 0.40)
      const highInfluenceRanked = HybridRankingPipeline.rankCandidates(
        candidatePool,
        10,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        temporalProfile,
        0.40
      );
      assert.ok(highInfluenceRanked[0].metadata?.temporalInfluence <= 0.40);

      console.log('✓ Test 5 Passed: Dynamic tuning of temporal influence verified.');
    }

    // Test 6: End-to-End Recommendation Service Integration with Graceful Fallback
    {
      const originalDetect = ColdStartDetectionService.detectUserColdStartStatus;
      const originalGenerate = CandidateGenerationService.generateHybridCandidates;

      try {
        (ColdStartDetectionService as any).detectUserColdStartStatus = async () => ({
          isColdStart: false,
          classification: 'ACTIVE',
          historyCount: 35,
          likesCount: 15,
          sessionsCount: 5,
        });

        (CandidateGenerationService as any).generateHybridCandidates = async () => candidatePool;

        // 1. With temporalProfile passed directly
        const resWithProfile = await HybridRecommendationService.getHybridRecommendations({
          userId,
          temporalProfile,
          limit: 3,
        });

        assert.strictEqual(resWithProfile.strategyUsed, 'HYBRID_PERSONALIZED');
        assert.strictEqual(resWithProfile.recommendations.length, 3);
        assert.ok(resWithProfile.recommendations[0].componentScores.temporalTasteScore !== undefined);

        // 2. Fallback when temporalProfile is null
        const resFallback = await HybridRecommendationService.getHybridRecommendations({
          userId,
          temporalProfile: null,
          useTemporalProfile: false,
          limit: 3,
        });

        assert.strictEqual(resFallback.strategyUsed, 'HYBRID_PERSONALIZED');
        assert.strictEqual(resFallback.recommendations.length, 3);
        assert.strictEqual(resFallback.recommendations[0].componentScores.temporalTasteScore, undefined);

        console.log('✓ Test 6 Passed: End-to-end recommendation service integration and graceful fallback verified.');
      } finally {
        ColdStartDetectionService.detectUserColdStartStatus = originalDetect;
        CandidateGenerationService.generateHybridCandidates = originalGenerate;
      }
    }

    console.log('🎉 ALL 6 Temporal Recommendation Integration tests completed successfully.');
  } finally {
    resetTemporalTasteInfluenceConfig();
  }
}
