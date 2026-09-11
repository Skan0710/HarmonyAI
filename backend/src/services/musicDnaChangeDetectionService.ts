import { isValidObjectId } from '../utils/validators.js';
import { IMusicDNASnapshot } from '../models/MusicDNASnapshot.js';
import { MusicDNASnapshotService } from './musicDnaSnapshotService.js';
import { UnifiedMusicDNAService } from './unifiedMusicDnaService.js';
import { UnifiedMusicDNA } from '../schemas/musicDnaSchema.js';

export type ChangeClassification = 'increased' | 'decreased' | 'stable' | 'emerging' | 'fading';

export interface TasteItemChange {
  name: string;
  previousScore: number;
  currentScore: number;
  delta: number;
  classification: ChangeClassification;
  playCountDelta: number;
  explanation: string;
}

export interface MoodChange {
  mood: string;
  previousScore: number;
  currentScore: number;
  delta: number;
  classification: ChangeClassification;
  explanation: string;
}

export interface TendencyChange {
  dimension: string;
  previousScore: number;
  currentScore: number;
  delta: number;
  classification: 'increased' | 'decreased' | 'stable';
  explanation: string;
}

export interface BehaviorChange {
  metric: string;
  previousValue: number | string;
  currentValue: number | string;
  delta?: number;
  classification: 'increased' | 'decreased' | 'stable' | 'archetype_shift';
  explanation: string;
}

export interface ChangeDetectionThresholds {
  significanceThreshold: number; // default 0.08
  emergenceThreshold: number; // default 0.50
  fadingThreshold: number; // default 0.25
  highVelocityThreshold: number; // default 0.25
}

export const DEFAULT_CHANGE_THRESHOLDS: ChangeDetectionThresholds = {
  significanceThreshold: 0.08,
  emergenceThreshold: 0.50,
  fadingThreshold: 0.25,
  highVelocityThreshold: 0.25,
};

export interface MusicDNAChangeAnalysis {
  userId: string;
  hasSufficientHistory: boolean;
  timeframe: {
    previousTimestamp?: Date;
    currentTimestamp: Date;
    elapsedDays?: number;
  };
  overallShiftMagnitude: number; // [0.0, 1.0]
  tasteStabilityRating: 'highly_stable' | 'moderate_evolution' | 'rapid_transformation' | 'unrated';
  genreChanges: TasteItemChange[];
  artistChanges: TasteItemChange[];
  moodChanges: MoodChange[];
  tendencyChanges: TendencyChange[];
  behaviorChanges: BehaviorChange[];
  summary: {
    topIncreasingGenres: string[];
    topDecreasingGenres: string[];
    emergingGenres: string[];
    fadingGenres: string[];
    emergingArtists: string[];
    fadingArtists: string[];
    primaryTasteDirection: string;
  };
}

export class MusicDNAChangeDetectionService {
  /**
   * Classifies a numerical score delta between previous and current score.
   */
  static classifyChange(
    prev: number,
    curr: number,
    thresholds: ChangeDetectionThresholds = DEFAULT_CHANGE_THRESHOLDS
  ): ChangeClassification {
    const delta = curr - prev;

    // Emerging: Was absent or very low (< 0.20), but now >= emergenceThreshold (e.g. 0.50)
    if (prev < 0.20 && curr >= thresholds.emergenceThreshold) {
      return 'emerging';
    }

    // Fading: Was strong (>= 0.50), but has dropped below fadingThreshold (e.g. 0.25)
    if (prev >= 0.50 && curr < thresholds.fadingThreshold) {
      return 'fading';
    }

    // Meaningful increase
    if (delta >= thresholds.significanceThreshold) {
      return 'increased';
    }

    // Meaningful decrease
    if (delta <= -thresholds.significanceThreshold) {
      return 'decreased';
    }

    // Microscopic fluctuations treated as stable
    return 'stable';
  }

