import { Types } from 'mongoose';
import { IMusicDNASnapshot } from '../models/MusicDNASnapshot.js';
import { MusicDNASnapshotService } from './musicDnaSnapshotService.js';
import { UnifiedMusicDNAService } from './unifiedMusicDnaService.js';
import { UnifiedMusicDNA, DetailedTasteItem } from '../schemas/musicDnaSchema.js';

export type TastePreferenceStage =
  | 'one_off_interaction' // Not enough interactions to be a preference (< minInteractions)
  | 'emerging'            // Rising recently, not established (< established threshold, >= minInteractions)
  | 'sustained_emerging'  // Detected as emerging across multiple snapshots
  | 'established'         // Long-term foundational taste
  | 'fading'              // Previously established/strong, now dropping
  | 'stable_secondary';   // Consistent low/medium interest

export interface EmergingItemAnalysis {
  name: string;
  type: 'genre' | 'artist' | 'mood';
  stage: TastePreferenceStage;
  recentPlayCount: number;
  currentScore: number;
  shortTermScore: number;
  longTermScore: number;
  momentumDelta: number; // shortTermScore - longTermScore
  emergenceConfidence: number; // [0.0, 1.0]
  hasPositiveFeedback?: boolean;
  firstObservedWindow?: string;
  explanation: string;
}

export interface EmergingBehaviorAnalysis {
  metric: string;
  stage: 'emerging_shift' | 'stable' | 'fading_habit';
  previousScore: number;
  currentScore: number;
  delta: number;
  explanation: string;
}

export interface EmergingTasteReport {
  userId: string;
  generatedAt: Date;
  summary: {
    totalEmergingCount: number;
    primaryEmergingGenre: string | null;
    primaryEmergingArtist: string | null;
    primaryEmergingMood: string | null;
    narrative: string;
  };
  emergingGenres: EmergingItemAnalysis[];
  emergingArtists: EmergingItemAnalysis[];
  emergingMoods: EmergingItemAnalysis[];
  emergingBehaviors: EmergingBehaviorAnalysis[];
  establishedPreferences: {
    genres: string[];
    artists: string[];
  };
  fadingPreferences: {
    genres: string[];
    artists: string[];
  };
}

export interface EmergingDetectionOptions {
  minInteractionsThreshold?: number; // default: 3
  momentumThreshold?: number; // default: 0.15
  establishedAffinityThreshold?: number; // default: 0.60
  fadingDeltaThreshold?: number; // default: -0.20
  referenceDate?: Date;
}

export const DEFAULT_EMERGING_OPTIONS: Required<EmergingDetectionOptions> = {
  minInteractionsThreshold: 3,
  momentumThreshold: 0.15,
  establishedAffinityThreshold: 0.60,
  fadingDeltaThreshold: -0.20,
  referenceDate: new Date(),
};

