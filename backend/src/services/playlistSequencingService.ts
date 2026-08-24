export type SequencingStrategy = 'balanced' | 'energetic' | 'gradual' | 'discovery';

export interface SequencingDiagnostics {
  strategy: SequencingStrategy;
  trackCount: number;
  averageTransitionDelta: number;
  maxTransitionDelta: number;
  smoothnessScore: number; // 0.0 (abrupt) to 1.0 (seamless)
  sameArtistAdjacentCount: number;
}

export interface SequencedResult<T> {
  sequencedTracks: T[];
  diagnostics: SequencingDiagnostics;
}

export class PlaylistSequencingService {
  /**
   * Intelligently sequences a list of playlist tracks based on audio features (energy, tempo),
   * mood, genre compatibility, and the requested sequencing strategy.
   * Returns the exact same songs in an optimized order without modifying candidate contents.
   */
  static sequenceTracks<T extends { song: any; score?: number; noveltyScore?: number; genre?: string; artist?: string }>(
    tracks: T[],
    strategy: SequencingStrategy = 'balanced'
  ): SequencedResult<T> {
    if (!Array.isArray(tracks) || tracks.length <= 1) {
      return {
        sequencedTracks: tracks ? [...tracks] : [],
        diagnostics: {
          strategy,
          trackCount: tracks?.length || 0,
          averageTransitionDelta: 0,
          maxTransitionDelta: 0,
          smoothnessScore: 1.0,
          sameArtistAdjacentCount: 0,
        },
      };
    }

    let sequenced: T[] = [];

    switch (strategy) {
      case 'energetic':
        sequenced = this.sequenceEnergetic(tracks);
        break;
      case 'gradual':
        sequenced = this.sequenceGradual(tracks);
        break;
      case 'discovery':
        sequenced = this.sequenceDiscovery(tracks);
        break;
      case 'balanced':
      default:
        sequenced = this.sequenceBalanced(tracks);
        break;
    }

    const diagnostics = this.calculateDiagnostics(sequenced, strategy);

    return {
      sequencedTracks: sequenced,
      diagnostics,
    };
  }

  // --- STRATEGY IMPLEMENTATIONS ---

  /**
   * Balanced Strategy:
   * Starts with an engaging hook track, creates a smooth wave/arc, and minimizes transition jarring.
   */
  private static sequenceBalanced<T extends { song: any; score?: number }>(tracks: T[]): T[] {
    const remaining = [...tracks];

    // Pick best hook track (high recommendation score & solid energy ~0.6 - 0.8)
    let bestStartIdx = 0;
    let highestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const score = (remaining[i].score ?? 0.7) + (this.getTrackEnergy(remaining[i]) >= 0.5 ? 0.1 : 0);
      if (score > highestScore) {
        highestScore = score;
        bestStartIdx = i;
      }
    }

    const result: T[] = [remaining.splice(bestStartIdx, 1)[0]];

    while (remaining.length > 0) {
      const current = result[result.length - 1];
      const currentArtist = this.getTrackArtist(current).toLowerCase();
      let bestNextIdx = 0;
      let lowestCost = Infinity;

      // Count artist frequencies in remaining pool to prevent starving separator slots
      const artistCounts: Record<string, number> = {};
      for (const r of remaining) {
        const art = this.getTrackArtist(r).toLowerCase();
        if (art) artistCounts[art] = (artistCounts[art] || 0) + 1;
      }

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];
        const candidateArtist = this.getTrackArtist(candidate).toLowerCase();
        const baseCost = this.calculateTransitionDistance(current, candidate, false);

        // Urgency bonus: prioritize inserting high-frequency artists when current is a different artist
        let urgencyBonus = 0;
        if (currentArtist && candidateArtist && currentArtist !== candidateArtist) {
          const count = artistCounts[candidateArtist] || 0;
          if (count > 1) {
            urgencyBonus = (count / remaining.length) * 0.45;
          }
        }

