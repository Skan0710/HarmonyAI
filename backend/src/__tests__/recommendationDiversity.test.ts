import assert from 'node:assert';
import {
  RecommendationDiversityService,
  DiversitySongItem,
} from '../services/recommendationDiversityService.js';

export function runRecommendationDiversityTests() {
  console.log('[Recommendation Diversity & Novelty Test Suite] Starting tests...');

  // Test 1: Diverse Recommendations (Different Genres & Artists)
  {
    const songs: DiversitySongItem[] = [
      { songId: 'song_1', genreId: 'genre_rock', artistId: 'artist_queen', playCount: 50 },
      { songId: 'song_2', genreId: 'genre_jazz', artistId: 'artist_miles', playCount: 100 },
      { songId: 'song_3', genreId: 'genre_pop', artistId: 'artist_taylor', playCount: 200 },
      { songId: 'song_4', genreId: 'genre_synthwave', artistId: 'artist_m83', playCount: 30 },
    ];

    const metrics = RecommendationDiversityService.evaluateDiversityAndNovelty(songs, 100, 1000);

    assert.strictEqual(metrics.genreDiversity, 1.0, '4 unique genres out of 4 items = 1.0');
    assert.strictEqual(metrics.artistDiversity, 1.0, '4 unique artists out of 4 items = 1.0');
    assert.strictEqual(metrics.diversityScore, 1.0, 'Combined diversity = 1.0');
    assert.strictEqual(metrics.catalogCoverage, 0.04, '4 unique songs out of 100 catalog songs = 0.04');
    assert.ok(metrics.noveltyScore > 0.8, 'Low play count tracks yield high novelty score (> 0.8)');

    console.log('✓ Test 1 Passed: Diverse recommendations evaluated correctly.');
  }

  // Test 2: Low Diversity Recommendations (Same Genre & Artist)
  {
    const songs: DiversitySongItem[] = [
      { songId: 'song_1', genreId: 'genre_rock', artistId: 'artist_queen', playCount: 800 },
      { songId: 'song_2', genreId: 'genre_rock', artistId: 'artist_queen', playCount: 900 },
      { songId: 'song_3', genreId: 'genre_rock', artistId: 'artist_queen', playCount: 1000 },
    ];

    const metrics = RecommendationDiversityService.evaluateDiversityAndNovelty(songs, 50, 1000);

    assert.strictEqual(metrics.genreDiversity, 0.3333, '1 genre out of 3 items = 0.3333');
    assert.strictEqual(metrics.artistDiversity, 0.3333, '1 artist out of 3 items = 0.3333');
    assert.ok(metrics.noveltyScore < 0.2, 'Highly played mainstream tracks yield low novelty score (< 0.2)');

    console.log('✓ Test 2 Passed: Low diversity and popular songs yield lower scores correctly.');
  }

  // Test 3: Edge Case - Empty Recommendation List
  {
    const songs: DiversitySongItem[] = [];
    const metrics = RecommendationDiversityService.evaluateDiversityAndNovelty(songs, 100, 1000);

    assert.strictEqual(metrics.diversityScore, 0.0);
    assert.strictEqual(metrics.catalogCoverage, 0.0);
    assert.strictEqual(metrics.noveltyScore, 0.0);
    console.log('✓ Test 3 Passed: Empty recommendation list handled safely.');
  }

  // Test 4: Edge Case - Zero Catalog Items
  {
    const songs: DiversitySongItem[] = [
      { songId: 'song_1', genreId: 'genre_pop', artistId: 'artist_a', playCount: 10 },
    ];

    const coverage = RecommendationDiversityService.calculateCatalogCoverage(['song_1'], 0);
    assert.strictEqual(coverage, 0.0, 'Zero catalog count returns 0.0 coverage safely');
    console.log('✓ Test 4 Passed: Zero catalog count handled safely.');
  }

  console.log('🎉 All recommendation diversity and novelty service tests completed successfully.');
}
