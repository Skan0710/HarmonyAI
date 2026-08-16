import assert from 'node:assert';
import {
  validateAndSanitizePlaylistPreference,
  DEFAULT_PLAYLIST_PREFERENCES,
  AIPlaylistPreference,
} from '../schemas/aiPlaylistPreferenceSchema.js';

export function runAIPlaylistPreferenceSchemaTests() {
  console.log('[AI Playlist Preference Schema Test Suite] Starting tests...');

  // Test 1: Full Valid Preference Object Sanitization
  {
    const rawInput = {
      title: '  Synthwave Night Run  ',
      description: '  Energetic retro synthwave  ',
      requestedMood: 'Energetic',
      genres: ['Synthwave', '   ', 'Synthwave', 'Cyberpunk'],
      artists: ['M83', 'Kavinsky', 'M83'],
      language: 'English',
      energyLevel: 0.85,
      tempoPreference: 'fast',
      acousticPreference: 0.15,
      instrumentalPreference: 0.8,
      requestedSongCount: 15,
      excludedArtists: ['Artist X'],
      excludedGenres: ['Country'],
      searchKeywords: ['synthwave', 'night', 'synthwave'],
    };

    const sanitized = validateAndSanitizePlaylistPreference(rawInput);

    assert.strictEqual(sanitized.title, 'Synthwave Night Run');
    assert.strictEqual(sanitized.description, 'Energetic retro synthwave');
    assert.strictEqual(sanitized.requestedMood, 'Energetic');
    assert.deepStrictEqual(sanitized.genres, ['Synthwave', 'Cyberpunk'], 'Duplicate and empty genres sanitized');
    assert.deepStrictEqual(sanitized.artists, ['M83', 'Kavinsky'], 'Duplicate artists sanitized');
    assert.strictEqual(sanitized.energyLevel, 0.85);
    assert.strictEqual(sanitized.tempoPreference, 'fast');
    assert.strictEqual(sanitized.requestedSongCount, 15);

    console.log('✓ Test 1 Passed: Full preference object sanitization verified.');
  }

  // Test 2: Sensible Default Assignment for Missing / Invalid Fields
  {
    const rawInput = {
      title: '',
      energyLevel: 1.5, // Out of bounds -> should clamp to 1.0
      requestedSongCount: 99, // Out of bounds -> should clamp to 50
    };

    const sanitized = validateAndSanitizePlaylistPreference(rawInput);

    assert.strictEqual(sanitized.title, DEFAULT_PLAYLIST_PREFERENCES.title, 'Empty title assigned default');
    assert.strictEqual(sanitized.description, DEFAULT_PLAYLIST_PREFERENCES.description, 'Missing description assigned default');
    assert.strictEqual(sanitized.energyLevel, 1.0, 'Excessive energy level clamped to 1.0');
    assert.strictEqual(sanitized.requestedSongCount, 50, 'Excessive track count clamped to 50');
    assert.strictEqual(sanitized.tempoPreference, DEFAULT_PLAYLIST_PREFERENCES.tempoPreference);

    console.log('✓ Test 2 Passed: Sensible defaults & numeric clamping verified.');
  }

  // Test 3: Custom BPM Number Tempo Preference Parsing
  {
    const rawInput = {
      title: 'BPM Test',
      desiredTempoBpm: 142,
    };

    const sanitized = validateAndSanitizePlaylistPreference(rawInput);

    assert.strictEqual(sanitized.tempoPreference, 142, 'Desired BPM number preserved as tempoPreference');
    console.log('✓ Test 3 Passed: Custom BPM tempo preference parsing verified.');
  }

  console.log('🎉 All AI playlist preference schema tests completed successfully.');
}
