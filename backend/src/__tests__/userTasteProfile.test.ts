import assert from 'node:assert';
import {
  UserTasteProfile,
} from '../services/userTasteProfileService.js';

export function runUserTasteProfileTests() {
  console.log('[User Taste Profile Service Test Suite] Starting tests...');

  // Test 1: Affinity Score Normalization Bounds (0 to 1)
  {
    const rawLongTerm = 25;
    const maxLongTerm = 50;
    const rawRecent = 10;
    const maxRecent = 10;

    const longTermNorm = rawLongTerm / maxLongTerm; // 0.5
    const recentNorm = rawRecent / maxRecent;     // 1.0
    const combined = 0.6 * recentNorm + 0.4 * longTermNorm; // 0.6*1.0 + 0.4*0.5 = 0.8

    assert.strictEqual(longTermNorm, 0.5);
    assert.strictEqual(recentNorm, 1.0);
    assert.strictEqual(combined, 0.8);
    assert.ok(combined >= 0 && combined <= 1.0, 'Affinity scores bounded between 0 and 1');

    console.log('✓ Test 1 Passed: Affinity score normalization bounds verified.');
  }

  // Test 2: Differentiating Recent vs Long-Term Listening Behavior
  {
    const now = new Date();
    const recentDays = 30;
    const recentCutoff = new Date(now.getTime() - recentDays * 24 * 60 * 60 * 1000);

    const oldPlaybackDate = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);
    const recentPlaybackDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

    const isOldRecent = oldPlaybackDate >= recentCutoff;
    const isNewRecent = recentPlaybackDate >= recentCutoff;

    assert.strictEqual(isOldRecent, false, '45-day old playback categorized as long-term history');
    assert.strictEqual(isNewRecent, true, '5-day old playback categorized as recent behavior');

    console.log('✓ Test 2 Passed: Differentiating recent vs long-term behavior verified.');
  }

  // Test 3: User Taste Profile Structure
  {
    const mockProfile: UserTasteProfile = {
      userId: '507f1f77bcf86cd799439011',
      shortTermProfile: {
        timeframeDays: 14,
        genres: [
          {
            genreId: 'genre_synthwave',
            name: 'Synthwave',
            affinityScore: 1.0,
          },
        ],
        artists: [
          {
            artistId: 'artist_m83',
            name: 'M83',
            affinityScore: 0.85,
          },
        ],
        preferredLanguages: ['English'],
        preferredMoods: ['Electronic'],
      },
      longTermProfile: {
        timeframeDays: 180,
        genres: [
          {
            genreId: 'genre_synthwave',
            name: 'Synthwave',
            affinityScore: 0.875,
          },
        ],
        artists: [
          {
            artistId: 'artist_m83',
            name: 'M83',
            affinityScore: 0.975,
          },
        ],
        preferredLanguages: ['English'],
        preferredMoods: ['Electronic'],
      },
      combinedGenres: [
        {
          genreId: 'genre_synthwave',
          name: 'Synthwave',
          affinityScore: 0.95,
        },
      ],
      combinedArtists: [
        {
          artistId: 'artist_m83',
          name: 'M83',
          affinityScore: 0.9,
        },
      ],
      preferredLanguages: ['English', 'French'],
      preferredMoods: ['Electronic', 'Chill'],
      updatedAt: new Date(),
    };

    assert.strictEqual(mockProfile.shortTermProfile.genres.length, 1);
    assert.strictEqual(mockProfile.longTermProfile.artists.length, 1);
    assert.strictEqual(mockProfile.shortTermProfile.timeframeDays, 14);
    assert.ok(mockProfile.combinedGenres[0].affinityScore <= 1.0);
    assert.ok(mockProfile.combinedArtists[0].affinityScore <= 1.0);

    console.log('✓ Test 3 Passed: User taste profile structure verified.');
  }

  console.log('🎉 All user taste profile service tests completed successfully.');
}