  /**
   * Pure comparator comparing two sets of taste items (genres or artists).
   */
  static compareTasteItems(
    previousItems: { name: string; affinityScore: number; playCount?: number }[] = [],
    currentItems: { name: string; affinityScore: number; playCount?: number }[] = [],
    itemType: 'genre' | 'artist',
    thresholds: ChangeDetectionThresholds = DEFAULT_CHANGE_THRESHOLDS
  ): TasteItemChange[] {
    const prevMap = new Map<string, { score: number; plays: number }>();
    for (const item of previousItems) {
      prevMap.set(item.name.toLowerCase(), {
        score: item.affinityScore,
        plays: item.playCount || 0,
      });
    }

    const currMap = new Map<string, { name: string; score: number; plays: number }>();
    for (const item of currentItems) {
      currMap.set(item.name.toLowerCase(), {
        name: item.name,
        score: item.affinityScore,
        plays: item.playCount || 0,
      });
    }

    const allKeys = new Set([...prevMap.keys(), ...currMap.keys()]);
    const changes: TasteItemChange[] = [];

    for (const key of allKeys) {
      const prev = prevMap.get(key) || { score: 0.0, plays: 0 };
      const curr = currMap.get(key) || { name: key, score: 0.0, plays: 0 };
      const name = curr.name || key;

      // Skip items with zero significance in both
      if (prev.score < 0.05 && curr.score < 0.05) continue;

      const delta = Number((curr.score - prev.score).toFixed(4));
      const playCountDelta = curr.plays - prev.plays;
      const classification = this.classifyChange(prev.score, curr.score, thresholds);

      let explanation = `${name} affinity is ${classification}`;
      if (classification === 'emerging') {
        explanation = `New rising interest in ${name} (rose from ${(prev.score * 100).toFixed(0)}% to ${(curr.score * 100).toFixed(0)}%)`;
      } else if (classification === 'fading') {
        explanation = `Declining habit in ${name} (dropped from ${(prev.score * 100).toFixed(0)}% to ${(curr.score * 100).toFixed(0)}%)`;
      } else if (classification === 'increased') {
        explanation = `${name} strengthened by +${(delta * 100).toFixed(1)}%`;
      } else if (classification === 'decreased') {
        explanation = `${name} decreased by ${(delta * 100).toFixed(1)}%`;
      } else {
        explanation = `${name} remained stable at ${(curr.score * 100).toFixed(0)}%`;
      }

      changes.push({
        name,
        previousScore: prev.score,
        currentScore: curr.score,
        delta,
        classification,
        playCountDelta,
        explanation,
      });
    }

    // Sort by absolute delta descending so the most meaningful shifts appear first
    return changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }

  /**
   * Pure comparator comparing preferred moods.
   */
  static compareMoods(
    previousMoods: { mood: string; affinityScore: number; playCount?: number }[] = [],
    currentMoods: { mood: string; affinityScore: number; playCount?: number }[] = [],
    thresholds: ChangeDetectionThresholds = DEFAULT_CHANGE_THRESHOLDS
  ): MoodChange[] {
    const prevMap = new Map<string, number>();
    for (const m of previousMoods) {
      prevMap.set(m.mood.toLowerCase(), m.affinityScore);
    }

    const currMap = new Map<string, { mood: string; score: number }>();
    for (const m of currentMoods) {
      currMap.set(m.mood.toLowerCase(), { mood: m.mood, score: m.affinityScore });
    }

    const allKeys = new Set([...prevMap.keys(), ...currMap.keys()]);
    const changes: MoodChange[] = [];

    for (const key of allKeys) {
      const prevScore = prevMap.get(key) ?? 0.0;
      const curr = currMap.get(key) || { mood: key, score: 0.0 };
      if (prevScore < 0.05 && curr.score < 0.05) continue;

      const delta = Number((curr.score - prevScore).toFixed(4));
      const classification = this.classifyChange(prevScore, curr.score, thresholds);

      changes.push({
        mood: curr.mood,
        previousScore: prevScore,
        currentScore: curr.score,
        delta,
        classification,
        explanation: `Mood '${curr.mood}' is ${classification} (delta: ${(delta * 100).toFixed(1)}%)`,
      });
    }

    return changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }

  /**
   * Compares tendency dimensions (exploration, familiarity, diversity, discovery).
   */
  static compareTendencies(
    prev: Record<string, number> = {},
    curr: Record<string, number> = {},
    thresholds: ChangeDetectionThresholds = DEFAULT_CHANGE_THRESHOLDS
  ): TendencyChange[] {
    const dimensions = ['explorationPreference', 'familiarityPreference', 'diversityPreference', 'discoveryTendency'];
    const changes: TendencyChange[] = [];

    for (const dim of dimensions) {
      const prevScore = prev[dim] ?? 0.5;
      const currScore = curr[dim] ?? 0.5;
      const delta = Number((currScore - prevScore).toFixed(4));

      let classification: 'increased' | 'decreased' | 'stable' = 'stable';
      if (delta >= thresholds.significanceThreshold) classification = 'increased';
      else if (delta <= -thresholds.significanceThreshold) classification = 'decreased';

      changes.push({
        dimension: dim,
        previousScore: prevScore,
        currentScore: currScore,
        delta,
        classification,
        explanation: `${dim} ${classification} from ${(prevScore * 100).toFixed(0)}% to ${(currScore * 100).toFixed(0)}%`,
      });
    }

    return changes;
  }

