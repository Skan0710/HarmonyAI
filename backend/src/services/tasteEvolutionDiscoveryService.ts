import { Types } from 'mongoose';
import {
  TasteEvolutionDiscoveryConfig,
  getTasteEvolutionDiscoveryConfig,
} from '../config/tasteEvolutionDiscoveryConfig.js';
import { GENRE_ADJACENCY_MAP } from './tasteBoundaryDetectionService.js';
import { HybridCandidate } from './candidateGenerationService.js';
import { HybridRankedResult } from './hybridRankingPipeline.js';
import { UnifiedMusicDNA } from '../schemas/musicDnaSchema.js';
import { PersonalMusicTwinAttributes } from '../schemas/personalMusicTwinSchema.js';
import { UnifiedLayeredTasteProfile } from './layeredTemporalTasteProfileService.js';
import {
  EmergingTasteReport,
  EmergingTasteDetectionService,
} from './emergingTasteDetectionService.js';
import {
  TasteStabilityTransformationMetrics,
  TasteStabilityTransformationService,
} from './tasteStabilityTransformationService.js';
import { UnifiedMusicDNAService } from './unifiedMusicDnaService.js';
import { PersonalMusicTwinService } from './personalMusicTwinService.js';
import { LayeredTemporalTasteProfileService } from './layeredTemporalTasteProfileService.js';
import { MusicDNASnapshotService } from './musicDnaSnapshotService.js';

export type EvolutionDiscoveryCategory =
  | 'EMERGING_GENRE_FRONTIER'
  | 'RELATED_EMERGING_ARTIST'
  | 'RISING_MOOD_MOMENTUM'
  | 'ADJACENT_RECENT_BEHAVIOR'
  | 'STABLE_ANCHOR_CONTINUITY'
  | 'GENERAL_DISCOVERY';

export interface TasteEvolutionDiscoveryItemDiagnostics {
  directionAlignmentScore: number;       // [0.0, 1.0] Alignment with taste trajectory
  isEmergingGenre: boolean;
  isSustainedEmerging: boolean;
  isRelatedToEmergingArtist: boolean;
  isRisingMood: boolean;
  isAdjacentToRecentBehavior: boolean;
  isFadingPreference: boolean;
  isFlukeSuppressed: boolean;
  category: EvolutionDiscoveryCategory;
  explanation: string;
}

export interface TasteEvolutionRankedResult extends HybridRankedResult {
  tasteEvolutionDiscoveryDiagnostics: TasteEvolutionDiscoveryItemDiagnostics;
}

export interface EvolutionTrendState {
  name: string;
  type: 'genre' | 'artist' | 'mood';
  status: 'emerging' | 'sustained_emerging' | 'stable' | 'fading' | 'isolated_fluke';
  isVerifiedTrend: boolean;
  momentumDelta: number;
  confidence: number;
  interactionCount: number;
  hasPositiveFeedback?: boolean;
  evidenceReason: string;
}

export interface TasteEvolutionDiscoveryInputs {
  userId: string | Types.ObjectId;
  candidates: HybridCandidate[];
  limit?: number;
  musicDna?: UnifiedMusicDNA | any | null;
  personalMusicTwin?: PersonalMusicTwinAttributes | any | null;
  temporalProfile?: UnifiedLayeredTasteProfile | any | null;
  emergingTasteReport?: EmergingTasteReport | any | null;
  tasteStabilityMetrics?: TasteStabilityTransformationMetrics | any | null;
  snapshots?: any[] | null;
  configOverride?: Partial<TasteEvolutionDiscoveryConfig>;
}

export interface TasteEvolutionDiscoveryResult {
  userId: string;
  strategyUsed: 'TASTE_EVOLUTION_DISCOVERY';
  recommendations: TasteEvolutionRankedResult[];
  diagnostics: {
    totalCandidatesEvaluated: number;
    emergingMatchesCount: number;
    relatedArtistMatchesCount: number;
    risingMoodMatchesCount: number;
    fadingPenalizedCount: number;
    flukesSuppressedCount: number;
    transformationIntensity: number;
    evolutionArchetype: string;
    dominantDirection: string;
    verifiedEmergingGenres: string[];
    verifiedEmergingArtists: string[];
    fadingPreferences: string[];
  };
  summaryNarrative: string;
}

