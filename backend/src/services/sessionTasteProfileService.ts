import { Types } from 'mongoose';
import { IListeningSession } from '../models/ListeningSession.js';
import { ListeningSessionService } from './listeningSessionService.js';
import { Song } from '../models/Song.js';
import { User } from '../models/User.js';

export interface GenrePreferenceSignal {
  genre: string;
  score: number; // Normalized 0.0 to 1.0
  rawWeight: number;
}

export interface ArtistPreferenceSignal {
  artistId: string;
  name: string;
  score: number; // Normalized 0.0 to 1.0
  rawWeight: number;
}

export interface MoodPreferenceSignal {
  mood: string;
  score: number; // Normalized 0.0 to 1.0
}

export interface SessionTasteProfile {
  sessionId: string;
  userId: string;
  totalInteractions: number;
  preferredGenres: GenrePreferenceSignal[];
  preferredArtists: ArtistPreferenceSignal[];
  averageEnergy: number; // 0.0 to 1.0 (weighted)
  averageTempo: number; // BPM (weighted)
  dominantMoods: MoodPreferenceSignal[];
  discoveryLevel: number; // 0.0 to 1.0 (exploratory score)
  interactionSummary: {
    playsCount: number;
    skipsCount: number;
    completionsCount: number;
    replaysCount: number;
    likesCount: number;
  };
  isTemporary: true;
  lastUpdated: Date;
}

export interface InteractionWeightMultipliers {
  play: number;
  complete: number;
  replay: number;
  like: number;
  skip: number;
  queue_add: number;
}

export const DEFAULT_SESSION_INTERACTION_MULTIPLIERS: InteractionWeightMultipliers = {
  play: 1.0,
  complete: 1.5,
  replay: 2.0,
  like: 2.0,
  skip: -1.2,
  queue_add: 1.2,
};

export class SessionTasteProfileService {
  /**
   * Calculates exponential recency weight: items closer to the end of the session sequence receive higher weight.
   * Index (total - 1) has recencyWeight = 1.0.
   */
  private static calculateRecencyWeight(index: number, total: number, lambda = 0.18): number {
    if (total <= 1) return 1.0;
    const distance = total - 1 - index;
    return Number(Math.exp(-lambda * distance).toFixed(4));
  }

