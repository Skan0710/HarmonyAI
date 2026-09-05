import assert from 'node:assert';
import {
  NoveltyScoringService,
  UserFamiliarityCategory,
  UserFamiliarityProfile,
} from '../services/noveltyScoringService.js';
import {
  getNoveltyScoringConfig,
  updateNoveltyScoringConfig,
  resetNoveltyScoringConfig,
} from '../config/recommendationSignalConfig.js';
import {
  getNoveltyConfigWeights,
  updateNoveltyConfigWeights,
  resetNoveltyConfigWeights,
} from '../config/recommendationConfig.js';
import { HybridRankedResult } from '../services/hybridRankingPipeline.js';

export function runRecommendationNoveltyScoringTests() {
  console.log('[Recommendation Novelty Scoring Test Suite] Starting tests...');

  try {
    resetNoveltyScoringConfig();
    resetNoveltyConfigWeights();

    // =========================================================================
    // 1. User Familiarity Classification (All 4 Categories)
    // =========================================================================
    {
      console.log('\n--- 1. User Familiarity Classification ---');

      // Completely Unfamiliar: 0 plays
      assert.strictEqual(NoveltyScoringService.classifyUserFamiliarity(0), 'COMPLETELY_UNFAMILIAR');
      assert.strictEqual(NoveltyScoringService.classifyUserFamiliarity(-1), 'COMPLETELY_UNFAMILIAR');

      // Rarely Heard: 1 to 2 plays
      assert.strictEqual(NoveltyScoringService.classifyUserFamiliarity(1), 'RARELY_HEARD');
      assert.strictEqual(NoveltyScoringService.classifyUserFamiliarity(2), 'RARELY_HEARD');

      // Previously Heard: 3 to 5 plays
      assert.strictEqual(NoveltyScoringService.classifyUserFamiliarity(3), 'PREVIOUSLY_HEARD');
      assert.strictEqual(NoveltyScoringService.classifyUserFamiliarity(4), 'PREVIOUSLY_HEARD');
      assert.strictEqual(NoveltyScoringService.classifyUserFamiliarity(5), 'PREVIOUSLY_HEARD');

      // Frequently Heard: > 5 plays
      assert.strictEqual(NoveltyScoringService.classifyUserFamiliarity(6), 'FREQUENTLY_HEARD');
      assert.strictEqual(NoveltyScoringService.classifyUserFamiliarity(15), 'FREQUENTLY_HEARD');
      assert.strictEqual(NoveltyScoringService.classifyUserFamiliarity(100), 'FREQUENTLY_HEARD');

      // Verify category baseline scores order
      const unfamiliarScore = NoveltyScoringService.getFamiliarityScoreForCategory('COMPLETELY_UNFAMILIAR');
      const rarelyScore = NoveltyScoringService.getFamiliarityScoreForCategory('RARELY_HEARD');
      const previouslyScore = NoveltyScoringService.getFamiliarityScoreForCategory('PREVIOUSLY_HEARD');
      const frequentlyScore = NoveltyScoringService.getFamiliarityScoreForCategory('FREQUENTLY_HEARD');

      assert.strictEqual(unfamiliarScore, 1.0);
      assert.ok(unfamiliarScore > rarelyScore, 'Unfamiliar score must exceed rarely heard');
      assert.ok(rarelyScore > previouslyScore, 'Rarely heard score must exceed previously heard');
      assert.ok(previouslyScore > frequentlyScore, 'Previously heard score must exceed frequently heard');

      console.log('  Passed: All 4 user familiarity categories classified and graded accurately');
    }

    // =========================================================================
    // 2. Frequently Consumed Songs vs Unfamiliar Songs Novelty Gradients
    // =========================================================================
    {
      console.log('\n--- 2. Frequently Consumed vs Unfamiliar Songs ---');

      const novUnfamiliar = NoveltyScoringService.calculateUserExposureNovelty(0);
      const novRare1 = NoveltyScoringService.calculateUserExposureNovelty(1);
      const novRare2 = NoveltyScoringService.calculateUserExposureNovelty(2);
      const novPrev3 = NoveltyScoringService.calculateUserExposureNovelty(3);
      const novPrev5 = NoveltyScoringService.calculateUserExposureNovelty(5);
      const novFreq6 = NoveltyScoringService.calculateUserExposureNovelty(6);
      const novFreq20 = NoveltyScoringService.calculateUserExposureNovelty(20);

      assert.strictEqual(novUnfamiliar, 1.0, 'Completely unfamiliar must have max user novelty 1.0');
      assert.ok(novUnfamiliar > novRare1, 'Unfamiliar > Rarely heard');
      assert.ok(novRare1 > novRare2, '1 play > 2 plays');
      assert.ok(novRare2 > novPrev3, 'Rarely heard > Previously heard');
      assert.ok(novPrev3 > novPrev5, '3 plays > 5 plays');
      assert.ok(novPrev5 > novFreq6, 'Previously heard > Frequently heard');
      assert.ok(novFreq20 >= 0.05, 'Frequently heard should not drop below floor of 0.05');

      // Composite novelty test (fusing catalog novelty and user exposure novelty)
      const unfamiliarSongNovelty = NoveltyScoringService.computeCompositeNovelty({
        catalogPlayCount: 50,
        userPlayCount: 0,
      });

      const frequentSongNovelty = NoveltyScoringService.computeCompositeNovelty({
        catalogPlayCount: 800,
        userPlayCount: 15,
      });

      assert.ok(
        unfamiliarSongNovelty > frequentSongNovelty,
        `Unfamiliar track composite (${unfamiliarSongNovelty}) must be higher than frequent track composite (${frequentSongNovelty})`
      );
      assert.ok(unfamiliarSongNovelty >= 0.85, 'Unfamiliar track should have high composite novelty');
      assert.ok(frequentSongNovelty <= 0.25, 'Frequent track should have low composite novelty');

      console.log('  Passed: Frequently consumed songs have significantly lower novelty');
    }

    // =========================================================================
    // 3. Relevance Gating (Novelty Must NOT Override Relevance)
    // =========================================================================
    {
      console.log('\n--- 3. Relevance Gating ---');

      const minThreshold = 0.35;

      // Case A: Completely unrelated song with base relevance 0.15 (below threshold 0.35)
      // Even with 100% raw novelty, gated novelty MUST be 0.0!
      const gatedUnrelated = NoveltyScoringService.calculateGatedNoveltyBoost(0.15, 1.0, minThreshold);
      assert.strictEqual(
        gatedUnrelated,
        0.0,
        'Completely unrelated candidates below threshold must receive 0.0 gated novelty'
      );

      const combinedUnrelated = NoveltyScoringService.combineNoveltyWithBaseScore(0.15, 1.0);
      assert.strictEqual(
        combinedUnrelated.gatedNoveltyScore,
        0.0,
        'Gated novelty score must be 0 for low-relevance items'
      );
      assert.ok(
        combinedUnrelated.finalScore <= 0.15,
        'Final score for unrelated item should NEVER be boosted by novelty'
      );

      // Case B: Boundary case at exact threshold 0.35
      const gatedAtBoundary = NoveltyScoringService.calculateGatedNoveltyBoost(0.35, 1.0, minThreshold);
      assert.strictEqual(gatedAtBoundary, 0.0, 'At threshold boundary, gated novelty must be 0.0');

      // Case C: Relevant song at 0.70 base relevance
      const gatedRelevant = NoveltyScoringService.calculateGatedNoveltyBoost(0.70, 1.0, minThreshold);
      assert.ok(
        gatedRelevant > 0.50,
        `Relevant candidate should receive strong gated boost, received: ${gatedRelevant}`
      );

      // Case D: Highly relevant song at 0.95 base relevance
      const gatedSuperRelevant = NoveltyScoringService.calculateGatedNoveltyBoost(0.95, 1.0, minThreshold);
      assert.ok(
        gatedSuperRelevant > gatedRelevant,
        'Gated boost increases monotonically with relevance'
      );

      console.log('  Passed: Relevance gating strictly prevents unrelated songs from receiving novelty boosts');
    }

    // =========================================================================
    // 4. Novelty Does Not Override Relevance (Super-Relevant vs Novel Mediocre)
    // =========================================================================
    {
      console.log('\n--- 4. Novelty Preserves Relevance Hierarchy ---');

      // Song A: Highly relevant favorite (baseScore 0.92, frequently heard userPlayCount 12, rawNovelty 0.10)
      const songA = NoveltyScoringService.combineNoveltyWithBaseScore(0.92, 0.10);

      // Song B: Mediocre candidate (baseScore 0.45, completely unfamiliar userPlayCount 0, rawNovelty 0.95)
      const songB = NoveltyScoringService.combineNoveltyWithBaseScore(0.45, 0.95);

      // Song C: Irrelevant candidate (baseScore 0.20, completely unfamiliar userPlayCount 0, rawNovelty 1.0)
      const songC = NoveltyScoringService.combineNoveltyWithBaseScore(0.20, 1.0);

      assert.ok(
        songA.finalScore > songB.finalScore,
        `Highly relevant song A (${songA.finalScore}) must rank above mediocre novel song B (${songB.finalScore})`
      );
      assert.ok(
        songB.finalScore > songC.finalScore,
        `Mediocre song B (${songB.finalScore}) must rank above irrelevant song C (${songC.finalScore})`
      );

      // Now consider Song D: Highly relevant AND unfamiliar discovery (baseScore 0.90, rawNovelty 0.95)
      // Between Song A (0.92, frequent) and Song D (0.90, novel discovery), Song D receives enough boost to be ranked #1
      const songD = NoveltyScoringService.combineNoveltyWithBaseScore(0.90, 0.95);
      assert.ok(
        songD.finalScore > songA.finalScore,
        `Novel relevant discovery Song D (${songD.finalScore}) should overtake familiar Song A (${songA.finalScore})`
      );

      console.log('  Passed: High relevance candidates prevail over mediocre novel ones; novel relevant discoveries are rewarded');
    }

    // =========================================================================
    // 5. Configurable Novelty Weights & Dynamic Updates
    // =========================================================================
    {
      console.log('\n--- 5. Configurable Novelty Weights ---');

      const initialConfig = getNoveltyScoringConfig();
      assert.strictEqual(initialConfig.noveltyWeight, 0.15);
      assert.strictEqual(initialConfig.minRelevanceThreshold, 0.35);

      // Dynamically increase novelty weight to 0.30
      updateNoveltyScoringConfig({ noveltyWeight: 0.30, minRelevanceThreshold: 0.40 });
      const updatedConfig = getNoveltyScoringConfig();
      assert.strictEqual(updatedConfig.noveltyWeight, 0.30);
      assert.strictEqual(updatedConfig.minRelevanceThreshold, 0.40);

      // Verify sync with recommendationConfig getNoveltyConfigWeights()
      const syncConfig = getNoveltyConfigWeights();
      assert.strictEqual(syncConfig.noveltyWeight, 0.30);
      assert.strictEqual(syncConfig.minRelevanceThreshold, 0.40);

      // Score item with higher novelty weight: novelty impact should be larger
      const scoreWith30 = NoveltyScoringService.combineNoveltyWithBaseScore(0.80, 0.90, {
        noveltyWeight: 0.30,
      });
      const scoreWith10 = NoveltyScoringService.combineNoveltyWithBaseScore(0.80, 0.90, {
        noveltyWeight: 0.10,
      });

      assert.ok(
        scoreWith30.finalScore !== scoreWith10.finalScore,
        'Changing novelty weight must change final combined score'
      );

      // Reset to defaults
      resetNoveltyScoringConfig();
      assert.strictEqual(getNoveltyScoringConfig().noveltyWeight, 0.15);
      assert.strictEqual(getNoveltyConfigWeights().noveltyWeight, 0.15);

      console.log('  Passed: Novelty configuration is centralized, dynamic, and fully configurable');
    }

    // =========================================================================
    // 6. Pipeline Integration & Diagnostic Breakdown
    // =========================================================================
    {
      console.log('\n--- 6. Pipeline Integration & Diagnostics ---');

      const mockCandidates: HybridRankedResult[] = [
        {
          song: { _id: 'song_familiar', title: 'Familiar Hit', playCount: 800 },
          hybridScore: 0.91,
          componentScores: { contentScore: 0.9, collaborativeScore: 0.9, userTasteAffinityScore: 0.9, popularityScore: 0.8, recencyScore: 0.7 },
          sources: ['taste'],
        },
        {
          song: { _id: 'song_discovery', title: 'Fresh Discovery', playCount: 80 },
          hybridScore: 0.89,
          componentScores: { contentScore: 0.9, collaborativeScore: 0.88, userTasteAffinityScore: 0.89, popularityScore: 0.4, recencyScore: 0.9 },
          sources: ['content'],
        },
        {
          song: { _id: 'song_rare', title: 'Rare Encounter', playCount: 200 },
          hybridScore: 0.85,
          componentScores: { contentScore: 0.85, collaborativeScore: 0.85, userTasteAffinityScore: 0.85, popularityScore: 0.5, recencyScore: 0.6 },
          sources: ['collaborative'],
        },
        {
          song: { _id: 'song_unrelated', title: 'Completely Unrelated', playCount: 10 },
          hybridScore: 0.20,
          componentScores: { contentScore: 0.2, collaborativeScore: 0.2, userTasteAffinityScore: 0.2, popularityScore: 0.1, recencyScore: 0.5 },
          sources: ['catalog'],
        },
      ];

      const mockUserProfile: Partial<UserFamiliarityProfile> = {
        userId: 'user123',
        songEncounterCounts: new Map([
          ['song_familiar', 12], // >5 -> FREQUENTLY_HEARD
          ['song_rare', 2],      // 1-2 -> RARELY_HEARD
          // 'song_discovery' not in map -> 0 -> COMPLETELY_UNFAMILIAR
          // 'song_unrelated' not in map -> 0 -> COMPLETELY_UNFAMILIAR
        ]),
        songCategories: new Map<string, UserFamiliarityCategory>([
          ['song_familiar', 'FREQUENTLY_HEARD'],
          ['song_rare', 'RARELY_HEARD'],
          ['song_discovery', 'COMPLETELY_UNFAMILIAR'],
          ['song_unrelated', 'COMPLETELY_UNFAMILIAR'],
        ]),
      };

      const { results, diagnostics } = NoveltyScoringService.applyNoveltyScoringToRankedResults(
        mockCandidates,
        mockUserProfile as any
      );

      assert.strictEqual(results.length, 4, 'Should process all 4 candidates');
      assert.strictEqual(diagnostics.totalCandidates, 4);
      assert.strictEqual(diagnostics.frequentlyHeardCount, 1);
      assert.strictEqual(diagnostics.rarelyHeardCount, 1);
      assert.strictEqual(diagnostics.completelyUnfamiliarCount, 2);

      // Verify each result contains enriched novelty metadata
      for (const res of results) {
        assert.ok(typeof res.finalScore === 'number', 'finalScore must be defined');
        assert.ok(typeof res.componentScores.noveltyScore === 'number', 'noveltyScore must be in componentScores');
        assert.ok(res.metadata?.familiarityCategory, 'familiarityCategory must be in metadata');
        assert.ok(typeof res.metadata?.gatedNoveltyScore === 'number', 'gatedNoveltyScore must be in metadata');
      }

      // Check that Fresh Discovery overtook Familiar Hit because of novelty boost among highly relevant candidates
      const topSong = results[0];
      assert.strictEqual(
        topSong.song._id,
        'song_discovery',
        'Relevant unfamiliar song should take the top spot with novelty boost'
      );
      assert.strictEqual(topSong.metadata?.familiarityCategory, 'COMPLETELY_UNFAMILIAR');

      // Check that Completely Unrelated remains at the bottom with 0 gated novelty
      const bottomSong = results[3];
      assert.strictEqual(bottomSong.song._id, 'song_unrelated');
      assert.strictEqual(bottomSong.metadata?.gatedNoveltyScore, 0.0);
      assert.ok(bottomSong.finalScore! <= 0.20);

      console.log('  Passed: Pipeline correctly ranks unfamiliar relevant discoveries while keeping unrelated candidates gated');
    }

    console.log('\n[Recommendation Novelty Scoring Test Suite] ALL TESTS PASSED! \u2714\n');
  } finally {
    resetNoveltyScoringConfig();
    resetNoveltyConfigWeights();
  }
}

// Allow direct execution via: node -e "import('./dist/__tests__/recommendationNoveltyScoring.test.js').then(m => m.runRecommendationNoveltyScoringTests())"
if (process.argv[1]?.includes('recommendationNoveltyScoring.test')) {
  runRecommendationNoveltyScoringTests();
}
