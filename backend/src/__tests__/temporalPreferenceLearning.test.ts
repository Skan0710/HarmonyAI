import assert from 'node:assert';
import { Types } from 'mongoose';
import {
  TemporalPreferenceAggregationService,
  RawTemporalInteractionEvent,
} from '../services/temporalPreferenceAggregationService.js';
import {
  LayeredTemporalTasteProfileService,
  UnifiedLayeredTasteProfile,
} from '../services/layeredTemporalTasteProfileService.js';
import {
  HybridRankingPipeline,
  HybridRankedResult,
} from '../services/hybridRankingPipeline.js';
import { HybridCandidate } from '../services/candidateGenerationService.js';
import { HybridRecommendationService } from '../services/hybridRecommendationService.js';
import { ColdStartDetectionService } from '../services/coldStartDetectionService.js';
import { ColdStartRecommendationService } from '../services/coldStartRecommendationService.js';
import { CandidateGenerationService } from '../services/candidateGenerationService.js';
import {
  getTemporalAggregationConfig,
  updateTemporalAggregationConfig,
  resetTemporalAggregationConfig,
  getTemporalTasteInfluenceConfig,
  updateTemporalTasteInfluenceConfig,
  resetTemporalTasteInfluenceConfig,
} from '../config/recommendationConfig.js';

