import { Types } from 'mongoose';
import {
  TemporalPreference,
  TemporalTimeWindow,
  TimeWindow,
} from '../models/TemporalPreference.js';
import { ListeningHistory } from '../models/ListeningHistory.js';
import { ListeningSession } from '../models/ListeningSession.js';
import { User } from '../models/User.js';
import { Song } from '../models/Song.js';
import {
  TemporalPreferenceAggregationConfig,
  getTemporalAggregationConfig,
  PreferenceDecayModel,
} from '../config/recommendationConfig.js';

export interface DecayExplanation {
  decayModel: PreferenceDecayModel;
  eventDate: Date;
  referenceDate: Date;
  eventAgeDays: number;
  decayFactor: number;
  baseWeight: number;
  effectiveWeight: number;
  minWeightFloor: number;
  halfLifeDays?: number;
  linearMaxDays?: number;
  summary: string;
}

export interface RawTemporalInteractionEvent {
  songId?: string;
  genreId?: string;
  genreName?: string;
  artistId?: string;
  artistName?: string;
  mood?: string;
  action: 'play' | 'complete' | 'replay' | 'like' | 'favorite' | 'skip' | string;
  timestamp: Date;
  playDurationSeconds?: number;
}

export interface TemporalPreferenceScore {
  id?: string;
  name: string;
  preferenceScore: number;
  interactionCount: number;
  lastInteractionAt: Date;
  timeWindow: TemporalTimeWindow;
  rawWeight: number;
  decayExplanation?: string;
}

export interface WindowPreferences {
  timeWindow: TemporalTimeWindow;
  timeframeDays: number;
  genres: TemporalPreferenceScore[];
  artists: TemporalPreferenceScore[];
  moods: TemporalPreferenceScore[];
  totalInteractions: number;
}

export interface UserTemporalPreferenceAggregationResult {
  userId: string;
  shortTerm: WindowPreferences;
  mediumTerm: WindowPreferences;
  longTerm: WindowPreferences;
  blendedGenres: TemporalPreferenceScore[];
  blendedArtists: TemporalPreferenceScore[];
  blendedMoods: TemporalPreferenceScore[];
  persistedCount?: number;
  updatedAt: Date;
}

export interface AggregateTemporalOptions {
  configOverride?: Partial<TemporalPreferenceAggregationConfig>;
  persist?: boolean;
  referenceDate?: Date;
}

export class TemporalPreferenceAggregationService {
  /**
   * Calculates time-based preference decay factor using the configured decay function.
   * Simple, modular, and explainable.
   * Supports 'exponential', 'linear', and 'step' decay models.
   *
   * - 'exponential': Decays smoothly based on half-life (W = 0.5 ^ (age / halfLife)).
   * - 'linear': Decays linearly across maxDays towards minFloor.
   * - 'step': Applies step brackets based on discrete time age tiers.
   */
  static calculateTimeDecay(
    eventDate: Date,
    halfLifeDays: number,
    config: TemporalPreferenceAggregationConfig = getTemporalAggregationConfig(),
    referenceDate: Date = new Date()
  ): number {
    const ageMs = Math.max(0, referenceDate.getTime() - new Date(eventDate).getTime());
    const ageInDays = ageMs / (1000 * 60 * 60 * 24);
    const minFloor = config.minWeightFloor ?? 0.05;

    switch (config.decayModel) {
      case 'linear': {
        const maxDays = Math.max(1, config.linearDecayMaxDays || 180);
        if (ageInDays >= maxDays) return minFloor;
        const slope = (1.0 - minFloor) / maxDays;
        const linearFactor = 1.0 - slope * ageInDays;
        return Number(Math.max(minFloor, Math.min(1.0, linearFactor)).toFixed(4));
      }

      case 'step': {
        const brackets = config.stepDecayBrackets || [
          { maxDays: 7, multiplier: 1.0 },
          { maxDays: 30, multiplier: 0.70 },
          { maxDays: 90, multiplier: 0.40 },
          { maxDays: 180, multiplier: 0.15 },
        ];
        const matched = brackets.find((b) => ageInDays <= b.maxDays);
        if (matched) {
          return Number(Math.max(minFloor, Math.min(1.0, matched.multiplier)).toFixed(4));
        }
        return minFloor;
      }

      case 'exponential':
      default: {
        const decayed = Math.pow(0.5, ageInDays / Math.max(0.5, halfLifeDays));
        return Number(Math.max(minFloor, Math.min(1.0, decayed)).toFixed(4));
      }
    }
  }