        const totalCost = baseCost - urgencyBonus;
        if (totalCost < lowestCost) {
          lowestCost = totalCost;
          bestNextIdx = i;
        }
      }

      result.push(remaining.splice(bestNextIdx, 1)[0]);
    }

    return result;
  }

  /**
   * Energetic Strategy:
   * Front-loads and maintains high momentum with smooth energy and tempo transitions.
   */
  private static sequenceEnergetic<T extends { song: any }>(tracks: T[]): T[] {
    const remaining = [...tracks];

    // Sort initial pool by energy + tempo descending
    remaining.sort((a, b) => {
      const energyA = this.getTrackEnergy(a);
      const energyB = this.getTrackEnergy(b);
      return energyB - energyA;
    });

    const result: T[] = [remaining.shift()!];

    while (remaining.length > 0) {
      const current = result[result.length - 1];
      let bestNextIdx = 0;
      let lowestCost = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];
        const transitionDist = this.calculateTransitionDistance(current, candidate, false);
        // Energy reward: penalize dropping energy too quickly
        const energyPenalty = Math.max(0, this.getTrackEnergy(current) - this.getTrackEnergy(candidate)) * 0.3;
        const totalCost = transitionDist + energyPenalty;

        if (totalCost < lowestCost) {
          lowestCost = totalCost;
          bestNextIdx = i;
        }
      }

      result.push(remaining.splice(bestNextIdx, 1)[0]);
    }

    return result;
  }

  /**
   * Gradual Strategy:
   * Smooth ascending ramp (warm-up / arc) starting from low energy building up to peak intensity.
   */
  private static sequenceGradual<T extends { song: any }>(tracks: T[]): T[] {
    const remaining = [...tracks];

    // Find lowest energy track to start
    let lowestEnergyIdx = 0;
    let minEnergy = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const e = this.getTrackEnergy(remaining[i]);
      if (e < minEnergy) {
        minEnergy = e;
        lowestEnergyIdx = i;
      }
    }

    const result: T[] = [remaining.splice(lowestEnergyIdx, 1)[0]];

    const totalLength = tracks.length;

    while (remaining.length > 0) {
      const current = result[result.length - 1];
      const progress = result.length / totalLength; // 0.0 -> 1.0
      const targetEnergy = progress * 0.9; // Gradual climb towards 0.9

      let bestNextIdx = 0;
      let lowestCost = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];
        const transitionDist = this.calculateTransitionDistance(current, candidate, false);
        const energyFit = Math.abs(this.getTrackEnergy(candidate) - targetEnergy) * 0.5;
        const totalCost = transitionDist + energyFit;

        if (totalCost < lowestCost) {
          lowestCost = totalCost;
          bestNextIdx = i;
        }
      }

      result.push(remaining.splice(bestNextIdx, 1)[0]);
    }

    return result;
  }

  /**
   * Discovery Strategy:
   * Strategically interleaves familiar anchor tracks with novel discovery tracks,
   * allowing intentional contrast while preventing jarring acoustic clashes.
   */
  private static sequenceDiscovery<T extends { song: any; noveltyScore?: number }>(tracks: T[]): T[] {
    const familiar: T[] = [];
    const novel: T[] = [];

    for (const t of tracks) {
      const nov = t.noveltyScore ?? 0.5;
      if (nov >= 0.55) {
        novel.push(t);
      } else {
        familiar.push(t);
      }
    }

    // Sort familiar by score descending, novel by compatibility
    familiar.sort((a, b) => this.getTrackEnergy(b) - this.getTrackEnergy(a));

    const result: T[] = [];
    let takeNovel = false;

    // Interleave familiar and novel
    while (familiar.length > 0 || novel.length > 0) {
      const current = result.length > 0 ? result[result.length - 1] : null;
      let pool = takeNovel && novel.length > 0 ? novel : familiar.length > 0 ? familiar : novel;

      if (!current) {
        result.push(pool.shift()!);
      } else {
        // Pick best matching candidate from the active pool
        let bestIdx = 0;
        let lowestCost = Infinity;

        for (let i = 0; i < pool.length; i++) {
          // Allow slightly higher tolerance when transitioning into discovery
          const cost = this.calculateTransitionDistance(current, pool[i], takeNovel);
          if (cost < lowestCost) {
            lowestCost = cost;
            bestIdx = i;
          }
        }

        result.push(pool.splice(bestIdx, 1)[0]);
      }

      takeNovel = !takeNovel;
    }

    return result;
  }

  // --- AUDIO FEATURE & TRANSITION HELPERS ---

  /**
   * Computes a multi-dimensional transition distance between two tracks.
   * Considers energy, tempo, mood, genre, and same-artist repetition.
   */
  public static calculateTransitionDistance(trackA: any, trackB: any, allowDiscoveryContrast: boolean = false): number {
    const energyA = this.getTrackEnergy(trackA);
    const energyB = this.getTrackEnergy(trackB);
    const energyDelta = Math.abs(energyA - energyB);

    const tempoA = this.getTrackTempo(trackA);
    const tempoB = this.getTrackTempo(trackB);
    const tempoDelta = Math.abs(tempoA - tempoB) / Math.max(tempoA, tempoB, 100);

    const moodA = this.getTrackMood(trackA);
    const moodB = this.getTrackMood(trackB);
    const moodDelta = this.calculateMoodDistance(moodA, moodB);

    const genreA = this.getTrackGenre(trackA);
    const genreB = this.getTrackGenre(trackB);
    const genreDelta = genreA && genreB && genreA.toLowerCase() === genreB.toLowerCase() ? 0 : 0.4;

    const artistA = this.getTrackArtist(trackA);
    const artistB = this.getTrackArtist(trackB);
    const sameArtistPenalty = artistA && artistB && artistA.toLowerCase() === artistB.toLowerCase() ? 1.5 : 0;

    const contrastMultiplier = allowDiscoveryContrast ? 0.7 : 1.0;

    const weightedDistance =
      energyDelta * 0.35 +
      tempoDelta * 0.25 +
      moodDelta * 0.20 +
      genreDelta * 0.20 +
      sameArtistPenalty;

    return weightedDistance * contrastMultiplier;
  }

  private static calculateMoodDistance(moodA: string, moodB: string): number {
    if (!moodA || !moodB) return 0.2;
    if (moodA.toLowerCase() === moodB.toLowerCase()) return 0;

    const energeticSet = new Set(['energetic', 'upbeat', 'party', 'workout', 'hype']);
    const chillSet = new Set(['chill', 'relax', 'calm', 'sleep', 'ambient', 'focus']);
    const sadSet = new Set(['sad', 'melancholic', 'gloomy', 'rainy']);

    const isAEnergetic = energeticSet.has(moodA.toLowerCase());
    const isBEnergetic = energeticSet.has(moodB.toLowerCase());
    const isAChill = chillSet.has(moodA.toLowerCase());
    const isBChill = chillSet.has(moodB.toLowerCase());
    const isASad = sadSet.has(moodA.toLowerCase());
    const isBSad = sadSet.has(moodB.toLowerCase());

    if ((isAEnergetic && isBSad) || (isASad && isBEnergetic)) return 0.9;
    if ((isAEnergetic && isBChill) || (isAChill && isBEnergetic)) return 0.6;
    if ((isAChill && isBSad) || (isASad && isBChill)) return 0.3;

    return 0.4;
  }

  private static getTrackEnergy(track: any): number {
    if (!track) return 0.5;
    const song = track.song || track;
    if (song.audioFeatures && typeof song.audioFeatures.energy === 'number') {
      return song.audioFeatures.energy;
    }
    const mood = (song.mood || '').toLowerCase();
    if (mood.includes('energetic') || mood.includes('party') || mood.includes('workout')) return 0.85;
    if (mood.includes('chill') || mood.includes('calm') || mood.includes('sleep')) return 0.35;
    if (mood.includes('sad') || mood.includes('melanchol')) return 0.30;
    return 0.5;
  }

  private static getTrackTempo(track: any): number {
    if (!track) return 120;
    const song = track.song || track;
    if (song.audioFeatures) {
      const bpm = song.audioFeatures.tempo ?? song.audioFeatures.bpm;
      if (typeof bpm === 'number' && bpm > 0) return bpm;
    }
    const mood = (song.mood || '').toLowerCase();
    if (mood.includes('energetic') || mood.includes('party')) return 135;
    if (mood.includes('chill') || mood.includes('relax')) return 90;
    return 120;
  }

  private static getTrackMood(track: any): string {
    const song = track?.song || track;
    return song?.mood || '';
  }

  private static getTrackGenre(track: any): string {
    if (track?.genre) return String(track.genre);
    const song = track?.song || track;
    if (typeof song?.genre === 'object' && song?.genre?.name) return String(song.genre.name);
    return String(song?.genre || '');
  }

  private static getTrackArtist(track: any): string {
    if (track?.artist) return String(track.artist);
    const song = track?.song || track;
    if (typeof song?.artist === 'object' && song?.artist?.name) return String(song.artist.name);
    return String(song?.artist || '');
  }

  private static calculateDiagnostics<T>(sequenced: T[], strategy: SequencingStrategy): SequencingDiagnostics {
    if (sequenced.length <= 1) {
      return {
        strategy,
        trackCount: sequenced.length,
        averageTransitionDelta: 0,
        maxTransitionDelta: 0,
        smoothnessScore: 1.0,
        sameArtistAdjacentCount: 0,
      };
    }

    let totalDelta = 0;
    let maxDelta = 0;
    let sameArtistCount = 0;

    for (let i = 0; i < sequenced.length - 1; i++) {
      const a = sequenced[i];
      const b = sequenced[i + 1];
      const dist = this.calculateTransitionDistance(a, b, strategy === 'discovery');
      totalDelta += dist;
      if (dist > maxDelta) {
        maxDelta = dist;
      }

      const artistA = this.getTrackArtist(a).toLowerCase();
      const artistB = this.getTrackArtist(b).toLowerCase();
      if (artistA && artistB && artistA === artistB) {
        sameArtistCount++;
      }
    }

    const avgDelta = Number((totalDelta / (sequenced.length - 1)).toFixed(4));
    const smoothness = Number(Math.max(0, Math.min(1.0, 1.0 - avgDelta)).toFixed(4));

    return {
      strategy,
      trackCount: sequenced.length,
      averageTransitionDelta: avgDelta,
      maxTransitionDelta: Number(maxDelta.toFixed(4)),
      smoothnessScore: smoothness,
      sameArtistAdjacentCount: sameArtistCount,
    };
  }
}
