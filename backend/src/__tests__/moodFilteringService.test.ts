import assert from 'node:assert';
import { MoodFilteringService } from '../services/moodFilteringService.js';

export function runMoodFilteringServiceTests() {
  console.log('[Mood Filtering Service Test Suite] Starting tests...');

  const moodsToTest = ['happy', 'calm', 'energetic', 'sad', 'focused', 'romantic', 'relaxed'];

  // Test 1: Supported Mood Target Compatibility Scoring
  {
    for (const moodName of moodsToTest) {
      const song = {
        title: `${moodName} track`,
        mood: moodName,
        tags: [moodName],
        audioFeatures: { energy: 0.8, valence: 0.8, bpm: 120 },
      };

      const score = MoodFilteringService.calculateMoodCompatibilityScore(song, moodName);

      assert.strictEqual(typeof score, 'number');
      assert.ok(score >= 0.0 && score <= 1.0, `Score for ${moodName} must be bounded [0, 1]`);
      assert.ok(score > 0.6, `Direct mood match for ${moodName} must score high (> 0.6)`);
    }

    console.log('✓ Test 1 Passed: Supported moods (happy, calm, energetic, sad, focused, romantic, relaxed) compatibility scoring verified.');
  }

  // Test 2: Safe Handling of Missing Metadata
  {
    const missingMetadataSong = {
      title: 'Blank Metadata Song',
    };

    const score = MoodFilteringService.calculateMoodCompatibilityScore(missingMetadataSong, 'calm');

    assert.strictEqual(typeof score, 'number');
    assert.ok(score >= 0.0 && score <= 1.0, 'Missing metadata score must be bounded [0, 1]');
    assert.strictEqual(score, 0.4, 'Returns safe default baseline score when metadata is missing');

    console.log('✓ Test 2 Passed: Safe handling of missing metadata verified.');
  }

  // Test 3: Song Ranking by Mood Compatibility
  {
    const songs = [
      { id: 's1', title: 'Sad Song', mood: 'Sad', audioFeatures: { energy: 0.2, valence: 0.1, bpm: 70 } },
      { id: 's2', title: 'Energetic Song', mood: 'Energetic', audioFeatures: { energy: 0.95, valence: 0.8, bpm: 140 } },
    ];

    const ranked = MoodFilteringService.filterAndRankSongsByMood(songs, 'energetic');

    assert.strictEqual(ranked.length, 2);
    assert.strictEqual(ranked[0].song.id, 's2', 'Energetic song ranked first for energetic mood request');
    assert.ok(ranked[0].moodScore > ranked[1].moodScore, 'Higher compatibility score ranked first');

    console.log('✓ Test 3 Passed: Song ranking by mood compatibility verified.');
  }

  console.log('🎉 All mood filtering service tests completed successfully.');
}