export class TasteEvolutionDiscoveryService {
  /**
   * Pure deterministic ranking function:
   * Re-ranks candidates by aligning them with where the user's taste appears to be heading,
   * boosting verified emerging genres, related artists, rising moods, and adjacent recent frontiers
   * while dampening fading preferences and requiring verified evidence to avoid overreacting to isolated flukes.
   */
  static rankTasteEvolutionDiscovery(
    inputs: TasteEvolutionDiscoveryInputs
  ): TasteEvolutionDiscoveryResult {
    const config: TasteEvolutionDiscoveryConfig = {
      ...getTasteEvolutionDiscoveryConfig(),
      ...inputs.configOverride,
    };

    const userIdStr = inputs.userId ? inputs.userId.toString() : '';
    const candidates = inputs.candidates || [];
    const limit = inputs.limit ?? 10;

    // 1. Extract Evolution Trends across all input sources with Anti-Overreaction Evidence Verification
    const trends = this.extractEvolutionTrends(inputs, config);

    // 2. Resolve transformation intensity & archetype
    const intensity =
      inputs.tasteStabilityMetrics?.transformationIntensity ??
      inputs.personalMusicTwin?.tasteEvolution?.transformationIntensity ??
      0.50;

    const archetype =
      inputs.tasteStabilityMetrics?.archetype ??
      inputs.personalMusicTwin?.tasteEvolution?.evolutionArchetype ??
      (intensity > 0.65 ? 'Transforming / Paradigm Shift' : 'Gradual Evolver');

    const intensityMultiplier =
      intensity > 0.60 ? config.transformationIntensityMultiplier : 1.0;

    // Fast lookup structures
    const emergingGenreMap = new Map<string, EvolutionTrendState>();
    const emergingArtistMap = new Map<string, EvolutionTrendState>();
    const relatedEmergingArtistMap = new Map<string, string>(); // artistName -> emergingArtistName
    const risingMoodMap = new Map<string, EvolutionTrendState>();
    const adjacentRecentGenreMap = new Map<string, string>();   // adjacentGenre -> anchorRecentGenre
    const fadingGenreSet = new Set<string>();
    const fadingArtistSet = new Set<string>();
    const stableGenreSet = new Set<string>();
    const flukeGenreSet = new Set<string>();
    const flukeArtistSet = new Set<string>();

    for (const t of trends) {
      const key = t.name.toLowerCase().trim();
      if (t.type === 'genre') {
        if (t.status === 'emerging' || t.status === 'sustained_emerging') {
          emergingGenreMap.set(key, t);
          // Find adjacent sister/neighbor genres connected to this emerging genre (including family peers)
          const adjacentPeers = this.getAdjacentGenresFor(t.name);
          for (const peer of adjacentPeers) {
            const pKey = peer.name.toLowerCase().trim();
            if (!adjacentRecentGenreMap.has(pKey) && !emergingGenreMap.has(pKey)) {
              adjacentRecentGenreMap.set(pKey, peer.anchor);
            }
          }
        } else if (t.status === 'fading') {
          fadingGenreSet.add(key);
        } else if (t.status === 'stable') {
          stableGenreSet.add(key);
        } else if (t.status === 'isolated_fluke') {
          flukeGenreSet.add(key);
        }
      } else if (t.type === 'artist') {
        if (t.status === 'emerging' || t.status === 'sustained_emerging') {
          emergingArtistMap.set(key, t);
        } else if (t.status === 'fading') {
          fadingArtistSet.add(key);
        } else if (t.status === 'isolated_fluke') {
          flukeArtistSet.add(key);
        }
      } else if (t.type === 'mood') {
        if (t.status === 'emerging' || t.status === 'sustained_emerging') {
          risingMoodMap.set(key, t);
        }
      }
    }

    // Build related artists map from Twin or metadata
    const twinEmergingArtists = inputs.personalMusicTwin?.currentEmergingInterests?.artists || [];
    for (const a of twinEmergingArtists) {
      const aName = (typeof a === 'string' ? a : a.name || '').toLowerCase().trim();
      if (aName) {
        // Any other artist sharing an emerging genre or explicitly marked as peer
        const peerList = (a as any).relatedArtists || [];
        for (const p of peerList) {
          const pName = (typeof p === 'string' ? p : p.name || '').toLowerCase().trim();
          if (pName && !emergingArtistMap.has(pName)) {
            relatedEmergingArtistMap.set(pName, aName);
          }
        }
      }
    }

    let emergingMatchesCount = 0;
    let relatedArtistMatchesCount = 0;
    let risingMoodMatchesCount = 0;
    let fadingPenalizedCount = 0;
    let flukesSuppressedCount = 0;

    const scoredCandidates: TasteEvolutionRankedResult[] = [];

    // 3. Score Each Candidate Track on Taste Evolution Trajectory
    for (const cand of candidates) {
      const candAny = cand as any;
      const songDoc = cand.songDoc || candAny.song || {};
      const songId = (songDoc._id || cand.songId || candAny._id || '').toString();

      const songGenre = (
        typeof songDoc.genre === 'object' && songDoc.genre?.name
          ? songDoc.genre.name
          : typeof songDoc.genre === 'string'
          ? songDoc.genre
          : Array.isArray(songDoc.genres) && songDoc.genres[0]
          ? songDoc.genres[0]
          : ''
      ).toLowerCase().trim();

      const songArtist = (
        typeof songDoc.artist === 'object' && songDoc.artist?.name
          ? songDoc.artist.name
          : typeof songDoc.artist === 'string'
          ? songDoc.artist
          : Array.isArray(songDoc.artists) && songDoc.artists[0]
          ? songDoc.artists[0]
          : ''
      ).toLowerCase().trim();

      const songMood = (
        songDoc.mood ||
        songDoc.primaryMood ||
        (Array.isArray(songDoc.moods) && songDoc.moods[0]) ||
        (songDoc.song && (songDoc.song.mood || songDoc.song.primaryMood)) ||
        ''
      ).toLowerCase().trim();

      let directionScore = 0.20;
      let isEmergingGenre = false;
      let isSustainedEmerging = false;
      let isRelatedToEmergingArtist = false;
      let isRisingMood = false;
      let isAdjacentToRecentBehavior = false;
      let isFadingPreference = false;
      let isFlukeSuppressed = false;
      let category: EvolutionDiscoveryCategory = 'GENERAL_DISCOVERY';
      let explanation = 'Explores fresh sounds balanced against your general musical background.';

      // A. Check Anti-Overreaction Fluke Suppression first
      if (flukeGenreSet.has(songGenre) || flukeArtistSet.has(songArtist)) {
        isFlukeSuppressed = true;
        flukesSuppressedCount++;
        directionScore = Math.max(0.05, directionScore - config.flukeSuppressionPenalty);
        explanation = 'Isolated short-term interaction detected without sufficient trend evidence; deprioritized to avoid overreaction.';
      }

      // B. Emerging Genre Match
      const emergingGenreTrend = emergingGenreMap.get(songGenre);
      if (emergingGenreTrend && emergingGenreTrend.isVerifiedTrend) {
        isEmergingGenre = true;
        emergingMatchesCount++;
        isSustainedEmerging = emergingGenreTrend.status === 'sustained_emerging';
        const boost =
          (config.emergingGenreBoost + (isSustainedEmerging ? config.sustainedEmergingBonus : 0.0)) *
          intensityMultiplier;
        directionScore += boost;
        category = 'EMERGING_GENRE_FRONTIER';
        explanation = `Matches your verified emerging genre "${emergingGenreTrend.name}" (${emergingGenreTrend.evidenceReason}).`;
      }

      // C. Related Emerging Artist Match
      const emergingArtistTrend = emergingArtistMap.get(songArtist);
      if (emergingArtistTrend && emergingArtistTrend.isVerifiedTrend) {
        emergingMatchesCount++;
        directionScore += config.relatedEmergingArtistBoost * intensityMultiplier;
        if (category === 'GENERAL_DISCOVERY') {
          category = 'RELATED_EMERGING_ARTIST';
        }
        explanation = isEmergingGenre
          ? `Matches your verified emerging genre "${emergingGenreTrend?.name}" and rising artist "${emergingArtistTrend.name}".`
          : `Matches your rapidly rising emerging artist "${emergingArtistTrend.name}".`;
      } else if (relatedEmergingArtistMap.has(songArtist)) {
        const anchorArtist = relatedEmergingArtistMap.get(songArtist);
        isRelatedToEmergingArtist = true;
        relatedArtistMatchesCount++;
        directionScore += config.relatedEmergingArtistBoost * 0.85;
        if (category === 'GENERAL_DISCOVERY') {
          category = 'RELATED_EMERGING_ARTIST';
        }
        explanation = `Features ${songDoc.artist?.name || songArtist}, a stylistic peer connected to your emerging interest in ${anchorArtist}.`;
      }

      // D. Rising Mood Momentum Match
      if (risingMoodMap.has(songMood)) {
        const moodTrend = risingMoodMap.get(songMood)!;
        isRisingMood = true;
        risingMoodMatchesCount++;
        directionScore += config.risingMoodBoost;
        if (category === 'GENERAL_DISCOVERY') {
          category = 'RISING_MOOD_MOMENTUM';
          explanation = `Taps into your increasingly preferred mood "${moodTrend.name}" based on recent listening momentum.`;
        }
      }

      // E. Adjacent Recent Genre Frontier
      if (!isEmergingGenre && adjacentRecentGenreMap.has(songGenre)) {
        const anchor = adjacentRecentGenreMap.get(songGenre);
        isAdjacentToRecentBehavior = true;
        directionScore += config.adjacentRecentGenreBoost;
        if (category === 'GENERAL_DISCOVERY') {
          category = 'ADJACENT_RECENT_BEHAVIOR';
          explanation = `Explores "${songDoc.genre?.name || songGenre}", an adjacent frontier directly connected to your recent interest in ${anchor}.`;
        }
      }

      // F. Stable Anchor Continuity (Foundational grounding)
      if (stableGenreSet.has(songGenre)) {
        directionScore += config.stableAnchorBaseScore * 0.50;
        if (category === 'GENERAL_DISCOVERY') {
          category = 'STABLE_ANCHOR_CONTINUITY';
          explanation = `Grounded in your foundational bedrock genre "${songGenre}" with fresh compositional traits.`;
        }
      }

      // G. Fading Preference Penalty
      if (fadingGenreSet.has(songGenre) || fadingArtistSet.has(songArtist)) {
        isFadingPreference = true;
        fadingPenalizedCount++;
        directionScore = Math.max(0.05, directionScore - config.fadingPenalty);
        explanation = `Deprioritized because this style is currently fading in your overall listening trajectory.`;
      }

      // Normalization and hybrid score calculation
      const baseAffinity = cand.userTasteAffinityScore ?? cand.contentScore ?? 0.5;
      const compositeScore = Number(
        Math.min(0.99, Math.max(0.05, 0.40 * baseAffinity + 0.60 * directionScore)).toFixed(4)
      );

      const diagnostics: TasteEvolutionDiscoveryItemDiagnostics = {
        directionAlignmentScore: Number(Math.min(1.0, Math.max(0.0, directionScore)).toFixed(4)),
        isEmergingGenre,
        isSustainedEmerging,
        isRelatedToEmergingArtist,
        isRisingMood,
        isAdjacentToRecentBehavior,
        isFadingPreference,
        isFlukeSuppressed,
        category,
        explanation,
      };

      scoredCandidates.push({
        song: songDoc,
        hybridScore: compositeScore,
        componentScores: {
          contentScore: Number(directionScore.toFixed(4)),
          collaborativeScore: cand.collaborativeScore ?? 0.5,
          userTasteAffinityScore: baseAffinity,
          popularityScore: cand.popularitySignal ?? 0.5,
          recencyScore: isEmergingGenre ? 0.90 : 0.50,
          tasteEvolutionScore: Number(directionScore.toFixed(4)),
          personalMusicTwinScore: compositeScore,
        },
        sources: cand.sources || ['taste_evolution_discovery'],
        tasteEvolutionDiscoveryDiagnostics: diagnostics,
      });
    }

    // 4. Sort by Taste Evolution hybrid score descending
    scoredCandidates.sort((a, b) => b.hybridScore - a.hybridScore);

    // 5. Diversity Re-ranking across top candidates (prevent single emerging genre monopolization)
    const finalRecommendations: TasteEvolutionRankedResult[] = [];
    const genreCounts = new Map<string, number>();
    const maxPerGenre = Math.max(2, Math.ceil(limit * 0.35));

    for (const item of scoredCandidates) {
      const g = (
        typeof item.song?.genre === 'object' && item.song?.genre?.name
          ? item.song.genre.name
          : typeof item.song?.genre === 'string'
          ? item.song.genre
          : Array.isArray(item.song?.genres) && item.song?.genres[0]
          ? item.song.genres[0]
          : 'unknown'
      ).toLowerCase();

      const count = genreCounts.get(g) || 0;
      if (count < maxPerGenre || finalRecommendations.length + (scoredCandidates.length - finalRecommendations.length) <= limit) {
        genreCounts.set(g, count + 1);
        const decayPenalty = count * (config.diversityDecayRate ?? 0.05);
        item.hybridScore = Number(Math.max(0.01, item.hybridScore - decayPenalty).toFixed(4));
        finalRecommendations.push(item);
        if (finalRecommendations.length >= limit) break;
      }
    }

    // Backfill if diversity limit left vacancies
    if (finalRecommendations.length < limit) {
      const selectedIds = new Set(finalRecommendations.map((r) => (r.song?._id || '').toString()));
      for (const item of scoredCandidates) {
        const id = (item.song?._id || '').toString();
        if (!selectedIds.has(id)) {
          finalRecommendations.push(item);
          if (finalRecommendations.length >= limit) break;
        }
      }
    }

    const verifiedEmergingGenres = Array.from(emergingGenreMap.values())
      .filter((g) => g.isVerifiedTrend)
      .map((g) => g.name);

    const verifiedEmergingArtists = Array.from(emergingArtistMap.values())
      .filter((a) => a.isVerifiedTrend)
      .map((a) => a.name);

    const fadingPrefs = [
      ...Array.from(fadingGenreSet.values()),
      ...Array.from(fadingArtistSet.values()),
    ];

    const dominantDirection =
      verifiedEmergingGenres.length > 0
        ? `Emerging into ${verifiedEmergingGenres.join(', ')}`
        : archetype;

    const summaryNarrative =
      verifiedEmergingGenres.length > 0
        ? `Taste evolution discovery aligned with active trajectory toward ${verifiedEmergingGenres.slice(0, 2).join(' & ')}.`
        : `Taste evolution discovery preserving stable anchors with cautious exploratory expansion.`;

    return {
      userId: userIdStr,
      strategyUsed: 'TASTE_EVOLUTION_DISCOVERY',
      recommendations: finalRecommendations,
      diagnostics: {
        totalCandidatesEvaluated: candidates.length,
        emergingMatchesCount,
        relatedArtistMatchesCount,
        risingMoodMatchesCount,
        fadingPenalizedCount,
        flukesSuppressedCount,
        transformationIntensity: intensity,
        evolutionArchetype: archetype,
        dominantDirection,
        verifiedEmergingGenres,
        verifiedEmergingArtists,
        fadingPreferences: fadingPrefs,
      },
      summaryNarrative,
    };
  }

