import { isValidObjectId } from '../utils/validators.js';
import { IMusicDNASnapshot } from '../types/domainModels.js';
import { MusicDNASnapshotService } from './musicDnaSnapshotService.js';
import { UnifiedMusicDNAService } from './unifiedMusicDnaService.js';
import { UnifiedMusicDNA } from '../schemas/musicDnaSchema.js';

export type TasteTransformationArchetype =
  | 'Anchor / High Stability'
  | 'Dynamic Churn / High Volatility'
  | 'Gradual Evolver'
  | 'Transforming / Paradigm Shift'
  | 'New Listener / Baseline';

export interface TasteStabilityTransformationMetrics {
  userId: string;
  calculatedAt: Date;
  hasSufficientHistory: boolean;
  snapshotsAnalyzed: number;

  // The 5 Core Normalized Metrics [0.0, 1.0]
  tasteStability: number;          // Resistance to sudden taste divergence
  tasteVolatility: number;         // Variance of taste shifts over time
  preferencePersistence: number;   // Retention rate of foundational preferences
  discoveryTendency: number;       // Willingness to explore and adopt novel sounds
  transformationIntensity: number; // Net magnitude of structural taste shift

  // Descriptive Classification
  archetype: TasteTransformationArchetype;
  description: string;
  metricBreakdown: {
    topGenreRetentionRate: number;
    topArtistRetentionRate: number;
    consecutiveShiftVariance: number;
    netBaselineDistance: number;
    observedSpanDays: number;
  };
}

export interface StabilityMetricsConfig {
  minSnapshotsRequired?: number; // default 2
  baselineWeight?: number;       // default 0.35
  volatilityDampeningFactor?: number; // default 1.0
}

export const DEFAULT_STABILITY_CONFIG: Required<StabilityMetricsConfig> = {
  minSnapshotsRequired: 2,
  baselineWeight: 0.35,
  volatilityDampeningFactor: 1.0,
};

export class TasteStabilityTransformationService {
  /**
   * Pure metric calculation from an array of chronological snapshots and current DNA profile.
   */
  static calculateMetricsFromData(
    userId: string,
    snapshots: IMusicDNASnapshot[] = [],
    currentDNA?: UnifiedMusicDNA | null,
    config: StabilityMetricsConfig = {}
  ): TasteStabilityTransformationMetrics {
    const minSnapshots = config.minSnapshotsRequired ?? DEFAULT_STABILITY_CONFIG.minSnapshotsRequired;
    const calculatedAt = new Date();

    // 1. Guard against insufficient snapshot history
    if (!snapshots || snapshots.length < minSnapshots) {
      const fallbackStability = currentDNA?.temporalPreferences?.stabilityScore ?? 0.70;
      const fallbackDiscovery = currentDNA?.tendencies?.discoveryTendency ?? 0.50;

      return {
        userId,
        calculatedAt,
        hasSufficientHistory: false,
        snapshotsAnalyzed: snapshots ? snapshots.length : 0,
        tasteStability: Number(fallbackStability.toFixed(4)),
        tasteVolatility: 0.10, // Safe low volatility for baseline
        preferencePersistence: 0.80, // Default assume baseline persists
        discoveryTendency: Number(fallbackDiscovery.toFixed(4)),
        transformationIntensity: 0.05,
        archetype: 'New Listener / Baseline',
        description: 'Insufficient historical snapshot data to calculate long-term transformation metrics. Showing baseline estimates.',
        metricBreakdown: {
          topGenreRetentionRate: 1.0,
          topArtistRetentionRate: 1.0,
          consecutiveShiftVariance: 0.0,
          netBaselineDistance: 0.0,
          observedSpanDays: 0,
        },
      };
    }

    // Sort snapshots ascending (chronological)
    const sorted = [...snapshots].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const firstSnapshot = sorted[0];
    const latestSnapshot = sorted[sorted.length - 1];

    const observedSpanDays = Math.max(
      1,
      Number(
        ((new Date(latestSnapshot.timestamp).getTime() - new Date(firstSnapshot.timestamp).getTime()) /
          (1000 * 60 * 60 * 24)).toFixed(1)
      )
    );

    // 2. Compute Preference Persistence
    // Formula: What ratio of top-3 genres and artists from the initial snapshot remain in the latest top-5?
    const initialTopGenres = new Set(
      (firstSnapshot.topGenres || []).slice(0, 3).map((g) => g.name.toLowerCase())
    );
    const latestTopGenres = new Set(
      (latestSnapshot.topGenres || []).slice(0, 5).map((g) => g.name.toLowerCase())
    );

    let genreRetainedCount = 0;
    for (const g of initialTopGenres) {
      if (latestTopGenres.has(g)) genreRetainedCount++;
    }
    const topGenreRetentionRate = initialTopGenres.size > 0
      ? genreRetainedCount / initialTopGenres.size
      : 1.0;

    const initialTopArtists = new Set(
      (firstSnapshot.topArtists || []).slice(0, 3).map((a) => a.name.toLowerCase())
    );
    const latestTopArtists = new Set(
      (latestSnapshot.topArtists || []).slice(0, 5).map((a) => a.name.toLowerCase())
    );

    let artistRetainedCount = 0;
    for (const a of initialTopArtists) {
      if (latestTopArtists.has(a)) artistRetainedCount++;
    }
    const topArtistRetentionRate = initialTopArtists.size > 0
      ? artistRetainedCount / initialTopArtists.size
      : 1.0;

    const preferencePersistence = Number(
      ((topGenreRetentionRate * 0.5) + (topArtistRetentionRate * 0.5)).toFixed(4)
    );

    // 3. Compute Consecutive Shift Deltas & Volatility
    // Measures the variance of shift magnitudes between consecutive snapshot pairs
    const consecutiveDeltas: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];