  /**
   * Backwards-compatible alias for calculateTimeDecay in exponential mode.
   */
  static calculateRecencyDecay(
    eventDate: Date,
    halfLifeDays: number,
    minFloor: number = 0.05,
    referenceDate: Date = new Date()
  ): number {
    const config = {
      ...getTemporalAggregationConfig(),
      decayModel: 'exponential' as const,
      minWeightFloor: minFloor,
    };
    return this.calculateTimeDecay(eventDate, halfLifeDays, config, referenceDate);
  }

  /**
   * Provides a clear, transparent, and human-readable explanation of how a specific interaction
   * or preference event was decayed over time.
   */
  static explainDecay(
    eventDate: Date,
    action: string = 'play',
    halfLifeDays: number = 5,
    config: TemporalPreferenceAggregationConfig = getTemporalAggregationConfig(),
    referenceDate: Date = new Date()
  ): DecayExplanation {
    const ageMs = Math.max(0, referenceDate.getTime() - new Date(eventDate).getTime());
    const eventAgeDays = Number((ageMs / (1000 * 60 * 60 * 24)).toFixed(2));
    const baseWeight = this.getInteractionWeight(action, config);
    const decayFactor = this.calculateTimeDecay(eventDate, halfLifeDays, config, referenceDate);
    const effectiveWeight = Number((baseWeight * decayFactor).toFixed(4));
    const minWeightFloor = config.minWeightFloor ?? 0.05;

    let summary = '';
    if (config.decayModel === 'exponential') {
      summary = `Interaction occurred ${eventAgeDays} days ago. With a ${halfLifeDays}-day half-life exponential decay, ` +
        `it retains ${(decayFactor * 100).toFixed(1)}% of original strength (${baseWeight} -> ${effectiveWeight}).`;
    } else if (config.decayModel === 'linear') {
      summary = `Interaction occurred ${eventAgeDays} days ago. With linear decay across ${config.linearDecayMaxDays} days, ` +
        `it retains ${(decayFactor * 100).toFixed(1)}% of original strength (${baseWeight} -> ${effectiveWeight}).`;
    } else {
      summary = `Interaction occurred ${eventAgeDays} days ago. With step bracket decay, ` +
        `it retains ${(decayFactor * 100).toFixed(1)}% of original strength (${baseWeight} -> ${effectiveWeight}).`;
    }

    return {
      decayModel: config.decayModel,
      eventDate,
      referenceDate,
      eventAgeDays,
      decayFactor,
      baseWeight,
      effectiveWeight,
      minWeightFloor,
      halfLifeDays: config.decayModel === 'exponential' ? halfLifeDays : undefined,
      linearMaxDays: config.decayModel === 'linear' ? config.linearDecayMaxDays : undefined,
      summary,
    };
  }

  /**
   * Modular lookup for interaction type weight multipliers.
   */
  static getInteractionWeight(
    action: string,
    config: TemporalPreferenceAggregationConfig
  ): number {
    switch (action.toLowerCase()) {
      case 'complete':
        return config.completeWeight;
      case 'replay':
        return config.replayWeight;
      case 'like':
      case 'favorite':
        return config.likeWeight;
      case 'skip':
        return config.skipPenaltyWeight;
      case 'play':
      default:
        return config.playWeight;
    }
  }

