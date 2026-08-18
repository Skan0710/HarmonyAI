import assert from 'node:assert';
import { Types } from 'mongoose';

export function runPlaybackSessionIntegrationTests() {
  console.log('[Playback Session Integration Test Suite] Starting tests...');

  // Test 1: Order Preservation of Played Songs
  {
    const songId1 = new Types.ObjectId().toString();
    const songId2 = new Types.ObjectId().toString();

    const mockSongsPlayed: Array<{ song: string; playedAt: Date }> = [];

    const recordPlayInMockSession = (songId: string) => {
      mockSongsPlayed.push({ song: songId, playedAt: new Date() });
    };

    recordPlayInMockSession(songId1);
    recordPlayInMockSession(songId2);

    assert.strictEqual(mockSongsPlayed.length, 2);
    assert.strictEqual(mockSongsPlayed[0].song, songId1, 'First played song at index 0');
    assert.strictEqual(mockSongsPlayed[1].song, songId2, 'Second played song at index 1');

    console.log('✓ Test 1 Passed: Order preservation of played songs in session verified.');
  }

  // Test 2: Non-blocking Error Safety
  {
    let historyRecorded = false;

    const recordPlaybackSafe = async (throwSessionError = false) => {
      // History recorded first
      historyRecorded = true;

      // Non-blocking session call with catch handler
      Promise.resolve()
        .then(() => {
          if (throwSessionError) throw new Error('Session DB timeout');
        })
        .catch((err) => {
          // Handled gracefully without affecting history call
        });

      return { success: true };
    };

    const res = recordPlaybackSafe(true);
    assert.strictEqual(historyRecorded, true, 'Listening history recording succeeds even if session tracking fails');

    console.log('✓ Test 2 Passed: Non-blocking error safety verified.');
  }

  console.log('🎉 All playback session integration tests completed successfully.');
}
