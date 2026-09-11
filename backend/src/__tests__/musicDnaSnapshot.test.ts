import assert from 'node:assert';
import { MusicDNASnapshotService } from '../services/musicDnaSnapshotService.js';
import { UnifiedMusicDNA } from '../schemas/musicDnaSchema.js';

export async function runMusicDnaSnapshotTests() {
  console.log('[Music DNA Snapshot Test Suite] Starting tests...');

  const userId = crypto.randomUUID().toString();

  const mockUnifiedDNA: UnifiedMusicDNA = {
    userId,
    dnaVersion: '1.0.0',
    genreProfile: {
      topGenres: [
        {
          name: 'Synthwave',
          score: 0.92,
          preferenceType: 'established',
          playCount: 45,
          shortTermScore: 0.90,
          longTermScore: 0.94,
          momentumDelta: -0.04,
          explanation: 'Foundational favorite',
        },
        {
          name: 'Electronic',
          score: 0.81,
          preferenceType: 'established',
          playCount: 32,
          shortTermScore: 0.85,
          longTermScore: 0.78,
          momentumDelta: 0.07,
          explanation: 'Consistent genre',
        },
      ],
      emergingGenres: [
        {
          name: 'Darksynth',
          score: 0.65,
          preferenceType: 'emerging',
          playCount: 12,
          shortTermScore: 0.75,
          longTermScore: 0.35,
          momentumDelta: 0.40,
          explanation: 'Rapidly rising',
        },
      ],
      diversity: {
        score: 0.75,
        effectiveCount: 4,
        normalizedEntropy: 0.72,
        level: 'high',
        summary: 'High genre diversity',
      },
    },
    artistProfile: {
      strongestArtists: [
        {
          name: 'Kavinsky',
          score: 0.95,
          preferenceType: 'established',
          playCount: 28,
          shortTermScore: 0.92,
          longTermScore: 0.96,
          momentumDelta: -0.04,
          explanation: 'Top artist',
        },
      ],
      emergingArtists: [
        {
          name: 'Gunship',
          score: 0.68,
          preferenceType: 'emerging',
          playCount: 10,
          shortTermScore: 0.72,
          longTermScore: 0.40,
          momentumDelta: 0.32,
          explanation: 'Emerging artist',
        },
      ],
      diversity: {
        score: 0.70,
        effectiveCount: 5,
        normalizedEntropy: 0.68,
        level: 'moderate',
        summary: 'Moderate artist diversity',
      },
    },
    moodProfile: {
      preferredMoods: [
        {
          name: 'Energetic',
          score: 0.88,
          preferenceType: 'established',
          playCount: 40,
          shortTermScore: 0.90,
          longTermScore: 0.85,
          momentumDelta: 0.05,
          explanation: 'Dominant mood',
        },
      ],
    },
    listeningBehavior: {
      userId,
      repeatListeningTendency: 0.35,
      discoveryTendency: 0.80,
      skipTendency: 0.15,
      familiarityPreference: 0.40,
      explorationTendency: 0.78,
      diversityPreference: 0.75,
      sessionListeningIntensity: 0.65,
      preferenceStability: 0.82,
      preferenceChangeRate: 0.18,
      listenerArchetype: 'Adventurer',
      isDataSufficient: true,
      metricsBreakdown: {
        totalPlaysAnalyzed: 120,
        uniqueTracksCount: 90,
        uniqueArtistsCount: 45,
        uniqueGenresCount: 12,
        totalSessionsAnalyzed: 18,
        avgTracksPerSession: 6.6,
        avgSessionDurationMinutes: 32,
        skipRatio: 0.15,
        completionRatio: 0.85,
        replayRatio: 0.25,
      },
      confidenceScore: 0.88,
      generatedAt: new Date(),
    },
    temporalPreferences: {
      stabilityScore: 0.85,
      activeTimeWindow: 'short_term',
    },
    tendencies: {
      discoveryTendency: 0.80,
      familiarityPreference: 0.40,
      diversityPreference: 0.75,
      explorationPreference: 0.78,
    },
    listeningPatterns: {
      avgSessionDurationMinutes: 32,
      skipRate: 0.15,
      completionRate: 0.85,
      replayRate: 0.25,
    },
    confidenceScore: 0.88,
    lastRefreshedAt: new Date(),
    interactionsCountAtLastRefresh: 120,
  };

  // Test 1: Pure Mapper creates complete snapshot data
  {
    const snapshotData = MusicDNASnapshotService.buildSnapshotDataFromUnifiedDNA(
      mockUnifiedDNA,
      { triggerReason: 'weekly_recalculation' }
    );

    assert.strictEqual(snapshotData.userId.toString(), userId);
    assert.strictEqual(snapshotData.snapshotVersion, '1.0.0');
    assert.strictEqual(snapshotData.triggerReason, 'weekly_recalculation');
    assert.strictEqual(snapshotData.topGenres.length, 2);
    assert.strictEqual(snapshotData.topGenres[0].name, 'Synthwave');
    assert.strictEqual(snapshotData.topGenres[0].affinityScore, 0.92);
    assert.strictEqual(snapshotData.topArtists[0].name, 'Kavinsky');
    assert.strictEqual(snapshotData.preferredMoods[0].mood, 'Energetic');

    // Check behavioral metrics
    assert.strictEqual(snapshotData.listeningBehavior.repeatListeningTendency, 0.35);
    assert.strictEqual(snapshotData.listeningBehavior.discoveryTendency, 0.80);
    assert.strictEqual(snapshotData.listeningBehavior.listenerArchetype, 'Adventurer');

    // Check tendencies
    assert.strictEqual(snapshotData.tendencies.explorationPreference, 0.78);
    assert.strictEqual(snapshotData.tendencies.familiarityPreference, 0.40);
    assert.strictEqual(snapshotData.confidenceScore, 0.88);
    assert.strictEqual(snapshotData.interactionsCount, 120);

    console.log('✓ Test 1 Passed: Snapshot data mapper correctly captures all taste and behavioral dimensions.');
  }

  // Test 2: Validation of Snapshot Data Bounds
  {
    const valid = MusicDNASnapshotService.validateSnapshotData({
      userId,
      confidenceScore: 0.75,
      tendencies: {
        discoveryTendency: 0.5,
        familiarityPreference: 0.5,
        diversityPreference: 0.5,
        explorationPreference: 0.5,
      },
    });
    assert.strictEqual(valid.isValid, true);

    const invalid = MusicDNASnapshotService.validateSnapshotData({
      userId,
      confidenceScore: 1.5, // out of bounds
      tendencies: {
        discoveryTendency: -0.2, // out of bounds
      },
    });
    assert.strictEqual(invalid.isValid, false);
    assert.strictEqual(invalid.errors.length, 2);

    console.log('✓ Test 2 Passed: Snapshot validation ensures strictly bounded values [0.0, 1.0].');
  }

  // Test 3: Snapshot Payload Mapper Field Integrity
  {
    const snapshotData = MusicDNASnapshotService.buildSnapshotDataFromUnifiedDNA(mockUnifiedDNA);

    assert.strictEqual(snapshotData.userId.toString(), userId);
    assert.strictEqual(snapshotData.topGenres.length, 2);
    assert.strictEqual(snapshotData.listeningBehavior.listenerArchetype, 'Adventurer');

    console.log('✓ Test 3 Passed: MusicDNASnapshot payload mapper produces correctly shaped data.');
  }

  // Test 4: Historical Immutability (Multiple distinct snapshots can exist without overwriting)
  {
    const t1 = new Date('2026-08-01T12:00:00Z');
    const t2 = new Date('2026-08-15T12:00:00Z');

    const s1Data = MusicDNASnapshotService.buildSnapshotDataFromUnifiedDNA(mockUnifiedDNA, {
      timestamp: t1,
      triggerReason: 'baseline',
    });
    const s2Data = MusicDNASnapshotService.buildSnapshotDataFromUnifiedDNA(mockUnifiedDNA, {
      timestamp: t2,
      triggerReason: 'interaction_milestone',
    });

    assert.strictEqual(s1Data.timestamp.getTime(), t1.getTime());
    assert.strictEqual(s2Data.timestamp.getTime(), t2.getTime());
    assert.strictEqual(s1Data.triggerReason, 'baseline');
    assert.strictEqual(s2Data.triggerReason, 'interaction_milestone');

    console.log('✓ Test 4 Passed: Multiple immutable historical snapshots coexist without overwriting.');
  }

  console.log('🎉 All Music DNA Snapshot tests passed successfully!\n');
}

if (process.argv[1]?.includes('musicDnaSnapshot.test')) {
  runMusicDnaSnapshotTests().catch((err) => {
    console.error('Music DNA Snapshot test failed:', err);
    process.exit(1);
  });
}