  /**
   * Helper to extract and normalize evolution trend items from all available input sources.
   * Enforces Anti-Overreaction Evidence Verification:
   * - Items with < minInteractionsForEmergenceTrend (e.g. 1 play) and no positive feedback are marked as isolated_fluke.
   */
  static extractEvolutionTrends(
    inputs: TasteEvolutionDiscoveryInputs,
    config: TasteEvolutionDiscoveryConfig
  ): EvolutionTrendState[] {
    const trendMap = new Map<string, EvolutionTrendState>();

    const addTrend = (trend: EvolutionTrendState) => {
      const key = `${trend.type}:${trend.name.toLowerCase().trim()}`;
      const existing = trendMap.get(key);
      if (!existing) {
        trendMap.set(key, trend);
      } else {
        // Upgrade status if new source provides stronger evidence
        if (trend.isVerifiedTrend && !existing.isVerifiedTrend) {
          trendMap.set(key, trend);
        } else if (trend.status === 'sustained_emerging') {
          trendMap.set(key, trend);
        }
      }
    };

    // 1. From EmergingTasteReport (EmergingTasteDetectionService)
    if (inputs.emergingTasteReport) {
      const rep = inputs.emergingTasteReport;
      for (const g of rep.emergingGenres || []) {
        const plays = g.recentPlayCount || 0;
        const hasEvidence = plays >= config.minInteractionsForEmergenceTrend || !!g.hasPositiveFeedback;
        addTrend({
          name: g.name,
          type: 'genre',
          status: hasEvidence ? (g.stage === 'sustained_emerging' ? 'sustained_emerging' : 'emerging') : 'isolated_fluke',
          isVerifiedTrend: hasEvidence,
          momentumDelta: g.momentumDelta ?? 0.30,
          confidence: g.emergenceConfidence ?? 0.70,
          interactionCount: plays,
          hasPositiveFeedback: g.hasPositiveFeedback,
          evidenceReason: hasEvidence ? `${plays} recent interactions with positive trajectory` : 'Only 1 isolated play',
        });
      }

      for (const a of rep.emergingArtists || []) {
        const plays = a.recentPlayCount || 0;
        const hasEvidence = plays >= config.minInteractionsForEmergenceTrend || !!a.hasPositiveFeedback;
        addTrend({
          name: a.name,
          type: 'artist',
          status: hasEvidence ? (a.stage === 'sustained_emerging' ? 'sustained_emerging' : 'emerging') : 'isolated_fluke',
          isVerifiedTrend: hasEvidence,
          momentumDelta: a.momentumDelta ?? 0.30,
          confidence: a.emergenceConfidence ?? 0.70,
          interactionCount: plays,
          hasPositiveFeedback: a.hasPositiveFeedback,
          evidenceReason: hasEvidence ? `${plays} recent interactions` : 'Only 1 isolated play',
        });
      }

      for (const m of rep.emergingMoods || []) {
        addTrend({
          name: m.name,
          type: 'mood',
          status: 'emerging',
          isVerifiedTrend: true,
          momentumDelta: m.momentumDelta ?? 0.25,
          confidence: m.emergenceConfidence ?? 0.70,
          interactionCount: m.recentPlayCount || 2,
          evidenceReason: 'Rising mood trajectory in recent sessions',
        });
      }

      for (const fg of rep.fadingPreferences?.genres || []) {
        addTrend({
          name: fg,
          type: 'genre',
          status: 'fading',
          isVerifiedTrend: true,
          momentumDelta: -0.30,
          confidence: 0.80,
          interactionCount: 0,
          evidenceReason: 'Declining listening volume in recent windows',
        });
      }

      for (const fa of rep.fadingPreferences?.artists || []) {
        addTrend({
          name: fa,
          type: 'artist',
          status: 'fading',
          isVerifiedTrend: true,
          momentumDelta: -0.30,
          confidence: 0.80,
          interactionCount: 0,
          evidenceReason: 'Declining artist listens',
        });
      }
    }

    // 2. From PersonalMusicTwin (currentEmergingInterests, fadingPreferences, establishedPreferences)
    if (inputs.personalMusicTwin) {
      const twin = inputs.personalMusicTwin;
      const emerging = twin.currentEmergingInterests;
      if (emerging) {
        for (const g of emerging.genres || []) {
          const gName = typeof g === 'string' ? g : g.name;
          const conf = typeof g === 'object' && g.confidence !== undefined ? g.confidence : 0.75;
          addTrend({
            name: gName,
            type: 'genre',
            status: 'emerging',
            isVerifiedTrend: conf >= config.minEmergenceConfidence,
            momentumDelta: 0.35,
            confidence: conf,
            interactionCount: 3,
            evidenceReason: 'Twin active emerging frontier',
          });
        }

        for (const a of emerging.artists || []) {
          const aName = typeof a === 'string' ? a : a.name;
          const conf = typeof a === 'object' && a.confidence !== undefined ? a.confidence : 0.75;
          addTrend({
            name: aName,
            type: 'artist',
            status: 'emerging',
            isVerifiedTrend: conf >= config.minEmergenceConfidence,
            momentumDelta: 0.35,
            confidence: conf,
            interactionCount: 3,
            evidenceReason: 'Twin active emerging artist',
          });
        }

        for (const m of emerging.moods || []) {
          addTrend({
            name: m,
            type: 'mood',
            status: 'emerging',
            isVerifiedTrend: true,
            momentumDelta: 0.25,
            confidence: 0.75,
            interactionCount: 3,
            evidenceReason: 'Twin rising emotional resonance',
          });
        }
      }

      const fading = twin.fadingPreferences;
      if (fading) {
        for (const fg of fading.genres || []) {
          addTrend({
            name: fg,
            type: 'genre',
            status: 'fading',
            isVerifiedTrend: true,
            momentumDelta: -0.35,
            confidence: 0.85,
            interactionCount: 0,
            evidenceReason: 'Identified as fading in Music Twin',
          });
        }
        for (const fa of fading.artists || []) {
          addTrend({
            name: fa,
            type: 'artist',
            status: 'fading',
            isVerifiedTrend: true,
            momentumDelta: -0.35,
            confidence: 0.85,
            interactionCount: 0,
            evidenceReason: 'Identified as fading artist in Music Twin',
          });
        }
      }

      const established = twin.establishedPreferences;
      if (established) {
        for (const sg of established.genres || []) {
          addTrend({
            name: sg,
            type: 'genre',
            status: 'stable',
            isVerifiedTrend: true,
            momentumDelta: 0.0,
            confidence: 0.90,
            interactionCount: 15,
            evidenceReason: 'Established foundational preference',
          });
        }
      }
    }

    // 3. From LayeredTemporalTasteProfile (StrongestChangingPreferences & Layers)
    if (inputs.temporalProfile) {
      const tp = inputs.temporalProfile;
      const changes = tp.strongestChangingPreferences;
      if (changes) {
        for (const r of changes.topRising || []) {
          const plays = (r as any).recentPlayCount ?? (r as any).interactionCount ?? 3;
          const hasEvidence = plays >= config.minInteractionsForEmergenceTrend;
          addTrend({
            name: r.name,
            type: r.category as any,
            status: hasEvidence ? 'emerging' : 'isolated_fluke',
            isVerifiedTrend: hasEvidence,
            momentumDelta: r.changeDelta,
            confidence: 0.80,
            interactionCount: plays,
            evidenceReason: hasEvidence ? `Rising momentum +${(r.changeDelta * 100).toFixed(0)}%` : 'Only 1 isolated play',
          });
        }

        for (const d of changes.topDeclining || []) {
          addTrend({
            name: d.name,
            type: d.category as any,
            status: 'fading',
            isVerifiedTrend: true,
            momentumDelta: d.changeDelta,
            confidence: 0.80,
            interactionCount: 0,
            evidenceReason: `Declining momentum ${(d.changeDelta * 100).toFixed(0)}%`,
          });
        }

        for (const e of changes.topEmerging || []) {
          addTrend({
            name: e.name,
            type: e.category as any,
            status: 'emerging',
            isVerifiedTrend: true,
            momentumDelta: e.changeDelta,
            confidence: 0.85,
            interactionCount: 4,
            evidenceReason: `Emerging interest with delta +${(e.changeDelta * 100).toFixed(0)}%`,
          });
        }
      }
    }

    // 4. From UnifiedMusicDNA (detailedTaste top/emerging)
    if (inputs.musicDna) {
      const dna = inputs.musicDna;
      const emergingGenres =
        dna.detailedTaste?.emergingGenres ||
        dna.genreProfile?.emergingGenres ||
        [];
      for (const g of emergingGenres) {
        const name = typeof g === 'string' ? g : g.genre || g.name;
        if (name) {
          addTrend({
            name,
            type: 'genre',
            status: 'emerging',
            isVerifiedTrend: true,
            momentumDelta: 0.30,
            confidence: 0.75,
            interactionCount: 3,
            evidenceReason: 'DNA emerging genre',
          });
        }
      }

      const emergingArtists =
        dna.detailedTaste?.emergingArtists ||
        dna.artistProfile?.emergingArtists ||
        [];
      for (const a of emergingArtists) {
        const name = typeof a === 'string' ? a : a.artist || a.name;
        if (name) {
          addTrend({
            name,
            type: 'artist',
            status: 'emerging',
            isVerifiedTrend: true,
            momentumDelta: 0.30,
            confidence: 0.75,
            interactionCount: 3,
            evidenceReason: 'DNA emerging artist',
          });
        }
      }
    }

    return Array.from(trendMap.values());
  }

