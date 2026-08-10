import assert from 'node:assert';
import {
  ContentSimilarityService,
} from '../services/similarityService.js';
import {
  SongFeatureExtractionService,
  NormalizedSongFeatures,
} from '../services/songFeatureExtractionService.js';

export function runSimilarityEvaluationTests() {
  console.log('[Similarity Evaluation Test Suite] Starting tests...');

  // Test 1: Identical Songs
  {
    const songDoc = {
      _id: '507f1f77bcf86cd799439011',
      title: 'Midnight City',
      artist: '507f1f77bcf86cd799439022',
      genre: '507f1f77bcf86cd799439033',
      language: 'English',
      mood: 'Electronic',
      audioFeatures: { bpm: 125, energy: 0.8, danceability: 0.75, acousticness: 0.1, valence: 0.6 },
    };

    const featuresA = SongFeatureExtractionService.extractFeatures(songDoc);
    const featuresB = SongFeatureExtractionService.extractFeatures(songDoc);

    const score = ContentSimilarityService.calculateSimilarity(featuresA, featuresB);
    const { similarityScore, explanation } = ContentSimilarityService.calculateSimilarityWithExplanation(
      featuresA,
      featuresB
    );

    assert.strictEqual(score, 1.0, 'Identical song score should be 1.0');
    assert.strictEqual(similarityScore, 1.0, 'Identical similarity score explanation should be 1.0');
    assert.strictEqual(explanation.isIdentical, true, 'isIdentical should be true');
    console.log('✓ Test 1 Passed: Identical songs evaluated correctly.');
  }

  // Test 2: Completely Different Songs
  {
    const featuresA: NormalizedSongFeatures = {
      songId: 'song_1',
      artistId: 'artist_1',
      genreId: 'genre_synthwave',
      language: 'english',
      mood: 'energetic',
      normalizedBpm: 0.9,
      normalizedEnergy: 0.9,
      normalizedDanceability: 0.85,
      normalizedAcousticness: 0.05,
      normalizedValence: 0.8,
      numericalFeatureVector: [0.9, 0.9, 0.85, 0.05, 0.8],
    };

    const featuresB: NormalizedSongFeatures = {
      songId: 'song_2',
      artistId: 'artist_2',
      genreId: 'genre_classical',
      language: 'japanese',
      mood: 'melancholy',
      normalizedBpm: 0.1,
      normalizedEnergy: 0.1,
      normalizedDanceability: 0.1,
      normalizedAcousticness: 0.95,
      normalizedValence: 0.1,
      numericalFeatureVector: [0.1, 0.1, 0.1, 0.95, 0.1],
    };

    const { similarityScore, explanation } = ContentSimilarityService.calculateSimilarityWithExplanation(
      featuresA,
      featuresB
    );

    assert.ok(similarityScore < 0.4, 'Completely different songs score should be < 0.4');
    assert.strictEqual(explanation.matchingMetadata.genreMatch, false, 'genreMatch should be false');
    assert.strictEqual(explanation.matchingMetadata.artistMatch, false, 'artistMatch should be false');
    console.log('✓ Test 2 Passed: Completely different songs evaluated correctly.');
  }

  // Test 3: Missing Metadata
  {
    const emptySongDoc = {
      _id: '507f1f77bcf86cd799439044',
      title: 'Untagged Track',
    };

    const fullSongDoc = {
      _id: '507f1f77bcf86cd799439055',
      title: 'Full Track',
      artist: '507f1f77bcf86cd799439066',
      genre: '507f1f77bcf86cd799439077',
      audioFeatures: { bpm: 120, energy: 0.5 },
    };

    const featuresA = SongFeatureExtractionService.extractFeatures(emptySongDoc);
    const featuresB = SongFeatureExtractionService.extractFeatures(fullSongDoc);

    const result = ContentSimilarityService.calculateSimilarityWithExplanation(featuresA, featuresB);
    assert.ok(result.similarityScore >= 0 && result.similarityScore <= 1.0, 'Missing metadata score within bounds');
    console.log('✓ Test 3 Passed: Missing metadata handled safely.');
  }

  // Test 4: Zero-Value Feature Vectors
  {
    const featuresZeroA: NormalizedSongFeatures = {
      songId: 'song_zero_1',
      artistId: 'artist_a',
      genreId: 'genre_a',
      language: 'english',
      mood: 'chill',
      normalizedBpm: 0,
      normalizedEnergy: 0,
      normalizedDanceability: 0,
      normalizedAcousticness: 0,
      normalizedValence: 0,
      numericalFeatureVector: [0, 0, 0, 0, 0],
    };

    const featuresZeroB: NormalizedSongFeatures = {
      songId: 'song_zero_2',
      artistId: 'artist_b',
      genreId: 'genre_b',
      language: 'french',
      mood: 'ambient',
      normalizedBpm: 0,
      normalizedEnergy: 0,
      normalizedDanceability: 0,
      normalizedAcousticness: 0,
      normalizedValence: 0,
      numericalFeatureVector: [0, 0, 0, 0, 0],
    };

    const cosineScore = ContentSimilarityService.calculateVectorCosineSimilarity(
      featuresZeroA.numericalFeatureVector,
      featuresZeroB.numericalFeatureVector
    );

    assert.strictEqual(cosineScore, 0.0, 'Zero vector cosine similarity should be 0.0');
    assert.strictEqual(Number.isNaN(cosineScore), false, 'Cosine score should not be NaN');

    const result = ContentSimilarityService.calculateSimilarityWithExplanation(
      featuresZeroA,
      featuresZeroB
    );

    assert.strictEqual(Number.isNaN(result.similarityScore), false, 'Similarity score should not be NaN');
    assert.ok(result.similarityScore >= 0 && result.similarityScore <= 1.0, 'Zero vector score bounded');
    console.log('✓ Test 4 Passed: Zero-value feature vectors handled safely.');
  }

  console.log('🎉 All 4 similarity evaluation tests completed successfully.');
}
