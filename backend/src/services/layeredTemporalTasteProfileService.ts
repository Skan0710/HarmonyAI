import { Types } from 'mongoose';
import {
  TemporalPreferenceAggregationService,
  UserTemporalPreferenceAggregationResult,
  RawTemporalInteractionEvent,
  WindowPreferences,
} from './temporalPreferenceAggregationService.js';
import {
  getTemporalAggregationConfig,
  TemporalPreferenceAggregationConfig,
} from '../config/recommendationConfig.js';
import { ListeningHistory } from '../models/ListeningHistory.js';
import { User } from '../models/User.js';

export interface TasteAffinityItem {
  id?: string;
  name: string;
  score: number; // Normalized score [0.0, 1.0]
  rawWeight: number;
  interactionCount: number;
  lastInteractionAt: Date;
}

export interface AcousticProfileTarget {
  energy: number;
  tempo: number;
  valence?: number;
  danceability?: number;
}

export interface TemporalTasteLayer {
  layerName: 'short_term' | 'medium_term' | 'long_term';
  timeframeDays: number;
  role: 'immediate_momentum' | 'rotational_habits' | 'foundational_taste';
  genres: TasteAffinityItem[];
  artists: TasteAffinityItem[];
  moods: TasteAffinityItem[];
  acousticTargets?: AcousticProfileTarget;
  topGenre?: string;
  topArtist?: string;
  topMood?: string;
  totalInteractions: number;
  lastUpdated: Date;
}

export interface LayeredTasteProfileWeights {
  shortTermWeight: number;  // default: 0.50
  mediumTermWeight: number; // default: 0.30
  longTermWeight: number;   // default: 0.20
}

export interface PreferenceChangeSignal {
  name: string;
  category: 'genre' | 'artist' | 'mood';
  shortTermScore: number;
  longTermScore: number;
  changeDelta: number; // shortTermScore - longTermScore
  changePercentage: number;
  direction: 'rising' | 'declining' | 'emerging' | 'stable';
  explanation: string;
}

export interface StrongestChangingPreferences {
  topRising: PreferenceChangeSignal[];
  topDeclining: PreferenceChangeSignal[];
  topEmerging: PreferenceChangeSignal[];
  overallChanges: PreferenceChangeSignal[];
  tasteShiftSummary: string;
}

export interface UnifiedLayeredTasteProfile {
  userId: string;
  // Individual layers preserved strictly
  shortTerm: TemporalTasteLayer;
  mediumTerm: TemporalTasteLayer;
  longTerm: TemporalTasteLayer;
  // Unified / blended taste profile
  unifiedGenres: TasteAffinityItem[];
  unifiedArtists: TasteAffinityItem[];
  unifiedMoods: TasteAffinityItem[];
  unifiedAcousticTargets?: AcousticProfileTarget;
  // Strongest changing preferences across horizons
  strongestChangingPreferences?: StrongestChangingPreferences;
  // Metadata & diagnostics
  layerWeights: LayeredTasteProfileWeights;
  tasteStabilityScore: number; // [0.0, 1.0] (1.0 = highly stable taste, < 0.5 = active pivot)
  dominantTasteCategory?: string;
  totalInteractionsAnalyzed: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface LayeredTasteProfileOptions {
  weights?: Partial<LayeredTasteProfileWeights>;
  configOverride?: Partial<TemporalPreferenceAggregationConfig>;
  persist?: boolean;
  referenceDate?: Date;
}

export class LayeredTemporalTasteProfileService {
  /**
   * Calculates taste stability by measuring the cosine alignment between
   * short-term genre distribution and long-term genre distribution.
   * Returns a value between 0.0 (drastic taste shift) and 1.0 (consistent taste).
   */
  static calculateTasteStability(
    shortTermGenres: TasteAffinityItem[],
    longTermGenres: TasteAffinityItem[]
  ): number {
    if (shortTermGenres.length === 0 || longTermGenres.length === 0) {
      return 1.0; // Default to neutral/stable when insufficient data
    }

    const shortMap = new Map<string, number>();
    const longMap = new Map<string, number>();
    const allKeys = new Set<string>();

    shortTermGenres.forEach((g) => {
      const key = (g.id || g.name).toLowerCase();
      shortMap.set(key, g.score);
      allKeys.add(key);
    });

    longTermGenres.forEach((g) => {
      const key = (g.id || g.name).toLowerCase();
      longMap.set(key, g.score);
      allKeys.add(key);
    });

    let dotProduct = 0;
    let magShort = 0;
    let magLong = 0;

    for (const key of allKeys) {
      const valShort = shortMap.get(key) || 0;
      const valLong = longMap.get(key) || 0;
      dotProduct += valShort * valLong;
      magShort += valShort * valShort;
      magLong += valLong * valLong;
    }

    const magnitude = Math.sqrt(magShort) * Math.sqrt(magLong);
    if (magnitude === 0) return 1.0;

    const cosineSim = dotProduct / magnitude;
    return Number(Math.max(0.0, Math.min(1.0, cosineSim)).toFixed(4));
  }