  /**
   * Compares listening behaviors and archetypes.
   */
  static compareBehaviors(
    prev: Record<string, any> = {},
    curr: Record<string, any> = {},
    thresholds: ChangeDetectionThresholds = DEFAULT_CHANGE_THRESHOLDS
  ): BehaviorChange[] {
    const changes: BehaviorChange[] = [];

    // Archetype check
    const prevArchetype = prev.listenerArchetype || 'Balanced Listener';
    const currArchetype = curr.listenerArchetype || 'Balanced Listener';
    if (prevArchetype !== currArchetype) {
      changes.push({
        metric: 'listenerArchetype',
        previousValue: prevArchetype,
        currentValue: currArchetype,
        classification: 'archetype_shift',
        explanation: `Listener persona evolved from ${prevArchetype} to ${currArchetype}`,
      });
    }

    // Numerical behaviors
    const metrics = [
      'repeatListeningTendency',
      'skipTendency',
      'sessionListeningIntensity',
      'preferenceStability',
    ];

    for (const metric of metrics) {
      const p = prev[metric] ?? 0.5;
      const c = curr[metric] ?? 0.5;
      const delta = Number((c - p).toFixed(4));
      let classification: 'increased' | 'decreased' | 'stable' = 'stable';
      if (delta >= thresholds.significanceThreshold) classification = 'increased';
      else if (delta <= -thresholds.significanceThreshold) classification = 'decreased';

      changes.push({
        metric,
        previousValue: p,
        currentValue: c,
        delta,
        classification,
        explanation: `${metric} ${classification} (delta: ${(delta * 100).toFixed(1)}%)`,
      });
    }

    return changes;
  }

