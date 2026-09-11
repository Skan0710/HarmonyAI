import { isValidObjectId } from '../utils/validators.js';
import { IMusicDNASnapshot } from '../types/domainModels.js';
import { MusicDNASnapshotService } from './musicDnaSnapshotService.js';
import {
  MusicDNAChangeDetectionService,
  ChangeDetectionThresholds,
  DEFAULT_CHANGE_THRESHOLDS,
} from './musicDnaChangeDetectionService.js';

export type TimelineEventType =
  | 'GENRE_STRENGTHENED'
  | 'GENRE_WEAKENED'
  | 'NEW_ARTIST_EMERGED'
  | 'OLD_PREFERENCE_FADED'
  | 'EXPLORATION_INCREASED'
  | 'EXPLORATION_DECREASED'
  | 'FAMILIARITY_INCREASED'
  | 'FAMILIARITY_DECREASED'
  | 'DIVERSITY_CHANGED'
  | 'ARCHETYPE_SHIFTED'
  | 'TASTE_MILESTONE';

export type EventTargetDimension = 'genre' | 'artist' | 'mood' | 'tendency' | 'behavior';

export interface TimelineEvent {
  id: string;
  timestamp: Date;
  periodLabel: string;
  eventType: TimelineEventType;
  targetDimension: EventTargetDimension;
  itemName: string;
  previousValue: number | string;
  currentValue: number | string;
  delta: number;
  significance: number; // [0.0, 1.0]
  headline: string;
  description: string;
  snapshotId?: string;
}

export interface TasteEvolutionPhase {
  phaseName: string;
  startDate: Date;
  endDate: Date;
  leadingGenre: string;
  leadingArtist: string;
  averageExploration: number;
}

export interface TasteEvolutionTimeline {
  userId: string;
  generatedAt: Date;
  totalEvents: number;
  totalSnapshotsAnalyzed: number;
  timelineRange: {
    startDate: Date | null;
    endDate: Date | null;
    totalDays: number;
  };
  events: TimelineEvent[]; // Strictly ordered chronologically (ascending)
  milestones: TimelineEvent[];
  dominantPhases: TasteEvolutionPhase[];
}

export interface TimelineGenerationOptions {
  thresholds?: ChangeDetectionThresholds;
  maxEvents?: number;
  referenceDate?: Date;
}

