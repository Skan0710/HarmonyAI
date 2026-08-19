import { Types } from 'mongoose';
import { IListeningSession, SessionActionType } from '../models/ListeningSession.js';
import { ListeningSessionService } from './listeningSessionService.js';
import { SessionProfileService, TemporarySessionProfile } from './sessionProfileService.js';
import { Song } from '../models/Song.js';

export const ACTION_WEIGHT_MULTIPLIERS: Record<SessionActionType, number> = {
  like: 2.0,       // Strong positive boost
  replay: 1.75,    // Strong positive re-engagement
  complete: 1.25,  // Positive track completion
  play: 1.0,       // Standard play
  queue_add: 1.0,  // Standard queue insertion
  skip: -1.25,     // Negative penalty for skipped tracks
};

export class SessionPreferenceUpdateService {
  /**
   * Calculates exponential recency weight for event at index i out of total M events (0-indexed).
   */
  private static calculateEventRecencyWeight(index: number, totalEvents: number, lambda = 0.15): number {
    const distance = totalEvents - 1 - index;
    return Math.exp(-lambda * distance);
  }

  /**
   * Updates active session profile preferences based on real-time interaction events (play, skip, like, replay, queue_add, complete).
   * - Increases preference strength for liked and replayed songs.
   * - Reduces preference strength for skipped songs.
   * - Gives higher importance to recent interactions.
   * - Updates genre, artist, mood, energy, and tempo preferences.
   * - Keeps update logic isolated without modifying long-term user taste profiles.
   */
  static async updateSessionProfileFromInteractions(
    sessionDoc: IListeningSession
  ): Promise<TemporarySessionProfile | null> {
    if (!sessionDoc) return null;

    const events = sessionDoc.sessionEvents || [];
    // If no interaction events exist, fallback to songsPlayed analysis
    if (events.length === 0) {
      return await SessionProfileService.calculateSessionProfileFromSession(sessionDoc);
    }

    const songIds = events.map((ev) => ev.song);
    const songDocs = await Song.find({ _id: { $in: songIds } })
      .populate('artist', 'name')
      .populate('genre', 'name')
      .lean();

    const songMap = new Map<string, any>();
    songDocs.forEach((s) => songMap.set(s._id.toString(), s));

    const totalEvents = events.length;
    const genreWeightsMap = new Map<string, number>();
    const artistWeightsMap = new Map<string, { name: string; weight: number }>();
    const moodWeightsMap = new Map<string, number>();

    let totalPositiveWeight = 0;
    let weightedEnergySum = 0;
    let weightedTempoSum = 0;
    let energyWeightCount = 0;
    let tempoWeightCount = 0;

    events.forEach((ev, idx) => {
      const songIdStr = ev.song.toString();
      const song = songMap.get(songIdStr);
      if (!song) return;

      const actionMult = ACTION_WEIGHT_MULTIPLIERS[ev.action] ?? 1.0;
      const recencyWeight = this.calculateEventRecencyWeight(idx, totalEvents);
      const netWeight = actionMult * recencyWeight;

      // 1. Genres
      const genreName =
        typeof song.genre === 'object' && song.genre && 'name' in song.genre
          ? String(song.genre.name)
          : String(song.genre || 'Unknown');

      const currentGenreWeight = genreWeightsMap.get(genreName) || 0;
      genreWeightsMap.set(genreName, Math.max(0, currentGenreWeight + netWeight));

      // 2. Artists
      const artistId =
        typeof song.artist === 'object' && song.artist && '_id' in song.artist
          ? String(song.artist._id)
          : String(song.artist || 'unknown');
      const artistName =
        typeof song.artist === 'object' && song.artist && 'name' in song.artist
          ? String(song.artist.name)
          : 'Unknown Artist';

      const existingArtist = artistWeightsMap.get(artistId) || { name: artistName, weight: 0 };
      artistWeightsMap.set(artistId, {
        name: artistName,
        weight: Math.max(0, existingArtist.weight + netWeight),
      });

      // 3. Moods
      const moodStr = String(song.mood || 'Chill').trim();
      const currentMoodWeight = moodWeightsMap.get(moodStr) || 0;
      moodWeightsMap.set(moodStr, Math.max(0, currentMoodWeight + netWeight));

      // 4. Energy & Tempo (accumulate only for positive net weights)
      if (netWeight > 0) {
        totalPositiveWeight += netWeight;
        if (song.audioFeatures) {
          if (typeof song.audioFeatures.energy === 'number') {
            weightedEnergySum += song.audioFeatures.energy * netWeight;
            energyWeightCount += netWeight;
          }
          if (typeof song.audioFeatures.bpm === 'number') {
            weightedTempoSum += song.audioFeatures.bpm * netWeight;
            tempoWeightCount += netWeight;
          }
        }
      }
    });

    const sumGenreWeights = Array.from(genreWeightsMap.values()).reduce((a, b) => a + b, 0);
    const dominantGenres = Array.from(genreWeightsMap.entries())
      .map(([genre, w]) => ({
        genre,
        score: Number((sumGenreWeights > 0 ? w / sumGenreWeights : 0).toFixed(4)),
      }))
      .filter((g) => g.score > 0)
      .sort((a, b) => b.score - a.score);

    const sumArtistWeights = Array.from(artistWeightsMap.values()).reduce((a, b) => a + b.weight, 0);
    const dominantArtists = Array.from(artistWeightsMap.entries())
      .map(([artistId, info]) => ({
        artistId,
        name: info.name,
        score: Number((sumArtistWeights > 0 ? info.weight / sumArtistWeights : 0).toFixed(4)),
      }))
      .filter((a) => a.score > 0)
      .sort((a, b) => b.score - a.score);

    const sumMoodWeights = Array.from(moodWeightsMap.values()).reduce((a, b) => a + b, 0);
    const moodDistribution: Record<string, number> = {};
    moodWeightsMap.forEach((w, mood) => {
      if (w > 0) {
        moodDistribution[mood] = Number((sumMoodWeights > 0 ? w / sumMoodWeights : 0).toFixed(4));
      }
    });

    const averageEnergy = energyWeightCount > 0
      ? Number((weightedEnergySum / energyWeightCount).toFixed(4))
      : 0.5;

    const averageTempo = tempoWeightCount > 0
      ? Number(Math.round(weightedTempoSum / tempoWeightCount))
      : 110;

    return {
      sessionId: sessionDoc._id.toString(),
      userId: sessionDoc.user.toString(),
      songCount: sessionDoc.songsPlayed ? sessionDoc.songsPlayed.length : events.length,
      dominantGenres,
      dominantArtists,
      averageEnergy,
      averageTempo,
      moodDistribution,
      lastUpdated: new Date(),
    };
  }

  /**
   * Updates session preferences for a user's active listening session.
   */
  static async updateActiveSessionPreferences(userId: string): Promise<TemporarySessionProfile | null> {
    if (!userId || !Types.ObjectId.isValid(userId)) return null;

    const activeSession = await ListeningSessionService.getActiveSession(userId);
    if (!activeSession) return null;

    const updatedProfile = await this.updateSessionProfileFromInteractions(activeSession);
    return updatedProfile;
  }
}