  /**
   * Generates a temporary session taste profile from an active or historical ListeningSession document.
   * Accounts for interaction action weights (plays, completes, replays vs negative skips),
   * applies exponential recency weighting, calculates weighted energy/tempo averages,
   * dominant moods, and discovery level.
   * 
   * CRITICAL: Completely isolated from and does not modify the user's permanent long-term preferences.
   */
  static async generateSessionTasteProfile(
    sessionDoc: IListeningSession,
    multipliers: InteractionWeightMultipliers = DEFAULT_SESSION_INTERACTION_MULTIPLIERS
  ): Promise<SessionTasteProfile | null> {
    if (!sessionDoc || !sessionDoc.user) {
      return null;
    }

    const events = sessionDoc.sessionEvents || [];
    const songsPlayed = sessionDoc.tracksPlayed || sessionDoc.songsPlayed || [];
    const tracksSkipped = sessionDoc.tracksSkipped || [];
    const tracksCompleted = sessionDoc.tracksCompleted || [];

    // If no events or plays exist, return null
    if (events.length === 0 && songsPlayed.length === 0) {
      return null;
    }

    // 1. Gather all unique song IDs across plays and events
    const allSongIdSet = new Set<string>();
    songsPlayed.forEach((sp) => {
      if (sp.song) allSongIdSet.add(sp.song.toString());
    });
    events.forEach((ev) => {
      if (ev.song) allSongIdSet.add(ev.song.toString());
    });
    tracksSkipped.forEach((sk) => {
      if (sk.song) allSongIdSet.add(sk.song.toString());
    });
    tracksCompleted.forEach((tc) => {
      if (tc.song) allSongIdSet.add(tc.song.toString());
    });

    const songIds = Array.from(allSongIdSet).filter((id) => Types.ObjectId.isValid(id));
    const songDocs = await Song.find({ _id: { $in: songIds } })
      .populate('artist', 'name')
      .populate('genre', 'name')
      .lean();

    const songMap = new Map<string, any>();
    songDocs.forEach((s) => songMap.set(s._id.toString(), s));

    // Interaction counters
    let playsCount = songsPlayed.length;
    let skipsCount = tracksSkipped.length;
    let completionsCount = tracksCompleted.length;
    let replaysCount = 0;
    let likesCount = 0;

    events.forEach((ev) => {
      if (ev.action === 'replay') replaysCount++;
      if (ev.action === 'like') likesCount++;
      if (ev.action === 'skip' && !tracksSkipped.length) skipsCount++;
      if (ev.action === 'complete' && !tracksCompleted.length) completionsCount++;
    });

    // 2. Build chronological interaction item list for recency weighting
    interface UnifiedInteractionItem {
      songId: string;
      action: string;
      completed: boolean;
      multiplier: number;
    }

    const chronologicalItems: UnifiedInteractionItem[] = [];

    if (events.length > 0) {
      events.forEach((ev) => {
        const songId = ev.song ? ev.song.toString() : '';
        if (!songId || !songMap.has(songId)) return;

        let multiplier = multipliers.play;
        if (ev.action === 'complete') multiplier = multipliers.complete;
        else if (ev.action === 'replay') multiplier = multipliers.replay;
        else if (ev.action === 'like') multiplier = multipliers.like;
        else if (ev.action === 'skip') multiplier = multipliers.skip;

        chronologicalItems.push({
          songId,
          action: ev.action,
          completed: ev.action === 'complete',
          multiplier,
        });
      });
    } else {
      songsPlayed.forEach((sp) => {
        const songId = sp.song.toString();
        if (!songMap.has(songId)) return;

        chronologicalItems.push({
          songId,
          action: 'play',
          completed: Boolean(sp.completed),
          multiplier: sp.completed ? multipliers.complete : multipliers.play,
        });
      });
    }

    const totalInteractions = chronologicalItems.length;
    if (totalInteractions === 0) {
      return null;
    }

    // 3. Accumulate weighted signals
    const genreScoreMap = new Map<string, number>();
    const artistScoreMap = new Map<string, { name: string; weight: number }>();
    const moodScoreMap = new Map<string, number>();

    let totalPositiveWeight = 0;
    let weightedEnergySum = 0;
    let energyWeightSum = 0;
    let weightedTempoSum = 0;
    let tempoWeightSum = 0;
    let novelTracksCount = 0;

    // Fetch user's long-term top genres to calculate discovery ratio without modifying them
    let userTopGenres = new Set<string>();
    try {
      const userDoc: any = await User.findById(sessionDoc.user).populate('favoriteGenres', 'name').lean();
      if (userDoc && Array.isArray(userDoc.favoriteGenres)) {
        userDoc.favoriteGenres.forEach((g: any) => {
          const name = typeof g === 'object' && g && 'name' in g ? g.name : g;
          if (name) userTopGenres.add(String(name).toLowerCase());
        });
      }
    } catch {
      // Non-blocking fallback
    }

    chronologicalItems.forEach((item, index) => {
      const song = songMap.get(item.songId);
      if (!song) return;

      const recency = this.calculateRecencyWeight(index, totalInteractions);
      const effectiveWeight = item.multiplier * recency;

      // Extract genre name
      const genreName =
        typeof song.genre === 'object' && song.genre && 'name' in song.genre
          ? String(song.genre.name).trim()
          : String(song.genre || 'Unknown').trim();

      // Extract artist ID and Name
      const artistId =
        typeof song.artist === 'object' && song.artist && '_id' in song.artist
          ? String(song.artist._id)
          : String(song.artist || 'unknown');
      const artistName =
        typeof song.artist === 'object' && song.artist && 'name' in song.artist
          ? String(song.artist.name).trim()
          : 'Unknown Artist';

      // Extract Mood
      const moodStr = String(song.mood || 'Upbeat').trim();

      // Update genre signals
      const currentGenreWeight = genreScoreMap.get(genreName) || 0;
      genreScoreMap.set(genreName, Math.max(0, currentGenreWeight + effectiveWeight));

      // Update artist signals
      const currentArtist = artistScoreMap.get(artistId) || { name: artistName, weight: 0 };
      artistScoreMap.set(artistId, {
        name: artistName,
        weight: Math.max(0, currentArtist.weight + effectiveWeight),
      });

      // Update mood signals
      const currentMoodWeight = moodScoreMap.get(moodStr) || 0;
      moodScoreMap.set(moodStr, Math.max(0, currentMoodWeight + effectiveWeight));

      // Only positive interactions contribute to average acoustic baseline
      if (effectiveWeight > 0) {
        totalPositiveWeight += effectiveWeight;

        if (song.audioFeatures) {
          if (typeof song.audioFeatures.energy === 'number' && Number.isFinite(song.audioFeatures.energy)) {
            weightedEnergySum += song.audioFeatures.energy * effectiveWeight;
            energyWeightSum += effectiveWeight;
          }
          if (typeof song.audioFeatures.tempo === 'number' && song.audioFeatures.tempo > 0) {
            weightedTempoSum += song.audioFeatures.tempo * effectiveWeight;
            tempoWeightSum += effectiveWeight;
          } else if (typeof song.audioFeatures.bpm === 'number' && song.audioFeatures.bpm > 0) {
            weightedTempoSum += song.audioFeatures.bpm * effectiveWeight;
            tempoWeightSum += effectiveWeight;
          }
        }

        // Discovery calculation: check if track's genre is novel compared to long-term profile
        if (genreName && !userTopGenres.has(genreName.toLowerCase())) {
          novelTracksCount++;
        }
      }
    });

    // 4. Normalize outputs
    const genreTotalSum = Array.from(genreScoreMap.values()).reduce((sum, w) => sum + w, 0) || 1;
    const preferredGenres: GenrePreferenceSignal[] = Array.from(genreScoreMap.entries())
      .map(([genre, rawWeight]) => ({
        genre,
        score: Number(Math.max(0, Math.min(1, rawWeight / genreTotalSum)).toFixed(4)),
        rawWeight: Number(rawWeight.toFixed(4)),
      }))
      .filter((g) => g.score > 0)
      .sort((a, b) => b.score - a.score);

    const artistTotalSum = Array.from(artistScoreMap.values()).reduce((sum, a) => sum + a.weight, 0) || 1;
    const preferredArtists: ArtistPreferenceSignal[] = Array.from(artistScoreMap.entries())
      .map(([artistId, info]) => ({
        artistId,
        name: info.name,
        score: Number(Math.max(0, Math.min(1, info.weight / artistTotalSum)).toFixed(4)),
        rawWeight: Number(info.weight.toFixed(4)),
      }))
      .filter((a) => a.score > 0)
      .sort((a, b) => b.score - a.score);

    const moodTotalSum = Array.from(moodScoreMap.values()).reduce((sum, w) => sum + w, 0) || 1;
    const dominantMoods: MoodPreferenceSignal[] = Array.from(moodScoreMap.entries())
      .map(([mood, rawWeight]) => ({
        mood,
        score: Number(Math.max(0, Math.min(1, rawWeight / moodTotalSum)).toFixed(4)),
      }))
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score);