  /**
   * Asynchronous loader helper: Resolves Music DNA, Personal Music Twin,
   * temporal profiles, emerging reports, and snapshots from MongoDB when available,
   * then executes rankTasteEvolutionDiscovery.
   */
  static async getTasteEvolutionDiscoveryRecommendations(params: {
    userId: string;
    candidates?: HybridCandidate[];
    limit?: number;
    configOverride?: Partial<TasteEvolutionDiscoveryConfig>;
  }): Promise<TasteEvolutionDiscoveryResult> {
    const { userId, limit = 10, configOverride } = params;

    let musicDna: any = null;
    let personalMusicTwin: any = null;
    let temporalProfile: any = null;
    let emergingTasteReport: any = null;
    let snapshots: any[] = [];
    let tasteStabilityMetrics: any = null;

    if (userId && Types.ObjectId.isValid(userId)) {
      try {
        musicDna = await UnifiedMusicDNAService.getOrGenerateProfile(userId);
      } catch {
        // Safe fallback
      }

      try {
        personalMusicTwin = await PersonalMusicTwinService.getOrGenerateTwin(userId);
      } catch {
        // Safe fallback
      }

      try {
        temporalProfile = await LayeredTemporalTasteProfileService.generateLayeredTasteProfile(userId);
      } catch {
        // Safe fallback
      }

      try {
        emergingTasteReport = await EmergingTasteDetectionService.detectUserEmergingTastes(userId);
      } catch {
        // Safe fallback
      }

      try {
        snapshots = await MusicDNASnapshotService.getSnapshots(userId);
        if (snapshots.length >= 2) {
          tasteStabilityMetrics = TasteStabilityTransformationService.calculateMetricsFromData(
            userId,
            snapshots,
            musicDna
          );
        }
      } catch {
        // Safe fallback
      }
    }

    return this.rankTasteEvolutionDiscovery({
      userId,
      candidates: params.candidates || [],
      limit,
      musicDna,
      personalMusicTwin,
      temporalProfile,
      emergingTasteReport,
      tasteStabilityMetrics,
      snapshots,
      configOverride,
    });
  }