  /**
   * Main comparator: Evaluates two snapshots or current DNA vs previous snapshot.
   */
  static detectTasteChanges(
    previous: IMusicDNASnapshot | any | null,
    current: IMusicDNASnapshot | UnifiedMusicDNA | any,
    thresholds: ChangeDetectionThresholds = DEFAULT_CHANGE_THRESHOLDS
  ): MusicDNAChangeAnalysis {
    const userId = current?.userId?.toString() || previous?.userId?.toString() || 'unknown';
    const currentTimestamp = current?.timestamp || current?.lastRefreshedAt || new Date();

    // Insufficient history guard
    if (!previous) {
      return {
        userId,
        hasSufficientHistory: false,
        timeframe: {
          currentTimestamp,
        },
        overallShiftMagnitude: 0.0,
        tasteStabilityRating: 'unrated',
        genreChanges: [],
        artistChanges: [],
        moodChanges: [],
        tendencyChanges: [],
        behaviorChanges: [],
        summary: {
          topIncreasingGenres: [],
          topDecreasingGenres: [],
          emergingGenres: [],
          fadingGenres: [],
          emergingArtists: [],
          fadingArtists: [],
          primaryTasteDirection: 'Insufficient historical snapshot data to detect changes',
        },
      };
    }

    const previousTimestamp = previous.timestamp || previous.createdAt || new Date();
    const elapsedDays = Math.max(
      0,
      Number(((currentTimestamp.getTime() - previousTimestamp.getTime()) / (1000 * 60 * 60 * 24)).toFixed(1))
    );

    // Normalize access whether previous/current is IMusicDNASnapshot or UnifiedMusicDNA
    const getGenres = (dna: any) => {
      if (Array.isArray(dna.topGenres)) return dna.topGenres;
      if (Array.isArray(dna.genreProfile?.topGenres)) {
        return dna.genreProfile.topGenres.map((g: any) => ({
          name: g.name,
          affinityScore: g.score ?? g.affinityScore ?? 0,
          playCount: g.playCount ?? 0,
        }));
      }
      return [];
    };

    const getArtists = (dna: any) => {
      if (Array.isArray(dna.topArtists)) return dna.topArtists;
      if (Array.isArray(dna.artistProfile?.strongestArtists)) {
        return dna.artistProfile.strongestArtists.map((a: any) => ({
          name: a.name,
          affinityScore: a.score ?? a.affinityScore ?? 0,
          playCount: a.playCount ?? 0,
        }));
      }
      return [];
    };

    const getMoods = (dna: any) => {
      if (Array.isArray(dna.preferredMoods)) {
        return dna.preferredMoods.map((m: any) => ({
          mood: m.mood || m.name,
          affinityScore: m.affinityScore ?? m.score ?? 0,
          playCount: m.playCount ?? 0,
        }));
      }
      if (Array.isArray(dna.moodProfile?.preferredMoods)) {
        return dna.moodProfile.preferredMoods.map((m: any) => ({
          mood: m.name,
          affinityScore: m.score ?? 0,
          playCount: m.playCount ?? 0,
        }));
      }
      return [];
    };

    const prevGenres = getGenres(previous);
    const currGenres = getGenres(current);
    const genreChanges = this.compareTasteItems(prevGenres, currGenres, 'genre', thresholds);

    const prevArtists = getArtists(previous);
    const currArtists = getArtists(current);
    const artistChanges = this.compareTasteItems(prevArtists, currArtists, 'artist', thresholds);

    const prevMoods = getMoods(previous);
    const currMoods = getMoods(current);
    const moodChanges = this.compareMoods(prevMoods, currMoods, thresholds);

    const prevTendencies = previous.tendencies || {};
    const currTendencies = current.tendencies || {};
    const tendencyChanges = this.compareTendencies(prevTendencies, currTendencies, thresholds);

    const prevBehavior = previous.listeningBehavior || {};
    const currBehavior = current.listeningBehavior || {};
    const behaviorChanges = this.compareBehaviors(prevBehavior, currBehavior, thresholds);

    // Compute overall taste shift magnitude
    const activeDeltas = [
      ...genreChanges.map((c) => Math.abs(c.delta)),
      ...artistChanges.map((c) => Math.abs(c.delta)),
      ...tendencyChanges.map((c) => Math.abs(c.delta)),
    ];

    const overallShiftMagnitude = activeDeltas.length > 0
      ? Number((activeDeltas.reduce((acc, d) => acc + d, 0) / activeDeltas.length).toFixed(4))
      : 0.0;

    let tasteStabilityRating: 'highly_stable' | 'moderate_evolution' | 'rapid_transformation' = 'moderate_evolution';
    if (overallShiftMagnitude < thresholds.significanceThreshold) {
      tasteStabilityRating = 'highly_stable';
    } else if (overallShiftMagnitude >= thresholds.highVelocityThreshold) {
      tasteStabilityRating = 'rapid_transformation';
    }

    // Collect summaries
    const emergingGenres = genreChanges.filter((c) => c.classification === 'emerging').map((c) => c.name);
    const fadingGenres = genreChanges.filter((c) => c.classification === 'fading').map((c) => c.name);
    const topIncreasingGenres = genreChanges.filter((c) => c.classification === 'increased').map((c) => c.name).slice(0, 3);
    const topDecreasingGenres = genreChanges.filter((c) => c.classification === 'decreased').map((c) => c.name).slice(0, 3);

    const emergingArtists = artistChanges.filter((c) => c.classification === 'emerging').map((c) => c.name);
    const fadingArtists = artistChanges.filter((c) => c.classification === 'fading').map((c) => c.name);

    let primaryTasteDirection = 'Taste profile remains consistent and stable.';
    if (emergingGenres.length > 0 || emergingArtists.length > 0) {
      const items = [...emergingGenres, ...emergingArtists].join(', ');
      primaryTasteDirection = `Emerging interest expanding in: ${items}`;
    } else if (topIncreasingGenres.length > 0) {
      primaryTasteDirection = `Preferences shifting toward: ${topIncreasingGenres.join(', ')}`;
    } else if (fadingGenres.length > 0) {
      primaryTasteDirection = `Preferences cooling down in: ${fadingGenres.join(', ')}`;
    }

    return {
      userId,
      hasSufficientHistory: true,
      timeframe: {
        previousTimestamp,
        currentTimestamp,
        elapsedDays,
      },
      overallShiftMagnitude,
      tasteStabilityRating,
      genreChanges,
      artistChanges,
      moodChanges,
      tendencyChanges,
      behaviorChanges,
      summary: {
        topIncreasingGenres,
        topDecreasingGenres,
        emergingGenres,
        fadingGenres,
        emergingArtists,
        fadingArtists,
        primaryTasteDirection,
      },
    };
  }

  /**
   * Fetches latest snapshots from DB and performs change detection for a user.
   */
  static async analyzeUserChanges(
    userId: string,
    thresholds: ChangeDetectionThresholds = DEFAULT_CHANGE_THRESHOLDS
  ): Promise<MusicDNAChangeAnalysis> {
    if (!isValidObjectId(userId)) {
      throw new Error(`Invalid userId: ${userId}`);
    }

    // 1. Get snapshot pair
    const { latest, previous, hasSufficientHistory } = await MusicDNASnapshotService.getSnapshotPair(userId);

    // If no previous snapshot exists, return safe insufficient history analysis
    if (!hasSufficientHistory || !latest) {
      const currentDNA = await UnifiedMusicDNAService.getOrGenerateProfile(userId);
      return this.detectTasteChanges(null, currentDNA, thresholds);
    }

    // 2. Perform comparison between previous snapshot and latest snapshot
    return this.detectTasteChanges(previous, latest, thresholds);
  }
}
