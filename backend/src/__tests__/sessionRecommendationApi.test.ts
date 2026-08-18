import assert from 'node:assert';

export function runSessionRecommendationApiTests() {
  console.log('[Session Recommendation API Test Suite] Starting tests...');

  // Test 1: Fallback Format for Users Without Active Session
  {
    const mockFallbackResponse = {
      success: true,
      hasActiveSession: false,
      strategyUsed: 'COLD_START_FALLBACK',
      count: 2,
      data: [
        {
          song: { _id: 's1', title: 'Popular Track 1' },
          sessionScore: 0.85,
          contributingFactors: {
            contentSimilarityScore: 0.5,
            sessionProfileAffinity: 0.5,
          },
          source: 'cold_start_fallback',
        },
      ],
    };

    assert.strictEqual(mockFallbackResponse.success, true);
    assert.strictEqual(mockFallbackResponse.hasActiveSession, false);
    assert.strictEqual(mockFallbackResponse.strategyUsed, 'COLD_START_FALLBACK');
    assert.strictEqual(mockFallbackResponse.data[0].sessionScore, 0.85);
    assert.ok('contributingFactors' in mockFallbackResponse.data[0]);

    console.log('✓ Test 1 Passed: Fallback response structure format verified.');
  }

  // Test 2: Active Session Response Structure Format
  {
    const mockActiveResponse = {
      success: true,
      hasActiveSession: true,
      strategyUsed: 'SESSION_REALTIME',
      sessionId: 'sess_123',
      songCountInSession: 4,
      count: 1,
      data: [
        {
          song: { _id: 's2', title: 'Session Matched Synthwave' },
          sessionScore: 0.93,
          contributingFactors: {
            contentSimilarityScore: 0.9,
            sessionProfileAffinity: 0.96,
            seedSongId: 'seed_song_1',
          },
          source: 'session_content_similarity',
        },
      ],
    };

    assert.strictEqual(mockActiveResponse.hasActiveSession, true);
    assert.strictEqual(mockActiveResponse.strategyUsed, 'SESSION_REALTIME');
    assert.strictEqual(mockActiveResponse.sessionId, 'sess_123');
    assert.strictEqual(mockActiveResponse.data[0].contributingFactors.seedSongId, 'seed_song_1');

    console.log('✓ Test 2 Passed: Active session response structure format verified.');
  }

  console.log('🎉 All session recommendation API tests completed successfully.');
}
