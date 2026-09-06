import assert from 'node:assert';
import {
  TasteEvolutionTimelineService,
  TimelineEvent,
} from '../services/tasteEvolutionTimelineService.js';

export async function runTasteEvolutionTimelineTests() {
  console.log('[Taste Evolution Timeline Test Suite] Starting tests...');

  // Build a 3-snapshot sequence over 2 months
  const t1 = new Date('2026-06-01T10:00:00Z');
  const t2 = new Date('2026-07-01T10:00:00Z');
  const t3 = new Date('2026-08-01T10:00:00Z');

  const snapshot1: any = {
    _id: 'snap-1',
    userId: 'user-timeline-1',
    timestamp: t1,
    topGenres: [
      { name: 'Classical', affinityScore: 0.85, playCount: 40 },
      { name: 'Opera', affinityScore: 0.70, playCount: 25 },
    ],
    topArtists: [
      { name: 'Mozart', affinityScore: 0.90, playCount: 30 },
      { name: 'Puccini', affinityScore: 0.75, playCount: 20 },
    ],
    preferredMoods: [{ mood: 'Peaceful', affinityScore: 0.80 }],
    tendencies: {
      explorationPreference: 0.30,
      familiarityPreference: 0.80,
      diversityPreference: 0.35,
      discoveryTendency: 0.25,
    },
    listeningBehavior: {
      listenerArchetype: 'Loyalist',
      repeatListeningTendency: 0.80,
    },
  };

  const snapshot2: any = {
    _id: 'snap-2',
    userId: 'user-timeline-1',
    timestamp: t2,
    topGenres: [
      { name: 'Classical', affinityScore: 0.82, playCount: 50 },
      { name: 'Synthwave', affinityScore: 0.65, playCount: 18 }, // New emerging genre
      { name: 'Opera', affinityScore: 0.20, playCount: 26 },     // Faded from 0.70 to 0.20
    ],
    topArtists: [
      { name: 'Mozart', affinityScore: 0.85, playCount: 35 },
      { name: 'Kavinsky', affinityScore: 0.70, playCount: 16 },   // New emerging artist
      { name: 'Puccini', affinityScore: 0.22, playCount: 21 },    // Faded artist
    ],
    preferredMoods: [{ mood: 'Energetic', affinityScore: 0.75 }],
    tendencies: {
      explorationPreference: 0.65, // Jumped +0.35
      familiarityPreference: 0.55,
      diversityPreference: 0.60, // Jumped +0.25
      discoveryTendency: 0.60,
    },
    listeningBehavior: {
      listenerArchetype: 'Adventurer', // Shifted from Loyalist
      repeatListeningTendency: 0.50,
    },
  };

  const snapshot3: any = {
    _id: 'snap-3',
    userId: 'user-timeline-1',
    timestamp: t3,
    topGenres: [
      { name: 'Synthwave', affinityScore: 0.92, playCount: 45 }, // Became dominant
      { name: 'Classical', affinityScore: 0.50, playCount: 55 }, // Weakened
      { name: 'Cyberpunk', affinityScore: 0.70, playCount: 22 }, // Second wave emerging
    ],
    topArtists: [
      { name: 'Kavinsky', affinityScore: 0.94, playCount: 40 },
      { name: 'Gunship', affinityScore: 0.78, playCount: 20 },
      { name: 'Mozart', affinityScore: 0.45, playCount: 37 },
    ],
    preferredMoods: [{ mood: 'Energetic', affinityScore: 0.90 }],
    tendencies: {
      explorationPreference: 0.75,
      familiarityPreference: 0.75, // Familiarity re-increased around new core
      diversityPreference: 0.70,
      discoveryTendency: 0.70,
    },
    listeningBehavior: {
      listenerArchetype: 'Adventurer',
      repeatListeningTendency: 0.60,
    },
  };

  // Test 1: Chronological Ordering & Timeline Range
  {
    // Provide snapshots intentionally unsorted
    const timeline = TasteEvolutionTimelineService.generateTimelineFromSnapshots(
      'user-timeline-1',
      [snapshot3, snapshot1, snapshot2] // unordered
    );

    assert.strictEqual(timeline.totalSnapshotsAnalyzed, 3);
    assert.strictEqual(timeline.timelineRange.startDate?.getTime(), t1.getTime());
    assert.strictEqual(timeline.timelineRange.endDate?.getTime(), t3.getTime());
    assert.ok(timeline.timelineRange.totalDays >= 60, 'Total span should be ~61 days');

    // Verify chronological event order
    for (let i = 1; i < timeline.events.length; i++) {
      const prevTime = new Date(timeline.events[i - 1].timestamp).getTime();
      const currTime = new Date(timeline.events[i].timestamp).getTime();
      assert.ok(
        currTime >= prevTime,
        `Event at index ${i} (${currTime}) should be chronologically >= event at ${i - 1} (${prevTime})`
      );
    }

    console.log('✓ Test 1 Passed: Timeline strictly preserves chronological event ordering regardless of input array order.');
  }

  // Test 2: Event Type Classifications Detected
  {
    const timeline = TasteEvolutionTimelineService.generateTimelineFromSnapshots(
      'user-timeline-1',
      [snapshot1, snapshot2, snapshot3]
    );

    const eventTypes = new Set(timeline.events.map((e) => e.eventType));

    // Must represent all required event types
    assert.ok(eventTypes.has('TASTE_MILESTONE'), 'Must include baseline milestone');
    assert.ok(eventTypes.has('GENRE_STRENGTHENED'), 'Must detect genre strengthening');
    assert.ok(eventTypes.has('OLD_PREFERENCE_FADED'), 'Must detect old preference fading');
    assert.ok(eventTypes.has('NEW_ARTIST_EMERGED'), 'Must detect new artist emergence');
    assert.ok(eventTypes.has('EXPLORATION_INCREASED'), 'Must detect exploration increase');
    assert.ok(eventTypes.has('DIVERSITY_CHANGED'), 'Must detect diversity shift');
    assert.ok(eventTypes.has('ARCHETYPE_SHIFTED'), 'Must detect listener archetype shift');

    // Check specific events
    const operaFaded = timeline.events.find((e) => e.itemName === 'Opera' && e.eventType === 'OLD_PREFERENCE_FADED');
    assert.ok(operaFaded, 'Opera faded event must exist');

    const kavinskyEmerged = timeline.events.find((e) => e.itemName === 'Kavinsky' && e.eventType === 'NEW_ARTIST_EMERGED');
    assert.ok(kavinskyEmerged, 'Kavinsky emerged event must exist');

    const archetypeShift = timeline.events.find((e) => e.eventType === 'ARCHETYPE_SHIFTED');
    assert.ok(archetypeShift, 'Archetype shift event must exist');
    assert.strictEqual(archetypeShift?.previousValue, 'Loyalist');
    assert.strictEqual(archetypeShift?.currentValue, 'Adventurer');

    console.log('✓ Test 2 Passed: Meaningful events (strengthening, fading, emergence, tendencies, archetype) all represented.');
  }

  // Test 3: Structured, Machine-Readable Metadata & Milestones
  {
    const timeline = TasteEvolutionTimelineService.generateTimelineFromSnapshots(
      'user-timeline-1',
      [snapshot1, snapshot2, snapshot3]
    );

    for (const evt of timeline.events) {
      assert.ok(evt.id, 'Every event must have an id');
      assert.ok(evt.timestamp instanceof Date, 'Timestamp must be a valid Date');
      assert.ok(evt.periodLabel, 'Period label must be populated');
      assert.ok(evt.headline, 'Headline must be populated');
      assert.ok(evt.description, 'Description must be populated');
      assert.ok(evt.significance >= 0.0 && evt.significance <= 1.0, 'Significance must be [0.0, 1.0]');
    }

    assert.ok(timeline.milestones.length >= 1, 'Milestones should be collected');
    assert.ok(timeline.dominantPhases.length >= 1, 'Dominant phases should be identified');

    console.log('✓ Test 3 Passed: Timeline output is clean, machine-readable, and frontend-ready.');
  }

  // Test 4: Empty & Single-Snapshot Handling
  {
    const emptyTimeline = TasteEvolutionTimelineService.generateTimelineFromSnapshots('user-empty', []);
    assert.strictEqual(emptyTimeline.totalEvents, 0);
    assert.strictEqual(emptyTimeline.totalSnapshotsAnalyzed, 0);

    const singleTimeline = TasteEvolutionTimelineService.generateTimelineFromSnapshots('user-single', [snapshot1]);
    assert.strictEqual(singleTimeline.totalSnapshotsAnalyzed, 1);
    assert.strictEqual(singleTimeline.events.length, 1);
    assert.strictEqual(singleTimeline.events[0].eventType, 'TASTE_MILESTONE');

    console.log('✓ Test 4 Passed: Empty and single-snapshot cases handled gracefully.');
  }

  console.log('🎉 All Taste Evolution Timeline tests passed successfully!\n');
}

if (process.argv[1]?.includes('tasteEvolutionTimeline.test')) {
  runTasteEvolutionTimelineTests().catch((err) => {
    console.error('Taste Evolution Timeline test failed:', err);
    process.exit(1);
  });
}