  /**
   * Computes acoustic target averages (energy, tempo, valence, danceability) from a list of songs.
   */
  static extractAcousticTargets(
    songsWithFeatures: Array<{ audioFeatures?: any }>
  ): AcousticProfileTarget {
    let sumEnergy = 0;
    let sumTempo = 0;
    let sumValence = 0;
    let sumDanceability = 0;
    let count = 0;

    for (const item of songsWithFeatures) {
      const feat = item.audioFeatures;
      if (feat) {
        sumEnergy += typeof feat.energy === 'number' ? feat.energy : 0.5;
        sumTempo += typeof feat.tempo === 'number' ? feat.tempo : 120;
        sumValence += typeof feat.valence === 'number' ? feat.valence : 0.5;
        sumDanceability += typeof feat.danceability === 'number' ? feat.danceability : 0.5;
        count++;
      }
    }

    if (count === 0) {
      return { energy: 0.5, tempo: 120, valence: 0.5, danceability: 0.5 };
    }

    return {
      energy: Number((sumEnergy / count).toFixed(3)),
      tempo: Math.round(sumTempo / count),
      valence: Number((sumValence / count).toFixed(3)),
      danceability: Number((sumDanceability / count).toFixed(3)),
    };
  }

  /**
   * Maps an internal WindowPreferences structure into a first-class TemporalTasteLayer.
   */
  private static mapToTasteLayer(
    windowPrefs: WindowPreferences,
    role: 'immediate_momentum' | 'rotational_habits' | 'foundational_taste',
    acousticTargets?: AcousticProfileTarget,
    now: Date = new Date()
  ): TemporalTasteLayer {
    const genres: TasteAffinityItem[] = windowPrefs.genres.map((g) => ({
      id: g.id,
      name: g.name,
      score: g.preferenceScore,
      rawWeight: g.rawWeight,
      interactionCount: g.interactionCount,
      lastInteractionAt: g.lastInteractionAt,
    }));

    const artists: TasteAffinityItem[] = windowPrefs.artists.map((a) => ({
      id: a.id,
      name: a.name,
      score: a.preferenceScore,
      rawWeight: a.rawWeight,
      interactionCount: a.interactionCount,
      lastInteractionAt: a.lastInteractionAt,
    }));

    const moods: TasteAffinityItem[] = windowPrefs.moods.map((m) => ({
      name: m.name,
      score: m.preferenceScore,
      rawWeight: m.rawWeight,
      interactionCount: m.interactionCount,
      lastInteractionAt: m.lastInteractionAt,
    }));

    return {
      layerName: windowPrefs.timeWindow,
      timeframeDays: windowPrefs.timeframeDays,
      role,
      genres,
      artists,
      moods,
      acousticTargets,
      topGenre: genres.length > 0 ? genres[0].name : undefined,
      topArtist: artists.length > 0 ? artists[0].name : undefined,
      topMood: moods.length > 0 ? moods[0].name : undefined,
      totalInteractions: windowPrefs.totalInteractions,
      lastUpdated: now,
    };
  }