export async function runTemporalPreferenceLearningTests() {
  console.log('[Temporal Preference Learning Comprehensive Test Suite] Starting tests...');

  const now = new Date('2026-09-01T12:00:00.000Z');
  const userId = new Types.ObjectId().toString();

  try {
    // =========================================================================
    // 1. RECENT INTERACTIONS RECEIVING HIGHER WEIGHT
    // =========================================================================
    {
      const config = getTemporalAggregationConfig();

      // Interactions at varying ages: Today, 3 days ago, 10 days ago, 30 days ago
      const eventToday: RawTemporalInteractionEvent = {
        genreName: 'Afrobeats',
        action: 'play',
        timestamp: new Date(now.getTime() - 2 * 3600 * 1000), // 2 hours ago
      };
      const event3dAgo: RawTemporalInteractionEvent = {
        genreName: 'Afrobeats',
        action: 'play',
        timestamp: new Date(now.getTime() - 3 * 86400000),
      };
      const event10dAgo: RawTemporalInteractionEvent = {
        genreName: 'Afrobeats',
        action: 'play',
        timestamp: new Date(now.getTime() - 10 * 86400000),
      };
      const event30dAgo: RawTemporalInteractionEvent = {
        genreName: 'Afrobeats',
        action: 'play',
        timestamp: new Date(now.getTime() - 30 * 86400000),
      };

      const decayToday = TemporalPreferenceAggregationService.calculateTimeDecay(eventToday.timestamp, 5, config, now);
      const decay3d = TemporalPreferenceAggregationService.calculateTimeDecay(event3dAgo.timestamp, 5, config, now);
      const decay10d = TemporalPreferenceAggregationService.calculateTimeDecay(event10dAgo.timestamp, 5, config, now);
      const decay30d = TemporalPreferenceAggregationService.calculateTimeDecay(event30dAgo.timestamp, 5, config, now);

      assert.ok(decayToday > decay3d, 'Event today must have higher weight than 3-day-old event');
      assert.ok(decay3d > decay10d, 'Event 3 days ago must have higher weight than 10-day-old event');
      assert.ok(decay10d > decay30d, 'Event 10 days ago must have higher weight than 30-day-old event');

      // Interaction Action Multipliers: Likes and completions amplify weights, skips penalize
      const weightPlay = TemporalPreferenceAggregationService.getInteractionWeight('play', config);
      const weightComplete = TemporalPreferenceAggregationService.getInteractionWeight('complete', config);
      const weightReplay = TemporalPreferenceAggregationService.getInteractionWeight('replay', config);
      const weightLike = TemporalPreferenceAggregationService.getInteractionWeight('like', config);
      const weightSkip = TemporalPreferenceAggregationService.getInteractionWeight('skip', config);

      assert.strictEqual(weightPlay, 1.0, 'Base play weight is 1.0');
      assert.strictEqual(weightComplete, 1.5, 'Completion weight boosts to 1.5');
      assert.strictEqual(weightReplay, 2.0, 'Replay weight boosts to 2.0');
      assert.strictEqual(weightLike, 2.0, 'Like weight boosts to 2.0');
      assert.strictEqual(weightSkip, -0.8, 'Skip weight penalizes with negative value -0.8');

      // Aggregate two single-event genres to verify higher net score for more recent interaction
      const genreAEvents: RawTemporalInteractionEvent[] = [
        { genreName: 'RecentGenre', action: 'play', timestamp: new Date(now.getTime() - 1 * 86400000) },
      ];
      const genreBEvents: RawTemporalInteractionEvent[] = [
        { genreName: 'OlderGenre', action: 'play', timestamp: new Date(now.getTime() - 12 * 86400000) },
      ];

      const aggCombined = TemporalPreferenceAggregationService.aggregateFromEvents(userId, [...genreAEvents, ...genreBEvents], {
        referenceDate: now,
      });

      const recentScore = aggCombined.shortTerm.genres.find((g) => g.name === 'RecentGenre')!;
      const olderScore = aggCombined.shortTerm.genres.find((g) => g.name === 'OlderGenre')!;
      assert.ok(recentScore.rawWeight > olderScore.rawWeight, 'Recent genre must have higher raw weight than older genre');
      assert.strictEqual(recentScore.preferenceScore, 1.0, 'Most recent genre reaches normalized top score 1.0');
      assert.ok(olderScore.preferenceScore < 0.40, '12-day-old genre decays to under 0.40 in short-term window');

      console.log('✓ Target 1 Verified: Recent interactions receive strictly higher weight and positive action amplification.');
    }

    // =========================================================================
    // 2. PREFERENCE DECAY (EXPONENTIAL, LINEAR, STEP, FLOOR, AND EXPLAINABILITY)
    // =========================================================================
    {
      const halfLife = 7;
      const minFloor = 0.05;

      // 1. Exponential Half-life Decay: At age = halfLife, decay factor ~ 0.50
      const expConfig = {
        ...getTemporalAggregationConfig(),
        decayModel: 'exponential' as const,
        minWeightFloor: minFloor,
      };
      const ageExactHalfLife = new Date(now.getTime() - halfLife * 86400000);
      const decayHalfLife = TemporalPreferenceAggregationService.calculateTimeDecay(ageExactHalfLife, halfLife, expConfig, now);
      assert.ok(
        Math.abs(decayHalfLife - 0.50) < 0.01,
        `Exponential decay at half-life (${halfLife}d) must equal 0.50, got ${decayHalfLife}`
      );

      // At age = 2 * halfLife, decay factor ~ 0.25
      const ageTwoHalfLives = new Date(now.getTime() - 2 * halfLife * 86400000);
      const decayTwoHalfLives = TemporalPreferenceAggregationService.calculateTimeDecay(ageTwoHalfLives, halfLife, expConfig, now);
      assert.ok(
        Math.abs(decayTwoHalfLives - 0.25) < 0.01,
        `Exponential decay at 2x half-life (${2 * halfLife}d) must equal 0.25, got ${decayTwoHalfLives}`
      );

      // 2. Linear Decay: Constant slope towards minFloor over linearDecayMaxDays
      const linearConfig = {
        ...getTemporalAggregationConfig(),
        decayModel: 'linear' as const,
        linearDecayMaxDays: 100,
        minWeightFloor: 0.10,
      };
      const midLinear = new Date(now.getTime() - 50 * 86400000);
      const decayLinearMid = TemporalPreferenceAggregationService.calculateTimeDecay(midLinear, halfLife, linearConfig, now);
      // Slope: (1 - 0.10)/100 = 0.009/day -> at 50 days: 1 - 50*0.009 = 0.55
      assert.ok(
        Math.abs(decayLinearMid - 0.55) < 0.02,
        `Linear decay at midpoint must be ~0.55, got ${decayLinearMid}`
      );

      // 3. Step Bracket Decay
      const stepConfig = {
        ...getTemporalAggregationConfig(),
        decayModel: 'step' as const,
        stepDecayBrackets: [
          { maxDays: 7, multiplier: 1.0 },
          { maxDays: 30, multiplier: 0.70 },
          { maxDays: 90, multiplier: 0.40 },
          { maxDays: 180, multiplier: 0.15 },
        ],
        minWeightFloor: 0.05,
      };
      const age5d = new Date(now.getTime() - 5 * 86400000);
      const age20d = new Date(now.getTime() - 20 * 86400000);
      const age60d = new Date(now.getTime() - 60 * 86400000);
      const age120d = new Date(now.getTime() - 120 * 86400000);

      assert.strictEqual(TemporalPreferenceAggregationService.calculateTimeDecay(age5d, halfLife, stepConfig, now), 1.0);
      assert.strictEqual(TemporalPreferenceAggregationService.calculateTimeDecay(age20d, halfLife, stepConfig, now), 0.70);
      assert.strictEqual(TemporalPreferenceAggregationService.calculateTimeDecay(age60d, halfLife, stepConfig, now), 0.40);
      assert.strictEqual(TemporalPreferenceAggregationService.calculateTimeDecay(age120d, halfLife, stepConfig, now), 0.15);

      // 4. Protection Floor: Ancient interactions (e.g. 365 days old) never drop below minWeightFloor
      const ancientDate = new Date(now.getTime() - 365 * 86400000);
      const expAncient = TemporalPreferenceAggregationService.calculateTimeDecay(ancientDate, halfLife, expConfig, now);
      const linAncient = TemporalPreferenceAggregationService.calculateTimeDecay(ancientDate, halfLife, linearConfig, now);
      const stepAncient = TemporalPreferenceAggregationService.calculateTimeDecay(ancientDate, halfLife, stepConfig, now);

      assert.strictEqual(expAncient, 0.05, 'Exponential decay respects minWeightFloor');
      assert.strictEqual(linAncient, 0.10, 'Linear decay respects minWeightFloor');
      assert.strictEqual(stepAncient, 0.05, 'Step decay respects minWeightFloor');

      // 5. Explainable Decay Breakdown (explainDecay)
      const explanation = TemporalPreferenceAggregationService.explainDecay(age5d, 'complete', 5, expConfig, now);
      assert.strictEqual(explanation.decayModel, 'exponential');
      assert.strictEqual(explanation.eventAgeDays, 5);
      assert.strictEqual(explanation.baseWeight, 1.5);
      assert.strictEqual(explanation.effectiveWeight, Number((1.5 * explanation.decayFactor).toFixed(4)));
      assert.ok(explanation.summary.includes('days ago'));
      assert.ok(explanation.summary.includes('retains'));

      console.log('✓ Target 2 Verified: Exponential, linear, step decay curves, safety floors, and explainability confirmed.');
    }

    // =========================================================================
    // 3. SHORT / MEDIUM / LONG-TERM PROFILES & LAYERED PRESERVATION
    // =========================================================================
    {
      // 3 distinct temporal cohorts:
      // - Short-term (1-3 days ago): Hyperpop / 100 gecs / Chaotic mood
      // - Medium-term (25-35 days ago): Indie Rock / Boygenius / Melancholic mood
      // - Long-term (100-150 days ago): Classic Rock / Led Zeppelin / Nostalgic mood
      const cohortEvents: RawTemporalInteractionEvent[] = [
        // Short-term
        {
          genreName: 'Hyperpop',
          artistName: '100 gecs',
          mood: 'Chaotic',
          action: 'complete',
          timestamp: new Date(now.getTime() - 2 * 86400000),
        },
        // Medium-term
        {
          genreName: 'Indie Rock',
          artistName: 'Boygenius',
          mood: 'Melancholic',
          action: 'complete',
          timestamp: new Date(now.getTime() - 30 * 86400000),
        },
        // Long-term
        ...Array.from({ length: 12 }, (_, i) => ({
          genreName: 'Classic Rock',
          artistName: 'Led Zeppelin',
          mood: 'Nostalgic',
          action: 'complete' as const,
          timestamp: new Date(now.getTime() - (100 + i * 4) * 86400000),
        })),
      ];

      const profile = LayeredTemporalTasteProfileService.generateFromEvents(userId, cohortEvents, {
        referenceDate: now,
      });

      // 1. Check Short-Term Layer
      assert.strictEqual(profile.shortTerm.timeframeDays, 14);
      assert.strictEqual(profile.shortTerm.role, 'immediate_momentum');
      assert.strictEqual(profile.shortTerm.genres[0].name, 'Hyperpop');
      assert.strictEqual(profile.shortTerm.artists[0].name, '100 gecs');
      assert.strictEqual(profile.shortTerm.moods[0].name, 'Chaotic');
      // Must NOT contain medium-term or long-term genres
      assert.ok(!profile.shortTerm.genres.some((g) => g.name === 'Indie Rock'));
      assert.ok(!profile.shortTerm.genres.some((g) => g.name === 'Classic Rock'));

      // 2. Check Medium-Term Layer
      assert.strictEqual(profile.mediumTerm.timeframeDays, 60);
      assert.strictEqual(profile.mediumTerm.role, 'rotational_habits');
      const medGenres = profile.mediumTerm.genres.map((g) => g.name);
      assert.ok(medGenres.includes('Hyperpop') && medGenres.includes('Indie Rock'));
      assert.ok(!medGenres.includes('Classic Rock'), 'Long-term genre must not exist in medium-term layer');

      // 3. Check Long-Term Layer
      assert.strictEqual(profile.longTerm.timeframeDays, 180);
      assert.strictEqual(profile.longTerm.role, 'foundational_taste');
      const longGenres = profile.longTerm.genres.map((g) => g.name);
      assert.ok(longGenres.includes('Classic Rock'));
      assert.ok(longGenres.includes('Indie Rock'));
      assert.ok(longGenres.includes('Hyperpop'));

      // 4. Discrete Layer Preservation (Layers must remain distinct without mutating each other)
      assert.strictEqual(profile.shortTerm.genres.length, 1);
      assert.strictEqual(profile.mediumTerm.genres.length, 2);
      assert.strictEqual(profile.longTerm.genres.length, 3);

      // 5. Taste Stability Metric & Strongest Changing Preferences
      // Because short-term (Hyperpop) completely diverges from foundational taste (Classic Rock),
      // taste stability must be low (active taste pivot phase)
      assert.ok(profile.tasteStabilityScore <= 0.30, `Expected low taste stability for sharp genre pivot, got ${profile.tasteStabilityScore}`);

      // Strongest changing preferences
      // NOTE: Hyperpop (2 days ago) falls within the 180-day long-term window too, so it has a
      // non-zero long-term score and is classified as 'rising' (high positive delta), not 'emerging'.
      // 'emerging' is reserved strictly for items with ZERO long-term history (novel to long-term layer).
      assert.ok(profile.strongestChangingPreferences !== undefined);
      const changes = profile.strongestChangingPreferences!;
      assert.ok(
        changes.topRising.some((r) => r.name === 'Hyperpop') || changes.topEmerging.some((e) => e.name === 'Hyperpop'),
        'Hyperpop should be flagged as strongly rising or emerging'
      );
      assert.ok(changes.topDeclining.some((d) => d.name === 'Classic Rock'), 'Classic Rock should be flagged as declining in short-term');

      console.log('✓ Target 3 Verified: Short/medium/long-term discrete horizons, layer preservation, and drift metrics confirmed.');
    }

    // =========================================================================
    // 4. RECOMMENDATION SCORING USING TEMPORAL PREFERENCES
    // =========================================================================
    {
      // Candidate songs representing short-term obsession vs medium-term vs long-term foundation vs outside genre
      const hyperpopSong = {
        _id: new Types.ObjectId(),
        title: 'Money Machine',
        genre: { _id: new Types.ObjectId(), name: 'Hyperpop' },
        artist: { _id: new Types.ObjectId(), name: '100 gecs' },
        mood: 'Chaotic',
        audioFeatures: { energy: 0.90, tempo: 140 },
      };
      const indieSong = {
        _id: new Types.ObjectId(),
        title: 'Not Strong Enough',
        genre: { _id: new Types.ObjectId(), name: 'Indie Rock' },
        artist: { _id: new Types.ObjectId(), name: 'Boygenius' },
        mood: 'Melancholic',
        audioFeatures: { energy: 0.65, tempo: 115 },
      };
      const classicRockSong = {
        _id: new Types.ObjectId(),
        title: 'Stairway to Heaven',
        genre: { _id: new Types.ObjectId(), name: 'Classic Rock' },
        artist: { _id: new Types.ObjectId(), name: 'Led Zeppelin' },
        mood: 'Nostalgic',
        audioFeatures: { energy: 0.70, tempo: 82 },
      };
      const jazzSong = {
        _id: new Types.ObjectId(),
        title: 'Take Five',
        genre: { _id: new Types.ObjectId(), name: 'Jazz' },
        artist: { _id: new Types.ObjectId(), name: 'Dave Brubeck' },
        mood: 'Chill',
        audioFeatures: { energy: 0.35, tempo: 120 },
      };

      const candidateCatalog: HybridCandidate[] = [
        {
          songId: String(hyperpopSong._id),
          songDoc: hyperpopSong,
          contentScore: 0.70,
          collaborativeScore: 0.70,
          userTasteAffinityScore: 0.65,
          popularitySignal: 0.75,
          recencySignal: 0.90,
          sources: ['CONTENT'],
        },
        {
          songId: String(indieSong._id),
          songDoc: indieSong,
          contentScore: 0.75,
          collaborativeScore: 0.75,
          userTasteAffinityScore: 0.70,
          popularitySignal: 0.70,
          recencySignal: 0.80,
          sources: ['COLLABORATIVE'],
        },
        {
          songId: String(classicRockSong._id),
          songDoc: classicRockSong,
          contentScore: 0.70,
          collaborativeScore: 0.80,
          userTasteAffinityScore: 0.80,
          popularitySignal: 0.85,
          recencySignal: 0.50,
          sources: ['COLLABORATIVE'],
        },
        {
          songId: String(jazzSong._id),
          songDoc: jazzSong,
          contentScore: 0.20,
          collaborativeScore: 0.20,
          userTasteAffinityScore: 0.20,
          popularitySignal: 0.40,
          recencySignal: 0.30,
          sources: ['CONTENT'],
        },
      ];

      // Build profile with short-term (Hyperpop), medium-term (Indie Rock), long-term (Classic Rock)
      const events: RawTemporalInteractionEvent[] = [
        {
          genreName: 'Hyperpop',
          artistName: '100 gecs',
          mood: 'Chaotic',
          action: 'complete',
          timestamp: new Date(now.getTime() - 1 * 86400000),
        },
        {
          genreName: 'Indie Rock',
          artistName: 'Boygenius',
          mood: 'Melancholic',
          action: 'complete',
          timestamp: new Date(now.getTime() - 25 * 86400000),
        },
        ...Array.from({ length: 15 }, (_, i) => ({
          genreName: 'Classic Rock',
          artistName: 'Led Zeppelin',
          mood: 'Nostalgic',
          action: 'complete' as const,
          timestamp: new Date(now.getTime() - (90 + i * 4) * 86400000),
        })),
      ];

      const profile = LayeredTemporalTasteProfileService.generateFromEvents(userId, events, {
        referenceDate: now,
      });

      const ranked = HybridRankingPipeline.rankCandidates(
        candidateCatalog,
        10,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        profile
      );

      const hyperItem = ranked.find((r) => r.song.title === 'Money Machine')!;
      const indieItem = ranked.find((r) => r.song.title === 'Not Strong Enough')!;
      const classicItem = ranked.find((r) => r.song.title === 'Stairway to Heaven')!;
      const jazzItem = ranked.find((r) => r.song.title === 'Take Five')!;

      // 1. Separate component signals present
      assert.ok(hyperItem.componentScores.shortTermScore !== undefined);
      assert.ok(hyperItem.componentScores.mediumTermScore !== undefined);
      assert.ok(hyperItem.componentScores.longTermScore !== undefined);
      assert.ok(hyperItem.componentScores.temporalTasteScore !== undefined);

      // 2. Short-term matching song receives highest shortTermScore
      assert.ok(
        hyperItem.componentScores.shortTermScore! > indieItem.componentScores.shortTermScore!,
        'Hyperpop song must score higher in short-term than Indie Rock'
      );
      assert.ok(
        hyperItem.componentScores.shortTermScore! > classicItem.componentScores.shortTermScore!,
        'Hyperpop song must score higher in short-term than Classic Rock'
      );

      // 3. Recent preferences influence recommendations more strongly than medium-term
      assert.ok(
        hyperItem.componentScores.temporalTasteScore! > indieItem.componentScores.temporalTasteScore!,
        'Recent short-term obsession must yield higher overall temporal score than medium-term rotation'
      );

      // 4. Long-term foundational favorite retains strong baseline score (no complete override)
      assert.ok(
        classicItem.componentScores.longTermScore! >= 0.70,
        'Classic Rock must retain strong long-term score floor'
      );
      assert.ok(
        classicItem.hybridScore >= 0.55,
        'Foundational favorite must maintain resilient hybrid recommendation score'
      );

      // 5. Unrelated genre scores low on all temporal layers
      assert.ok(
        jazzItem.componentScores.temporalTasteScore! <= 0.25,
        'Unmatched genre must have low temporal affinity'
      );

      // 6. Metadata diagnostics validation
      assert.ok(hyperItem.metadata?.temporalInfluence !== undefined);
      assert.ok(hyperItem.metadata?.shortTermFitScore !== undefined);
      assert.ok(hyperItem.metadata?.tasteStabilityScore !== undefined);

      console.log('✓ Target 4 Verified: Recommendation scoring integrates multi-horizon signals with recent momentum priority.');
    }

    // =========================================================================
    // 5. FALLBACK BEHAVIOR WHEN HISTORY IS INSUFFICIENT
    // =========================================================================
    {
      const emptyEvents: RawTemporalInteractionEvent[] = [];

      // 1. Aggregation with empty history returns safe, clean structures without exceptions
      const emptyAgg = TemporalPreferenceAggregationService.aggregateFromEvents(userId, emptyEvents, {
        referenceDate: now,
      });
      assert.strictEqual(emptyAgg.shortTerm.genres.length, 0);
      assert.strictEqual(emptyAgg.mediumTerm.genres.length, 0);
      assert.strictEqual(emptyAgg.longTerm.genres.length, 0);
      assert.strictEqual(emptyAgg.shortTerm.totalInteractions, 0);

      // 2. Layered profile with empty events generates safe default layers
      const emptyProfile = LayeredTemporalTasteProfileService.generateFromEvents(userId, emptyEvents, {
        referenceDate: now,
      });
      assert.strictEqual(emptyProfile.totalInteractionsAnalyzed, 0);
      assert.strictEqual(emptyProfile.tasteStabilityScore, 1.0, 'Default stability is 1.0 for cold start');
      assert.strictEqual(emptyProfile.unifiedGenres.length, 0);
      assert.ok(emptyProfile.strongestChangingPreferences !== undefined);
      assert.strictEqual(emptyProfile.strongestChangingPreferences?.topRising.length, 0);
      assert.ok(
        emptyProfile.strongestChangingPreferences?.tasteShiftSummary.includes('stable continuity') ||
        emptyProfile.strongestChangingPreferences?.tasteShiftSummary.includes('Insufficient')
      );

      // 3. HybridRankingPipeline fallback invariance when temporalProfile is null or empty
      const candidateCatalog: HybridCandidate[] = [
        {
          songId: new Types.ObjectId().toString(),
          songDoc: { _id: new Types.ObjectId(), title: 'Sample A', genre: 'Rock' },
          contentScore: 0.8,
          collaborativeScore: 0.7,
          userTasteAffinityScore: 0.6,
          popularitySignal: 0.5,
          recencySignal: 0.5,
          sources: ['CONTENT'],
        },
        {
          songId: new Types.ObjectId().toString(),
          songDoc: { _id: new Types.ObjectId(), title: 'Sample B', genre: 'Pop' },
          contentScore: 0.6,
          collaborativeScore: 0.6,
          userTasteAffinityScore: 0.5,
          popularitySignal: 0.4,
          recencySignal: 0.4,
          sources: ['COLLABORATIVE'],
        },
      ];

      const baselineNoTemporal = HybridRankingPipeline.rankCandidates(candidateCatalog, 10);
      const withNullTemporal = HybridRankingPipeline.rankCandidates(
        candidateCatalog,
        10,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        null
      );
      const withEmptyTemporal = HybridRankingPipeline.rankCandidates(
        candidateCatalog,
        10,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        emptyProfile
      );

      // Fallback ranking must be 100% invariant
      assert.strictEqual(baselineNoTemporal.length, withNullTemporal.length);
      assert.strictEqual(baselineNoTemporal[0].hybridScore, withNullTemporal[0].hybridScore);
      assert.strictEqual(baselineNoTemporal[0].componentScores.temporalTasteScore, undefined);

      // With empty profile, components default safely
      assert.strictEqual(withEmptyTemporal[0].componentScores.shortTermScore, 0.5);

      // 4. HybridRecommendationService cold-start fallback
      const originalDetect = ColdStartDetectionService.detectUserColdStartStatus;
      const originalColdRec = ColdStartRecommendationService.getColdStartRecommendations;

      try {
        (ColdStartDetectionService as any).detectUserColdStartStatus = async () => ({
          isColdStart: true,
          classification: 'NEW',
          historyCount: 0,
          likesCount: 0,
          sessionsCount: 0,
        });

        (ColdStartRecommendationService as any).getColdStartRecommendations = async () => ({
          strategy: 'POPULAR_GENRES',
          songs: [
            { _id: new Types.ObjectId(), title: 'Cold Start Song 1', playCount: 500 },
            { _id: new Types.ObjectId(), title: 'Cold Start Song 2', playCount: 400 },
          ],
          candidateSources: ['cold_start'],
        });

        const newUserId = new Types.ObjectId().toString();
        const coldStartResult = await HybridRecommendationService.getHybridRecommendations({
          userId: newUserId,
          limit: 5,
        });

        assert.strictEqual(coldStartResult.strategyUsed, 'COLD_START');
        assert.strictEqual(coldStartResult.userClassification, 'NEW');
        assert.strictEqual(coldStartResult.recommendations.length, 2);
        assert.strictEqual(coldStartResult.recommendations[0].song.title, 'Cold Start Song 1');

        console.log('✓ Target 5 Verified: Robust fallback behavior when history is empty or insufficient confirmed.');
      } finally {
        ColdStartDetectionService.detectUserColdStartStatus = originalDetect;
        ColdStartRecommendationService.getColdStartRecommendations = originalColdRec;
      }
    }

    console.log('🎉 ALL 5 Temporal Preference Learning target verification areas passed with 100% success!');
  } finally {
    resetTemporalAggregationConfig();
    resetTemporalTasteInfluenceConfig();
  }
}