  /**
   * Normalizes raw score weights into the standard [0.0, 1.0] range.
   */
  static normalizeScores<T extends { rawWeight: number }>(
    items: T[]
  ): Array<T & { preferenceScore: number }> {
    if (items.length === 0) return [];

    const positiveWeights = items.map((i) => Math.max(0, i.rawWeight));
    const maxWeight = Math.max(...positiveWeights, 0);

    return items.map((item) => {
      const rawPos = Math.max(0, item.rawWeight);
      const normalized = maxWeight > 0 ? Number((rawPos / maxWeight).toFixed(4)) : 0;
      return {
        ...item,
        preferenceScore: Math.min(1.0, Math.max(0.0, normalized)),
      };
    });
  }

  /**
   * Aggregates preference scores for a single temporal window from interaction events.
   */
  static aggregatePreferencesForWindow(
    events: RawTemporalInteractionEvent[],
    timeWindow: TemporalTimeWindow,
    timeframeDays: number,
    halfLifeDays: number,
    config: TemporalPreferenceAggregationConfig,
    referenceDate: Date = new Date()
  ): WindowPreferences {
    const windowStartMs = referenceDate.getTime() - timeframeDays * 24 * 60 * 60 * 1000;

    // Filter events belonging to this time window
    const windowEvents = events.filter((e) => {
      const t = new Date(e.timestamp).getTime();
      return t >= windowStartMs && t <= referenceDate.getTime();
    });

    interface AccumulatorItem {
      id?: string;
      name: string;
      rawWeight: number;
      interactionCount: number;
      lastInteractionAt: Date;
    }

    const genreMap = new Map<string, AccumulatorItem>();
    const artistMap = new Map<string, AccumulatorItem>();
    const moodMap = new Map<string, AccumulatorItem>();

    for (const ev of windowEvents) {
      const baseWeight = this.getInteractionWeight(ev.action, config);
      const recencyDecay = this.calculateTimeDecay(
        ev.timestamp,
        halfLifeDays,
        config,
        referenceDate
      );
      const effectiveWeight = baseWeight * recencyDecay;

      // 1. Process Genre
      const genreKey = (ev.genreId || ev.genreName || '').trim();
      if (genreKey) {
        const existing = genreMap.get(genreKey) || {
          id: ev.genreId,
          name: ev.genreName || genreKey,
          rawWeight: 0,
          interactionCount: 0,
          lastInteractionAt: ev.timestamp,
        };
        existing.rawWeight += effectiveWeight;
        existing.interactionCount += 1;
        if (new Date(ev.timestamp) > new Date(existing.lastInteractionAt)) {
          existing.lastInteractionAt = ev.timestamp;
        }
        genreMap.set(genreKey, existing);
      }

      // 2. Process Artist
      const artistKey = (ev.artistId || ev.artistName || '').trim();
      if (artistKey) {
        const existing = artistMap.get(artistKey) || {
          id: ev.artistId,
          name: ev.artistName || artistKey,
          rawWeight: 0,
          interactionCount: 0,
          lastInteractionAt: ev.timestamp,
        };
        existing.rawWeight += effectiveWeight;
        existing.interactionCount += 1;
        if (new Date(ev.timestamp) > new Date(existing.lastInteractionAt)) {
          existing.lastInteractionAt = ev.timestamp;
        }
        artistMap.set(artistKey, existing);
      }

      // 3. Process Mood
      const moodKey = (ev.mood || '').trim();
      if (moodKey) {
        const existing = moodMap.get(moodKey) || {
          name: moodKey,
          rawWeight: 0,
          interactionCount: 0,
          lastInteractionAt: ev.timestamp,
        };
        existing.rawWeight += effectiveWeight;
        existing.interactionCount += 1;
        if (new Date(ev.timestamp) > new Date(existing.lastInteractionAt)) {
          existing.lastInteractionAt = ev.timestamp;
        }
        moodMap.set(moodKey, existing);
      }
    }

    // Convert and normalize scores
    const genres = this.normalizeScores(Array.from(genreMap.values()))
      .sort((a, b) => b.preferenceScore - a.preferenceScore)
      .map((g) => ({ ...g, timeWindow }));

    const artists = this.normalizeScores(Array.from(artistMap.values()))
      .sort((a, b) => b.preferenceScore - a.preferenceScore)
      .map((a) => ({ ...a, timeWindow }));

    const moods = this.normalizeScores(Array.from(moodMap.values()))
      .sort((a, b) => b.preferenceScore - a.preferenceScore)
      .map((m) => ({ ...m, timeWindow }));

    return {
      timeWindow,
      timeframeDays,
      genres,
      artists,
      moods,
      totalInteractions: windowEvents.length,
    };
  }

