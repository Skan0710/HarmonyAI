import { Types } from 'mongoose';
import { User } from '../models/User.js';
import { ListeningHistory } from '../models/ListeningHistory.js';
import { ListeningSession } from '../models/ListeningSession.js';
import { RecommendationInteraction } from '../models/RecommendationInteraction.js';
import {
  RawHistoryRecord,
  RawUserData,
  ExtractionRawInputs,
  ExtractionOptions,
} from './musicDnaExtractionService.js';
import {
  MusicDNAListeningBehaviorProfile,
  BehavioralMetricsBreakdown,
  ListenerArchetype,
  clampNumber,
} from '../schemas/musicDnaSchema.js';

export interface RawSessionInput {
  _id?: string;
  startTime: Date;
  endTime?: Date;
  songsPlayed?: any[];
  tracksPlayed?: any[];
  tracksSkipped?: any[];
  tracksCompleted?: any[];
}

export interface RawFeedbackInput {
  action: string;
  explanationFeedback?: string;
  timestamp?: Date;
}

export interface BehaviorProfilingRawInputs extends ExtractionRawInputs {
  sessions?: RawSessionInput[];
  feedback?: RawFeedbackInput[];
}

export class MusicDNABehaviorProfilingService {
  /**
   * Pure in-memory calculation of the user's Music DNA Listening Behavior Profile.
   * Analyzes HOW a user listens to music across 9 distinct behavioral dimensions.
   * Modular, configurable, and safely avoids creating fake data when data is absent.
   */
  static profileListeningBehaviorFromData(
    inputs: BehaviorProfilingRawInputs,
    options: ExtractionOptions = {}
  ): MusicDNAListeningBehaviorProfile {
    const { userId, user, history = [], sessions = [], feedback = [] } = inputs;
    const now = options.referenceDate || new Date();
    const totalPlays = history.length;
    const isDataSufficient = totalPlays >= 3;

    // Zero-data / Cold Start handling: Do not invent fake data
    if (totalPlays === 0) {
      return {
        userId,
        repeatListeningTendency: 0.0,
        discoveryTendency: 0.0,
        skipTendency: 0.0,
        familiarityPreference: 0.0,
        explorationTendency: 0.0,
        diversityPreference: 0.0,
        sessionListeningIntensity: 0.0,
        preferenceStability: 1.0,
        preferenceChangeRate: 0.0,
        listenerArchetype: 'Casual Listener',
        isDataSufficient: false,
        metricsBreakdown: {
          totalPlaysAnalyzed: 0,
          uniqueTracksCount: 0,
          uniqueArtistsCount: 0,
          uniqueGenresCount: 0,
          totalSessionsAnalyzed: 0,
          avgTracksPerSession: 0,
          avgSessionDurationMinutes: 0,
          skipRatio: 0,
          completionRatio: 0,
          replayRatio: 0,
          feedbackCount: feedback.length,
        },
        confidenceScore: 0.0,
        generatedAt: now,
        metadata: {
          status: 'NO_DATA',
          message: 'No listening activity available for behavioral profiling.',
        },
      };
    }

    // 1. Repeat Listening Tendency
    const { repeatListeningTendency, replayRatio, uniqueTracksCount } =
      this.calculateRepeatTendency(history);

    // 2. Discovery Tendency
    const { discoveryTendency, uniqueArtistsCount, uniqueGenresCount } =
      this.calculateDiscoveryTendency(history, uniqueTracksCount);

    // 3. Skip Tendency
    const { skipTendency, skipRatio, completionRatio } =
      this.calculateSkipTendency(history, sessions);

    // 4. Familiarity Preference
    const familiarityPreference = this.calculateFamiliarityPreference(
      history,
      user?.likedSongs || [],
      user?.favoriteArtists || [],
      replayRatio
    );

    // 5. Exploration Tendency
    const explorationTendency = this.calculateExplorationTendency(
      history,
      discoveryTendency,
      feedback
    );

    // 6. Diversity Preference
    const diversityPreference = this.calculateDiversityPreference(history);

    // 7. Session Listening Intensity
    const { sessionListeningIntensity, totalSessionsAnalyzed, avgTracksPerSession, avgSessionDurationMinutes } =
      this.calculateSessionListeningIntensity(history, sessions);

    // 8. Preference Stability and Change Rate
    const { preferenceStability, preferenceChangeRate } =
      this.calculatePreferenceStabilityAndChangeRate(history, now, options.shortTermDays || 14);

    // 9. Listener Archetype Classification
    const listenerArchetype = this.determineListenerArchetype({
      repeatListeningTendency,
      discoveryTendency,
      skipTendency,
      familiarityPreference,
      explorationTendency,
      diversityPreference,
      sessionListeningIntensity,
      preferenceStability,
      isDataSufficient,
    });

    // 10. Overall Confidence Score
    const confidenceScore = this.calculateConfidence(totalPlays, totalSessionsAnalyzed, isDataSufficient);

    const metricsBreakdown: BehavioralMetricsBreakdown = {
      totalPlaysAnalyzed: totalPlays,
      uniqueTracksCount,
      uniqueArtistsCount,
      uniqueGenresCount,
      totalSessionsAnalyzed,
      avgTracksPerSession,
      avgSessionDurationMinutes,
      skipRatio,
      completionRatio,
      replayRatio,
      feedbackCount: feedback.length,
    };

    return {
      userId,
      repeatListeningTendency,
      discoveryTendency,
      skipTendency,
      familiarityPreference,
      explorationTendency,
      diversityPreference,
      sessionListeningIntensity,
      preferenceStability,
      preferenceChangeRate,
      listenerArchetype,
      isDataSufficient,
      metricsBreakdown,
      confidenceScore,
      generatedAt: now,
      metadata: {
        analyzedPlays: totalPlays,
        sessionsCount: totalSessionsAnalyzed,
        feedbackActionsCount: feedback.length,
      },
    };
  }

