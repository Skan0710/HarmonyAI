import { Types } from 'mongoose';
import { IListeningSession } from '../models/ListeningSession.js';
import { ListeningSessionService } from './listeningSessionService.js';
import { Song } from '../models/Song.js';

export interface TemporarySessionProfile {
  sessionId: string;
  userId: string;
  songCount: number;
  dominantGenres: Array<{ genre: string; score: number }>;
  dominantArtists: Array<{ artistId: string; name: string; score: number }>;
  averageEnergy: number; // 0.0 to 1.0
  averageTempo: number;  // BPM
  moodDistribution: Record<string, number>; // mood -> normalized weight 0.0 - 1.0
  lastUpdated: Date;
}

export class SessionProfileService {
  /**
   * Calculates position-based exponential recency weight for a song played at index i in a sequence of length N.
   * Index (N - 1) is the most recent song (weight = 1.0).
   */
  private static calculatePositionRecencyWeight(index: number, totalSongs: number, decayLambda = 0.2): number {
    const recencyDistance = totalSongs - 1 - index;
    return Math.exp(-decayLambda * recencyDistance);
  }

  /**
   * Analyzes songs played during the current listening session and calculates temporary session preferences.
   * Gives higher weight to recently played tracks and normalizes outputs.
   * Keeps calculations completely separate from long-term User Taste Profiles.
   */
  static async calculateSessionProfileFromSession(
    sessionDoc: IListeningSession
  ): Promise<TemporarySessionProfile | null> {
    if (!sessionDoc || !sessionDoc.songsPlayed || sessionDoc.songsPlayed.length === 0) {
      return null;
    }

    const songsPlayed = sessionDoc.songsPlayed;
    const songIds = songsPlayed.map((sp) => sp.song);

    // Populate song details (genre, artist, audioFeatures, mood)
    const songDocs = await Song.find({ _id: { $in: songIds } })
      .populate('artist', 'name')
      .populate('genre', 'name')
      .lean();

    const songMap = new Map<string, any>();
    songDocs.forEach((s) => songMap.set(s._id.toString(), s));

    let totalWeightSum = 0;
    let weightedEnergySum = 0;
    let weightedTempoSum = 0;
    let energyCount = 0;
    let tempoCount = 0;

    const genreWeightsMap = new Map<string, number>();
    const artistWeightsMap = new Map<string, { name: string; weight: number }>();
    const moodWeightsMap = new Map<string, number>();

    const totalSongs = songsPlayed.length;

    songsPlayed.forEach((item, idx) => {
      const songIdStr = item.song.toString();
      const song = songMap.get(songIdStr);
      if (!song) return;

      const recencyWeight = this.calculatePositionRecencyWeight(idx, totalSongs);
      totalWeightSum += recencyWeight;

      // 1. Audio features (Energy & Tempo)
      if (song.audioFeatures) {
        if (typeof song.audioFeatures.energy === 'number') {
          weightedEnergySum += song.audioFeatures.energy * recencyWeight;
          energyCount += recencyWeight;
        }
        if (typeof song.audioFeatures.bpm === 'number') {
          weightedTempoSum += song.audioFeatures.bpm * recencyWeight;
          tempoCount += recencyWeight;
        }
      }

      // 2. Dominant Genres
      const genreName =
        typeof song.genre === 'object' && song.genre && 'name' in song.genre
          ? String(song.genre.name)
          : String(song.genre || 'Unknown');
      genreWeightsMap.set(genreName, (genreWeightsMap.get(genreName) || 0) + recencyWeight);

      // 3. Dominant Artists
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
        weight: existingArtist.weight + recencyWeight,
      });

      // 4. Mood Distribution
      const moodStr = String(song.mood || 'Chill').trim();
      moodWeightsMap.set(moodStr, (moodWeightsMap.get(moodStr) || 0) + recencyWeight);
    });

    if (totalWeightSum === 0) {
      return null;
    }

    // Normalize Dominant Genres (Score sum = 1.0)
    const dominantGenres = Array.from(genreWeightsMap.entries())
      .map(([genre, w]) => ({
        genre,
        score: Number((w / totalWeightSum).toFixed(4)),
      }))
      .sort((a, b) => b.score - a.score);

    // Normalize Dominant Artists (Score sum = 1.0)
    const dominantArtists = Array.from(artistWeightsMap.entries())
      .map(([artistId, info]) => ({
        artistId,
        name: info.name,
        score: Number((info.weight / totalWeightSum).toFixed(4)),
      }))
      .sort((a, b) => b.score - a.score);

    // Normalize Mood Distribution
    const moodDistribution: Record<string, number> = {};
    moodWeightsMap.forEach((w, mood) => {
      moodDistribution[mood] = Number((w / totalWeightSum).toFixed(4));
    });

    const averageEnergy = energyCount > 0
      ? Number((weightedEnergySum / energyCount).toFixed(4))
      : 0.5;

    const averageTempo = tempoCount > 0
      ? Number(Math.round(weightedTempoSum / tempoCount))
      : 110;

    return {
      sessionId: sessionDoc._id.toString(),
      userId: sessionDoc.user.toString(),
      songCount: totalSongs,
      dominantGenres,
      dominantArtists,
      averageEnergy,
      averageTempo,
      moodDistribution,
      lastUpdated: new Date(),
    };
  }

  /**
   * Fetches active listening session for user and calculates temporary session profile.
   */
  static async getActiveSessionProfileForUser(
    userId: string
  ): Promise<TemporarySessionProfile | null> {
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return null;
    }

    const activeSession = await ListeningSessionService.getActiveSession(userId);
    if (!activeSession) {
      return null;
    }

    return await this.calculateSessionProfileFromSession(activeSession);
  }
}