  /**
   * Combines individual temporal layers into unified lists using configurable layer weights.
   */
  static blendLayers(
    shortTerm: TemporalTasteLayer,
    mediumTerm: TemporalTasteLayer,
    longTerm: TemporalTasteLayer,
    weights: LayeredTasteProfileWeights
  ): {
    unifiedGenres: TasteAffinityItem[];
    unifiedArtists: TasteAffinityItem[];
    unifiedMoods: TasteAffinityItem[];
    unifiedAcousticTargets: AcousticProfileTarget;
  } {
    const totalWeight =
      weights.shortTermWeight + weights.mediumTermWeight + weights.longTermWeight;

    const blendList = (
      shortList: TasteAffinityItem[],
      mediumList: TasteAffinityItem[],
      longList: TasteAffinityItem[]
    ): TasteAffinityItem[] => {
      const keys = new Set<string>();
      const shortMap = new Map<string, TasteAffinityItem>();
      const medMap = new Map<string, TasteAffinityItem>();
      const longMap = new Map<string, TasteAffinityItem>();

      shortList.forEach((i) => {
        const k = i.id || i.name;
        keys.add(k);
        shortMap.set(k, i);
      });
      mediumList.forEach((i) => {
        const k = i.id || i.name;
        keys.add(k);
        medMap.set(k, i);
      });
      longList.forEach((i) => {
        const k = i.id || i.name;
        keys.add(k);
        longMap.set(k, i);
      });

      const blended: TasteAffinityItem[] = [];

      for (const k of keys) {
        const s = shortMap.get(k);
        const m = medMap.get(k);
        const l = longMap.get(k);

        const sScore = s ? s.score : 0;
        const mScore = m ? m.score : 0;
        const lScore = l ? l.score : 0;

        const blendedRaw =
          (sScore * weights.shortTermWeight +
            mScore * weights.mediumTermWeight +
            lScore * weights.longTermWeight) /
          Math.max(0.01, totalWeight);

        const count =
          (s?.interactionCount || 0) +
          (m?.interactionCount || 0) +
          (l?.interactionCount || 0);

        const dates = [
          s?.lastInteractionAt,
          m?.lastInteractionAt,
          l?.lastInteractionAt,
        ].filter(Boolean) as Date[];
        const lastDate =
          dates.length > 0
            ? new Date(Math.max(...dates.map((d) => d.getTime())))
            : new Date();

        blended.push({
          id: s?.id || m?.id || l?.id,
          name: s?.name || m?.name || l?.name || k,
          score: Number(blendedRaw.toFixed(4)),
          rawWeight: blendedRaw,
          interactionCount: count,
          lastInteractionAt: lastDate,
        });
      }

      // Re-normalize scores within [0.0, 1.0]
      const maxScore = Math.max(...blended.map((b) => b.score), 0);
      if (maxScore > 0) {
        blended.forEach((b) => {
          b.score = Number((b.score / maxScore).toFixed(4));
        });
      }

      return blended.sort((a, b) => b.score - a.score);
    };

    const unifiedGenres = blendList(shortTerm.genres, mediumTerm.genres, longTerm.genres);
    const unifiedArtists = blendList(shortTerm.artists, mediumTerm.artists, longTerm.artists);
    const unifiedMoods = blendList(shortTerm.moods, mediumTerm.moods, longTerm.moods);

    // Blend acoustic targets
    const sTargets = shortTerm.acousticTargets || { energy: 0.5, tempo: 120, valence: 0.5 };
    const mTargets = mediumTerm.acousticTargets || { energy: 0.5, tempo: 120, valence: 0.5 };
    const lTargets = longTerm.acousticTargets || { energy: 0.5, tempo: 120, valence: 0.5 };

    const blendedEnergy =
      (sTargets.energy * weights.shortTermWeight +
        mTargets.energy * weights.mediumTermWeight +
        lTargets.energy * weights.longTermWeight) /
      Math.max(0.01, totalWeight);

    const blendedTempo = Math.round(
      (sTargets.tempo * weights.shortTermWeight +
        mTargets.tempo * weights.mediumTermWeight +
        lTargets.tempo * weights.longTermWeight) /
        Math.max(0.01, totalWeight)
    );

    const blendedValence =
      ((sTargets.valence ?? 0.5) * weights.shortTermWeight +
        (mTargets.valence ?? 0.5) * weights.mediumTermWeight +
        (lTargets.valence ?? 0.5) * weights.longTermWeight) /
      Math.max(0.01, totalWeight);

    const unifiedAcousticTargets: AcousticProfileTarget = {
      energy: Number(blendedEnergy.toFixed(3)),
      tempo: blendedTempo,
      valence: Number(blendedValence.toFixed(3)),
    };

    return {
      unifiedGenres,
      unifiedArtists,
      unifiedMoods,
      unifiedAcousticTargets,
    };
  }