  /**
   * Fetches user history, active/past sessions, feedback, and user profile from MongoDB
   * to build the complete Music DNA Listening Behavior Profile.
   */
  static async profileListeningBehavior(
    userId: string,
    options: ExtractionOptions = {}
  ): Promise<MusicDNAListeningBehaviorProfile> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }

    const userObjectId = new Types.ObjectId(userId);

    // 1. Fetch User
    const userDoc = await User.findById(userObjectId)
      .select('likedSongs favoriteGenres favoriteArtists')
      .lean();

    // 2. Fetch Listening History
    const historyDocs = await ListeningHistory.find({ user: userObjectId })
      .populate({
        path: 'song',
        select: 'title genre artist mood duration audioFeatures',
        populate: [
          { path: 'genre', select: 'name' },
          { path: 'artist', select: 'name' },
        ],
      })
      .sort({ playedAt: -1 })
      .lean();

    // 3. Fetch Listening Sessions
    const sessionDocs = await ListeningSession.find({ user: userObjectId })
      .sort({ startTime: -1 })
      .limit(50)
      .lean();

    // 4. Fetch Recommendation Interactions / Feedback
    const feedbackDocs = await RecommendationInteraction.find({ user: userObjectId })
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();

    const rawInputs: BehaviorProfilingRawInputs = {
      userId,
      user: userDoc as any,
      history: historyDocs as any,
      sessions: sessionDocs as any,
      feedback: feedbackDocs as any,
      referenceDate: options.referenceDate,
    };

    return this.profileListeningBehaviorFromData(rawInputs, options);
  }

  // --------------------------------------------------------------------------
  // MODULAR METRIC CALCULATIONS
  // --------------------------------------------------------------------------

  /**
   * Analyzes repeat listening tendency and replay concentration.
   */
  static calculateRepeatTendency(history: RawHistoryRecord[]): {
    repeatListeningTendency: number;
    replayRatio: number;
    uniqueTracksCount: number;
  } {
    const totalPlays = history.length;
    if (totalPlays <= 1) {
      return { repeatListeningTendency: 0.1, replayRatio: 0.0, uniqueTracksCount: totalPlays };
    }

    const songCountMap = new Map<string, number>();
    for (const rec of history) {
      const id = this.extractSongId(rec);
      if (id) {
        songCountMap.set(id, (songCountMap.get(id) || 0) + 1);
      }
    }

    const uniqueTracksCount = Math.max(1, songCountMap.size);
    const repeatedPlays = Math.max(0, totalPlays - uniqueTracksCount);
    const replayRatio = Number((repeatedPlays / (totalPlays - 1)).toFixed(4));

    // Calculate top track concentration (percentage of total plays from top 25% of songs)
    const sortedCounts = Array.from(songCountMap.values()).sort((a, b) => b - a);
    const top25Count = Math.max(1, Math.ceil(sortedCounts.length * 0.25));
    const topPlays = sortedCounts.slice(0, top25Count).reduce((acc, c) => acc + c, 0);
    const topConcentration = topPlays / totalPlays;

    // Blend replay ratio and concentration
    const rawScore = 0.65 * replayRatio + 0.35 * Math.max(0, (topConcentration - 0.25) / 0.75);
    const repeatListeningTendency = clampNumber(rawScore, 0.0, 1.0, 0.1)!;

    return {
      repeatListeningTendency,
      replayRatio,
      uniqueTracksCount,
    };
  }

  /**
   * Analyzes discovery tendency based on new tracks and distinct artist exploration.
   */
  static calculateDiscoveryTendency(
    history: RawHistoryRecord[],
    uniqueTracksCount: number
  ): {
    discoveryTendency: number;
    uniqueArtistsCount: number;
    uniqueGenresCount: number;
  } {
    const totalPlays = history.length;
    if (totalPlays === 0) {
      return { discoveryTendency: 0.0, uniqueArtistsCount: 0, uniqueGenresCount: 0 };
    }

    const artistSet = new Set<string>();
    const genreSet = new Set<string>();

    for (const rec of history) {
      const a = this.extractArtistName(rec);
      if (a) artistSet.add(a.toLowerCase());

      const g = this.extractGenreName(rec);
      if (g) genreSet.add(g.toLowerCase());
    }

    const uniqueArtistsCount = artistSet.size;
    const uniqueGenresCount = genreSet.size;

    const trackDiscoveryRatio = uniqueTracksCount / totalPlays;
    const artistDiscoveryRatio = Math.min(1.0, uniqueArtistsCount / Math.max(1, Math.sqrt(totalPlays) * 2));

    const rawDiscovery = 0.6 * trackDiscoveryRatio + 0.4 * artistDiscoveryRatio;
    const discoveryTendency = clampNumber(rawDiscovery, 0.0, 1.0, 0.5)!;

    return {
      discoveryTendency,
      uniqueArtistsCount,
      uniqueGenresCount,
    };
  }

  /**
   * Analyzes skip tendency using listening history and session telemetry.
   */
  static calculateSkipTendency(
    history: RawHistoryRecord[],
    sessions: RawSessionInput[] = []
  ): {
    skipTendency: number;
    skipRatio: number;
    completionRatio: number;
  } {
    const totalPlays = history.length;
    if (totalPlays === 0) {
      return { skipTendency: 0.0, skipRatio: 0.0, completionRatio: 0.0 };
    }

    let skips = 0;
    let completed = 0;

    for (const rec of history) {
      if (rec.skipped) skips++;
      if (rec.completed) completed++;
    }

    // Incorporate session telemetry if available
    for (const sess of sessions) {
      if (sess.tracksSkipped && Array.isArray(sess.tracksSkipped)) {
        skips += Math.min(5, sess.tracksSkipped.length * 0.5);
      }
    }

    const skipRatio = Number((skips / totalPlays).toFixed(4));
    const completionRatio = Number((completed / totalPlays).toFixed(4));

    // Bayesian smoothing to handle small counts gracefully
    const smoothedSkip = (skips + 0.5) / (totalPlays + 2.5);
    const skipTendency = clampNumber(smoothedSkip, 0.0, 1.0, 0.2)!;

    return {
      skipTendency,
      skipRatio,
      completionRatio,
    };
  }

  /**
   * Analyzes familiarity preference: affinity for repeats, liked tracks, and favorite artists.
   */
  static calculateFamiliarityPreference(
    history: RawHistoryRecord[],
    likedSongs: any[],
    favoriteArtists: any[],
    replayRatio: number
  ): number {
    const totalPlays = history.length;
    if (totalPlays === 0) return 0.0;

    const likedIds = new Set<string>();
    for (const s of likedSongs) {
      if (s) {
        const id = typeof s === 'object' && s._id ? s._id.toString() : String(s);
        likedIds.add(id);
      }
    }

    const favArtists = new Set<string>();
    for (const a of favoriteArtists) {
      if (a) {
        const name = typeof a === 'object' && a.name ? a.name.toLowerCase() : String(a).toLowerCase();
        favArtists.add(name);
      }
    }

    let likedPlaysCount = 0;
    let favArtistPlaysCount = 0;

    for (const rec of history) {
      const songId = this.extractSongId(rec);
      if (songId && likedIds.has(songId)) {
        likedPlaysCount++;
      }

      const artistName = this.extractArtistName(rec);
      if (artistName && favArtists.has(artistName.toLowerCase())) {
        favArtistPlaysCount++;
      }
    }

    const likedRatio = likedPlaysCount / totalPlays;
    const favArtistRatio = favArtistPlaysCount / totalPlays;

    const rawScore = 0.50 * replayRatio + 0.35 * likedRatio + 0.15 * favArtistRatio;
    return clampNumber(rawScore, 0.0, 1.0, 0.5)!;
  }

  /**
   * Analyzes exploration tendency: willingness to venture into uncharted styles and songs.
   */
  static calculateExplorationTendency(
    history: RawHistoryRecord[],
    discoveryTendency: number,
    feedback: RawFeedbackInput[] = []
  ): number {
    const totalPlays = history.length;
    if (totalPlays === 0) return 0.0;

    // Completed novel tracks (tracks listened to completion that were played only once)
    const trackPlayCounts = new Map<string, { count: number; completed: number }>();
    for (const rec of history) {
      const id = this.extractSongId(rec);
      if (id) {
        const curr = trackPlayCounts.get(id) || { count: 0, completed: 0 };
        curr.count++;
        if (rec.completed) curr.completed++;
        trackPlayCounts.set(id, curr);
      }
    }

    let completedNovelTracks = 0;
    for (const item of trackPlayCounts.values()) {
      if (item.count === 1 && item.completed > 0) {
        completedNovelTracks++;
      }
    }

    const novelCompletionRatio = completedNovelTracks / Math.max(1, trackPlayCounts.size);

    // Feedback bonus
    let feedbackBonus = 0;
    if (feedback.length > 0) {
      const positive = feedback.filter((f) => f.action === 'like' || f.action === 'thumbs_up' || f.explanationFeedback === 'helpful').length;
      feedbackBonus = Math.min(0.15, (positive / feedback.length) * 0.15);
    }

    const rawScore = 0.55 * discoveryTendency + 0.35 * novelCompletionRatio + feedbackBonus;
    return clampNumber(rawScore, 0.0, 1.0, 0.5)!;
  }

  /**
   * Analyzes diversity preference: normalized Shannon entropy across genres and artists.
   */
  static calculateDiversityPreference(history: RawHistoryRecord[]): number {
    if (history.length === 0) return 0.0;

    const genreCounts = new Map<string, number>();
    const artistCounts = new Map<string, number>();

    for (const rec of history) {
      const g = this.extractGenreName(rec);
      if (g) genreCounts.set(g, (genreCounts.get(g) || 0) + 1);

      const a = this.extractArtistName(rec);
      if (a) artistCounts.set(a, (artistCounts.get(a) || 0) + 1);
    }

    const calcEntropy = (counts: Map<string, number>) => {
      const K = counts.size;
      if (K <= 1) return K === 1 ? 0.1 : 0.0;
      const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
      let H = 0;
      for (const count of counts.values()) {
        const p = count / total;
        if (p > 0) H -= p * Math.log2(p);
      }
      return H / Math.log2(K);
    };

    const genreEntropy = calcEntropy(genreCounts);
    const artistEntropy = calcEntropy(artistCounts);

    const rawScore = 0.55 * genreEntropy + 0.45 * artistEntropy;
    return clampNumber(rawScore, 0.0, 1.0, 0.5)!;
  }

  /**
   * Analyzes session listening intensity: duration, track volume, and immersion per session.
   */
  static calculateSessionListeningIntensity(
    history: RawHistoryRecord[],
    sessions: RawSessionInput[] = []
  ): {
    sessionListeningIntensity: number;
    totalSessionsAnalyzed: number;
    avgTracksPerSession: number;
    avgSessionDurationMinutes: number;
  } {
    const totalPlays = history.length;
    if (totalPlays === 0) {
      return {
        sessionListeningIntensity: 0.0,
        totalSessionsAnalyzed: 0,
        avgTracksPerSession: 0,
        avgSessionDurationMinutes: 0,
      };
    }

    // 1. If structured sessions exist, use them directly
    if (sessions && sessions.length > 0) {
      let totalDurationMins = 0;
      let totalSessionTracks = 0;

      for (const s of sessions) {
        const start = s.startTime ? new Date(s.startTime).getTime() : 0;
        const end = s.endTime ? new Date(s.endTime).getTime() : start + 30 * 60 * 1000;
        const durMins = Math.max(5, Math.round((end - start) / (1000 * 60)));
        totalDurationMins += durMins;

        const tracksCount = (s.songsPlayed?.length || s.tracksPlayed?.length || 1);
        totalSessionTracks += tracksCount;
      }

      const totalSessionsAnalyzed = sessions.length;
      const avgTracksPerSession = Number((totalSessionTracks / totalSessionsAnalyzed).toFixed(1));
      const avgSessionDurationMinutes = Math.round(totalDurationMins / totalSessionsAnalyzed);

      const trackIntensity = Math.min(1.0, avgTracksPerSession / 15);
      const durationIntensity = Math.min(1.0, avgSessionDurationMinutes / 60);

      const sessionListeningIntensity = clampNumber(
        0.55 * trackIntensity + 0.45 * durationIntensity,
        0.0,
        1.0,
        0.5
      )!;

      return {
        sessionListeningIntensity,
        totalSessionsAnalyzed,
        avgTracksPerSession,
        avgSessionDurationMinutes,
      };
    }

    // 2. Cluster history plays into sessions by identifying gaps > 30 mins
    const sortedPlays = [...history]
      .filter((h) => h.playedAt)
      .sort((a, b) => new Date(a.playedAt!).getTime() - new Date(b.playedAt!).getTime());

    let sessionCount = 1;
    let currentSessionTracks = 1;
    const sessionTrackCounts: number[] = [];

    for (let i = 1; i < sortedPlays.length; i++) {
      const prevTime = new Date(sortedPlays[i - 1].playedAt!).getTime();
      const currTime = new Date(sortedPlays[i].playedAt!).getTime();
      const gapMins = (currTime - prevTime) / (1000 * 60);

      if (gapMins > 35) {
        sessionTrackCounts.push(currentSessionTracks);
        sessionCount++;
        currentSessionTracks = 1;
      } else {
        currentSessionTracks++;
      }
    }
    sessionTrackCounts.push(currentSessionTracks);

    const totalSessionsAnalyzed = Math.max(1, sessionCount);
    const avgTracksPerSession = Number((totalPlays / totalSessionsAnalyzed).toFixed(1));
    const avgSessionDurationMinutes = Math.min(180, Math.max(10, Math.round(avgTracksPerSession * 3.5)));

    const trackIntensity = Math.min(1.0, avgTracksPerSession / 12);
    const durationIntensity = Math.min(1.0, avgSessionDurationMinutes / 50);

    const sessionListeningIntensity = clampNumber(
      0.55 * trackIntensity + 0.45 * durationIntensity,
      0.0,
      1.0,
      0.5
    )!;

    return {
      sessionListeningIntensity,
      totalSessionsAnalyzed,
      avgTracksPerSession,
      avgSessionDurationMinutes,
    };
  }

  /**
   * Analyzes preference stability and change rate by comparing short-term vs long-term horizon distributions.
   */
  static calculatePreferenceStabilityAndChangeRate(
    history: RawHistoryRecord[],
    referenceDate: Date,
    shortTermDays: number = 14
  ): { preferenceStability: number; preferenceChangeRate: number } {
    const totalPlays = history.length;
    if (totalPlays <= 3) {
      return { preferenceStability: 0.85, preferenceChangeRate: 0.15 };
    }

    const shortTermCutoff = new Date(referenceDate.getTime() - shortTermDays * 24 * 3600 * 1000);
    const shortMap = new Map<string, number>();
    const longMap = new Map<string, number>();

    let shortTotal = 0;
    let longTotal = 0;

    for (const rec of history) {
      const g = this.extractGenreName(rec);
      if (!g) continue;

      const playedAt = rec.playedAt ? new Date(rec.playedAt) : referenceDate;
      if (playedAt >= shortTermCutoff) {
        shortMap.set(g, (shortMap.get(g) || 0) + 1);
        shortTotal++;
      } else {
        longMap.set(g, (longMap.get(g) || 0) + 1);
        longTotal++;
      }
    }

    // If all listening occurred recently with no historical baseline, taste is newly emerging and relatively stable
    if (longTotal === 0 || shortTotal === 0) {
      return { preferenceStability: 0.75, preferenceChangeRate: 0.25 };
    }

    // Compute distribution overlap (intersection of probability distributions)
    let overlap = 0;
    for (const [g, sCount] of shortMap.entries()) {
      const lCount = longMap.get(g) || 0;
      const sProb = sCount / shortTotal;
      const lProb = lCount / longTotal;
      overlap += Math.min(sProb, lProb);
    }

    const preferenceStability = clampNumber(overlap, 0.05, 1.0, 0.7)!;
    const preferenceChangeRate = Number((1.0 - preferenceStability).toFixed(4));

    return {
      preferenceStability,
      preferenceChangeRate,
    };
  }

  /**
   * Categorizes the user into an intuitive Listener Archetype based on behavioral trait signatures.
   */
  static determineListenerArchetype(traits: {
    repeatListeningTendency: number;
    discoveryTendency: number;
    skipTendency: number;
    familiarityPreference: number;
    explorationTendency: number;
    diversityPreference: number;
    sessionListeningIntensity: number;
    preferenceStability: number;
    isDataSufficient: boolean;
  }): ListenerArchetype {
    if (!traits.isDataSufficient) {
      return 'Casual Listener';
    }

    // 1. Loyalist: high repeats, high familiarity
    if (traits.repeatListeningTendency >= 0.55 && traits.familiarityPreference >= 0.50) {
      return 'Loyalist';
    }

    // 2. Adventurer: high discovery, high exploration
    if (traits.discoveryTendency >= 0.65 && traits.explorationTendency >= 0.55) {
      return 'Adventurer';
    }

    // 3. Eclectic Nomad: high diversity, strong discovery
    if (traits.diversityPreference >= 0.65 && traits.discoveryTendency >= 0.50) {
      return 'Eclectic Nomad';
    }

    // 4. Restless Searcher: high skip tendency
    if (traits.skipTendency >= 0.40) {
      return 'Restless Searcher';
    }

    // 5. Focused Devotee: high session intensity and high stability
    if (traits.sessionListeningIntensity >= 0.60 && traits.preferenceStability >= 0.60) {
      return 'Focused Devotee';
    }

    return 'Balanced Listener';
  }

  // --------------------------------------------------------------------------
  // UTILITY HELPERS
  // --------------------------------------------------------------------------

  private static extractSongId(rec: RawHistoryRecord): string | null {
    if (!rec || !rec.song || typeof rec.song !== 'object') return null;
    return rec.song._id ? rec.song._id.toString() : null;
  }

  private static extractArtistName(rec: RawHistoryRecord): string | null {
    if (!rec || !rec.song || typeof rec.song !== 'object' || !rec.song.artist) return null;
    const a = rec.song.artist;
    return typeof a === 'object' && a.name ? a.name.trim() : String(a).trim();
  }

  private static extractGenreName(rec: RawHistoryRecord): string | null {
    if (!rec || !rec.song || typeof rec.song !== 'object' || !rec.song.genre) return null;
    const g = rec.song.genre;
    return typeof g === 'object' && g.name ? g.name.trim() : String(g).trim();
  }

  private static calculateConfidence(
    totalPlays: number,
    totalSessions: number,
    isDataSufficient: boolean
  ): number {
    if (!isDataSufficient || totalPlays === 0) return 0.0;
    const playScore = Math.min(1.0, totalPlays / 40) * 0.7;
    const sessionScore = Math.min(1.0, totalSessions / 10) * 0.3;
    return clampNumber(playScore + sessionScore, 0.1, 1.0, 0.1)!;
  }
}

export default MusicDNABehaviorProfilingService;