  /**
   * Blends preferences across short-term, medium-term, and long-term windows.
   * Short-term carries recent momentum while long-term preserves established taste.
   */
  static blendWindowPreferences(
    shortTerm: WindowPreferences,
    mediumTerm: WindowPreferences,
    longTerm: WindowPreferences,
    config: TemporalPreferenceAggregationConfig
  ): {
    blendedGenres: TemporalPreferenceScore[];
    blendedArtists: TemporalPreferenceScore[];
    blendedMoods: TemporalPreferenceScore[];
  } {
    const blendEntity = (
      shortList: TemporalPreferenceScore[],
      mediumList: TemporalPreferenceScore[],
      longList: TemporalPreferenceScore[]
    ): TemporalPreferenceScore[] => {
      const keys = new Set<string>();
      const shortMap = new Map<string, TemporalPreferenceScore>();
      const mediumMap = new Map<string, TemporalPreferenceScore>();
      const longMap = new Map<string, TemporalPreferenceScore>();

      shortList.forEach((s) => {
        const key = s.id || s.name;
        keys.add(key);
        shortMap.set(key, s);
      });
      mediumList.forEach((m) => {
        const key = m.id || m.name;
        keys.add(key);
        mediumMap.set(key, m);
      });
      longList.forEach((l) => {
        const key = l.id || l.name;
        keys.add(key);
        longMap.set(key, l);
      });

      const totalWeight =
        config.shortTermBlendWeight +
        config.mediumTermBlendWeight +
        config.longTermBlendWeight;

      const results: TemporalPreferenceScore[] = [];

      for (const key of keys) {
        const s = shortMap.get(key);
        const m = mediumMap.get(key);
        const l = longMap.get(key);

        const sScore = s ? s.preferenceScore : 0;
        const mScore = m ? m.preferenceScore : 0;
        const lScore = l ? l.preferenceScore : 0;

        const blendedRaw =
          (sScore * config.shortTermBlendWeight +
            mScore * config.mediumTermBlendWeight +
            lScore * config.longTermBlendWeight) /
          Math.max(0.01, totalWeight);

        const interactionCount =
          (s?.interactionCount || 0) +
          (m?.interactionCount || 0) +
          (l?.interactionCount || 0);

        const dates = [
          s?.lastInteractionAt,
          m?.lastInteractionAt,
          l?.lastInteractionAt,
        ].filter(Boolean) as Date[];
        const lastInteractionAt =
          dates.length > 0
            ? new Date(Math.max(...dates.map((d) => d.getTime())))
            : new Date();

        results.push({
          id: s?.id || m?.id || l?.id,
          name: s?.name || m?.name || l?.name || key,
          preferenceScore: Number(blendedRaw.toFixed(4)),
          rawWeight: blendedRaw,
          interactionCount,
          lastInteractionAt,
          timeWindow: 'medium_term', // Canonical blended window representation
        });
      }

      // Re-normalize blended scores
      return this.normalizeScores(results).sort(
        (a, b) => b.preferenceScore - a.preferenceScore
      );
    };

    return {
      blendedGenres: blendEntity(shortTerm.genres, mediumTerm.genres, longTerm.genres),
      blendedArtists: blendEntity(shortTerm.artists, mediumTerm.artists, longTerm.artists),
      blendedMoods: blendEntity(shortTerm.moods, mediumTerm.moods, longTerm.moods),
    };
  }

