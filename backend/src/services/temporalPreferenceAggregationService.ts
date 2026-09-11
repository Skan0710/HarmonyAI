import { supabase } from '../config/supabase.js';
import {
  TemporalTimeWindow,
  TimeWindow,
} from '../models/TemporalPreference.js';
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
   * Persists aggregated temporal preferences into the Supabase `temporal_preferences` table.
   *
   * SCHEMA RESHAPE NOTE (Mongoose -> Supabase):
   * The old Mongoose `TemporalPreference` collection stored one small document per
   * (userId, type['genre'|'artist'|'mood'], timeWindow, genre|artist|mood) tuple via
   * `bulkWrite` upserts - i.e. up to dozens of documents per user per aggregation run
   * (one per genre, one per artist, one per mood, times 3 recency windows). The
   * Postgres `temporal_preferences` table instead has exactly one row per
   * (user_id, day_type, time_slot), with `preferred_genres` / `preferred_moods` as
   * jsonb columns that hold *all* genres/artists/moods for that bucket at once, plus
   * a `unique(user_id, day_type, time_slot)` constraint to upsert against.
   *
   * `day_type` / `time_slot` read as if they were meant for real day-of-week /
   * time-of-day dayparting (e.g. day_type='weekday', time_slot='morning'), but
   * nothing in this service - nor the original Mongoose model/aggregation logic -
   * ever computed real dayparts from event timestamps. The only temporal axis this
   * service has ever tracked is the short/medium/long-term recency window
   * (`TimeWindow`). To satisfy the new composite key while preserving 100% of the
   * original information content (nothing invented, nothing dropped), we map:
   *   day_type  -> constant 'all'          (no day-of-week granularity exists yet)
   *   time_slot -> the recency window      ('short_term' | 'medium_term' | 'long_term')
   * This consolidates what used to be many small per-genre/per-artist documents into
   * exactly 3 rows per user (one per recency window). Real day-of-week/time-of-day
   * dayparting can replace this mapping later without touching the aggregation math.
   *
   * The new schema also has no dedicated `artist` column, so artist affinities are
   * nested inside the `preferred_genres` jsonb payload alongside genres (shaped as
   * `{ genres: [...], artists: [...] }`) rather than being dropped.
   *
   * `audio_feature_targets` is left null here: the original bulkWrite never
   * persisted acoustic/audio-feature data either - that's only ever computed
   * downstream (see LayeredTemporalTasteProfileService.extractAcousticTargets).
   */
  static async persistTemporalPreferences(
    userId: string,
    result: UserTemporalPreferenceAggregationResult
  ): Promise<number> {
    if (!userId) return 0;

    const DAY_TYPE = 'all';

    const toJsonScore = (item: TemporalPreferenceScore) => ({
      id: item.id,
      name: item.name,
      score: item.preferenceScore,
      interactionCount: item.interactionCount,
      lastInteractionAt: new Date(item.lastInteractionAt).toISOString(),
    });

    const buildRow = (window: WindowPreferences) => ({
      user_id: userId,
      day_type: DAY_TYPE,
      time_slot: window.timeWindow,
      preferred_genres: {
        genres: window.genres.map(toJsonScore),
        artists: window.artists.map(toJsonScore),
      },
      preferred_moods: window.moods.map(toJsonScore),
      updated_at: new Date().toISOString(),
    });

    const rows = [
      buildRow(result.shortTerm),
      buildRow(result.mediumTerm),
      buildRow(result.longTerm),
    ];

    const { error } = await (supabase.from('temporal_preferences') as any).upsert(
      rows as any,
      { onConflict: 'user_id,day_type,time_slot' }
    );

    if (error) {
      throw new Error(`Failed to persist temporal preferences: ${error.message}`);
    }

    return rows.length;
  }

  /**
   * Loads listening history and session data for a user and calculates temporal preferences.
   */
  static async aggregateUserPreferences(
    userId: string,
    options: AggregateTemporalOptions = {}
  ): Promise<UserTemporalPreferenceAggregationResult> {
    if (!userId) {
      throw new Error(`Invalid userId for temporal preference aggregation: ${userId}`);
    }

    const config: TemporalPreferenceAggregationConfig = {
      ...getTemporalAggregationConfig(),
      ...(options.configOverride || {}),
    };
    const refDate = options.referenceDate || new Date();
    const maxLookbackMs = config.longTermDays * 24 * 60 * 60 * 1000;
    const earliestAllowedDate = new Date(refDate.getTime() - maxLookbackMs);
    const earliestAllowedIso = earliestAllowedDate.toISOString();

    // 1. Concurrently fetch Listening History (joined to song/genre/artist), User
    // Favorites (the `users` table has no embedded favoriteGenres/favoriteArtists/
    // likedSongs arrays like the old Mongoose model - they live in junction tables,
    // see userService.ts for the established join pattern), the user's own
    // createdAt (used as a fallback timestamp for favorite events, same as the
    // original code), and Session Events.
    const [historyResult, favGenresResult, favArtistsResult, userRowResult, sessionResult] =
      await Promise.all([
        supabase
          .from('listening_history')
          .select(
            'song_id, played_at, completed, skipped, progress_percent, songs(id, title, mood, genre_id, artist_id, genres(id, name), artists(id, name))'
          )
          .eq('user_id', userId)
          .gte('played_at', earliestAllowedIso),
        supabase
          .from('user_favorite_genres')
          .select('genre_id, genres(id, name)')
          .eq('user_id', userId),
        supabase
          .from('user_favorite_artists')
          .select('artist_id, artists(id, name)')
          .eq('user_id', userId),
        supabase.from('users').select('created_at').eq('id', userId).maybeSingle(),
        supabase
          .from('listening_sessions')
          .select('songs_played, tracks_skipped, tracks_completed, session_events, session_start')
          .eq('user_id', userId)
          .gte('session_start', earliestAllowedIso),
      ]);

    const historyDocs: any[] = historyResult.data || [];
    const favGenreDocs: any[] = favGenresResult.data || [];
    const favArtistDocs: any[] = favArtistsResult.data || [];
    const userCreatedAt = (userRowResult.data as any)?.created_at
      ? new Date((userRowResult.data as any).created_at)
      : undefined;
    const sessionDocs: any[] = sessionResult.data || [];

    const rawEvents: RawTemporalInteractionEvent[] = [];

    // Process Listening History
    for (const h of historyDocs) {
      const songDoc = h.songs as any;
      if (!songDoc) continue;

      const genreId = songDoc.genres?.id || songDoc.genre_id;
      const genreName = songDoc.genres?.name;
      const artistId = songDoc.artists?.id || songDoc.artist_id;
      const artistName = songDoc.artists?.name;

      let action = 'play';
      if (h.skipped) {
        action = 'skip';
      } else if (h.completed || (h.progress_percent && h.progress_percent >= 90)) {
        action = 'complete';
      }

      rawEvents.push({
        songId: songDoc.id,
        genreId,
        genreName,
        artistId,
        artistName,
        mood: songDoc.mood,
        action,
        timestamp: h.played_at ? new Date(h.played_at) : new Date(),
      });
    }

    // Process User Favorites (from the user_favorite_genres / user_favorite_artists
    // junction tables, in place of the old User.favoriteGenres/favoriteArtists populate)
    const favoriteTimestamp = userCreatedAt || new Date(refDate.getTime() - 90 * 86400000);
    for (const g of favGenreDocs) {
      const genre = g.genres as any;
      rawEvents.push({
        genreId: genre?.id || g.genre_id,
        genreName: genre?.name,
        action: 'favorite',
        timestamp: favoriteTimestamp,
      });
    }
    for (const a of favArtistDocs) {
      const artist = a.artists as any;
      rawEvents.push({
        artistId: artist?.id || a.artist_id,
        artistName: artist?.name,
        action: 'favorite',
        timestamp: favoriteTimestamp,
      });
    }

    // Process Session Events (the `session_events` jsonb column added by the
    // 20260911b migration mirrors the old Mongoose embedded `sessionEvents` array)
    for (const sess of sessionDocs) {
      const events = (sess.session_events as any[]) || [];
      for (const ev of events) {
        rawEvents.push({
          songId: ev.song ? String(ev.song) : undefined,
          action: ev.action || 'play',
          timestamp: ev.timestamp ? new Date(ev.timestamp) : new Date(),
        });
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