export class TasteEvolutionTimelineService {
  /**
   * Pure generator creating a chronological timeline from an ordered array of snapshots.
   */
  static generateTimelineFromSnapshots(
    userId: string,
    snapshots: IMusicDNASnapshot[] = [],
    options: TimelineGenerationOptions = {}
  ): TasteEvolutionTimeline {
    const thresholds = options.thresholds || DEFAULT_CHANGE_THRESHOLDS;
    const generatedAt = options.referenceDate || new Date();

    // Ensure chronological ascending ordering (oldest first)
    const sortedSnapshots = [...snapshots].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    if (sortedSnapshots.length === 0) {
      return {
        userId,
        generatedAt,
        totalEvents: 0,
        totalSnapshotsAnalyzed: 0,
        timelineRange: { startDate: null, endDate: null, totalDays: 0 },
        events: [],
        milestones: [],
        dominantPhases: [],
      };
    }

    const startDate = new Date(sortedSnapshots[0].timestamp);
    const endDate = new Date(sortedSnapshots[sortedSnapshots.length - 1].timestamp);
    const totalDays = Math.max(
      0,
      Number(((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)).toFixed(1))
    );

    const events: TimelineEvent[] = [];
    const milestones: TimelineEvent[] = [];

    // Baseline milestone for the initial snapshot
    const firstSnap = sortedSnapshots[0];
    const topGenre = firstSnap.topGenres[0]?.name || 'Varied';
    const topArtist = firstSnap.topArtists[0]?.name || 'Various Artists';
    const baselineEvent: TimelineEvent = {
      id: `evt-baseline-${firstSnap._id || '0'}`,
      timestamp: new Date(firstSnap.timestamp),
      periodLabel: new Date(firstSnap.timestamp).toISOString().split('T')[0],
      eventType: 'TASTE_MILESTONE',
      targetDimension: 'genre',
      itemName: topGenre,
      previousValue: 0,
      currentValue: firstSnap.topGenres[0]?.affinityScore || 0.5,
      delta: firstSnap.topGenres[0]?.affinityScore || 0.5,
      significance: 0.85,
      headline: `Initial Music DNA Baseline Established`,
      description: `User taste profile initialized with foundational affinity in ${topGenre} and artist ${topArtist}.`,
      snapshotId: firstSnap._id?.toString(),
    };
    events.push(baselineEvent);
    milestones.push(baselineEvent);

    // Analyze transitions across sequential snapshots
    for (let i = 1; i < sortedSnapshots.length; i++) {
      const prev = sortedSnapshots[i - 1];
      const curr = sortedSnapshots[i];
      const currTimestamp = new Date(curr.timestamp);
      const periodLabel = currTimestamp.toISOString().split('T')[0];
      const snapId = curr._id?.toString();

      const changeAnalysis = MusicDNAChangeDetectionService.detectTasteChanges(prev, curr, thresholds);

      // 1. Genre Events
      for (const g of changeAnalysis.genreChanges) {
        if (g.classification === 'emerging') {
          events.push({
            id: `evt-genre-emg-${curr._id}-${g.name}`,
            timestamp: currTimestamp,
            periodLabel,
            eventType: 'GENRE_STRENGTHENED',
            targetDimension: 'genre',
            itemName: g.name,
            previousValue: g.previousScore,
            currentValue: g.currentScore,
            delta: g.delta,
            significance: 0.80,
            headline: `New Genre Emerged: ${g.name}`,
            description: `${g.name} gained rapid popularity (+${(g.delta * 100).toFixed(0)}%), establishing itself as an emerging preference.`,
            snapshotId: snapId,
          });
        } else if (g.classification === 'fading') {
          events.push({
            id: `evt-genre-fade-${curr._id}-${g.name}`,
            timestamp: currTimestamp,
            periodLabel,
            eventType: 'OLD_PREFERENCE_FADED',
            targetDimension: 'genre',
            itemName: g.name,
            previousValue: g.previousScore,
            currentValue: g.currentScore,
            delta: g.delta,
            significance: 0.70,
            headline: `Preference Faded: ${g.name}`,
            description: `Listening habits in ${g.name} declined noticeably from ${(g.previousScore * 100).toFixed(0)}% to ${(g.currentScore * 100).toFixed(0)}%.`,
            snapshotId: snapId,
          });
        } else if (g.classification === 'increased' && g.delta >= thresholds.highVelocityThreshold) {
          events.push({
            id: `evt-genre-inc-${curr._id}-${g.name}`,
            timestamp: currTimestamp,
            periodLabel,
            eventType: 'GENRE_STRENGTHENED',
            targetDimension: 'genre',
            itemName: g.name,
            previousValue: g.previousScore,
            currentValue: g.currentScore,
            delta: g.delta,
            significance: 0.65,
            headline: `${g.name} Became Stronger`,
            description: `Affinity for ${g.name} increased significantly by +${(g.delta * 100).toFixed(0)}%.`,
            snapshotId: snapId,
          });
        } else if (g.classification === 'decreased' && Math.abs(g.delta) >= thresholds.highVelocityThreshold) {
          events.push({
            id: `evt-genre-dec-${curr._id}-${g.name}`,
            timestamp: currTimestamp,
            periodLabel,
            eventType: 'GENRE_WEAKENED',
            targetDimension: 'genre',
            itemName: g.name,
            previousValue: g.previousScore,
            currentValue: g.currentScore,
            delta: g.delta,
            significance: 0.60,
            headline: `${g.name} Weakened in Priority`,
            description: `Listening priority for ${g.name} reduced by ${(g.delta * 100).toFixed(0)}%.`,
            snapshotId: snapId,
          });
        }
      }

      // 2. Artist Events
      for (const a of changeAnalysis.artistChanges) {
        if (a.classification === 'emerging') {
          events.push({
            id: `evt-artist-emg-${curr._id}-${a.name}`,
            timestamp: currTimestamp,
            periodLabel,
            eventType: 'NEW_ARTIST_EMERGED',
            targetDimension: 'artist',
            itemName: a.name,
            previousValue: a.previousScore,
            currentValue: a.currentScore,
            delta: a.delta,
            significance: 0.85,
            headline: `New Artist Preference Emerged: ${a.name}`,
            description: `Frequent interactions introduced ${a.name} into the user's top taste profile (+${(a.delta * 100).toFixed(0)}%).`,
            snapshotId: snapId,
          });
        } else if (a.classification === 'fading') {
          events.push({
            id: `evt-artist-fade-${curr._id}-${a.name}`,
            timestamp: currTimestamp,
            periodLabel,
            eventType: 'OLD_PREFERENCE_FADED',
            targetDimension: 'artist',
            itemName: a.name,
            previousValue: a.previousScore,
            currentValue: a.currentScore,
            delta: a.delta,
            significance: 0.65,
            headline: `Artist Affinity Faded: ${a.name}`,
            description: `Listening activity for ${a.name} cooled down across recent sessions.`,
            snapshotId: snapId,
          });
        }
      }

      // 3. Tendency & Behavioral Events
      for (const t of changeAnalysis.tendencyChanges) {
        if (t.dimension === 'explorationPreference') {
          if (t.classification === 'increased') {
            events.push({
              id: `evt-exp-inc-${curr._id}`,
              timestamp: currTimestamp,
              periodLabel,
              eventType: 'EXPLORATION_INCREASED',
              targetDimension: 'tendency',
              itemName: 'Exploration Tendency',
              previousValue: t.previousScore,
              currentValue: t.currentScore,
              delta: t.delta,
              significance: 0.70,
              headline: `Exploration Tendency Increased`,
              description: `User exhibited greater interest in venturing into unfamiliar music styles (+${(t.delta * 100).toFixed(0)}%).`,
              snapshotId: snapId,
            });
          } else if (t.classification === 'decreased') {
            events.push({
              id: `evt-exp-dec-${curr._id}`,
              timestamp: currTimestamp,
              periodLabel,
              eventType: 'EXPLORATION_DECREASED',
              targetDimension: 'tendency',
              itemName: 'Exploration Tendency',
              previousValue: t.previousScore,
              currentValue: t.currentScore,
              delta: t.delta,
              significance: 0.60,
              headline: `Exploration Appetite Stabilized`,
              description: `User leaned more heavily into known favorites rather than seeking new paths.`,
              snapshotId: snapId,
            });
          }
        } else if (t.dimension === 'familiarityPreference' && t.classification === 'increased') {
          events.push({
            id: `evt-fam-inc-${curr._id}`,
            timestamp: currTimestamp,
            periodLabel,
            eventType: 'FAMILIARITY_INCREASED',
            targetDimension: 'tendency',
            itemName: 'Familiarity Preference',
            previousValue: t.previousScore,
            currentValue: t.currentScore,
            delta: t.delta,
            significance: 0.65,
            headline: `Familiarity Preference Strengthened`,
            description: `Listening habits gravitated towards heavy rotation of favorite tracks and artists.`,
            snapshotId: snapId,
          });
        } else if (t.dimension === 'diversityPreference' && t.classification !== 'stable') {
          events.push({
            id: `evt-div-${curr._id}`,
            timestamp: currTimestamp,
            periodLabel,
            eventType: 'DIVERSITY_CHANGED',
            targetDimension: 'tendency',
            itemName: 'Diversity Preference',
            previousValue: t.previousScore,
            currentValue: t.currentScore,
            delta: t.delta,
            significance: 0.65,
            headline: `Diversity Preference Shifted`,
            description: `Eclecticism breadth shifted by ${(t.delta * 100).toFixed(0)}%.`,
            snapshotId: snapId,
          });
        }
      }

      // Archetype shifts
      const archChange = changeAnalysis.behaviorChanges.find((b) => b.classification === 'archetype_shift');
      if (archChange) {
        events.push({
          id: `evt-arch-${curr._id}`,
          timestamp: currTimestamp,
          periodLabel,
          eventType: 'ARCHETYPE_SHIFTED',
          targetDimension: 'behavior',
          itemName: 'Listener Archetype',
          previousValue: archChange.previousValue,
          currentValue: archChange.currentValue,
          delta: 1.0,
          significance: 0.90,
          headline: `Listener Persona Shifted: ${archChange.currentValue}`,
          description: `Listening behavioral patterns transitioned from ${archChange.previousValue} to ${archChange.currentValue}.`,
          snapshotId: snapId,
        });
      }

      // Rapid transformation milestone
      if (changeAnalysis.tasteStabilityRating === 'rapid_transformation') {
        const transMilestone: TimelineEvent = {
          id: `evt-milestone-rapid-${curr._id}`,
          timestamp: currTimestamp,
          periodLabel,
          eventType: 'TASTE_MILESTONE',
          targetDimension: 'genre',
          itemName: 'Paradigm Shift',
          previousValue: 0,
          currentValue: changeAnalysis.overallShiftMagnitude,
          delta: changeAnalysis.overallShiftMagnitude,
          significance: 0.95,
          headline: `Major Taste Transformation Phase`,
          description: `Rapid evolution across top genres and artists detected (${(changeAnalysis.overallShiftMagnitude * 100).toFixed(0)}% structural shift).`,
          snapshotId: snapId,
        };
        events.push(transMilestone);
        milestones.push(transMilestone);
      }
    }

    // Sort events strictly chronologically
    events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Identify dominant taste evolution phases
    const dominantPhases: TasteEvolutionPhase[] = [];
    if (sortedSnapshots.length >= 2) {
      for (let i = 0; i < sortedSnapshots.length; i++) {
        const snap = sortedSnapshots[i];
        const nextSnap = sortedSnapshots[i + 1] || snap;
        const gName = snap.topGenres[0]?.name || 'Eclectic';
        const aName = snap.topArtists[0]?.name || 'Various';
        const phaseName = `${gName} Era`;

        // Consolidate identical consecutive phases
        const lastPhase = dominantPhases[dominantPhases.length - 1];
        if (lastPhase && lastPhase.leadingGenre === gName) {
          lastPhase.endDate = new Date(nextSnap.timestamp);
        } else {
          dominantPhases.push({
            phaseName,
            startDate: new Date(snap.timestamp),
            endDate: new Date(nextSnap.timestamp),
            leadingGenre: gName,
            leadingArtist: aName,
            averageExploration: snap.tendencies?.explorationPreference ?? 0.5,
          });
        }
      }
    }

    return {
      userId,
      generatedAt,
      totalEvents: events.length,
      totalSnapshotsAnalyzed: sortedSnapshots.length,
      timelineRange: {
        startDate,
        endDate,
        totalDays,
      },
      events: options.maxEvents ? events.slice(0, options.maxEvents) : events,
      milestones,
      dominantPhases,
    };
  }

  /**
   * DB-backed method: Retrieves user's chronological snapshots and generates their evolution timeline.
   */
  static async getUserEvolutionTimeline(
    userId: string,
    options: TimelineGenerationOptions = {}
  ): Promise<TasteEvolutionTimeline> {
    if (!isValidObjectId(userId)) {
      throw new Error(`Invalid userId: ${userId}`);
    }

    const snapshots = await MusicDNASnapshotService.getSnapshots(userId, { sortAsc: true });
    return this.generateTimelineFromSnapshots(userId, snapshots, options);
  }
}