  /**
   * Pure aggregation method from a list of raw interaction events.
   */
  static aggregateFromEvents(
    userId: string,
    events: RawTemporalInteractionEvent[],
    options: AggregateTemporalOptions = {}
  ): UserTemporalPreferenceAggregationResult {
    const config: TemporalPreferenceAggregationConfig = {
      ...getTemporalAggregationConfig(),
      ...(options.configOverride || {}),
    };
    const refDate = options.referenceDate || new Date();

    // 1. Calculate Short-Term Profile (e.g. past 14 days, half-life 5 days)
    const shortTerm = this.aggregatePreferencesForWindow(
      events,
      TimeWindow.SHORT_TERM,
      config.shortTermDays,
      config.shortTermHalfLifeDays,
      config,
      refDate
    );

    // 2. Calculate Medium-Term Profile (e.g. past 60 days, half-life 21 days)
    const mediumTerm = this.aggregatePreferencesForWindow(
      events,
      TimeWindow.MEDIUM_TERM,
      config.mediumTermDays,
      config.mediumTermHalfLifeDays,
      config,
      refDate
    );

    // 3. Calculate Long-Term Profile (e.g. past 180 days, half-life 90 days)
    const longTerm = this.aggregatePreferencesForWindow(
      events,
      TimeWindow.LONG_TERM,
      config.longTermDays,
      config.longTermHalfLifeDays,
      config,
      refDate
    );

    // 4. Blend across time horizons
    const { blendedGenres, blendedArtists, blendedMoods } = this.blendWindowPreferences(
      shortTerm,
      mediumTerm,
      longTerm,
      config
    );

    return {
      userId,
      shortTerm,
      mediumTerm,
      longTerm,
      blendedGenres,
      blendedArtists,
      blendedMoods,
      updatedAt: refDate,
    };
  }

  /**
   * Persists aggregated temporal preferences into the TemporalPreference collection.
   */
  static async persistTemporalPreferences(
    userId: string,
    result: UserTemporalPreferenceAggregationResult
  ): Promise<number> {
    if (!Types.ObjectId.isValid(userId)) return 0;
    const userObjId = new Types.ObjectId(userId);

    const operations: any[] = [];

    const addBatchOps = (
      scores: TemporalPreferenceScore[],
      type: 'genre' | 'artist' | 'mood',
      timeWindow: TemporalTimeWindow
    ) => {
      for (const item of scores) {
        const filter: any = {
          userId: userObjId,
          timeWindow,
        };

        const updateData: any = {
          userId: userObjId,
          preferenceScore: item.preferenceScore,
          interactionCount: item.interactionCount,
          lastInteractionAt: item.lastInteractionAt,
          timeWindow,
        };

        if (type === 'genre') {
          filter.genre = item.id || item.name;
          updateData.genre = item.id || item.name;
        } else if (type === 'artist') {
          filter.artist = item.id || item.name;
          updateData.artist = item.id || item.name;
        } else if (type === 'mood') {
          filter.mood = item.name;
          updateData.mood = item.name;
        }

        operations.push({
          updateOne: {
            filter,
            update: { $set: updateData },
            upsert: true,
          },
        });
      }
    };

    // Save short, medium, and long term
    addBatchOps(result.shortTerm.genres, 'genre', TimeWindow.SHORT_TERM);
    addBatchOps(result.shortTerm.artists, 'artist', TimeWindow.SHORT_TERM);
    addBatchOps(result.shortTerm.moods, 'mood', TimeWindow.SHORT_TERM);

    addBatchOps(result.mediumTerm.genres, 'genre', TimeWindow.MEDIUM_TERM);
    addBatchOps(result.mediumTerm.artists, 'artist', TimeWindow.MEDIUM_TERM);
    addBatchOps(result.mediumTerm.moods, 'mood', TimeWindow.MEDIUM_TERM);

    addBatchOps(result.longTerm.genres, 'genre', TimeWindow.LONG_TERM);
    addBatchOps(result.longTerm.artists, 'artist', TimeWindow.LONG_TERM);
    addBatchOps(result.longTerm.moods, 'mood', TimeWindow.LONG_TERM);

    if (operations.length > 0) {
      await TemporalPreference.bulkWrite(operations);
    }

    return operations.length;
  }

