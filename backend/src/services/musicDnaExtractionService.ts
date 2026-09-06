import { Types } from 'mongoose';
import { User } from '../models/User.js';
import { ListeningHistory } from '../models/ListeningHistory.js';
import { MusicDNA, IMusicDNA } from '../models/MusicDNA.js';
import {
  MusicDNAGenrePreference,
  MusicDNAArtistPreference,
  MusicDNAMoodPreference,
  MusicDNAListeningPatterns,
  MusicDNATendencyDimensions,
  MusicDNATemporalTaste,
  MusicDNATemporalWindowPreference,
  MusicDNAProfileAttributes,
  DetailedMusicDNAProfile,
  DEFAULT_TENDENCY_DIMENSIONS,
  DEFAULT_LISTENING_PATTERNS,
  DEFAULT_TEMPORAL_TASTE,
  clampNumber,
} from '../schemas/musicDnaSchema.js';
import { IAudioFeatures } from '../models/Song.js';
import { MusicDNAProfilingService } from './musicDnaProfilingService.js';

export interface RawSongData {
  _id: string;
  title?: string;
  genre?: { _id: string; name: string } | string;
  artist?: { _id: string; name: string } | string;
  mood?: string;
  duration?: number;
  audioFeatures?: IAudioFeatures;
}

export interface RawHistoryRecord {
  song?: RawSongData | null;
  playedAt?: Date;
  completed?: boolean;
  skipped?: boolean;
  progressPercent?: number;
  durationSeconds?: number;
}

export interface RawUserData {
  _id: string;
  likedSongs?: (RawSongData | string)[];
  favoriteGenres?: ({ _id: string; name: string } | string)[];
  favoriteArtists?: ({ _id: string; name: string } | string)[];
}

export interface ExtractionRawInputs {
  userId: string;
  user?: RawUserData | null;
  history?: RawHistoryRecord[];
  referenceDate?: Date;
}

export interface ExtractionOptions {
  referenceDate?: Date;
  shortTermDays?: number;
  longTermDays?: number;
  persist?: boolean;
}

export class MusicDNAExtractionService {
  /**
   * Pure in-memory extraction pipeline that processes raw user & history inputs
   * without requiring direct MongoDB queries. Highly reusable, modular, and fast.
   */
  static extractFromRawData(inputs: ExtractionRawInputs, options: ExtractionOptions = {}): MusicDNAProfileAttributes {
    const { userId, user, history = [] } = inputs;
    const now = options.referenceDate || new Date();
    const shortTermDays = options.shortTermDays || 14;
    const longTermDays = options.longTermDays || 180;

    const shortTermCutoff = new Date(now.getTime() - shortTermDays * 24 * 60 * 60 * 1000);
    const longTermCutoff = new Date(now.getTime() - longTermDays * 24 * 60 * 60 * 1000);

    const totalPlays = history.length;
    const likedSongs = user?.likedSongs || [];
    const favoriteGenres = user?.favoriteGenres || [];
    const favoriteArtists = user?.favoriteArtists || [];

    // 1. Genre Preferences Extraction
    const genres = this.extractGenrePreferences(history, likedSongs, favoriteGenres);

    // 2. Artist Preferences Extraction
    const artists = this.extractArtistPreferences(history, likedSongs, favoriteArtists);

    // 3. Mood Preferences Extraction
    const moods = this.extractMoodPreferences(history, likedSongs);

    // 4. Listening Patterns Extraction
    const listeningPatterns = this.extractListeningPatterns(history);

    // 5. Behavioral Tendencies Extraction (discovery, familiarity, diversity, exploration)
    const tendencies = this.extractTendencyDimensions(history, likedSongs, genres, artists);

    // 6. Temporal Taste Extraction
    const temporalTaste = this.extractTemporalTaste(
      history,
      shortTermCutoff,
      longTermCutoff,
      genres,
      artists,
      moods,
      now
    );

    // 7. Confidence Score Calculation
    const confidenceScore = this.calculateConfidenceScore(totalPlays, likedSongs.length, favoriteGenres.length, favoriteArtists.length);

    return {
      userId,
      dnaVersion: '1.0.0',
      genres,
      artists,
      moods,
      listeningPatterns,
      tendencies,
      temporalTaste,
      confidenceScore,
      metadata: {
        extractedAt: now.toISOString(),
        totalPlaysAnalyzed: totalPlays,
        totalLikesAnalyzed: likedSongs.length,
        historyTier: totalPlays === 0 ? 'NO_HISTORY' : totalPlays < 10 ? 'LIMITED_HISTORY' : 'LARGE_HISTORY',
      },
    };
  }

