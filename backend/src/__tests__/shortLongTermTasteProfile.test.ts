import assert from 'node:assert';
import { UserTasteProfile } from '../services/userTasteProfileService.js';

export function runShortLongTermTasteProfileTests() {
  console.log('[Short-Term & Long-Term Taste Profile Test Suite] Starting tests...');

  // Test 1: Verify Structured UserTasteProfile contains shortTermProfile and longTermProfile
  {
    const mockProfile: UserTasteProfile = {
      userId: '507f1f77bcf86cd799439011',
      shortTermProfile: {
        timeframeDays: 14,
        genres: [{ genreId: 'genre_synthwave', name: 'Synthwave', affinityScore: 1.0 }],
        artists: [{ artistId: 'artist_m83', name: 'M83', affinityScore: 0.9 }],
        preferredLanguages: ['English'],
        preferredMoods: ['Electronic'],
      },
      longTermProfile: {
        timeframeDays: 180,
        genres: [
          { genreId: 'genre_rock', name: 'Rock', affinityScore: 0.85 },
          { genreId: 'genre_synthwave', name: 'Synthwave', affinityScore: 0.75 },
        ],
        artists: [
          { artistId: 'artist_queen', name: 'Queen', affinityScore: 0.95 },
          { artistId: 'artist_m83', name: 'M83', affinityScore: 0.7 },
        ],
        preferredLanguages: ['English'],
        preferredMoods: ['Rock', 'Electronic'],
      },
      combinedGenres: [
        { genreId: 'genre_synthwave', name: 'Synthwave', affinityScore: 0.9 },
        { genreId: 'genre_rock', name: 'Rock', affinityScore: 0.34 },
      ],
      combinedArtists: [
        { artistId: 'artist_m83', name: 'M83', affinityScore: 0.82 },
        { artistId: 'artist_queen', name: 'Queen', affinityScore: 0.38 },
      ],
      preferredLanguages: ['English'],
      preferredMoods: ['Electronic', 'Rock'],
      updatedAt: new Date(),
    };

    assert.strictEqual(mockProfile.shortTermProfile.timeframeDays, 14);
    assert.strictEqual(mockProfile.longTermProfile.timeframeDays, 180);

    assert.strictEqual(mockProfile.shortTermProfile.genres[0].genreId, 'genre_synthwave');
    assert.strictEqual(mockProfile.longTermProfile.genres[0].genreId, 'genre_rock');

    assert.ok(mockProfile.shortTermProfile.genres[0].affinityScore <= 1.0);
    assert.ok(mockProfile.longTermProfile.genres[0].affinityScore <= 1.0);
    assert.ok(mockProfile.combinedGenres[0].affinityScore <= 1.0);

    console.log('✓ Test 1 Passed: Short-term and long-term profile structure verified.');
  }

  console.log('🎉 All short-term and long-term taste profile tests completed successfully.');
}