  /**
   * Resolves adjacent sister and neighbor genres for a given genre,
   * supporting both direct primary mappings and bidirectional family peer lookup.
   */
  static getAdjacentGenresFor(genreName: string): { name: string; anchor: string }[] {
    const key = genreName.toLowerCase().trim();
    const result: { name: string; anchor: string }[] = [];
    const seen = new Set<string>();

    const addPeer = (name: string, anchor: string) => {
      const pKey = name.toLowerCase().trim();
      if (pKey !== key && !seen.has(pKey)) {
        seen.add(pKey);
        result.push({ name, anchor });
      }
    };

    // 1. Direct primary key mapping
    if (GENRE_ADJACENCY_MAP[key]) {
      const mapping = GENRE_ADJACENCY_MAP[key];
      for (const s of mapping.sisters) addPeer(s.name, genreName);
      for (const n of mapping.neighbors) addPeer(n.name, genreName);
    }

    // 2. Bidirectional / Inverse search: check if key is a sister or neighbor in any family
    for (const [primaryGenre, mapping] of Object.entries(GENRE_ADJACENCY_MAP)) {
      const isSister = mapping.sisters.some((s) => s.name.toLowerCase().trim() === key);
      const isNeighbor = mapping.neighbors.some((n) => n.name.toLowerCase().trim() === key);
      if (isSister || isNeighbor) {
        addPeer(primaryGenre, genreName);
        for (const s of mapping.sisters) addPeer(s.name, genreName);
        for (const n of mapping.neighbors) addPeer(n.name, genreName);
      }
    }

    return result;
  }
}

export default TasteEvolutionDiscoveryService;
