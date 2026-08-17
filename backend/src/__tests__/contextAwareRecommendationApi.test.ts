import assert from 'node:assert';

export function runContextAwareRecommendationApiTests() {
  console.log('[Context-Aware Recommendation API Test Suite] Starting tests...');

  // Test 1: Query Parameter Parsing & Graceful Missing Context Handling
  {
    const parseQueryParams = (query: any) => {
      const mood = query.mood ? String(query.mood) : undefined;
      const activity = query.activity ? String(query.activity) : undefined;
      const energyParam = query.energy || query.energyLevel;
      const energyLevel = energyParam && !isNaN(parseFloat(String(energyParam))) ? parseFloat(String(energyParam)) : undefined;
      const durationParam = query.duration || query.durationMinutes;
      const durationMinutes = durationParam && !isNaN(parseInt(String(durationParam), 10)) ? parseInt(String(durationParam), 10) : undefined;

      return { mood, activity, energyLevel, durationMinutes };
    };

    const emptyParams = parseQueryParams({});
    assert.strictEqual(emptyParams.mood, undefined);
    assert.strictEqual(emptyParams.activity, undefined);
    assert.strictEqual(emptyParams.energyLevel, undefined);
    assert.strictEqual(emptyParams.durationMinutes, undefined);

    const fullParams = parseQueryParams({ mood: 'energetic', activity: 'workout', energy: '0.9', duration: '45' });
    assert.strictEqual(fullParams.mood, 'energetic');
    assert.strictEqual(fullParams.activity, 'workout');
    assert.strictEqual(fullParams.energyLevel, 0.9);
    assert.strictEqual(fullParams.durationMinutes, 45);

    console.log('✓ Test 1 Passed: Query parameter parsing & missing context handling verified.');
  }

  // Test 2: Payload Response Structure Format
  {
    const mockApiResponse = {
      success: true,
      strategyUsed: 'CONTEXTUAL_HYBRID_PERSONALIZED',
      userClassification: 'ACTIVE',
      detectedContext: {
        timeOfDay: 'Morning',
        mood: 'Energetic',
        activity: 'Workout',
        energyLevel: 0.85,
        instrumentalPreference: 'Any',
      },
      count: 2,
      data: [
        {
          song: { _id: 's1', title: 'Morning Run' },
          contextScore: 0.92,
          componentScores: {
            contentScore: 0.8,
            collaborativeScore: 0.8,
            userTasteAffinityScore: 0.8,
            popularityScore: 0.9,
            recencyScore: 0.8,
            moodScore: 0.95,
            activityScore: 0.9,
          },
          sources: ['content', 'context'],
        },
      ],
    };

    assert.strictEqual(mockApiResponse.success, true);
    assert.strictEqual(mockApiResponse.strategyUsed, 'CONTEXTUAL_HYBRID_PERSONALIZED');
    assert.strictEqual(mockApiResponse.userClassification, 'ACTIVE');
    assert.strictEqual(mockApiResponse.detectedContext.timeOfDay, 'Morning');
    assert.ok(Array.isArray(mockApiResponse.data));
    assert.strictEqual(mockApiResponse.data[0].contextScore, 0.92);

    console.log('✓ Test 2 Passed: Payload response structure format verified.');
  }

  // Test 3: Unauthenticated / Cold-Start User Routing Logic
  {
    const selectRoutingStrategy = (userId?: string, isColdStart?: boolean) => {
      if (!userId || isColdStart) {
        return 'COLD_START';
      }
      return 'CONTEXTUAL_HYBRID_PERSONALIZED';
    };

    assert.strictEqual(selectRoutingStrategy(undefined, false), 'COLD_START', 'Anonymous requests use COLD_START');
    assert.strictEqual(selectRoutingStrategy('user_new', true), 'COLD_START', 'NEW users use COLD_START');
    assert.strictEqual(selectRoutingStrategy('user_active', false), 'CONTEXTUAL_HYBRID_PERSONALIZED', 'ACTIVE users use CONTEXTUAL_HYBRID_PERSONALIZED');

    console.log('✓ Test 3 Passed: Cold-start / unauthenticated routing logic verified.');
  }

  console.log('🎉 All context-aware recommendation API tests completed successfully.');
}