export class EmergingTasteDetectionService {
  /**
   * Classifies a candidate taste item (genre, artist, or mood) into its evolutionary stage.
   */
  static classifyPreferenceStage(
    item: {
      name: string;
      playCount: number;
      shortTermScore: number;
      longTermScore: number;
      momentumDelta?: number;
      historicalEmerging?: boolean;
    },
    options: EmergingDetectionOptions = {}
  ): { stage: TastePreferenceStage; emergenceConfidence: number; explanation: string } {
    const minPlays = options.minInteractionsThreshold ?? DEFAULT_EMERGING_OPTIONS.minInteractionsThreshold;
    const momThresh = options.momentumThreshold ?? DEFAULT_EMERGING_OPTIONS.momentumThreshold;
    const estThresh = options.establishedAffinityThreshold ?? DEFAULT_EMERGING_OPTIONS.establishedAffinityThreshold;
    const fadeThresh = options.fadingDeltaThreshold ?? DEFAULT_EMERGING_OPTIONS.fadingDeltaThreshold;

    const momentum = item.momentumDelta !== undefined
      ? item.momentumDelta
      : Number((item.shortTermScore - item.longTermScore).toFixed(4));

    // 1. One-off or insufficient interactions guard
    if (item.playCount < minPlays) {
      return {
        stage: 'one_off_interaction',
        emergenceConfidence: 0.0,
        explanation: `${item.name} has only ${item.playCount} play(s). Below threshold (${minPlays}) required for emerging taste.`,
      };
    }

    // 2. Established foundational preference
    // If long-term affinity is already strong (>= estThresh), it cannot be merely 'emerging'
    if (item.longTermScore >= estThresh) {
      if (momentum <= fadeThresh) {
        return {
          stage: 'fading',
          emergenceConfidence: 0.0,
          explanation: `${item.name} is an established favorite that is currently fading (${(momentum * 100).toFixed(1)}% momentum).`,
        };
      }
      return {
        stage: 'established',
        emergenceConfidence: 0.0,
        explanation: `${item.name} is a confirmed long-term established preference (${(item.longTermScore * 100).toFixed(0)}% long-term score).`,
      };
    }

    // 3. Fading check for non-established items
    if (momentum <= fadeThresh && item.longTermScore >= 0.30) {
      return {
        stage: 'fading',
        emergenceConfidence: 0.0,
        explanation: `${item.name} is cooling down rapidly (${(momentum * 100).toFixed(1)}% momentum).`,
      };
    }

    // 4. Emerging preference check
    // Low or moderate long-term score, but strong recent momentum and sufficient plays
    if (momentum >= momThresh && item.shortTermScore >= 0.45) {
      // Calculate confidence based on play count and momentum strength
      const playConfidence = Math.min(1.0, item.playCount / 10);
      const momentumConfidence = Math.min(1.0, momentum / 0.50);
      const emergenceConfidence = Number(((playConfidence * 0.5) + (momentumConfidence * 0.5)).toFixed(4));

      if (item.historicalEmerging) {
        return {
          stage: 'sustained_emerging',
          emergenceConfidence: Math.min(1.0, emergenceConfidence + 0.15),
          explanation: `${item.name} is a sustained emerging preference across recent sessions (${item.playCount} plays, +${(momentum * 100).toFixed(1)}% momentum).`,
        };
      }

      return {
        stage: 'emerging',
        emergenceConfidence,
        explanation: `${item.name} is a new emerging interest recently gaining traction (${item.playCount} plays, +${(momentum * 100).toFixed(1)}% momentum).`,
      };
    }

    // 5. Default stable secondary
    return {
      stage: 'stable_secondary',
      emergenceConfidence: 0.1,
      explanation: `${item.name} maintains a steady secondary preference level.`,
    };
  }