  /**
   * Fetches user profile and listening history from MongoDB and extracts Music DNA.
   */
  static async extractMusicDNA(
    userId: string,
    options: ExtractionOptions = {}
  ): Promise<MusicDNAProfileAttributes> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }

    const userObjectId = new Types.ObjectId(userId);

    // 1. Fetch User with populated preferences and liked songs
    const userDoc = await User.findById(userObjectId)
      .populate({
        path: 'likedSongs',
        populate: [
          { path: 'genre', select: 'name' },
          { path: 'artist', select: 'name' },
        ],
      })
      .populate('favoriteGenres', 'name')
      .populate('favoriteArtists', 'name')
      .lean();

    // 2. Fetch Listening History
    const historyDocs = await ListeningHistory.find({ user: userObjectId })
      .populate({
        path: 'song',
        populate: [
          { path: 'genre', select: 'name' },
          { path: 'artist', select: 'name' },
        ],
      })
      .sort({ playedAt: -1 })
      .lean();

    const rawInputs: ExtractionRawInputs = {
      userId,
      user: userDoc as any,
      history: historyDocs as any,
      referenceDate: options.referenceDate,
    };

    return this.extractFromRawData(rawInputs, options);
  }

  /**
   * Extracts Music DNA and persists/updates the user's MusicDNA model document in MongoDB.
   */
  static async extractAndPersistMusicDNA(
    userId: string,
    options: ExtractionOptions = {}
  ): Promise<IMusicDNA> {
    const extracted = await this.extractMusicDNA(userId, options);

    const existing = await MusicDNA.findByUserId(userId);
    if (existing) {
      existing.genres = extracted.genres as any;
      existing.artists = extracted.artists as any;
      existing.moods = extracted.moods as any;
      existing.listeningPatterns = extracted.listeningPatterns as any;
      existing.tendencies = extracted.tendencies as any;
      existing.temporalTaste = extracted.temporalTaste as any;
      existing.confidenceScore = extracted.confidenceScore;
      existing.metadata = {
        ...existing.metadata,
        ...extracted.metadata,
      };
      return await existing.save();
    }

    const newDoc = new MusicDNA(extracted);
    return await newDoc.save();
  }

  /**
   * Generates a Detailed Music DNA Profile from in-memory inputs, distinguishing
   * established vs emerging preferences and evaluating genre & artist diversity.
   */
  static generateDetailedProfileFromData(
    inputs: ExtractionRawInputs,
    options: ExtractionOptions = {}
  ): DetailedMusicDNAProfile {
    return MusicDNAProfilingService.generateDetailedProfileFromData(inputs, options);
  }

  /**
   * Fetches user history from MongoDB and generates a Detailed Music DNA Profile.
   */
  static async generateDetailedProfile(
    userId: string,
    options: ExtractionOptions = {}
  ): Promise<DetailedMusicDNAProfile> {
    return await MusicDNAProfilingService.generateDetailedProfile(userId, options);
  }

  // --------------------------------------------------------------------------
  // MODULAR SUB-EXTRACTION FUNCTIONS
  // --------------------------------------------------------------------------

  /**
   * Extracts weighted genre preferences from plays, likes, and explicit preferences.
   */
  static extractGenrePreferences(
    history: RawHistoryRecord[],
    likedSongs: any[],
    favoriteGenres: any[]
  ): MusicDNAGenrePreference[] {
    const genreMap = new Map<
      string,
      { genreId?: string; name: string; score: number; playCount: number; lastInteractionAt: Date }
    >();

    const getOrCreate = (id: string, name: string) => {
      if (!genreMap.has(id)) {
        genreMap.set(id, {
          genreId: id,
          name: name || 'Unknown Genre',
          score: 0,
          playCount: 0,
          lastInteractionAt: new Date(0),
        });
      }
      return genreMap.get(id)!;
    };

    // Explicit Favorites Seed (weight +10)
    for (const fg of favoriteGenres) {
      if (!fg) continue;
      const id = typeof fg === 'object' && fg._id ? fg._id.toString() : String(fg);
      const name = typeof fg === 'object' && fg.name ? fg.name : id;
      const acc = getOrCreate(id, name);
      acc.score += 10;
      acc.lastInteractionAt = new Date();
    }

    // Liked Songs Seed (weight +5)
    for (const song of likedSongs) {
      if (!song || typeof song !== 'object' || !song.genre) continue;
      const g = song.genre;
      const id = typeof g === 'object' && g._id ? g._id.toString() : String(g);
      const name = typeof g === 'object' && g.name ? g.name : id;
      const acc = getOrCreate(id, name);
      acc.score += 5;
      if (acc.lastInteractionAt.getTime() === 0) acc.lastInteractionAt = new Date();
    }

    // Listening History plays
    for (const rec of history) {
      if (!rec.song || typeof rec.song !== 'object' || !rec.song.genre) continue;
      const g = rec.song.genre;
      const id = typeof g === 'object' && g._id ? g._id.toString() : String(g);
      const name = typeof g === 'object' && g.name ? g.name : id;
      const acc = getOrCreate(id, name);

      acc.playCount += 1;
      let playWeight = 4;
      if (rec.skipped) playWeight = -1;
      else if (rec.completed === false) playWeight = 2;

      acc.score = Math.max(0, acc.score + playWeight);

      const playedAt = rec.playedAt ? new Date(rec.playedAt) : new Date();
      if (playedAt > acc.lastInteractionAt) {
        acc.lastInteractionAt = playedAt;
      }
    }

    const items = Array.from(genreMap.values());
    if (items.length === 0) return [];

    const maxScore = Math.max(...items.map((i) => i.score), 1);

    return items
      .map((item) => ({
        genre: item.genreId,
        name: item.name,
        affinityScore: clampNumber(item.score / maxScore, 0.0, 1.0, 0.5)!,
        playCount: item.playCount,
        lastInteractionAt: item.lastInteractionAt.getTime() === 0 ? new Date() : item.lastInteractionAt,
      }))
      .sort((a, b) => b.affinityScore - a.affinityScore);
  }

  /**
   * Extracts weighted artist preferences from plays, likes, and explicit preferences.
   */
  static extractArtistPreferences(
    history: RawHistoryRecord[],
    likedSongs: any[],
    favoriteArtists: any[]
  ): MusicDNAArtistPreference[] {
    const artistMap = new Map<
      string,
      { artistId?: string; name: string; score: number; playCount: number; lastInteractionAt: Date }
    >();

    const getOrCreate = (id: string, name: string) => {
      if (!artistMap.has(id)) {
        artistMap.set(id, {
          artistId: id,
          name: name || 'Unknown Artist',
          score: 0,
          playCount: 0,
          lastInteractionAt: new Date(0),
        });
      }
      return artistMap.get(id)!;
    };

    // Explicit Favorite Artists (weight +10)
    for (const fa of favoriteArtists) {
      if (!fa) continue;
      const id = typeof fa === 'object' && fa._id ? fa._id.toString() : String(fa);
      const name = typeof fa === 'object' && fa.name ? fa.name : id;
      const acc = getOrCreate(id, name);
      acc.score += 10;
      acc.lastInteractionAt = new Date();
    }

    // Liked Songs (weight +5)
    for (const song of likedSongs) {
      if (!song || typeof song !== 'object' || !song.artist) continue;
      const a = song.artist;
      const id = typeof a === 'object' && a._id ? a._id.toString() : String(a);
      const name = typeof a === 'object' && a.name ? a.name : id;
      const acc = getOrCreate(id, name);
      acc.score += 5;
      if (acc.lastInteractionAt.getTime() === 0) acc.lastInteractionAt = new Date();
    }

    // Listening History
    for (const rec of history) {
      if (!rec.song || typeof rec.song !== 'object' || !rec.song.artist) continue;
      const a = rec.song.artist;
      const id = typeof a === 'object' && a._id ? a._id.toString() : String(a);
      const name = typeof a === 'object' && a.name ? a.name : id;
      const acc = getOrCreate(id, name);

      acc.playCount += 1;
      let playWeight = 4;
      if (rec.skipped) playWeight = -1;
      else if (rec.completed === false) playWeight = 2;

      acc.score = Math.max(0, acc.score + playWeight);

      const playedAt = rec.playedAt ? new Date(rec.playedAt) : new Date();
      if (playedAt > acc.lastInteractionAt) {
        acc.lastInteractionAt = playedAt;
      }
    }

    const items = Array.from(artistMap.values());
    if (items.length === 0) return [];

    const maxScore = Math.max(...items.map((i) => i.score), 1);

    return items
      .map((item) => ({
        artist: item.artistId,
        name: item.name,
        affinityScore: clampNumber(item.score / maxScore, 0.0, 1.0, 0.5)!,
        playCount: item.playCount,
        lastInteractionAt: item.lastInteractionAt.getTime() === 0 ? new Date() : item.lastInteractionAt,
      }))
      .sort((a, b) => b.affinityScore - a.affinityScore);
  }

  /**
   * Extracts mood preferences from listening history and liked tracks.
   */
  static extractMoodPreferences(
    history: RawHistoryRecord[],
    likedSongs: any[]
  ): MusicDNAMoodPreference[] {
    const moodMap = new Map<string, { count: number; playCount: number; lastInteractionAt: Date }>();

    for (const song of likedSongs) {
      if (!song || typeof song !== 'object' || !song.mood) continue;
      const mood = String(song.mood).trim();
      if (!mood) continue;
      const current = moodMap.get(mood) || { count: 0, playCount: 0, lastInteractionAt: new Date() };
      current.count += 2; // Extra weight for liked tracks
      moodMap.set(mood, current);
    }

    for (const rec of history) {
      if (!rec.song || typeof rec.song !== 'object' || !rec.song.mood) continue;
      const mood = String(rec.song.mood).trim();
      if (!mood) continue;
      const current = moodMap.get(mood) || { count: 0, playCount: 0, lastInteractionAt: new Date(0) };
      current.count += rec.skipped ? 0.5 : 1.5;
      current.playCount += 1;
      const playedAt = rec.playedAt ? new Date(rec.playedAt) : new Date();
      if (playedAt > current.lastInteractionAt) {
        current.lastInteractionAt = playedAt;
      }
      moodMap.set(mood, current);
    }

    const items = Array.from(moodMap.entries());
    if (items.length === 0) return [];

    const maxCount = Math.max(...items.map((i) => i[1].count), 1);

    return items
      .map(([mood, data]) => ({
        mood,
        affinityScore: clampNumber(data.count / maxCount, 0.0, 1.0, 0.5)!,
        playCount: data.playCount,
        lastInteractionAt: data.lastInteractionAt.getTime() === 0 ? new Date() : data.lastInteractionAt,
      }))
      .sort((a, b) => b.affinityScore - a.affinityScore);
  }

  /**
   * Extracts listening patterns: time-of-day distribution, session statistics,
   * skip rate, completion rate, replay rate, and audio feature averages.
   */
  static extractListeningPatterns(history: RawHistoryRecord[]): MusicDNAListeningPatterns {
    if (!history || history.length === 0) {
      return { ...DEFAULT_LISTENING_PATTERNS };
    }

    const totalPlays = history.length;
    let skipsCount = 0;
    let completedCount = 0;

    const timeBuckets = {
      morning: 0,    // 06:00 - 11:59
      afternoon: 0,  // 12:00 - 16:59
      evening: 0,    // 17:00 - 20:59
      night: 0,      // 21:00 - 01:59
      late_night: 0, // 02:00 - 05:59
    };

    const songPlayCount = new Map<string, number>();

    // Audio features accumulator
    let totalEnergy = 0,
      totalDance = 0,
      totalValence = 0,
      totalAcoustic = 0,
      totalInstrumental = 0;
    let audioFeatureSongCount = 0;

    const tempoList: number[] = [];

    // Session duration estimation
    let totalListeningDurationSecs = 0;

    for (const rec of history) {
      if (rec.skipped) skipsCount++;
      if (rec.completed) completedCount++;

      // Time of day
      const playedAt = rec.playedAt ? new Date(rec.playedAt) : new Date();
      const hour = playedAt.getHours();

      if (hour >= 6 && hour < 12) timeBuckets.morning++;
      else if (hour >= 12 && hour < 17) timeBuckets.afternoon++;
      else if (hour >= 17 && hour < 21) timeBuckets.evening++;
      else if (hour >= 21 || hour < 2) timeBuckets.night++;
      else timeBuckets.late_night++;

      // Replay count
      if (rec.song && typeof rec.song === 'object') {
        const songId = rec.song._id ? rec.song._id.toString() : '';
        if (songId) {
          songPlayCount.set(songId, (songPlayCount.get(songId) || 0) + 1);
        }

        // Duration
        const dur = rec.durationSeconds ?? rec.song.duration ?? 180;
        totalListeningDurationSecs += dur;

        // Audio features
        const af = rec.song.audioFeatures;
        if (af) {
          if (af.energy !== undefined) totalEnergy += af.energy;
          if (af.danceability !== undefined) totalDance += af.danceability;
          if (af.valence !== undefined) totalValence += af.valence;
          if (af.acousticness !== undefined) totalAcoustic += af.acousticness;
          if (af.instrumentalness !== undefined) totalInstrumental += af.instrumentalness;
          if (af.bpm !== undefined && af.bpm > 0) tempoList.push(af.bpm);
          audioFeatureSongCount++;
        }
      }
    }

    // Time-of-day distribution normalized
    const timeOfDayDistribution = {
      morning: Number((timeBuckets.morning / totalPlays).toFixed(4)),
      afternoon: Number((timeBuckets.afternoon / totalPlays).toFixed(4)),
      evening: Number((timeBuckets.evening / totalPlays).toFixed(4)),
      night: Number((timeBuckets.night / totalPlays).toFixed(4)),
      late_night: Number((timeBuckets.late_night / totalPlays).toFixed(4)),
    };

    // Bayesian smoothed skip & completion rates for limited data
    const priorPlays = 5;
    const skipRate = Number(((skipsCount + 0.75) / (totalPlays + priorPlays)).toFixed(4));
    const completionRate = Number(((completedCount + 4.25) / (totalPlays + priorPlays)).toFixed(4));

    // Replay Rate = (totalPlays - uniqueSongs) / totalPlays
    const uniqueSongsCount = songPlayCount.size;
    const rawReplayRate = totalPlays > 1 ? (totalPlays - uniqueSongsCount) / (totalPlays - 1) : 0;
    const replayRate = clampNumber(rawReplayRate, 0.0, 1.0, 0.2)!;

    // Average session duration estimate (approx based on grouping)
    const avgSessionMinutes = Math.min(
      180,
      Math.max(10, Math.round(totalListeningDurationSecs / (Math.max(1, uniqueSongsCount * 0.4) * 60)))
    );

    // Audio Features
    const audioFeaturePreferences: Partial<IAudioFeatures> =
      audioFeatureSongCount > 0
        ? {
            energy: Number((totalEnergy / audioFeatureSongCount).toFixed(4)),
            danceability: Number((totalDance / audioFeatureSongCount).toFixed(4)),
            valence: Number((totalValence / audioFeatureSongCount).toFixed(4)),
            acousticness: Number((totalAcoustic / audioFeatureSongCount).toFixed(4)),
            instrumentalness: Number((totalInstrumental / audioFeatureSongCount).toFixed(4)),
          }
        : { ...DEFAULT_LISTENING_PATTERNS.audioFeaturePreferences };

    // Preferred Tempo
    const avgBpm =
      tempoList.length > 0
        ? Math.round(tempoList.reduce((a, b) => a + b, 0) / tempoList.length)
        : 115;
    const minBpm = tempoList.length > 0 ? Math.min(...tempoList) : 80;
    const maxBpm = tempoList.length > 0 ? Math.max(...tempoList) : 140;

    return {
      timeOfDayDistribution,
      avgSessionDurationMinutes: avgSessionMinutes,
      skipRate,
      completionRate,
      replayRate,
      preferredSituations: [...(DEFAULT_LISTENING_PATTERNS.preferredSituations || [])],
      audioFeaturePreferences,
      preferredTempo: {
        min: minBpm,
        max: maxBpm,
        target: avgBpm,
      },
    };
  }

  /**
   * Extracts behavioral tendency dimensions:
   * - discoveryTendency: openness to new tracks
   * - familiarityPreference: comfort with known favorites and repeated tracks
   * - diversityPreference: Shannon entropy across genre/artist distribution
   * - explorationPreference: proactive exploration willingness
   */
  static extractTendencyDimensions(
    history: RawHistoryRecord[],
    likedSongs: any[],
    genres: MusicDNAGenrePreference[],
    artists: MusicDNAArtistPreference[]
  ): MusicDNATendencyDimensions {
    if (!history || history.length === 0) {
      return { ...DEFAULT_TENDENCY_DIMENSIONS };
    }

    const totalPlays = history.length;

    // Track unique vs repeated plays
    const songCounts = new Map<string, number>();
    for (const rec of history) {
      if (rec.song && typeof rec.song === 'object' && rec.song._id) {
        const id = rec.song._id.toString();
        songCounts.set(id, (songCounts.get(id) || 0) + 1);
      }
    }

    const uniqueSongs = songCounts.size;
    const repeatedPlays = totalPlays - uniqueSongs;
    const repeatRatio = totalPlays > 1 ? repeatedPlays / totalPlays : 0.0;

    // 1. Familiarity Preference: high when repeat ratio is high and liked tracks are frequently listened to
    const familiarityScore = 0.25 + 0.55 * repeatRatio + (likedSongs.length > 0 ? 0.15 : 0);
    const familiarityPreference = clampNumber(familiarityScore, 0.0, 1.0, 0.5)!;

    // 2. Discovery Tendency: high when user listens to many distinct songs with few repeats
    const uniqueRatio = totalPlays > 0 ? uniqueSongs / totalPlays : 0.5;
    const discoveryScore = 0.2 + 0.65 * uniqueRatio;
    const discoveryTendency = clampNumber(discoveryScore, 0.0, 1.0, 0.5)!;

    // 3. Diversity Preference: calculated via normalized Shannon Entropy of genres and artists
    const genrePlayTotal = genres.reduce((acc, g) => acc + g.playCount, 0);
    let genreEntropy = 0;
    if (genrePlayTotal > 0 && genres.length > 1) {
      for (const g of genres) {
        if (g.playCount > 0) {
          const p = g.playCount / genrePlayTotal;
          genreEntropy -= p * Math.log2(p);
        }
      }
      // Normalize entropy by log2(K)
      genreEntropy = genreEntropy / Math.log2(genres.length);
    } else if (genres.length === 1) {
      genreEntropy = 0.2; // Monoculture
    } else {
      genreEntropy = 0.5;
    }

    const diversityPreference = clampNumber(genreEntropy, 0.0, 1.0, 0.5)!;

    // 4. Exploration Preference: blend of discovery tendency and genre diversity
    const explorationScore = 0.55 * discoveryTendency + 0.45 * diversityPreference;
    const explorationPreference = clampNumber(explorationScore, 0.0, 1.0, 0.5)!;

    return {
      discoveryTendency,
      familiarityPreference,
      diversityPreference,
      explorationPreference,
    };
  }

  /**
   * Extracts temporal taste dynamics, comparing short-term (14d) vs long-term (180d)
   * to determine stability, trending genres, and emerging tastes.
   */
  static extractTemporalTaste(
    history: RawHistoryRecord[],
    shortTermCutoff: Date,
    longTermCutoff: Date,
    allGenres: MusicDNAGenrePreference[],
    allArtists: MusicDNAArtistPreference[],
    allMoods: MusicDNAMoodPreference[],
    referenceDate: Date
  ): MusicDNATemporalTaste {
    if (!history || history.length === 0) {
      return { ...DEFAULT_TEMPORAL_TASTE, lastCalculatedAt: referenceDate };
    }

    const shortTermPlays: RawHistoryRecord[] = [];
    const longTermPlays: RawHistoryRecord[] = [];

    for (const rec of history) {
      const playedAt = rec.playedAt ? new Date(rec.playedAt) : referenceDate;
      if (playedAt >= shortTermCutoff) {
        shortTermPlays.push(rec);
      }
      if (playedAt >= longTermCutoff) {
        longTermPlays.push(rec);
      }
    }

    // Genre frequencies across short and long horizons
    const shortGenreCount = new Map<string, number>();
    const longGenreCount = new Map<string, number>();

    const getGenreName = (rec: RawHistoryRecord): string | null => {
      if (!rec.song || typeof rec.song !== 'object' || !rec.song.genre) return null;
      const g = rec.song.genre;
      return typeof g === 'object' && g.name ? g.name : String(g);
    };

    for (const rec of shortTermPlays) {
      const gName = getGenreName(rec);
      if (gName) shortGenreCount.set(gName, (shortGenreCount.get(gName) || 0) + 1);
    }

    for (const rec of longTermPlays) {
      const gName = getGenreName(rec);
      if (gName) longGenreCount.set(gName, (longGenreCount.get(gName) || 0) + 1);
    }

    const shortTotal = Math.max(1, shortTermPlays.length);
    const longTotal = Math.max(1, longTermPlays.length);

    // Identify Trending Genres (short-term proportion significantly exceeds long-term)
    const trendingGenres: string[] = [];
    const emergingGenres: string[] = [];
    const decliningGenres: string[] = [];

    for (const [gName, shortCnt] of shortGenreCount.entries()) {
      const shortRatio = shortCnt / shortTotal;
      const longRatio = (longGenreCount.get(gName) || 0) / longTotal;

      if (!longGenreCount.has(gName) && shortCnt >= 2) {
        emergingGenres.push(gName);
      } else if (shortRatio - longRatio >= 0.15) {
        trendingGenres.push(gName);
      }
    }

    for (const [gName, longCnt] of longGenreCount.entries()) {
      const longRatio = longCnt / longTotal;
      const shortRatio = (shortGenreCount.get(gName) || 0) / shortTotal;
      if (longRatio >= 0.2 && shortRatio <= 0.05) {
        decliningGenres.push(gName);
      }
    }

    // Compute Taste Stability Score [0.0, 1.0]
    // Overlap / Cosine similarity between short-term top genres and long-term top genres
    let stabilityScore = 0.7;
    if (shortGenreCount.size > 0 && longGenreCount.size > 0) {
      let intersectionWeight = 0;
      for (const [gName, sCnt] of shortGenreCount.entries()) {
        const sP = sCnt / shortTotal;
        const lP = (longGenreCount.get(gName) || 0) / longTotal;
        intersectionWeight += Math.min(sP, lP);
      }
      stabilityScore = clampNumber(intersectionWeight, 0.1, 1.0, 0.7)!;
    }

    // Build Temporal Affinities
    const temporalAffinities: MusicDNATemporalWindowPreference[] = [
      {
        window: 'short_term',
        topGenres: Array.from(shortGenreCount.keys()).slice(0, 5),
        topArtists: allArtists.slice(0, 3).map((a) => a.name),
        topMoods: allMoods.slice(0, 3).map((m) => String(m.mood)),
        score: 0.85,
      },
      {
        window: 'medium_term',
        topGenres: allGenres.slice(0, 5).map((g) => g.name),
        topArtists: allArtists.slice(0, 5).map((a) => a.name),
        topMoods: allMoods.slice(0, 5).map((m) => String(m.mood)),
        score: 0.75,
      },
      {
        window: 'long_term',
        topGenres: Array.from(longGenreCount.keys()).slice(0, 5),
        topArtists: allArtists.slice(0, 5).map((a) => a.name),
        topMoods: allMoods.slice(0, 5).map((m) => String(m.mood)),
        score: 0.65,
      },
    ];

    return {
      stabilityScore,
      activeTimeWindow: 'medium_term',
      trendingGenres: trendingGenres.slice(0, 5),
      emergingGenres: emergingGenres.slice(0, 5),
      decliningGenres: decliningGenres.slice(0, 5),
      temporalAffinities,
      lastCalculatedAt: referenceDate,
    };
  }

  /**
   * Calculates overall confidence score in [0.0, 1.0] reflecting data volume completeness.
   */
  static calculateConfidenceScore(
    totalPlays: number,
    likedCount: number,
    favoriteGenresCount: number,
    favoriteArtistsCount: number
  ): number {
    if (totalPlays === 0 && likedCount === 0) {
      return favoriteGenresCount > 0 || favoriteArtistsCount > 0 ? 0.15 : 0.05;
    }

    // Base confidence for having at least 1 interaction
    const base = 0.1;

    // Play volume factor (up to 0.70 saturated at 30 plays)
    const playFactor = Math.min(1.0, totalPlays / 30) * 0.7;

    // Likes factor (bonus up to 0.15 saturated at 10 likes)
    const likesFactor = Math.min(1.0, likedCount / 10) * 0.15;

    // Explicit favorites bonus (up to 0.05)
    const explicitFactor = favoriteGenresCount > 0 || favoriteArtistsCount > 0 ? 0.05 : 0;

    const score = base + playFactor + likesFactor + explicitFactor;
    return clampNumber(score, 0.05, 1.0, 0.1)!;
  }
}

export default MusicDNAExtractionService;