  /**
   * Loads listening history and session data for a user and calculates temporal preferences.
   */
  static async aggregateUserPreferences(
    userId: string,
    options: AggregateTemporalOptions = {}
  ): Promise<UserTemporalPreferenceAggregationResult> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error(`Invalid userId for temporal preference aggregation: ${userId}`);
    }

    const config: TemporalPreferenceAggregationConfig = {
      ...getTemporalAggregationConfig(),
      ...(options.configOverride || {}),
    };
    const refDate = options.referenceDate || new Date();
    const maxLookbackMs = config.longTermDays * 24 * 60 * 60 * 1000;
    const earliestAllowedDate = new Date(refDate.getTime() - maxLookbackMs);

    // 1. Fetch Listening History
    const historyDocs = await ListeningHistory.find({
      user: userId,
      playedAt: { $gte: earliestAllowedDate },
    })
      .populate({
        path: 'song',
        select: 'genre artist mood title audioFeatures',
        populate: [
          { path: 'genre', select: 'name' },
          { path: 'artist', select: 'name' },
        ],
      })
      .lean();

    // 2. Fetch User Favorites (Long-term baseline signals)
    const userDoc = await User.findById(userId)
      .populate('favoriteGenres', 'name')
      .populate('favoriteArtists', 'name')
      .populate('likedSongs', 'genre artist mood')
      .lean();

    // 3. Fetch Session Events
    const sessionDocs = await ListeningSession.find({
      user: userId,
      startTime: { $gte: earliestAllowedDate },
    })
      .select('sessionEvents tracksPlayed tracksSkipped tracksCompleted')
      .lean();

    const rawEvents: RawTemporalInteractionEvent[] = [];

    // Process Listening History
    for (const h of historyDocs) {
      const songDoc = h.song as any;
      if (!songDoc) continue;

      const genreId = songDoc.genre?._id ? songDoc.genre._id.toString() : songDoc.genre?.toString();
      const genreName = songDoc.genre?.name || (typeof songDoc.genre === 'string' ? songDoc.genre : undefined);
      const artistId = songDoc.artist?._id ? songDoc.artist._id.toString() : songDoc.artist?.toString();
      const artistName = songDoc.artist?.name || (typeof songDoc.artist === 'string' ? songDoc.artist : undefined);

      let action = 'play';
      if (h.skipped) {
        action = 'skip';
      } else if (h.completed || (h.progressPercent && h.progressPercent >= 90)) {
        action = 'complete';
      }

      rawEvents.push({
        songId: songDoc._id ? songDoc._id.toString() : undefined,
        genreId,
        genreName,
        artistId,
        artistName,
        mood: songDoc.mood,
        action,
        timestamp: h.playedAt || new Date(),
      });
    }

    // Process User Favorites
    if (userDoc) {
      if (userDoc.favoriteGenres) {
        for (const g of userDoc.favoriteGenres as any[]) {
          rawEvents.push({
            genreId: g._id ? g._id.toString() : g.toString(),
            genreName: g.name || (typeof g === 'string' ? g : undefined),
            action: 'favorite',
            timestamp: userDoc.createdAt || new Date(refDate.getTime() - 90 * 86400000),
          });
        }
      }
      if (userDoc.favoriteArtists) {
        for (const a of userDoc.favoriteArtists as any[]) {
          rawEvents.push({
            artistId: a._id ? a._id.toString() : a.toString(),
            artistName: a.name || (typeof a === 'string' ? a : undefined),
            action: 'favorite',
            timestamp: userDoc.createdAt || new Date(refDate.getTime() - 90 * 86400000),
          });
        }
      }
    }

    // Process Session Events
    for (const sess of sessionDocs) {
      if (sess.sessionEvents) {
        for (const ev of sess.sessionEvents as any[]) {
          rawEvents.push({
            songId: ev.song ? ev.song.toString() : undefined,
            action: ev.action || 'play',
            timestamp: ev.timestamp || new Date(),
          });
        }
      }
    }

    // Run modular calculation
    const result = this.aggregateFromEvents(userId, rawEvents, options);

    // Persist if requested
    if (options.persist) {
      const persistedCount = await this.persistTemporalPreferences(userId, result);
      result.persistedCount = persistedCount;
    }

    return result;
  }
}
