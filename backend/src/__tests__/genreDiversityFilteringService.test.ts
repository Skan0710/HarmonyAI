import assert from 'node:assert';
import { GenreDiversityFilteringService } from '../services/genreDiversityFilteringService.js';
import { UserTasteProfile } from '../services/userTasteProfileService.js';
import {
  getGenreDiversityWeights,
  updateGenreDiversityWeights,
  resetGenreDiversityWeights,
} from '../config/recommendationConfig.js';

export function runGenreDiversityFilteringServiceTests() {
  console.log('[Genre Diversity Filtering Service Test Suite] Starting tests...');

  // Test 1: Preventing Single Genre Dominance (Default Diversity Concentration)
  {
    const candidates = [
      { id: '1', score: 0.99, genre: 'electronic' },
      { id: '2', score: 0.95, genre: 'electronic' },
      { id: '3', score: 0.92, genre: 'electronic' },
      { id: '4', score: 0.90, genre: 'electronic' },
      { id: '5', score: 0.88, genre: 'electronic' },
      { id: '6', score: 0.85, genre: 'rock' },
      { id: '7', score: 0.82, genre: 'jazz' },
      { id: '8', score: 0.80, genre: 'hip hop' },
    ];

    // For targetLimit = 5, default max concentration = 0.40 -> max 2 per genre
    const result = GenreDiversityFilteringService.applyGenreDiversity({
      items: candidates,
      targetLimit: 5,
      genreExtractor: (it) => it.genre,
      scoreExtractor: (it) => it.score,
    });

    assert.strictEqual(result.length, 5);
    const electronicTracks = result.filter((it) => it.genre === 'electronic');
    assert.strictEqual(electronicTracks.length, 2, 'Default concentration caps electronic tracks at 2 of 5');
    assert.ok(result.some((it) => it.genre === 'rock'), 'Includes rock to balance distribution');
    assert.ok(result.some((it) => it.genre === 'jazz'), 'Includes jazz to balance distribution');

    console.log('✓ Test 1 Passed: Single genre dominance prevention verified.');
  }

  // Test 2: Taste Profile Preference Increasing Acceptable Genre Concentration
  {
    const candidates = [
      { id: '1', score: 0.99, genre: 'synthwave' },
      { id: '2', score: 0.95, genre: 'synthwave' },
      { id: '3', score: 0.92, genre: 'synthwave' },
      { id: '4', score: 0.90, genre: 'synthwave' },
      { id: '5', score: 0.85, genre: 'rock' },
    ];

    const mockTasteProfile: UserTasteProfile = {
      userId: 'user_synth_lover',
      shortTermProfile: {
        timeframeDays: 7,
        genres: [{ genreId: 'g1', name: 'synthwave', affinityScore: 0.95 }],
        artists: [],
        preferredLanguages: [],
        preferredMoods: [],
      },
      longTermProfile: {
        timeframeDays: 90,
        genres: [{ genreId: 'g1', name: 'synthwave', affinityScore: 0.90 }],
        artists: [],
        preferredLanguages: [],
        preferredMoods: [],
      },
      combinedGenres: [{ genreId: 'g1', name: 'synthwave', affinityScore: 0.92 }],
      combinedArtists: [],
      preferredLanguages: [],
      preferredMoods: [],
      updatedAt: new Date(),
    };

    const result = GenreDiversityFilteringService.applyGenreDiversity({
      items: candidates,
      tasteProfile: mockTasteProfile,
      targetLimit: 4,
      genreExtractor: (it) => it.genre,
      scoreExtractor: (it) => it.score,
    });

    assert.strictEqual(result.length, 4);
    const synthTracks = result.filter((it) => it.genre === 'synthwave');
    assert.ok(synthTracks.length >= 3, 'User taste profile affinity allows higher synthwave concentration (>= 3 of 4)');

    console.log('✓ Test 2 Passed: Taste profile preference concentration scaling verified.');
  }

  // Test 3: Explicitly Requested Genres Allowing Full Concentration
  {
    const candidates = [
      { id: '1', score: 0.99, genre: 'jazz' },
      { id: '2', score: 0.95, genre: 'jazz' },
      { id: '3', score: 0.92, genre: 'jazz' },
      { id: '4', score: 0.90, genre: 'jazz' },
      { id: '5', score: 0.85, genre: 'pop' },
    ];

    const result = GenreDiversityFilteringService.applyGenreDiversity({
      items: candidates,
      requestedGenres: ['jazz'],
      targetLimit: 4,
      genreExtractor: (it) => it.genre,
      scoreExtractor: (it) => it.score,
    });

    assert.strictEqual(result.length, 4);
    const jazzTracks = result.filter((it) => it.genre === 'jazz');
    assert.strictEqual(jazzTracks.length, 4, 'Explicitly requested jazz genre allows full concentration');

    console.log('✓ Test 3 Passed: Explicitly requested genre full concentration verified.');
  }

  // Test 4: Configurable Genre Diversity Weights
  {
    const initial = getGenreDiversityWeights();
    assert.strictEqual(initial.defaultMaxGenreConcentration, 0.40);

    const updated = updateGenreDiversityWeights({ defaultMaxGenreConcentration: 0.60 });
    assert.strictEqual(updated.defaultMaxGenreConcentration, 0.60);
    assert.strictEqual(getGenreDiversityWeights().defaultMaxGenreConcentration, 0.60);

    const reset = resetGenreDiversityWeights();
    assert.strictEqual(reset.defaultMaxGenreConcentration, 0.40);

    console.log('✓ Test 4 Passed: Configurable genre diversity weights verified.');
  }

  console.log('🎉 All genre diversity filtering service tests completed successfully.');
}
