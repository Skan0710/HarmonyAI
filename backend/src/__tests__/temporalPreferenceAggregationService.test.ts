import assert from 'node:assert';
import { Types } from 'mongoose';
import {
  TemporalPreferenceAggregationService,
  RawTemporalInteractionEvent,
} from '../services/temporalPreferenceAggregationService.js';
import {
  getTemporalAggregationConfig,
  updateTemporalAggregationConfig,
  resetTemporalAggregationConfig,
  DEFAULT_TEMPORAL_AGGREGATION_CONFIG,
} from '../config/recommendationConfig.js';
import { ListeningHistory } from '../models/ListeningHistory.js';
import { ListeningSession } from '../models/ListeningSession.js';
import { User } from '../models/User.js';
import { TemporalPreference } from '../models/TemporalPreference.js';

export async function runTemporalPreferenceAggregationServiceTests() {
  console.log('[Temporal Preference Aggregation Service Test Suite] Starting tests...');

  const originalHistoryFind = (ListeningHistory as any).find;
  const originalUserFindById = (User as any).findById;
  const originalSessionFind = (ListeningSession as any).find;
  const originalBulkWrite = TemporalPreference.bulkWrite;

  try {
    const userId = new Types.ObjectId().toString();
    const now = new Date('2026-09-01T12:00:00.000Z');

    // Test 1: Modular Recency Decay Weighting
    {
      const today = new Date('2026-09-01T10:00:00.000Z');
      const fiveDaysAgo = new Date('2026-08-27T12:00:00.000Z');
      const thirtyDaysAgo = new Date('2026-08-02T12:00:00.000Z');

      const decayToday = TemporalPreferenceAggregationService.calculateRecencyDecay(today, 5, 0.05, now);
      const decay5d = TemporalPreferenceAggregationService.calculateRecencyDecay(fiveDaysAgo, 5, 0.05, now);
      const decay30d = TemporalPreferenceAggregationService.calculateRecencyDecay(thirtyDaysAgo, 5, 0.05, now);

      assert.ok(decayToday > 0.95, 'Recent interaction today should have decay close to 1.0');
      assert.ok(Math.abs(decay5d - 0.5) < 0.05, 'Interaction at half-life (5 days) should be approximately 0.50');
      assert.ok(decay30d < decay5d, 'Older interaction must decay significantly more than recent interaction');
      assert.ok(decay30d >= 0.05, 'Decay must respect the minimum floor (0.05)');

      console.log('✓ Test 1 Passed: Recency decay weighting verified with mathematical accuracy.');
    }

    // Test 2: Modular Interaction Multipliers (Completions/Likes Boost, Skips Penalize)
    {
      const config = getTemporalAggregationConfig();
      const weightPlay = TemporalPreferenceAggregationService.getInteractionWeight('play', config);
      const weightComplete = TemporalPreferenceAggregationService.getInteractionWeight('complete', config);
      const weightLike = TemporalPreferenceAggregationService.getInteractionWeight('like', config);
      const weightReplay = TemporalPreferenceAggregationService.getInteractionWeight('replay', config);
      const weightSkip = TemporalPreferenceAggregationService.getInteractionWeight('skip', config);

      assert.strictEqual(weightPlay, 1.0);
      assert.strictEqual(weightComplete, 1.5);
      assert.strictEqual(weightLike, 2.0);
      assert.strictEqual(weightReplay, 2.0);
      assert.strictEqual(weightSkip, -0.8);

      console.log('✓ Test 2 Passed: Interaction multipliers verified (Boost for complete/like, penalty for skip).');
    }

    // Test 3: Aggregation Across Short-Term, Medium-Term, and Long-Term Windows
    {
      const events: RawTemporalInteractionEvent[] = [
        // Short-term recent event (yesterday)
        {
          genreName: 'Synthwave',
          artistName: 'Kavinsky',
          mood: 'Energetic',
          action: 'complete',
          timestamp: new Date('2026-08-31T12:00:00.000Z'),
        },
        // Medium-term event (20 days ago)
        {
          genreName: 'Electronic',
          artistName: 'Daft Punk',
          mood: 'Upbeat',
          action: 'play',
          timestamp: new Date('2026-08-12T12:00:00.000Z'),
        },
        // Long-term foundational event (90 days ago)
        {
          genreName: 'Rock',
          artistName: 'Queen',
          mood: 'Epic',
          action: 'like',
          timestamp: new Date('2026-06-03T12:00:00.000Z'),
        },
      ];

      const result = TemporalPreferenceAggregationService.aggregateFromEvents(userId, events, {
        referenceDate: now,
      });

      // Short-term should only capture the recent Synthwave event
      assert.strictEqual(result.shortTerm.totalInteractions, 1);
      assert.strictEqual(result.shortTerm.genres[0].name, 'Synthwave');
      assert.strictEqual(result.shortTerm.artists[0].name, 'Kavinsky');
      assert.strictEqual(result.shortTerm.moods[0].name, 'Energetic');

      // Medium-term should capture Synthwave + Electronic
      assert.strictEqual(result.mediumTerm.totalInteractions, 2);
      const medGenres = result.mediumTerm.genres.map((g) => g.name);
      assert.ok(medGenres.includes('Synthwave') && medGenres.includes('Electronic'));

      // Long-term should capture all 3 events (Synthwave + Electronic + Rock)
      assert.strictEqual(result.longTerm.totalInteractions, 3);
      const longGenres = result.longTerm.genres.map((g) => g.name);
      assert.ok(longGenres.includes('Synthwave') && longGenres.includes('Electronic') && longGenres.includes('Rock'));

      console.log('✓ Test 3 Passed: Window partitioning and multi-horizon aggregation verified.');
    }

    // Test 4: Preserving Long-Term Preferences while Prioritizing Recent Activity
    {
      const events: RawTemporalInteractionEvent[] = [
        // Long-term core favorite: Rock (played 20 times between 30 and 150 days ago)
        ...Array.from({ length: 20 }, (_, i) => ({
          genreName: 'Rock',
          artistName: 'Led Zeppelin',
          mood: 'Classic',
          action: 'complete',
          timestamp: new Date(now.getTime() - (30 + i * 5) * 86400000),
        })),
        // Recent short-term shift: Jazz (played 3 times in the last 2 days)
        {
          genreName: 'Jazz',
          artistName: 'Miles Davis',
          mood: 'Chill',
          action: 'complete',
          timestamp: new Date(now.getTime() - 1 * 86400000),
        },
        {
          genreName: 'Jazz',
          artistName: 'Miles Davis',
          mood: 'Chill',
          action: 'complete',
          timestamp: new Date(now.getTime() - 2 * 86400000),
        },
      ];

      const result = TemporalPreferenceAggregationService.aggregateFromEvents(userId, events, {
        referenceDate: now,
      });

      // 1. In Short-Term window: Jazz is #1 because Rock had 0 interactions in the last 14 days
      assert.strictEqual(result.shortTerm.genres[0].name, 'Jazz');

      // 2. In Long-Term window: Rock is #1 because of historical volume and loyalty
      assert.strictEqual(result.longTerm.genres[0].name, 'Rock');

      // 3. In Blended profile: Both are represented with valid scores in [0.0, 1.0]
      const rockBlended = result.blendedGenres.find((g) => g.name === 'Rock');
      const jazzBlended = result.blendedGenres.find((g) => g.name === 'Jazz');
      assert.ok(rockBlended && rockBlended.preferenceScore > 0, 'Long-term preference Rock is preserved');
      assert.ok(jazzBlended && jazzBlended.preferenceScore > 0, 'Recent preference Jazz is strongly represented');

      console.log('✓ Test 4 Passed: Recent momentum prioritized without erasing long-term taste.');
    }

    // Test 5: Modular Scoring Tunability & Runtime Overrides
    {
      // Custom configuration override
      const customConfig = {
        shortTermDays: 7,
        playWeight: 2.0,
        completeWeight: 3.0,
        shortTermBlendWeight: 0.80, // Heavy bias towards short-term
        longTermBlendWeight: 0.10,
      };

      const events: RawTemporalInteractionEvent[] = [
        {
          genreName: 'Pop',
          action: 'play',
          timestamp: new Date(now.getTime() - 2 * 86400000),
        },
      ];

      const result = TemporalPreferenceAggregationService.aggregateFromEvents(userId, events, {
        configOverride: customConfig,
        referenceDate: now,
      });

      assert.strictEqual(result.shortTerm.timeframeDays, 7);

      // Verify global config updating and resetting
      updateTemporalAggregationConfig({ shortTermDays: 10 });
      assert.strictEqual(getTemporalAggregationConfig().shortTermDays, 10);

      resetTemporalAggregationConfig();
      assert.strictEqual(
        getTemporalAggregationConfig().shortTermDays,
        DEFAULT_TEMPORAL_AGGREGATION_CONFIG.shortTermDays
      );

      console.log('✓ Test 5 Passed: Configuration is completely modular and tuneable at runtime.');
    }

    // Test 6: Normalization Boundary Guarantees
    {
      const rawScores = [
        { rawWeight: 100 },
        { rawWeight: 50 },
        { rawWeight: 0 },
        { rawWeight: -20 }, // Negative penalty from skip
      ];

      const normalized = TemporalPreferenceAggregationService.normalizeScores(rawScores);
      assert.strictEqual(normalized[0].preferenceScore, 1.0);
      assert.strictEqual(normalized[1].preferenceScore, 0.5);
      assert.strictEqual(normalized[2].preferenceScore, 0.0);
      assert.strictEqual(normalized[3].preferenceScore, 0.0, 'Negative raw weight clamped safely to 0');

      for (const n of normalized) {
        assert.ok(n.preferenceScore >= 0.0 && n.preferenceScore <= 1.0);
      }

      console.log('✓ Test 6 Passed: Output scores strictly bounded and normalized within [0.0, 1.0].');
    }

    // Test 7: End-to-End Aggregation with Mocked MongoDB Collections and Persistence
    {
      const mockHistoryDocs = [
        {
          user: userId,
          song: {
            _id: new Types.ObjectId(),
            genre: { _id: new Types.ObjectId(), name: 'Ambient' },
            artist: { _id: new Types.ObjectId(), name: 'Brian Eno' },
            mood: 'Calm',
            title: 'Quiet Music',
          },
          playedAt: new Date(now.getTime() - 3 * 86400000),
          completed: true,
          skipped: false,
        },
      ];

      const mockUserDoc = {
        _id: userId,
        favoriteGenres: [{ _id: new Types.ObjectId(), name: 'Ambient' }],
        favoriteArtists: [{ _id: new Types.ObjectId(), name: 'Brian Eno' }],
        likedSongs: [],
        createdAt: new Date(now.getTime() - 100 * 86400000),
      };

      (ListeningHistory as any).find = () => ({
        populate: () => ({
          lean: async () => mockHistoryDocs,
        }),
      });

      (User as any).findById = () => ({
        populate: () => ({
          populate: () => ({
            populate: () => ({
              lean: async () => mockUserDoc,
            }),
          }),
        }),
      });

      (ListeningSession as any).find = () => ({
        select: () => ({
          lean: async () => [],
        }),
      });

      let bulkWriteCalled = false;
      let bulkOpsCount = 0;
      (TemporalPreference as any).bulkWrite = async (ops: any[]) => {
        bulkWriteCalled = true;
        bulkOpsCount = ops.length;
        return { ok: 1 };
      };

      const result = await TemporalPreferenceAggregationService.aggregateUserPreferences(userId, {
        persist: true,
        referenceDate: now,
      });

      assert.strictEqual(result.userId, userId);
      assert.strictEqual(bulkWriteCalled, true, 'bulkWrite should be called when persist=true');
      assert.ok(bulkOpsCount > 0, 'Temporal preferences upsert operations dispatched');
      assert.strictEqual(result.persistedCount, bulkOpsCount);
      assert.ok(result.shortTerm.genres.length > 0, 'Short-term genres populated');
      assert.strictEqual(result.shortTerm.genres[0].name, 'Ambient');

      console.log('✓ Test 7 Passed: End-to-end user aggregation with MongoDB models & persistence verified.');
    }

    // Test 8: Configurable Decay Functions (Exponential, Linear, and Step Models)
    {
      const eventRecent = new Date(now.getTime() - 2 * 86400000);   // 2 days old
      const eventMid = new Date(now.getTime() - 20 * 86400000);     // 20 days old
      const eventOld = new Date(now.getTime() - 80 * 86400000);     // 80 days old
      const eventAncient = new Date(now.getTime() - 200 * 86400000); // 200 days old

      // 1. Exponential Decay
      const expConfig = { ...getTemporalAggregationConfig(), decayModel: 'exponential' as const };
      const expRecent = TemporalPreferenceAggregationService.calculateTimeDecay(eventRecent, 10, expConfig, now);
      const expMid = TemporalPreferenceAggregationService.calculateTimeDecay(eventMid, 10, expConfig, now);
      const expOld = TemporalPreferenceAggregationService.calculateTimeDecay(eventOld, 10, expConfig, now);
      assert.ok(expRecent > expMid && expMid > expOld, 'Exponential decay: older events have strictly less influence');

      // 2. Linear Decay
      const linearConfig = {
        ...getTemporalAggregationConfig(),
        decayModel: 'linear' as const,
        linearDecayMaxDays: 100,
        minWeightFloor: 0.10,
      };
      const linRecent = TemporalPreferenceAggregationService.calculateTimeDecay(eventRecent, 10, linearConfig, now);
      const linMid = TemporalPreferenceAggregationService.calculateTimeDecay(eventMid, 10, linearConfig, now);
      const linAncient = TemporalPreferenceAggregationService.calculateTimeDecay(eventAncient, 10, linearConfig, now);
      assert.ok(linRecent > linMid, 'Linear decay: older events have strictly less influence');
      assert.strictEqual(linAncient, 0.10, 'Linear decay: events beyond maxDays clamped to minWeightFloor');

      // 3. Step Decay
      const stepConfig = {
        ...getTemporalAggregationConfig(),
        decayModel: 'step' as const,
        stepDecayBrackets: [
          { maxDays: 7, multiplier: 1.0 },
          { maxDays: 30, multiplier: 0.65 },
          { maxDays: 90, multiplier: 0.35 },
          { maxDays: 180, multiplier: 0.10 },
        ],
        minWeightFloor: 0.05,
      };
      const stepRecent = TemporalPreferenceAggregationService.calculateTimeDecay(eventRecent, 10, stepConfig, now);
      const stepMid = TemporalPreferenceAggregationService.calculateTimeDecay(eventMid, 10, stepConfig, now);
      const stepOld = TemporalPreferenceAggregationService.calculateTimeDecay(eventOld, 10, stepConfig, now);
      const stepAncient = TemporalPreferenceAggregationService.calculateTimeDecay(eventAncient, 10, stepConfig, now);

      assert.strictEqual(stepRecent, 1.0, 'Step decay: <= 7 days receives 1.0');
      assert.strictEqual(stepMid, 0.65, 'Step decay: 8-30 days receives 0.65');
      assert.strictEqual(stepOld, 0.35, 'Step decay: 31-90 days receives 0.35');
      assert.strictEqual(stepAncient, 0.05, 'Step decay: beyond brackets receives minWeightFloor');

      console.log('✓ Test 8 Passed: Configurable decay models (exponential, linear, step) verified.');
    }

    // Test 9: Simple and Explainable Decay Breakdown (explainDecay)
    {
      const threeDaysAgo = new Date(now.getTime() - 3 * 86400000);
      const explanation = TemporalPreferenceAggregationService.explainDecay(
        threeDaysAgo,
        'complete',
        7,
        getTemporalAggregationConfig(),
        now
      );

      assert.strictEqual(explanation.decayModel, 'exponential');
      assert.strictEqual(explanation.eventAgeDays, 3);
      assert.strictEqual(explanation.baseWeight, 1.5);
      assert.ok(explanation.decayFactor > 0.70 && explanation.decayFactor < 0.80);
      assert.strictEqual(explanation.effectiveWeight, Number((1.5 * explanation.decayFactor).toFixed(4)));
      assert.ok(explanation.summary.includes('days ago'), 'Summary must mention age');
      assert.ok(explanation.summary.includes('retains'), 'Summary must mention retained percentage');

      console.log('✓ Test 9 Passed: Simple and explainable decay breakdown verified.');
    }

    // Test 10: Aggregation with Linear and Step Decay Overrides
    {
      const events: RawTemporalInteractionEvent[] = [
        {
          genreName: 'Classical',
          action: 'play',
          timestamp: new Date(now.getTime() - 2 * 86400000),
        },
        {
          genreName: 'Classical',
          action: 'play',
          timestamp: new Date(now.getTime() - 40 * 86400000),
        },
      ];

      const linearResult = TemporalPreferenceAggregationService.aggregateFromEvents(userId, events, {
        configOverride: { decayModel: 'linear', linearDecayMaxDays: 60 },
        referenceDate: now,
      });
      assert.strictEqual(linearResult.shortTerm.genres[0].name, 'Classical');

      const stepResult = TemporalPreferenceAggregationService.aggregateFromEvents(userId, events, {
        configOverride: { decayModel: 'step' },
        referenceDate: now,
      });
      assert.strictEqual(stepResult.shortTerm.genres[0].name, 'Classical');

      console.log('✓ Test 10 Passed: Aggregation successfully executes across multiple decay models.');
    }

    console.log('🎉 ALL 10 Temporal Preference Aggregation Service tests completed successfully.');
  } finally {
    (ListeningHistory as any).find = originalHistoryFind;
    (User as any).findById = originalUserFindById;
    (ListeningSession as any).find = originalSessionFind;
    (TemporalPreference as any).bulkWrite = originalBulkWrite;
    resetTemporalAggregationConfig();
  }
}
