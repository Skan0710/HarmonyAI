import assert from 'node:assert';
import {
  TasteStabilityTransformationService,
  TasteTransformationArchetype,
} from '../services/tasteStabilityTransformationService.js';

export async function runTasteStabilityTransformationTests() {
  console.log('[Taste Stability & Transformation Test Suite] Starting tests...');

  // Test 1: User with Highly Stable Taste (Anchor / High Stability)
  {
    const snapshots: any[] = [
      {
        timestamp: new Date('2026-06-01'),
        topGenres: [
          { name: 'Metal', affinityScore: 0.90 },
          { name: 'Hard Rock', affinityScore: 0.85 },
        ],
        topArtists: [
          { name: 'Metallica', affinityScore: 0.92 },
          { name: 'Iron Maiden', affinityScore: 0.88 },
        ],
        tendencies: { explorationPreference: 0.25, discoveryTendency: 0.30 },
      },
      {
        timestamp: new Date('2026-07-01'),
        topGenres: [
          { name: 'Metal', affinityScore: 0.91 },
          { name: 'Hard Rock', affinityScore: 0.84 },
        ],
        topArtists: [
          { name: 'Metallica', affinityScore: 0.90 },
          { name: 'Iron Maiden', affinityScore: 0.89 },
        ],
        tendencies: { explorationPreference: 0.26, discoveryTendency: 0.31 },
      },
      {
        timestamp: new Date('2026-08-01'),
        topGenres: [
          { name: 'Metal', affinityScore: 0.89 },
          { name: 'Hard Rock', affinityScore: 0.86 },
        ],
        topArtists: [
          { name: 'Metallica', affinityScore: 0.93 },
          { name: 'Iron Maiden', affinityScore: 0.87 },
        ],
        tendencies: { explorationPreference: 0.24, discoveryTendency: 0.29 },
      },
    ];

    const metrics = TasteStabilityTransformationService.calculateMetricsFromData('user-anchor', snapshots);

    assert.strictEqual(metrics.hasSufficientHistory, true);
    assert.strictEqual(metrics.archetype, 'Anchor / High Stability');
    assert.ok(metrics.tasteStability >= 0.75, `Stability (${metrics.tasteStability}) should be >= 0.75`);
    assert.ok(metrics.tasteVolatility <= 0.25, `Volatility (${metrics.tasteVolatility}) should be <= 0.25`);
    assert.ok(metrics.preferencePersistence >= 0.90, 'Persistence should be very high');
    assert.ok(metrics.transformationIntensity <= 0.20, 'Transformation intensity should be very low');

    console.log('✓ Test 1 Passed: Highly stable listener recognized as Anchor with high stability and low volatility.');
  }

  // Test 2: User whose Taste Changes Frequently (Dynamic Churn / High Volatility)
  {
    const snapshots: any[] = [
      {
        timestamp: new Date('2026-06-01'),
        topGenres: [{ name: 'Country', affinityScore: 0.85 }],
        topArtists: [{ name: 'Johnny Cash', affinityScore: 0.85 }],
        tendencies: { explorationPreference: 0.50, discoveryTendency: 0.60 },
      },
      {
        timestamp: new Date('2026-07-01'),
        topGenres: [{ name: 'EDM', affinityScore: 0.90 }], // Completely switched
        topArtists: [{ name: 'Skrillex', affinityScore: 0.90 }],
        tendencies: { explorationPreference: 0.80, discoveryTendency: 0.85 },
      },
      {
        timestamp: new Date('2026-08-01'),
        topGenres: [{ name: 'Jazz', affinityScore: 0.88 }], // Switched again
        topArtists: [{ name: 'Miles Davis', affinityScore: 0.85 }],
        tendencies: { explorationPreference: 0.40, discoveryTendency: 0.70 },
      },
    ];

    const metrics = TasteStabilityTransformationService.calculateMetricsFromData('user-volatile', snapshots);

    assert.strictEqual(metrics.hasSufficientHistory, true);
    assert.strictEqual(metrics.archetype, 'Dynamic Churn / High Volatility');
    assert.ok(metrics.tasteVolatility >= 0.40, `Volatility (${metrics.tasteVolatility}) should be elevated`);
    assert.ok(metrics.preferencePersistence <= 0.40, `Persistence (${metrics.preferencePersistence}) should be low`);

    console.log('✓ Test 2 Passed: Erratic listener recognized as Dynamic Churn with high volatility and low persistence.');
  }

  // Test 3: User Gradually Developing New Preferences (Gradual Evolver)
  {
    const snapshots: any[] = [
      {
        timestamp: new Date('2026-06-01'),
        topGenres: [
          { name: 'Indie Rock', affinityScore: 0.85 },
          { name: 'Alternative', affinityScore: 0.75 },
        ],
        topArtists: [
          { name: 'Arctic Monkeys', affinityScore: 0.88 },
          { name: 'The Strokes', affinityScore: 0.80 },
        ],
        tendencies: { explorationPreference: 0.50, discoveryTendency: 0.55 },
      },
      {
        timestamp: new Date('2026-07-01'),
        topGenres: [
          { name: 'Indie Rock', affinityScore: 0.82 },
          { name: 'Dream Pop', affinityScore: 0.65 }, // Added dream pop
        ],
        topArtists: [
          { name: 'Arctic Monkeys', affinityScore: 0.84 },
          { name: 'Beach House', affinityScore: 0.68 },
        ],
        tendencies: { explorationPreference: 0.58, discoveryTendency: 0.62 },
      },
      {
        timestamp: new Date('2026-08-01'),
        topGenres: [
          { name: 'Dream Pop', affinityScore: 0.84 },
          { name: 'Indie Rock', affinityScore: 0.78 }, // Retained Indie Rock
          { name: 'Shoegaze', affinityScore: 0.65 },
        ],
        topArtists: [
          { name: 'Beach House', affinityScore: 0.86 },
          { name: 'Arctic Monkeys', affinityScore: 0.80 }, // Retained Arctic Monkeys
        ],
        tendencies: { explorationPreference: 0.65, discoveryTendency: 0.65 },
      },
    ];

    const metrics = TasteStabilityTransformationService.calculateMetricsFromData('user-gradual', snapshots);

    assert.strictEqual(metrics.hasSufficientHistory, true);
    assert.strictEqual(metrics.archetype, 'Gradual Evolver');
    assert.ok(metrics.tasteStability >= 0.50, `Stability (${metrics.tasteStability}) should be moderate`);
    assert.ok(metrics.preferencePersistence >= 0.50, `Persistence (${metrics.preferencePersistence}) should be solid`);

    console.log('✓ Test 3 Passed: Balanced user recognized as Gradual Evolver.');
  }

  // Test 4: User Experiencing Major Taste Shift (Transforming / Paradigm Shift)
  {
    const snapshots: any[] = [
      {
        timestamp: new Date('2026-06-01'),
        topGenres: [{ name: 'Acoustic Folk', affinityScore: 0.90 }],
        topArtists: [{ name: 'Bob Dylan', affinityScore: 0.92 }],
        tendencies: { explorationPreference: 0.20, discoveryTendency: 0.25 },
      },
      {
        timestamp: new Date('2026-08-01'),
        topGenres: [
          { name: 'Industrial Cyberpunk', affinityScore: 0.95 },
          { name: 'Midwest Emo', affinityScore: 0.70 },
        ],
        topArtists: [
          { name: 'Nine Inch Nails', affinityScore: 0.92 },
        ],
        tendencies: { explorationPreference: 0.85, discoveryTendency: 0.80 },
      },
    ];

    const metrics = TasteStabilityTransformationService.calculateMetricsFromData('user-transforming', snapshots);

    assert.strictEqual(metrics.hasSufficientHistory, true);
    assert.strictEqual(metrics.archetype, 'Transforming / Paradigm Shift');
    assert.ok(metrics.transformationIntensity >= 0.55, `Transformation (${metrics.transformationIntensity}) should be high`);

    console.log('✓ Test 4 Passed: Structural taste revolution recognized as Transforming / Paradigm Shift.');
  }

  // Test 5: Insufficient History (0 or 1 snapshot)
  {
    const singleSnapshot: any[] = [
      {
        timestamp: new Date('2026-08-01'),
        topGenres: [{ name: 'Pop', affinityScore: 0.70 }],
        tendencies: { explorationPreference: 0.50, discoveryTendency: 0.50 },
      },
    ];

    const metrics = TasteStabilityTransformationService.calculateMetricsFromData('user-new', singleSnapshot);

    assert.strictEqual(metrics.hasSufficientHistory, false);
    assert.strictEqual(metrics.archetype, 'New Listener / Baseline');
    assert.ok(metrics.tasteStability >= 0.60, 'Should return sensible default stability');
    assert.ok(metrics.tasteVolatility <= 0.20, 'Should not produce misleading high volatility');
    assert.strictEqual(metrics.transformationIntensity, 0.05);

    console.log('✓ Test 5 Passed: Sparse history handled gracefully without misleading spikes.');
  }

  // Test 6: Boundedness Verification [0.0, 1.0] across all metrics
  {
    const snapshots: any[] = [
      {
        timestamp: new Date('2026-07-01'),
        topGenres: [{ name: 'GenreA', affinityScore: 0.50 }],
        tendencies: { explorationPreference: 0.50, discoveryTendency: 0.50 },
      },
      {
        timestamp: new Date('2026-08-01'),
        topGenres: [{ name: 'GenreB', affinityScore: 0.99 }],
        tendencies: { explorationPreference: 0.99, discoveryTendency: 0.99 },
      },
    ];

    const metrics = TasteStabilityTransformationService.calculateMetricsFromData('user-bound', snapshots);

    const keys: (keyof typeof metrics)[] = [
      'tasteStability',
      'tasteVolatility',
      'preferencePersistence',
      'discoveryTendency',
      'transformationIntensity',
    ];

    for (const key of keys) {
      const val = metrics[key] as number;
      assert.ok(val >= 0.0 && val <= 1.0, `Metric ${key} (${val}) must be strictly bounded in [0.0, 1.0]`);
    }

    console.log('✓ Test 6 Passed: All metrics verified strictly bounded within [0.0, 1.0].');
  }

  console.log('🎉 All Taste Stability & Transformation tests passed successfully!\n');
}

if (process.argv[1]?.includes('tasteStabilityTransformation.test')) {
  runTasteStabilityTransformationTests().catch((err) => {
    console.error('Taste Stability & Transformation test failed:', err);
    process.exit(1);
  });
}