  /**
   * Pure builder converting a UserTemporalPreferenceAggregationResult into a UnifiedLayeredTasteProfile.
   */
  static buildFromAggregatedResult(
    userId: string,
    aggResult: UserTemporalPreferenceAggregationResult,
    options: LayeredTasteProfileOptions = {},
    acousticTargetsByWindow?: {
      shortTerm?: AcousticProfileTarget;
      mediumTerm?: AcousticProfileTarget;
      longTerm?: AcousticProfileTarget;
    }
  ): UnifiedLayeredTasteProfile {
    const config = getTemporalAggregationConfig();
    const weights: LayeredTasteProfileWeights = {
      shortTermWeight:
        options.weights?.shortTermWeight ?? config.shortTermBlendWeight ?? 0.50,
      mediumTermWeight:
        options.weights?.mediumTermWeight ?? config.mediumTermBlendWeight ?? 0.30,
      longTermWeight:
        options.weights?.longTermWeight ?? config.longTermBlendWeight ?? 0.20,
    };
    const now = options.referenceDate || new Date();

    // 1. Build discrete, preserved layers
    const shortTerm = this.mapToTasteLayer(
      aggResult.shortTerm,
      'immediate_momentum',
      acousticTargetsByWindow?.shortTerm,
      now
    );
    const mediumTerm = this.mapToTasteLayer(
      aggResult.mediumTerm,
      'rotational_habits',
      acousticTargetsByWindow?.mediumTerm,
      now
    );
    const longTerm = this.mapToTasteLayer(
      aggResult.longTerm,
      'foundational_taste',
      acousticTargetsByWindow?.longTerm,
      now
    );

    // 2. Blend layers into unified taste
    const { unifiedGenres, unifiedArtists, unifiedMoods, unifiedAcousticTargets } =
      this.blendLayers(shortTerm, mediumTerm, longTerm, weights);

    // 3. Compute taste stability score (cosine alignment between short-term and long-term)
    const tasteStabilityScore = this.calculateTasteStability(
      shortTerm.genres,
      longTerm.genres
    );

    // 4. Identify strongest changing preferences between short-term momentum and long-term baseline
    const strongestChangingPreferences = this.calculateStrongestChangingPreferences(
      shortTerm,
      longTerm
    );

    const totalInteractions =
      shortTerm.totalInteractions +
      mediumTerm.totalInteractions +
      longTerm.totalInteractions;

    return {
      userId,
      shortTerm,
      mediumTerm,
      longTerm,
      unifiedGenres,
      unifiedArtists,
      unifiedMoods,
      unifiedAcousticTargets,
      strongestChangingPreferences,
      layerWeights: weights,
      tasteStabilityScore,
      dominantTasteCategory: unifiedGenres.length > 0 ? unifiedGenres[0].name : undefined,
      totalInteractionsAnalyzed: totalInteractions,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Compares the user's short-term taste against foundational long-term taste to identify
   * the strongest changing preferences (emerging, rising/surging, and declining/cooling).
   */
  static calculateStrongestChangingPreferences(
    shortTerm: TemporalTasteLayer,
    longTerm: TemporalTasteLayer,
    limit = 10
  ): StrongestChangingPreferences {
    const changes: PreferenceChangeSignal[] = [];

    const analyzeCategory = (
      shortList: TasteAffinityItem[],
      longList: TasteAffinityItem[],
      category: 'genre' | 'artist' | 'mood'
    ) => {
      const shortMap = new Map<string, TasteAffinityItem>();
      const longMap = new Map<string, TasteAffinityItem>();
      const allNames = new Set<string>();

      shortList.forEach((item) => {
        const key = item.name.toLowerCase();
        shortMap.set(key, item);
        allNames.add(item.name);
      });

      longList.forEach((item) => {
        const key = item.name.toLowerCase();
        longMap.set(key, item);
        allNames.add(item.name);
      });

      for (const name of allNames) {
        const key = name.toLowerCase();
        const shortItem = shortMap.get(key);
        const longItem = longMap.get(key);

        const shortScore = shortItem ? shortItem.score : 0;
        const longScore = longItem ? longItem.score : 0;
        const delta = Number((shortScore - longScore).toFixed(4));

        if (shortScore === 0 && longScore === 0) continue;

        let direction: 'rising' | 'declining' | 'emerging' | 'stable' = 'stable';
        let explanation = '';
        const pct = longScore > 0
          ? Number(((delta / longScore) * 100).toFixed(1))
          : 100;

        if (shortScore > 0 && longScore === 0) {
          direction = 'emerging';
          explanation = `New discovery: ${name} recently entered listening rotations with a ${shortScore.toFixed(2)} score.`;
        } else if (delta >= 0.15) {
          direction = 'rising';
          explanation = `Surging: ${name} grew by ${(delta * 100).toFixed(1)}% above long-term affinity.`;
        } else if (delta <= -0.15) {
          direction = 'declining';
          explanation = `Cooling down: ${name} decreased by ${(Math.abs(delta) * 100).toFixed(1)}% compared to historical listening.`;
        } else {
          direction = 'stable';
          explanation = `${name} remains consistent with baseline listening habits.`;
        }

        changes.push({
          name,
          category,
          shortTermScore: shortScore,
          longTermScore: longScore,
          changeDelta: delta,
          changePercentage: pct,
          direction,
          explanation,
        });
      }
    };

    analyzeCategory(shortTerm.genres, longTerm.genres, 'genre');
    analyzeCategory(shortTerm.artists, longTerm.artists, 'artist');
    analyzeCategory(shortTerm.moods, longTerm.moods, 'mood');

    // Sort by absolute delta descending
    changes.sort((a, b) => Math.abs(b.changeDelta) - Math.abs(a.changeDelta));

    const topRising = changes.filter((c) => c.direction === 'rising').slice(0, limit);
    const topDeclining = changes.filter((c) => c.direction === 'declining').slice(0, limit);
    const topEmerging = changes.filter((c) => c.direction === 'emerging').slice(0, limit);
    const overallChanges = changes.slice(0, limit);

    let tasteShiftSummary = 'Your listening profile shows stable continuity across time horizons.';
    if (topEmerging.length > 0 && topRising.length > 0) {
      tasteShiftSummary = `Active taste evolution: ${topEmerging[0].name} recently emerged, while ${topRising[0].name} is experiencing a strong listening spike.`;
    } else if (topRising.length > 0) {
      tasteShiftSummary = `Surging interest in ${topRising.map((r) => r.name).slice(0, 2).join(' and ')} compared to foundational taste.`;
    } else if (topDeclining.length > 0) {
      tasteShiftSummary = `Rotation cooling down for ${topDeclining[0].name} while baseline favorites remain intact.`;
    }

    return {
      topRising,
      topDeclining,
      topEmerging,
      overallChanges,
      tasteShiftSummary,
    };
  }

  /**
   * Primary entry point: aggregates listening history, user favorites, and sessions,
   * generates short, medium, and long term layers, and unifies them into a complete layered profile.
   */
  static async generateLayeredTasteProfile(
    userId: string,
    options: LayeredTasteProfileOptions = {}
  ): Promise<UnifiedLayeredTasteProfile> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error(`Invalid userId for layered temporal taste profile: ${userId}`);
    }

    const refDate = options.referenceDate || new Date();

    // 1. Reuse existing TemporalPreferenceAggregationService
    const aggResult = await TemporalPreferenceAggregationService.aggregateUserPreferences(
      userId,
      {
        configOverride: options.configOverride,
        persist: options.persist,
        referenceDate: refDate,
      }
    );

    // 2. Fetch acoustic features from recent listening history for each timeframe
    const config = getTemporalAggregationConfig();
    const shortTermCutoff = new Date(refDate.getTime() - config.shortTermDays * 86400000);
    const mediumTermCutoff = new Date(refDate.getTime() - config.mediumTermDays * 86400000);
    const longTermCutoff = new Date(refDate.getTime() - config.longTermDays * 86400000);

    const historyDocs = await ListeningHistory.find({
      user: userId,
      playedAt: { $gte: longTermCutoff },
    })
      .populate('song', 'audioFeatures')
      .lean();

    const shortSongs: any[] = [];
    const mediumSongs: any[] = [];
    const longSongs: any[] = [];

    for (const h of historyDocs) {
      if (!h.song) continue;
      const t = new Date(h.playedAt).getTime();
      if (t >= shortTermCutoff.getTime()) shortSongs.push(h.song);
      if (t >= mediumTermCutoff.getTime()) mediumSongs.push(h.song);
      longSongs.push(h.song);
    }

    const acousticTargets = {
      shortTerm: this.extractAcousticTargets(shortSongs),
      mediumTerm: this.extractAcousticTargets(mediumSongs),
      longTerm: this.extractAcousticTargets(longSongs),
    };

    // 3. Build unified profile preserving individual layers
    return this.buildFromAggregatedResult(userId, aggResult, options, acousticTargets);
  }

  /**
   * Convenience method to generate a layered profile directly from an in-memory event stream.
   * Reuses TemporalPreferenceAggregationService.aggregateFromEvents.
   */
  static generateFromEvents(
    userId: string,
    events: RawTemporalInteractionEvent[],
    options: LayeredTasteProfileOptions = {}
  ): UnifiedLayeredTasteProfile {
    const aggResult = TemporalPreferenceAggregationService.aggregateFromEvents(
      userId,
      events,
      {
        configOverride: options.configOverride,
        referenceDate: options.referenceDate,
      }
    );

    return this.buildFromAggregatedResult(userId, aggResult, options);
  }
}