  /**
   * Evaluates a user's current Music DNA and recent historical snapshots to produce an Emerging Taste Report.
   */
  static analyzeEmergingTastesFromData(
    currentDNA: UnifiedMusicDNA,
    previousSnapshots: IMusicDNASnapshot[] = [],
    options: EmergingDetectionOptions = {}
  ): EmergingTasteReport {
    const userId = currentDNA.userId;
    const generatedAt = options.referenceDate || new Date();

    // Map of historical emerging items from previous snapshots
    const historicalEmergingNames = new Set<string>();
    for (const snap of previousSnapshots) {
      const gList = snap.topGenres || [];
      const aList = snap.topArtists || [];
      for (const g of gList) {
        if ((g.momentumDelta || 0) > (options.momentumThreshold || 0.15)) {
          historicalEmergingNames.add(g.name.toLowerCase());
        }
      }
      for (const a of aList) {
        if ((a.momentumDelta || 0) > (options.momentumThreshold || 0.15)) {
          historicalEmergingNames.add(a.name.toLowerCase());
        }
      }
    }

    // 1. Analyze Genres
    const rawGenres: DetailedTasteItem[] = [
      ...(currentDNA.genreProfile?.topGenres || []),
      ...(currentDNA.genreProfile?.emergingGenres || []),
    ];
    // Deduplicate by name
    const uniqueGenres = new Map<string, DetailedTasteItem>();
    for (const g of rawGenres) {
      if (!uniqueGenres.has(g.name.toLowerCase())) {
        uniqueGenres.set(g.name.toLowerCase(), g);
      }
    }

    const emergingGenres: EmergingItemAnalysis[] = [];
    const establishedGenres: string[] = [];
    const fadingGenres: string[] = [];

    for (const g of uniqueGenres.values()) {
      const historicalEmerging = historicalEmergingNames.has(g.name.toLowerCase());
      const analysis = this.classifyPreferenceStage(
        {
          name: g.name,
          playCount: g.playCount ?? 0,
          shortTermScore: g.shortTermScore ?? g.score ?? 0,
          longTermScore: g.longTermScore ?? 0,
          momentumDelta: g.momentumDelta,
          historicalEmerging,
        },
        options
      );

      if (analysis.stage === 'emerging' || analysis.stage === 'sustained_emerging') {
        emergingGenres.push({
          name: g.name,
          type: 'genre',
          stage: analysis.stage,
          recentPlayCount: g.playCount ?? 0,
          currentScore: g.score ?? 0,
          shortTermScore: g.shortTermScore ?? g.score ?? 0,
          longTermScore: g.longTermScore ?? 0,
          momentumDelta: g.momentumDelta ?? 0,
          emergenceConfidence: analysis.emergenceConfidence,
          explanation: analysis.explanation,
        });
      } else if (analysis.stage === 'established') {
        establishedGenres.push(g.name);
      } else if (analysis.stage === 'fading') {
        fadingGenres.push(g.name);
      }
    }

    // Sort emerging genres by emergenceConfidence descending
    emergingGenres.sort((a, b) => b.emergenceConfidence - a.emergenceConfidence);

    // 2. Analyze Artists
    const rawArtists: DetailedTasteItem[] = [
      ...(currentDNA.artistProfile?.strongestArtists || []),
      ...(currentDNA.artistProfile?.emergingArtists || []),
    ];
    const uniqueArtists = new Map<string, DetailedTasteItem>();
    for (const a of rawArtists) {
      if (!uniqueArtists.has(a.name.toLowerCase())) {
        uniqueArtists.set(a.name.toLowerCase(), a);
      }
    }

    const emergingArtists: EmergingItemAnalysis[] = [];
    const establishedArtists: string[] = [];
    const fadingArtists: string[] = [];

    for (const a of uniqueArtists.values()) {
      const historicalEmerging = historicalEmergingNames.has(a.name.toLowerCase());
      const analysis = this.classifyPreferenceStage(
        {
          name: a.name,
          playCount: a.playCount ?? 0,
          shortTermScore: a.shortTermScore ?? a.score ?? 0,
          longTermScore: a.longTermScore ?? 0,
          momentumDelta: a.momentumDelta,
          historicalEmerging,
        },
        options
      );

      if (analysis.stage === 'emerging' || analysis.stage === 'sustained_emerging') {
        emergingArtists.push({
          name: a.name,
          type: 'artist',
          stage: analysis.stage,
          recentPlayCount: a.playCount ?? 0,
          currentScore: a.score ?? 0,
          shortTermScore: a.shortTermScore ?? a.score ?? 0,
          longTermScore: a.longTermScore ?? 0,
          momentumDelta: a.momentumDelta ?? 0,
          emergenceConfidence: analysis.emergenceConfidence,
          explanation: analysis.explanation,
        });
      } else if (analysis.stage === 'established') {
        establishedArtists.push(a.name);
      } else if (analysis.stage === 'fading') {
        fadingArtists.push(a.name);
      }
    }

    emergingArtists.sort((a, b) => b.emergenceConfidence - a.emergenceConfidence);

    // 3. Analyze Moods
    const rawMoods: DetailedTasteItem[] = currentDNA.moodProfile?.preferredMoods || [];
    const emergingMoods: EmergingItemAnalysis[] = [];

    for (const m of rawMoods) {
      const analysis = this.classifyPreferenceStage(
        {
          name: m.name,
          playCount: m.playCount ?? 0,
          shortTermScore: m.shortTermScore ?? m.score ?? 0,
          longTermScore: m.longTermScore ?? 0,
          momentumDelta: m.momentumDelta,
        },
        options
      );

      if (analysis.stage === 'emerging' || analysis.stage === 'sustained_emerging') {
        emergingMoods.push({
          name: m.name,
          type: 'mood',
          stage: analysis.stage,
          recentPlayCount: m.playCount ?? 0,
          currentScore: m.score ?? 0,
          shortTermScore: m.shortTermScore ?? m.score ?? 0,
          longTermScore: m.longTermScore ?? 0,
          momentumDelta: m.momentumDelta ?? 0,
          emergenceConfidence: analysis.emergenceConfidence,
          explanation: analysis.explanation,
        });
      }
    }

    // 4. Analyze Emerging Behaviors (exploration shifts, archetype transitions)
    const emergingBehaviors: EmergingBehaviorAnalysis[] = [];
    const latestSnapshot = previousSnapshots[0];

    if (latestSnapshot) {
      const prevExp = latestSnapshot.tendencies?.explorationPreference ?? 0.5;
      const currExp = currentDNA.tendencies?.explorationPreference ?? 0.5;
      const expDelta = Number((currExp - prevExp).toFixed(4));
      if (expDelta >= (options.momentumThreshold || 0.15)) {
        emergingBehaviors.push({
          metric: 'explorationPreference',
          stage: 'emerging_shift',
          previousScore: prevExp,
          currentScore: currExp,
          delta: expDelta,
          explanation: `Exploration appetite is expanding rapidly (+${(expDelta * 100).toFixed(1)}%).`,
        });
      }

      const prevArchetype = latestSnapshot.listeningBehavior?.listenerArchetype;
      const currArchetype = currentDNA.listeningBehavior?.listenerArchetype;
      if (prevArchetype && currArchetype && prevArchetype !== currArchetype) {
        emergingBehaviors.push({
          metric: 'listenerArchetype',
          stage: 'emerging_shift',
          previousScore: 0,
          currentScore: 1,
          delta: 1,
          explanation: `Listener personality transitioning from ${prevArchetype} to ${currArchetype}.`,
        });
      }
    }

    // 5. Build Summary & Narrative
    const primaryEmergingGenre = emergingGenres[0]?.name || null;
    const primaryEmergingArtist = emergingArtists[0]?.name || null;
    const primaryEmergingMood = emergingMoods[0]?.name || null;

    let narrative = 'No significant emerging preferences detected yet.';
    if (primaryEmergingGenre && primaryEmergingArtist) {
      narrative = `Strong emerging appetite observed in ${primaryEmergingGenre} and artist ${primaryEmergingArtist}.`;
    } else if (primaryEmergingGenre) {
      narrative = `Strong emerging appetite observed in genre: ${primaryEmergingGenre}.`;
    } else if (primaryEmergingArtist) {
      narrative = `Strong emerging affinity observed for artist: ${primaryEmergingArtist}.`;
    }

    return {
      userId,
      generatedAt,
      summary: {
        totalEmergingCount: emergingGenres.length + emergingArtists.length + emergingMoods.length,
        primaryEmergingGenre,
        primaryEmergingArtist,
        primaryEmergingMood,
        narrative,
      },
      emergingGenres,
      emergingArtists,
      emergingMoods,
      emergingBehaviors,
      establishedPreferences: {
        genres: establishedGenres,
        artists: establishedArtists,
      },
      fadingPreferences: {
        genres: fadingGenres,
        artists: fadingArtists,
      },
    };
  }

  /**
   * DB-backed method: Retrieves user's profile and snapshots and executes full emerging taste analysis.
   */
  static async detectUserEmergingTastes(
    userId: string,
    options: EmergingDetectionOptions = {}
  ): Promise<EmergingTasteReport> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error(`Invalid userId: ${userId}`);
    }

    const currentDNA = await UnifiedMusicDNAService.getOrGenerateProfile(userId);
    const snapshots = await MusicDNASnapshotService.getSnapshots(userId, { limit: 5, sortAsc: false });

    return this.analyzeEmergingTastesFromData(currentDNA, snapshots, options);
  }
}