      // Compare top genres
      const prevGenreScores = new Map(
        (prev.topGenres || []).map((g) => [g.name.toLowerCase(), g.affinityScore])
      );
      const currGenreScores = new Map(
        (curr.topGenres || []).map((g) => [g.name.toLowerCase(), g.affinityScore])
      );

      const allKeys = new Set([...prevGenreScores.keys(), ...currGenreScores.keys()]);
      let totalGenreDiff = 0;
      for (const k of allKeys) {
        const p = prevGenreScores.get(k) || 0;
        const c = currGenreScores.get(k) || 0;
        totalGenreDiff += Math.abs(c - p);
      }
      const avgGenreDiff = allKeys.size > 0 ? totalGenreDiff / allKeys.size : 0;

      // Compare tendency shift
      const prevExp = prev.tendencies?.explorationPreference ?? 0.5;
      const currExp = curr.tendencies?.explorationPreference ?? 0.5;
      const expDiff = Math.abs(currExp - prevExp);

      consecutiveDeltas.push((avgGenreDiff * 0.7) + (expDiff * 0.3));
    }

    // Mean delta
    const meanDelta = consecutiveDeltas.length > 0
      ? consecutiveDeltas.reduce((a, b) => a + b, 0) / consecutiveDeltas.length
      : 0;

    // Variance of deltas
    const variance = consecutiveDeltas.length > 1
      ? consecutiveDeltas.reduce((acc, d) => acc + Math.pow(d - meanDelta, 2), 0) /
        consecutiveDeltas.length
      : 0;

    // Volatility: combines average shift velocity with variance
    const rawVolatility = (meanDelta * 0.6) + (Math.sqrt(variance) * 0.4);
    const tasteVolatility = Number(Math.min(1.0, Math.max(0.0, rawVolatility * 1.5)).toFixed(4));

    // 4. Compute Transformation Intensity (Net Baseline Distance)
    // Compares initial snapshot vs latest snapshot directly
    const firstGenres = new Map((firstSnapshot.topGenres || []).map((g) => [g.name.toLowerCase(), g.affinityScore]));
    const latestGenres = new Map((latestSnapshot.topGenres || []).map((g) => [g.name.toLowerCase(), g.affinityScore]));
    const combinedGenreKeys = new Set([...firstGenres.keys(), ...latestGenres.keys()]);

    let netGenreDistance = 0;
    for (const key of combinedGenreKeys) {
      const f = firstGenres.get(key) || 0;
      const l = latestGenres.get(key) || 0;
      netGenreDistance += Math.abs(l - f);
    }
    const avgNetGenreDistance = combinedGenreKeys.size > 0
      ? netGenreDistance / combinedGenreKeys.size
      : 0;

    const netExpDistance = Math.abs(
      (latestSnapshot.tendencies?.explorationPreference ?? 0.5) -
      (firstSnapshot.tendencies?.explorationPreference ?? 0.5)
    );

    const netBaselineDistance = Number(
      ((avgNetGenreDistance * 0.7) + (netExpDistance * 0.3)).toFixed(4)
    );

    // Transformation Intensity is high if baseline distance is high and persistence is low
    const rawTransformation = (netBaselineDistance * 0.65) + ((1.0 - preferencePersistence) * 0.35);
    const transformationIntensity = Number(
      Math.min(1.0, Math.max(0.0, rawTransformation)).toFixed(4)
    );

    // 5. Compute Taste Stability
    // Stability is the inverse of volatility and shift magnitude, reinforced by preference persistence
    const rawStability = (1.0 - tasteVolatility) * 0.55 + preferencePersistence * 0.45;
    const tasteStability = Number(Math.min(1.0, Math.max(0.0, rawStability)).toFixed(4));

    // 6. Discovery Tendency
    const discoveryTendency = Number(
      (latestSnapshot.tendencies?.discoveryTendency ?? currentDNA?.tendencies?.discoveryTendency ?? 0.50).toFixed(4)
    );

    // Check immediate retention from the previous snapshot
    const prevImmediateGenres = new Set(
      (sorted[sorted.length - 2]?.topGenres || []).map((g) => g.name.toLowerCase())
    );
    let immediateRetained = 0;
    for (const g of prevImmediateGenres) {
      if (latestTopGenres.has(g)) immediateRetained++;
    }
    const immediateRetentionRate = prevImmediateGenres.size > 0
      ? immediateRetained / prevImmediateGenres.size
      : 0;

    // 7. Determine Archetype & Description
    let archetype: TasteTransformationArchetype = 'Gradual Evolver';
    let description = 'User taste evolves smoothly, blending persistent favorites with exploratory discoveries.';

    if (tasteStability >= 0.75 && tasteVolatility <= 0.25) {
      archetype = 'Anchor / High Stability';
      description = 'User possesses highly loyal, bedrock listening habits with strong resistance to taste drift.';
    } else if (sorted.length >= 3 && immediateRetentionRate <= 0.20 && topGenreRetentionRate <= 0.20) {
      archetype = 'Dynamic Churn / High Volatility';
      description = 'User experiences frequent rotations of favorite genres and artists without maintaining a persistent core.';
    } else if (transformationIntensity >= 0.55 && tasteStability < 0.65) {
      archetype = 'Transforming / Paradigm Shift';
      description = 'User has undergone a major taste metamorphosis, moving far from their starting musical baseline.';
    } else if (tasteStability >= 0.50 && preferencePersistence >= 0.40) {
      archetype = 'Gradual Evolver';
      description = 'User steadily incorporates new preferences while anchoring to core long-term artists.';
    }

    return {
      userId,
      calculatedAt,
      hasSufficientHistory: true,
      snapshotsAnalyzed: sorted.length,
      tasteStability,
      tasteVolatility,
      preferencePersistence,
      discoveryTendency,
      transformationIntensity,
      archetype,
      description,
      metricBreakdown: {
        topGenreRetentionRate: Number(topGenreRetentionRate.toFixed(4)),
        topArtistRetentionRate: Number(topArtistRetentionRate.toFixed(4)),
        consecutiveShiftVariance: Number(variance.toFixed(4)),
        netBaselineDistance,
        observedSpanDays,
      },
    };
  }

  /**
   * DB-backed method: Calculates stability and transformation metrics for a user.
   */
  static async calculateUserStabilityMetrics(
    userId: string,
    config: StabilityMetricsConfig = {}
  ): Promise<TasteStabilityTransformationMetrics> {
    if (!isValidObjectId(userId)) {
      throw new Error(`Invalid userId: ${userId}`);
    }

    const snapshots = await MusicDNASnapshotService.getSnapshots(userId, { sortAsc: true });
    const currentDNA = await UnifiedMusicDNAService.getOrGenerateProfile(userId);

    return this.calculateMetricsFromData(userId, snapshots, currentDNA, config);
  }
}
