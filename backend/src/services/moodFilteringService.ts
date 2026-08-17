export interface MoodProfileTarget {
  name: string;
  aliases: string[];
  targetEnergy: number;
  targetValence: number;
  targetBpm: number;
  targetAcousticness?: number;
  targetInstrumentalness?: number;
  matchingGenres: string[];
}

export const MOOD_PROFILE_TARGETS: Record<string, MoodProfileTarget> = {
  happy: {
    name: 'happy',
    aliases: ['happy', 'upbeat', 'joyful', 'cheerful'],
    targetEnergy: 0.75,
    targetValence: 0.85,
    targetBpm: 120,
    matchingGenres: ['pop', 'dance', 'disco', 'funk', 'upbeat'],
  },
  calm: {
    name: 'calm',
    aliases: ['calm', 'relaxed', 'chill', 'peaceful', 'serene'],
    targetEnergy: 0.30,
    targetValence: 0.50,
    targetBpm: 85,
    targetAcousticness: 0.70,
    matchingGenres: ['ambient', 'acoustic', 'chill', 'classical', 'jazz'],
  },
  energetic: {
    name: 'energetic',
    aliases: ['energetic', 'workout', 'high energy', 'intense', 'power'],
    targetEnergy: 0.90,
    targetValence: 0.75,
    targetBpm: 135,
    matchingGenres: ['rock', 'synthwave', 'electronic', 'metal', 'dance'],
  },
  sad: {
    name: 'sad',
    aliases: ['sad', 'melancholic', 'gloomy', 'heartbreak'],
    targetEnergy: 0.25,
    targetValence: 0.20,
    targetBpm: 75,
    targetAcousticness: 0.65,
    matchingGenres: ['indie', 'acoustic', 'blues', 'classical'],
  },
  focused: {
    name: 'focused',
    aliases: ['focused', 'study', 'coding', 'focus', 'concentration'],
    targetEnergy: 0.45,
    targetValence: 0.50,
    targetBpm: 100,
    targetInstrumentalness: 0.75,
    matchingGenres: ['ambient', 'classical', 'lo-fi', 'instrumental'],
  },
  romantic: {
    name: 'romantic',
    aliases: ['romantic', 'love', 'sensual', 'passion'],
    targetEnergy: 0.40,
    targetValence: 0.65,
    targetBpm: 90,
    targetAcousticness: 0.60,
    matchingGenres: ['r&b', 'soul', 'pop', 'acoustic'],
  },
  relaxed: {
    name: 'relaxed',
    aliases: ['relaxed', 'relaxation', 'unwind', 'mellow'],
    targetEnergy: 0.35,
    targetValence: 0.55,
    targetBpm: 90,
    targetAcousticness: 0.65,
    matchingGenres: ['chill', 'acoustic', 'ambient', 'jazz'],
  },
};

export class MoodFilteringService {
  /**
   * Normalizes input mood string to standard mood target key.
   */
  static normalizeMoodKey(requestedMood: string): MoodProfileTarget | null {
    if (!requestedMood || !requestedMood.trim()) return null;
    const clean = requestedMood.trim().toLowerCase();

    for (const target of Object.values(MOOD_PROFILE_TARGETS)) {
      if (target.aliases.includes(clean)) {
        return target;
      }
    }
    return null;
  }

  /**
   * Computes a normalized mood compatibility score (0.0 to 1.0) for a song document
   * against a requested target mood (happy, calm, energetic, sad, focused, romantic, relaxed).
   * Handles songs with missing mood or audio feature metadata safely.
   * Does not replace existing recommendation scoring.
   */
  static calculateMoodCompatibilityScore(songDoc: any, requestedMood: string): number {
    if (!songDoc || !requestedMood || !requestedMood.trim()) {
      return 0.5; // Safe default for invalid parameters
    }

    const target = this.normalizeMoodKey(requestedMood);
    if (!target) {
      // Fallback string matching if not in predefined target list
      const songMoodStr = String(songDoc.mood || '').toLowerCase();
      const targetStr = requestedMood.trim().toLowerCase();
      return songMoodStr.includes(targetStr) ? 0.8 : 0.5;
    }

    // 1. Direct Song Mood & Tag Match (40% Weight)
    let directMoodScore = 0.3;
    const songMood = String(songDoc.mood || '').toLowerCase();
    const songTags = Array.isArray(songDoc.tags) ? songDoc.tags.map((t: string) => String(t).toLowerCase()) : [];

    if (songMood && target.aliases.includes(songMood)) {
      directMoodScore = 1.0;
    } else if (songTags.some((tag: string) => target.aliases.includes(tag))) {
      directMoodScore = 0.85;
    }

    // 2. Audio Features Alignment (40% Weight)
    let audioFeatureScore = 0.5;
    if (songDoc.audioFeatures && typeof songDoc.audioFeatures === 'object') {
      const af = songDoc.audioFeatures;
      let scoreSum = 0;
      let count = 0;

      if (typeof af.energy === 'number' && typeof target.targetEnergy === 'number') {
        scoreSum += 1.0 - Math.min(1, Math.abs(af.energy - target.targetEnergy));
        count++;
      }

      if (typeof af.valence === 'number' && typeof target.targetValence === 'number') {
        scoreSum += 1.0 - Math.min(1, Math.abs(af.valence - target.targetValence));
        count++;
      }

      if (typeof af.bpm === 'number' && typeof target.targetBpm === 'number') {
        const bpmDiff = Math.abs(af.bpm - target.targetBpm) / 100;
        scoreSum += 1.0 - Math.min(1, bpmDiff);
        count++;
      }

      if (typeof af.acousticness === 'number' && typeof target.targetAcousticness === 'number') {
        scoreSum += 1.0 - Math.min(1, Math.abs(af.acousticness - target.targetAcousticness));
        count++;
      }

      if (typeof af.instrumentalness === 'number' && typeof target.targetInstrumentalness === 'number') {
        scoreSum += 1.0 - Math.min(1, Math.abs(af.instrumentalness - target.targetInstrumentalness));
        count++;
      }

      if (count > 0) {
        audioFeatureScore = scoreSum / count;
      }
    }

    // 3. Genre Metadata Compatibility (20% Weight)
    let genreScore = 0.4;
    const genreName =
      typeof songDoc.genre === 'object' && songDoc.genre && 'name' in songDoc.genre
        ? String(songDoc.genre.name).toLowerCase()
        : String(songDoc.genre || '').toLowerCase();

    if (genreName && target.matchingGenres.some((mg) => genreName.includes(mg))) {
      genreScore = 0.95;
    }

    // Weighted Fusion Score
    const finalScore = directMoodScore * 0.4 + audioFeatureScore * 0.4 + genreScore * 0.2;

    // Bounded strictly between 0.0 and 1.0
    return Number(Math.max(0.0, Math.min(1.0, finalScore)).toFixed(4));
  }

  /**
   * Ranks an array of songs by requested mood compatibility score descending.
   */
  static filterAndRankSongsByMood(songs: any[], requestedMood: string, limit = 10): Array<{ song: any; moodScore: number }> {
    if (!Array.isArray(songs) || songs.length === 0) return [];

    const scored = songs.map((song) => ({
      song,
      moodScore: this.calculateMoodCompatibilityScore(song, requestedMood),
    }));

    scored.sort((a, b) => b.moodScore - a.moodScore);
    return scored.slice(0, Math.max(1, limit));
  }
}
