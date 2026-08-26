import assert from 'node:assert';
import {
  RecommendationExplanationService,
  ExplanationSignalInput,
} from '../services/recommendationExplanationService.js';

export function runRecommendationExplanationServiceTests() {
  console.log('[Recommendation Explanation Service Test Suite] Starting tests...');

  // Test 1: User Taste & Genre Preference Explanations
  {
    const input: ExplanationSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439011',
        title: 'Midnight City',
        artist: { name: 'M83' },
        genre: { name: 'Synthwave' },
      },
      componentScores: {
        userTasteAffinityScore: 0.92,
      },
      tasteProfile: {
        combinedGenres: [
          { name: 'Synthwave', affinityScore: 0.95 },
          { name: 'Indie Rock', affinityScore: 0.60 },
        ],
      },
    };

    const explanation = RecommendationExplanationService.explainSong(input);

    assert.strictEqual(explanation.songId, '507f1f77bcf86cd799439011');
    assert.ok(explanation.explanations.length >= 2);

    const tasteExp = explanation.explanations.find((e) => e.type === 'USER_TASTE_SIMILARITY');
    const genreExp = explanation.explanations.find((e) => e.type === 'GENRE_PREFERENCE');

    assert.ok(tasteExp !== undefined);
    assert.ok(tasteExp.message.includes('92% affinity'));
    assert.ok(genreExp !== undefined);
    assert.ok(genreExp.message.includes('Synthwave'));
    assert.ok(genreExp.message.includes('95% affinity'));

    console.log('✓ Test 1 Passed: User taste and genre preference explanations verified.');
  }

  // Test 2: Content & Seed Song Similarity Explanation
  {
    const input: ExplanationSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439012',
        title: 'Nightcall',
        artist: { name: 'Kavinsky' },
      },
      similarityScore: 0.88,
      seedSong: {
        title: 'Tech Noir',
      },
    };

    const explanation = RecommendationExplanationService.explainSong(input);
    const contentExp = explanation.explanations.find((e) => e.type === 'CONTENT_SIMILARITY');

    assert.ok(contentExp !== undefined);
    assert.ok(contentExp.message.includes('"Tech Noir"'));
    assert.ok(contentExp.message.includes('88% match'));
    assert.strictEqual(contentExp.supportingValue, 0.88);

    console.log('✓ Test 2 Passed: Content and seed song similarity explanation verified.');
  }

  // Test 3: Collaborative Filtering Explanation
  {
    const input: ExplanationSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439013',
        title: 'Get Lucky',
        artist: { name: 'Daft Punk' },
      },
      componentScores: {
        collaborativeScore: 0.85,
      },
    };

    const explanation = RecommendationExplanationService.explainSong(input);
    const collabExp = explanation.explanations.find((e) => e.type === 'COLLABORATIVE_FILTERING');

    assert.ok(collabExp !== undefined);
    assert.ok(collabExp.message.includes('Listeners with musical tastes similar to yours'));
    assert.ok(collabExp.message.includes('85% match'));

    console.log('✓ Test 3 Passed: Collaborative filtering explanation verified.');
  }

  // Test 4: Artist Preference Explanation
  {
    const input: ExplanationSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439014',
        title: 'Starboy',
        artist: { name: 'The Weeknd' },
      },
      tasteProfile: {
        combinedArtists: [
          { name: 'The Weeknd', affinityScore: 0.90 },
        ],
      },
    };

    const explanation = RecommendationExplanationService.explainSong(input);
    const artistExp = explanation.explanations.find((e) => e.type === 'ARTIST_PREFERENCE');

    assert.ok(artistExp !== undefined);
    assert.ok(artistExp.message.includes('The Weeknd'));
    assert.ok(artistExp.message.includes('90% affinity'));

    console.log('✓ Test 4 Passed: Artist preference explanation verified.');
  }

  // Test 5: Mood, Energy, and Tempo Alignment
  {
    const input: ExplanationSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439015',
        title: 'High Voltage Rhythm',
        audioFeatures: {
          energy: 0.85,
          tempo: 128,
        },
      },
      sessionPreferences: {
        activeMood: 'Energetic',
        targetEnergy: 0.80,
        targetTempo: 125,
      },
    };

    const explanation = RecommendationExplanationService.explainSong(input);

    const moodExp = explanation.explanations.find((e) => e.type === 'MOOD_MATCH');
    const energyExp = explanation.explanations.find((e) => e.type === 'ENERGY_MATCH');
    const tempoExp = explanation.explanations.find((e) => e.type === 'TEMPO_MATCH');

    assert.ok(moodExp !== undefined && moodExp.message.includes('energetic'));
    assert.ok(energyExp !== undefined && energyExp.message.includes('high-energy'));
    assert.ok(tempoExp !== undefined && tempoExp.message.includes('128 BPM'));

    console.log('✓ Test 5 Passed: Mood, energy, and tempo explanations verified.');
  }

  // Test 6: Novelty and Diversity Signals
  {
    const input: ExplanationSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439016',
        title: 'Underground Gem',
      },
      noveltyScore: 0.85,
      diversityAdjustment: 0.12,
    };

    const explanation = RecommendationExplanationService.explainSong(input);

    const noveltyExp = explanation.explanations.find((e) => e.type === 'NOVELTY');
    const diversityExp = explanation.explanations.find((e) => e.type === 'DIVERSITY');

    assert.ok(noveltyExp !== undefined);
    assert.ok(noveltyExp.message.includes('fresh discovery'));
    assert.ok(diversityExp !== undefined);
    assert.ok(diversityExp.message.includes('curated variety'));

    console.log('✓ Test 6 Passed: Novelty and diversity explanations verified.');
  }

  // Test 7: Batch Explanations Processing
  {
    const batchInput: ExplanationSignalInput[] = [
      {
        song: { _id: '1', title: 'Song One' },
        componentScores: { userTasteAffinityScore: 0.8 },
      },
      {
        song: { _id: '2', title: 'Song Two' },
        componentScores: { collaborativeScore: 0.9 },
      },
    ];

    const batchResults = RecommendationExplanationService.explainBatch(batchInput);

    assert.strictEqual(batchResults.length, 2);
    assert.strictEqual(batchResults[0].songId, '1');
    assert.strictEqual(batchResults[1].songId, '2');

    console.log('✓ Test 7 Passed: Batch explanations processing verified.');
  }

  // Test 8: Structured Explanation Format & Importance Sorting
  {
    const input: ExplanationSignalInput = {
      song: { _id: '100', title: 'Ranked Track' },
      componentScores: {
        userTasteAffinityScore: 0.95,
        popularityScore: 0.50,
      },
    };

    const explanation = RecommendationExplanationService.explainSong(input);

    assert.ok(explanation.primaryExplanation.length > 0);
    assert.ok(explanation.summary.length > 0);
    assert.ok(explanation.confidenceScore >= 0 && explanation.confidenceScore <= 1.0);

    // Verify importance sorting descending
    for (let i = 0; i < explanation.explanations.length - 1; i++) {
      assert.ok(
        explanation.explanations[i].importanceScore >= explanation.explanations[i + 1].importanceScore,
        'Explanations must be sorted descending by importanceScore'
      );
    }

    console.log('✓ Test 8 Passed: Structured format and importance score ordering verified.');
  }

  console.log('🎉 All 8 recommendation explanation service tests completed successfully.');
}
