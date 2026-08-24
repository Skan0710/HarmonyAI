import assert from 'node:assert';
import {
  DedicatedPlaylistGenerationService,
  AIPlaylistGenerationInput,
  getPlaylistDurationConfig,
  updatePlaylistDurationConfig,
  resetPlaylistDurationConfig,
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

  // Test 2: Structured Track Output with Recommendation Scores & Formatting
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

  // Test 3: Duration Tolerance & Diagnostics Tracking
  {
    const input: AIPlaylistGenerationInput = {
      targetDurationMinutes: 15, // 900 seconds
      durationToleranceSeconds: 180, // +/- 3 minutes tolerance
    };

    DedicatedPlaylistGenerationService.generatePlaylist(input).then((result) => {
      assert.ok(result !== null);
      assert.ok(result.durationDiagnostics !== undefined);
      assert.strictEqual(result.durationDiagnostics?.targetDurationSeconds, 900);
      assert.strictEqual(result.durationDiagnostics?.durationToleranceSeconds, 180);
      assert.ok(typeof result.durationDiagnostics?.achievedDurationSeconds === 'number');
      assert.ok(typeof result.durationDiagnostics?.durationVarianceSeconds === 'number');
      assert.ok(typeof result.durationDiagnostics?.isWithinTolerance === 'boolean');
      assert.ok(typeof result.durationDiagnostics?.isDurationGoalMet === 'boolean');
      assert.ok(typeof result.durationDiagnostics?.duplicateTracksPrevented === 'number');

      console.log('✓ Test 3 Passed: Duration tolerance & diagnostics tracking verified.');
    });
  }

  // Test 4: Global Duration Configuration Management
  {
    const defaultConfig = getPlaylistDurationConfig();
    assert.strictEqual(defaultConfig.defaultToleranceSeconds, 120);

    const updated = updatePlaylistDurationConfig({ defaultToleranceSeconds: 90 });
    assert.strictEqual(updated.defaultToleranceSeconds, 90);

    resetPlaylistDurationConfig();
    assert.strictEqual(getPlaylistDurationConfig().defaultToleranceSeconds, 120);

    console.log('✓ Test 4 Passed: Global duration configuration management verified.');
  }

  // Test 5: Unauthenticated / Cold Start Graceful Handling
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

      console.log('✓ Test 5 Passed: Unauthenticated / cold-start fallback handled gracefully.');
    });
  }

  console.log('🎉 All dedicated AI playlist generation service tests completed successfully.');
}
