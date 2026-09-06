import assert from 'node:assert';
import {
  EmergingTasteDetectionService,
  DEFAULT_EMERGING_OPTIONS,
} from '../services/emergingTasteDetectionService.js';
import { UnifiedMusicDNA } from '../schemas/musicDnaSchema.js';

export async function runEmergingTasteDetectionTests() {
  console.log('[Emerging Taste Detection Test Suite] Starting tests...');

  // Test 1: One-off Interaction (playCount < minInteractionsThreshold: 3)
  {
    const result = EmergingTasteDetectionService.classifyPreferenceStage({
      name: 'Drill',
      playCount: 1, // Only 1 play!
      shortTermScore: 0.85,
      longTermScore: 0.0,
      momentumDelta: 0.85,
    });

    assert.strictEqual(result.stage, 'one_off_interaction');
    assert.strictEqual(result.emergenceConfidence, 0.0);
    assert.match(result.explanation, /Below threshold/i);

    console.log('✓ Test 1 Passed: One-off interaction correctly rejected from emerging status.');
  }

  // Test 2: Repeated Recent Interaction (playCount >= 3, high momentum, low longTermScore)
  {
    const result = EmergingTasteDetectionService.classifyPreferenceStage({
      name: 'Hyperpop',
      playCount: 6, // Repeated interaction
      shortTermScore: 0.82,
      longTermScore: 0.20,
      momentumDelta: 0.62,
    });

    assert.strictEqual(result.stage, 'emerging');
    assert.ok(result.emergenceConfidence > 0.5, 'Emergence confidence should be significant');
    assert.match(result.explanation, /new emerging interest/i);

    console.log('✓ Test 2 Passed: Repeated recent interaction with strong momentum correctly identified as emerging.');
  }

  // Test 3: Sustained Emerging Preference (present across multiple snapshots)
  {
    const result = EmergingTasteDetectionService.classifyPreferenceStage({
      name: 'Shoegaze',
      playCount: 12,
      shortTermScore: 0.88,
      longTermScore: 0.35,
      momentumDelta: 0.53,
      historicalEmerging: true, // Marked emerging in earlier snapshot
    });

    assert.strictEqual(result.stage, 'sustained_emerging');
    assert.ok(result.emergenceConfidence > 0.7, 'Sustained emergence should have elevated confidence');
    assert.match(result.explanation, /sustained emerging preference/i);

    console.log('✓ Test 3 Passed: Sustained emerging preference correctly upgraded across historical snapshots.');
  }

  // Test 4: Established Long-term Preference (longTermScore >= 0.60)
  {
    const result = EmergingTasteDetectionService.classifyPreferenceStage({
      name: 'Classic Rock',
      playCount: 85,
      shortTermScore: 0.90,
      longTermScore: 0.88, // High foundational score
      momentumDelta: 0.02,
    });

    assert.strictEqual(result.stage, 'established');
    assert.strictEqual(result.emergenceConfidence, 0.0);
    assert.match(result.explanation, /confirmed long-term established/i);

    console.log('✓ Test 4 Passed: Established foundational taste recognized and not mislabeled as emerging.');
  }

  // Test 5: Fading Preference (previously strong, but negative momentum <= -0.20)
  {
    const result = EmergingTasteDetectionService.classifyPreferenceStage({
      name: 'Trap',
      playCount: 5,
      shortTermScore: 0.30,
      longTermScore: 0.75, // Was strong previously
      momentumDelta: -0.45, // Heavy negative delta
    });

    assert.strictEqual(result.stage, 'fading');
    assert.strictEqual(result.emergenceConfidence, 0.0);
    assert.match(result.explanation, /fading/i);

    console.log('✓ Test 5 Passed: Fading preference identified by negative momentum drop.');
  }

  // Test 6: End-to-End Report Generation with Mock Profile
  {
    const mockDNA: any = {
      userId: 'user-emerging-report',
      genreProfile: {
        topGenres: [
          {
            name: 'Ambient',
            score: 0.90,
            playCount: 60,
            shortTermScore: 0.90,
            longTermScore: 0.88,
            momentumDelta: 0.02,
          },
          {
            name: 'Folk',
            score: 0.40,
            playCount: 15,
            shortTermScore: 0.20,
            longTermScore: 0.70,
            momentumDelta: -0.50,
          },
        ],
        emergingGenres: [
          {
            name: 'Midwest Indie',
            score: 0.75,
            playCount: 8,
            shortTermScore: 0.80,
            longTermScore: 0.15,
            momentumDelta: 0.65,
          },
        ],
      },
      artistProfile: {
        strongestArtists: [
          {
            name: 'Brian Eno',
            score: 0.95,
            playCount: 50,
            shortTermScore: 0.92,
            longTermScore: 0.94,
            momentumDelta: -0.02,
          },
        ],
        emergingArtists: [
          {
            name: 'Phoebe Bridgers',
            score: 0.78,
            playCount: 7,
            shortTermScore: 0.82,
            longTermScore: 0.20,
            momentumDelta: 0.62,
          },
        ],
      },
      moodProfile: {
        preferredMoods: [
          {
            name: 'Melancholic',
            score: 0.76,
            playCount: 9,
            shortTermScore: 0.80,
            longTermScore: 0.25,
            momentumDelta: 0.55,
          },
        ],
      },
      tendencies: {
        explorationPreference: 0.85,
      },
      listeningBehavior: {
        listenerArchetype: 'Adventurer',
      },
    };

    const mockSnapshots: any[] = [
      {
        tendencies: { explorationPreference: 0.60 }, // rose by +0.25
        listeningBehavior: { listenerArchetype: 'Loyalist' }, // archetype shifted
      },
    ];

    const report = EmergingTasteDetectionService.analyzeEmergingTastesFromData(mockDNA, mockSnapshots);

    assert.strictEqual(report.emergingGenres.length, 1);
    assert.strictEqual(report.emergingGenres[0].name, 'Midwest Indie');
    assert.strictEqual(report.emergingArtists.length, 1);
    assert.strictEqual(report.emergingArtists[0].name, 'Phoebe Bridgers');
    assert.strictEqual(report.emergingMoods.length, 1);
    assert.strictEqual(report.emergingMoods[0].name, 'Melancholic');

    assert.ok(report.establishedPreferences.genres.includes('Ambient'));
    assert.ok(report.establishedPreferences.artists.includes('Brian Eno'));
    assert.ok(report.fadingPreferences.genres.includes('Folk'));

    assert.strictEqual(report.emergingBehaviors.length, 2);
    assert.ok(report.summary.narrative.includes('Midwest Indie'));

    console.log('✓ Test 6 Passed: Full Emerging Taste Report generated successfully with genres, artists, moods, and behaviors.');
  }

  console.log('🎉 All Emerging Taste Detection tests passed successfully!\n');
}

if (process.argv[1]?.includes('emergingTasteDetection.test')) {
  runEmergingTasteDetectionTests().catch((err) => {
    console.error('Emerging Taste Detection test failed:', err);
    process.exit(1);
  });
}
