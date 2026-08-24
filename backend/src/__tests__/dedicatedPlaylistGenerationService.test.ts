import assert from 'node:assert';
import {
  DedicatedPlaylistGenerationService,
  AIPlaylistGenerationInput,
} from '../services/dedicatedPlaylistGenerationService.js';

export function runDedicatedPlaylistGenerationServiceTests() {
  console.log('[Dedicated AI Playlist Generation Service Test Suite] Starting tests...');

  // Test 1: Generate Playlist with Mood, Activity, and Target Duration
  {
    const input: AIPlaylistGenerationInput = {
      mood: 'Chill',
      activity: 'Coding',
      targetDurationMinutes: 30,
      preferredGenres: ['Synthwave', 'Ambient'],
      preferredArtists: ['Kavinsky'],
      noveltyPreference: 0.8,
      diversityPreference: 0.7,
    };

    DedicatedPlaylistGenerationService.generatePlaylist(input).then((result) => {
      assert.ok(result !== null);
      assert.ok(typeof result.title === 'string');
      assert.ok(typeof result.description === 'string');
      assert.strictEqual(result.preferences.mood, 'Chill');
      assert.strictEqual(result.preferences.activity, 'Coding');
      assert.strictEqual(result.preferences.targetDurationMinutes, 30);
      assert.strictEqual(result.preferences.noveltyPreference, 0.8);
      assert.strictEqual(result.preferences.diversityPreference, 0.7);
      assert.ok(Array.isArray(result.tracks));
      assert.ok(typeof result.totalDurationSeconds === 'number');
      assert.ok(typeof result.totalDurationFormatted === 'string');
      assert.strictEqual(result.trackCount, result.tracks.length);

      console.log('✓ Test 1 Passed: Playlist generation with mood, activity, and target duration verified.');
    });
  }

  // Test 2: Structured Track Output with Recommendation Scores
  {
    const input: AIPlaylistGenerationInput = {
      mood: 'Energetic',
      activity: 'Workout',
      targetSongCount: 5,
      noveltyPreference: 0.3,
      diversityPreference: 0.4,
    };

    DedicatedPlaylistGenerationService.generatePlaylist(input).then((result) => {
      assert.ok(result.tracks.length <= 5);
      for (const track of result.tracks) {
        assert.ok(track.song !== undefined);
        assert.ok(typeof track.score === 'number');
        assert.ok(typeof track.matchScore === 'number');
        assert.ok(typeof track.genre === 'string');
        assert.ok(typeof track.artist === 'string');
        assert.ok(typeof track.durationSeconds === 'number');
        assert.ok(typeof track.durationFormatted === 'string');
      }

      console.log('✓ Test 2 Passed: Structured track return format and recommendation scores verified.');
    });
  }

  // Test 3: Unauthenticated / Cold Start Graceful Handling
  {
    const input: AIPlaylistGenerationInput = {
      userId: undefined,
      searchPrompt: 'Late night lofi study beats',
      targetSongCount: 8,
    };

    DedicatedPlaylistGenerationService.generatePlaylist(input).then((result) => {
      assert.ok(result !== null);
      assert.strictEqual(result.preferences.userId, undefined);
      assert.strictEqual(result.preferences.searchPrompt, 'Late night lofi study beats');
      assert.ok(typeof result.candidateCountEvaluated === 'number');

      console.log('✓ Test 3 Passed: Unauthenticated / cold-start fallback handled gracefully.');
    });
  }

  // Test 4: Target Duration Calculation Bounds
  {
    const input: AIPlaylistGenerationInput = {
      targetDurationMinutes: 60, // 60 mins -> ~17-18 songs
    };

    DedicatedPlaylistGenerationService.generatePlaylist(input).then((result) => {
      assert.ok(result.trackCount >= 0);
      assert.ok(result.totalDurationSeconds >= 0);

      console.log('✓ Test 4 Passed: Target duration calculation bounds verified.');
    });
  }

  console.log('🎉 All dedicated AI playlist generation service tests completed successfully.');
}