    const averageEnergy =
      energyWeightSum > 0
        ? Number(Math.max(0, Math.min(1, weightedEnergySum / energyWeightSum)).toFixed(4))
        : 0.55;

    const averageTempo =
      tempoWeightSum > 0
        ? Number(Math.max(30, Math.min(250, Math.round(weightedTempoSum / tempoWeightSum))))
        : 110;

    const discoveryLevel =
      totalInteractions > 0
        ? Number(Math.max(0, Math.min(1, novelTracksCount / totalInteractions)).toFixed(4))
        : 0.50;

    return {
      sessionId: sessionDoc._id.toString(),
      userId: sessionDoc.user.toString(),
      totalInteractions,
      preferredGenres,
      preferredArtists,
      averageEnergy,
      averageTempo,
      dominantMoods,
      discoveryLevel,
      interactionSummary: {
        playsCount,
        skipsCount,
        completionsCount,
        replaysCount,
        likesCount,
      },
      isTemporary: true,
      lastUpdated: new Date(),
    };
  }

  /**
   * Retrieves the user's active listening session and calculates their temporary session taste profile.
   */
  static async getActiveSessionTasteProfile(userId: string): Promise<SessionTasteProfile | null> {
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return null;
    }

    const activeSession = await ListeningSessionService.getActiveSession(userId);
    if (!activeSession) {
      return null;
    }

    return await this.generateSessionTasteProfile(activeSession);
  }
}

export default SessionTasteProfileService;
