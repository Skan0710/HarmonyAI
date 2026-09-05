import assert from 'node:assert';
import {
  DiversityAwareRankingService,
  DiversityRankingOptions,
} from '../services/diversityAwareRankingService.js';
import {
  getDiversityAwareRankingConfig,
  updateDiversityAwareRankingConfig,
  resetDiversityAwareRankingConfig,
} from '../config/recommendationSignalConfig.js';
import { HybridRankedResult } from '../services/hybridRankingPipeline.js';

export function runDiversityAwareRankingTests() {
  console.log('[Diversity-Aware Recommendation Ranking Test Suite] Starting tests...');

  try {
    resetDiversityAwareRankingConfig();

    // =========================================================================
    // 1. Repeated Artists Test (Mitigates Monopolies While Tolerating Normal Plays)
    // =========================================================================
    {
      console.log('\n--- 1. Repeated Artists ---');
      // 3 songs by The Weeknd with close scores, plus 1 song by Dua Lipa and 1 by Daft Punk
      const candidates: HybridRankedResult[] = [
        {
          song: { _id: 's1', title: 'Blinding Lights', artist: 'The Weeknd', genre: 'Pop' },
          hybridScore: 0.92,
          finalScore: 0.92,
          componentScores: { contentScore: 0.9, collaborativeScore: 0.9, userTasteAffinityScore: 0.9, popularityScore: 0.9, recencyScore: 0.9 },
          sources: ['taste'],
        },
        {
          song: { _id: 's2', title: 'Save Your Tears', artist: 'The Weeknd', genre: 'Pop' },
          hybridScore: 0.90,
          finalScore: 0.90,
          componentScores: { contentScore: 0.9, collaborativeScore: 0.9, userTasteAffinityScore: 0.9, popularityScore: 0.9, recencyScore: 0.9 },
          sources: ['taste'],
        },
        {
          song: { _id: 's3', title: 'Starboy', artist: 'The Weeknd', genre: 'Pop' },
          hybridScore: 0.88,
          finalScore: 0.88,
          componentScores: { contentScore: 0.88, collaborativeScore: 0.88, userTasteAffinityScore: 0.88, popularityScore: 0.88, recencyScore: 0.88 },
          sources: ['taste'],
        },
        {
          song: { _id: 's4', title: 'Levitating', artist: 'Dua Lipa', genre: 'Pop' },
          hybridScore: 0.87,
          finalScore: 0.87,
          componentScores: { contentScore: 0.87, collaborativeScore: 0.87, userTasteAffinityScore: 0.87, popularityScore: 0.87, recencyScore: 0.87 },
          sources: ['collaborative'],
        },
        {
          song: { _id: 's5', title: 'Get Lucky', artist: 'Daft Punk', genre: 'Electronic' },
          hybridScore: 0.85,
          finalScore: 0.85,
          componentScores: { contentScore: 0.85, collaborativeScore: 0.85, userTasteAffinityScore: 0.85, popularityScore: 0.85, recencyScore: 0.85 },
          sources: ['collaborative'],
        },
      ];

      const { results, diagnostics } = DiversityAwareRankingService.applyDiversityAwareRanking(
        candidates,
        {
          diversityStrength: 0.40,
          maxConsecutiveSameArtist: 1, // 1 consecutive allowed before progressive penalty
        }
      );

      assert.strictEqual(results.length, 5);
      // Top song must still be The Weeknd's highest-scored song
      assert.strictEqual(results[0].song.title, 'Blinding Lights');

      // The 3rd Weeknd track ('Starboy') should be penalized down, allowing 'Levitating' to be promoted
      const secondArtist = results[1].song.artist;
      const thirdArtist = results[2].song.artist;

      // Ensure that 3 Weeknd songs are NOT all placed consecutively at ranks 0, 1, 2
      const firstThreeArtists = [results[0].song.artist, results[1].song.artist, results[2].song.artist];
      const allWeeknd = firstThreeArtists.every((a) => a === 'the weeknd');
      assert.strictEqual(allWeeknd, false, 'Diversity ranking must prevent 3 consecutive songs from the same artist');

      // Check diagnostics
      assert.ok(diagnostics.appliedAdjustmentsCount > 0, 'Must record applied diversity adjustments');

      console.log('✓ Repeated artist cluster effectively spaced out without discarding any songs');
    }

    // =========================================================================
    // 2. Repeated Genres Test (Prevents Genre Monotony)
    // =========================================================================
    {
      console.log('\n--- 2. Repeated Genres ---');
      // 4 consecutive Rock songs followed by Electronic and Hip Hop
      const candidates: HybridRankedResult[] = [
        {
          song: { _id: 'r1', title: 'Rock Track 1', artist: 'Band A', genre: 'Rock' },
          hybridScore: 0.89,
          finalScore: 0.89,
          componentScores: { contentScore: 0.89, collaborativeScore: 0.89, userTasteAffinityScore: 0.89, popularityScore: 0.89, recencyScore: 0.89 },
          sources: ['taste'],
        },
        {
          song: { _id: 'r2', title: 'Rock Track 2', artist: 'Band B', genre: 'Rock' },
          hybridScore: 0.88,
          finalScore: 0.88,
          componentScores: { contentScore: 0.88, collaborativeScore: 0.88, userTasteAffinityScore: 0.88, popularityScore: 0.88, recencyScore: 0.88 },
          sources: ['taste'],
        },
        {
          song: { _id: 'r3', title: 'Rock Track 3', artist: 'Band C', genre: 'Rock' },
          hybridScore: 0.87,
          finalScore: 0.87,
          componentScores: { contentScore: 0.87, collaborativeScore: 0.87, userTasteAffinityScore: 0.87, popularityScore: 0.87, recencyScore: 0.87 },
          sources: ['taste'],
        },
        {
          song: { _id: 'r4', title: 'Rock Track 4', artist: 'Band D', genre: 'Rock' },
          hybridScore: 0.86,
          finalScore: 0.86,
          componentScores: { contentScore: 0.86, collaborativeScore: 0.86, userTasteAffinityScore: 0.86, popularityScore: 0.86, recencyScore: 0.86 },
          sources: ['taste'],
        },
        {
          song: { _id: 'e1', title: 'Electronic Track', artist: 'DJ X', genre: 'Electronic' },
          hybridScore: 0.85,
          finalScore: 0.85,
          componentScores: { contentScore: 0.85, collaborativeScore: 0.85, userTasteAffinityScore: 0.85, popularityScore: 0.85, recencyScore: 0.85 },
          sources: ['discovery'],
        },
      ];

      const { results } = DiversityAwareRankingService.applyDiversityAwareRanking(
        candidates,
        {
          diversityStrength: 0.40,
          maxConsecutiveSameGenre: 2, // Allows 2 consecutive Rock tracks before penalty
        }
      );

      assert.strictEqual(results.length, 5);
      // First 2 can be Rock (consecutive allowance = 2)
      assert.strictEqual(results[0].song.genre, 'Rock');
      assert.strictEqual(results[1].song.genre, 'Rock');

      // The 3rd or 4th consecutive Rock track should yield to 'Electronic Track'
      const thirdGenre = results[2].song.genre;
      assert.strictEqual(
        thirdGenre,
        'Electronic',
        'Electronic track should be promoted ahead of the 3rd and 4th consecutive Rock tracks'
      );

      console.log('✓ Repeated genre cluster balanced: allowed 2 consecutive, then promoted diverse genre');
    }

    // =========================================================================
    // 3. Highly Similar Candidates (Pairwise Audio & Metadata Similarity Penalty)
    // =========================================================================
    {
      console.log('\n--- 3. Highly Similar Candidates ---');
      // Song 1 and Song 2 are acoustic twins: same artist, same genre, virtually identical audio features
      const candidates: HybridRankedResult[] = [
        {
          song: {
            _id: 's_twin_1',
            title: 'Ambient Waves 1',
            artist: 'Chillout Master',
            genre: 'Ambient',
            audioFeatures: { energy: 0.2, tempo: 70, valence: 0.4, danceability: 0.3 },
          },
          hybridScore: 0.90,
          finalScore: 0.90,
          componentScores: { contentScore: 0.9, collaborativeScore: 0.9, userTasteAffinityScore: 0.9, popularityScore: 0.5, recencyScore: 0.5 },
          sources: ['taste'],
        },
        {
          song: {
            _id: 's_twin_2',
            title: 'Ambient Waves 2',
            artist: 'Chillout Master',
            genre: 'Ambient',
            audioFeatures: { energy: 0.21, tempo: 70, valence: 0.41, danceability: 0.3 },
          },
          hybridScore: 0.89, // Near-identical score and near-identical audio
          finalScore: 0.89,
          componentScores: { contentScore: 0.89, collaborativeScore: 0.89, userTasteAffinityScore: 0.89, popularityScore: 0.5, recencyScore: 0.5 },
          sources: ['taste'],
        },
        {
          song: {
            _id: 's_distinct',
            title: 'Uplifting Beat',
            artist: 'Energetic Producer',
            genre: 'House',
            audioFeatures: { energy: 0.85, tempo: 128, valence: 0.8, danceability: 0.85 },
          },
          hybridScore: 0.86,
          finalScore: 0.86,
          componentScores: { contentScore: 0.86, collaborativeScore: 0.86, userTasteAffinityScore: 0.86, popularityScore: 0.5, recencyScore: 0.5 },
          sources: ['collaborative'],
        },
      ];

      // Pairwise similarity between twin 1 and twin 2 should be very high (> 0.85)
      const pairwiseSim = DiversityAwareRankingService.calculateSongSimilarity(
        candidates[0].song,
        candidates[1].song
      );
      assert.ok(pairwiseSim > 0.85, `Expected high pairwise similarity between twins, got ${pairwiseSim}`);

      const { results } = DiversityAwareRankingService.applyDiversityAwareRanking(
        candidates,
        {
          diversityStrength: 0.50,
          similarityThreshold: 0.70,
        }
      );

      // Distinct track should be prioritized over the redundant acoustic clone
      assert.strictEqual(results[0].song.title, 'Ambient Waves 1');
      assert.strictEqual(results[1].song.title, 'Uplifting Beat');
      assert.strictEqual(results[2].song.title, 'Ambient Waves 2');

      // The clone is still included at the end (never discarded!)
      assert.strictEqual(results[2].song._id, 's_twin_2');

      console.log('✓ Acoustically similar clone penalized and spaced out, while retained in the recommendation set');
    }

    // =========================================================================
    // 4. Already Diverse Candidate Lists (No Regression in Order or Scores)
    // =========================================================================
    {
      console.log('\n--- 4. Already Diverse Candidate Lists ---');
      const diverseCandidates: HybridRankedResult[] = [
        {
          song: { _id: 'd1', title: 'Jazz Standard', artist: 'Miles Davis', genre: 'Jazz' },
          hybridScore: 0.95,
          finalScore: 0.95,
          componentScores: { contentScore: 0.95, collaborativeScore: 0.95, userTasteAffinityScore: 0.95, popularityScore: 0.8, recencyScore: 0.8 },
          sources: ['taste'],
        },
        {
          song: { _id: 'd2', title: 'Indie Anthem', artist: 'Arctic Monkeys', genre: 'Indie Rock' },
          hybridScore: 0.88,
          finalScore: 0.88,
          componentScores: { contentScore: 0.88, collaborativeScore: 0.88, userTasteAffinityScore: 0.88, popularityScore: 0.8, recencyScore: 0.8 },
          sources: ['taste'],
        },
        {
          song: { _id: 'd3', title: 'Electronic Beat', artist: 'Daft Punk', genre: 'Electronic' },
          hybridScore: 0.82,
          finalScore: 0.82,
          componentScores: { contentScore: 0.82, collaborativeScore: 0.82, userTasteAffinityScore: 0.82, popularityScore: 0.8, recencyScore: 0.8 },
          sources: ['taste'],
        },
        {
          song: { _id: 'd4', title: 'Classical Symphony', artist: 'Beethoven', genre: 'Classical' },
          hybridScore: 0.77,
          finalScore: 0.77,
          componentScores: { contentScore: 0.77, collaborativeScore: 0.77, userTasteAffinityScore: 0.77, popularityScore: 0.8, recencyScore: 0.8 },
          sources: ['taste'],
        },
      ];

      const { results, diagnostics } = DiversityAwareRankingService.applyDiversityAwareRanking(
        diverseCandidates,
        { diversityStrength: 0.30 }
      );

      assert.strictEqual(results.length, 4);
      // Order must be 100% identical
      assert.strictEqual(results[0].song.title, 'Jazz Standard');
      assert.strictEqual(results[1].song.title, 'Indie Anthem');
      assert.strictEqual(results[2].song.title, 'Electronic Beat');
      assert.strictEqual(results[3].song.title, 'Classical Symphony');

      // Zero redundancy penalties applied
      assert.strictEqual(diagnostics.appliedAdjustmentsCount, 0);

      console.log('✓ Already diverse candidate list strictly retains exact original ranking and scores');
    }

    // =========================================================================
    // 5. Strong Relevance Preservation (Super-Relevant Songs Stay Consecutive)
    // =========================================================================
    {
      console.log('\n--- 5. Strong Relevance Preservation ---');
      // Candidate 1: Artist A (score: 0.99)
      // Candidate 2: Artist A (score: 0.96) - same artist, but VERY HIGH relevance
      // Candidate 3: Artist B (score: 0.45) - diverse, but very low relevance
      const candidates: HybridRankedResult[] = [
        {
          song: { _id: 's_super_1', title: 'Masterpiece 1', artist: 'Great Artist', genre: 'Soul' },
          hybridScore: 0.99,
          finalScore: 0.99,
          componentScores: { contentScore: 0.99, collaborativeScore: 0.99, userTasteAffinityScore: 0.99, popularityScore: 0.9, recencyScore: 0.9 },
          sources: ['taste'],
        },
        {
          song: { _id: 's_super_2', title: 'Masterpiece 2', artist: 'Great Artist', genre: 'Soul' },
          hybridScore: 0.96, // Extremely relevant
          finalScore: 0.96,
          componentScores: { contentScore: 0.96, collaborativeScore: 0.96, userTasteAffinityScore: 0.96, popularityScore: 0.9, recencyScore: 0.9 },
          sources: ['taste'],
        },
        {
          song: { _id: 's_mediocre', title: 'Mediocre filler', artist: 'Other Artist', genre: 'Country' },
          hybridScore: 0.45, // Much weaker match
          finalScore: 0.45,
          componentScores: { contentScore: 0.45, collaborativeScore: 0.45, userTasteAffinityScore: 0.45, popularityScore: 0.5, recencyScore: 0.5 },
          sources: ['catalog'],
        },
      ];

      const { results } = DiversityAwareRankingService.applyDiversityAwareRanking(
        candidates,
        {
          diversityStrength: 0.30,
          maxConsecutiveSameArtist: 1,
        }
      );

      // Because Masterpiece 2's relevance (0.96) vastly outweighs the diversity penalty (0.15 * 0.30 = 0.045),
      // it should STILL be placed at rank 1 ahead of the mediocre track (0.45)!
      assert.strictEqual(results[0].song.title, 'Masterpiece 1');
      assert.strictEqual(results[1].song.title, 'Masterpiece 2');
      assert.strictEqual(results[2].song.title, 'Mediocre filler');

      console.log('✓ High relevance correctly preserves consecutive high-quality tracks over weak alternatives');
    }

    // =========================================================================
    // 6. Configurable Diversity Strength & Reset
    // =========================================================================
    {
      console.log('\n--- 6. Configurable Diversity Strength ---');
      const base = getDiversityAwareRankingConfig();
      assert.strictEqual(base.diversityStrength, 0.30);

      // Disable diversity ranking via configuration
      updateDiversityAwareRankingConfig({ enabled: false });
      assert.strictEqual(getDiversityAwareRankingConfig().enabled, false);

      const candidates: HybridRankedResult[] = [
        {
          song: { _id: 'c1', title: 'Track 1', artist: 'Artist Same', genre: 'Pop' },
          hybridScore: 0.9,
          finalScore: 0.9,
          componentScores: { contentScore: 0.9, collaborativeScore: 0.9, userTasteAffinityScore: 0.9, popularityScore: 0.9, recencyScore: 0.9 },
          sources: ['taste'],
        },
        {
          song: { _id: 'c2', title: 'Track 2', artist: 'Artist Same', genre: 'Pop' },
          hybridScore: 0.89,
          finalScore: 0.89,
          componentScores: { contentScore: 0.89, collaborativeScore: 0.89, userTasteAffinityScore: 0.89, popularityScore: 0.89, recencyScore: 0.89 },
          sources: ['taste'],
        },
        {
          song: { _id: 'c3', title: 'Track 3', artist: 'Artist Same', genre: 'Pop' },
          hybridScore: 0.88,
          finalScore: 0.88,
          componentScores: { contentScore: 0.88, collaborativeScore: 0.88, userTasteAffinityScore: 0.88, popularityScore: 0.88, recencyScore: 0.88 },
          sources: ['taste'],
        },
      ];

      const resDisabled = DiversityAwareRankingService.applyDiversityAwareRanking(candidates);
      assert.strictEqual(resDisabled.diagnostics.appliedAdjustmentsCount, 0);

      // Reset
      resetDiversityAwareRankingConfig();
      assert.strictEqual(getDiversityAwareRankingConfig().enabled, true);
      assert.strictEqual(getDiversityAwareRankingConfig().diversityStrength, 0.30);

      console.log('✓ Diversity configuration is fully customizable and resettable');
    }

    console.log('\n🎉 ALL DIVERSITY-AWARE RECOMMENDATION RANKING TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Diversity-aware recommendation ranking test failed:', err);
    throw err;
  }
}
