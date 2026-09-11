import { isValidObjectId } from '../utils/validators.js';
import {
  OutsideComfortZoneConfig,
  getOutsideComfortZoneConfig,
} from '../config/outsideComfortZoneConfig.js';
import {
  TasteBoundaryDetectionService,
  TasteBoundaryProfile,
  TasteBoundaryItem,
} from './tasteBoundaryDetectionService.js';
import {
  ComfortDiscoveryScoringService,
  ComfortDiscoveryScoreResult,
} from './comfortDiscoveryScoringService.js';
import { HybridCandidate } from './candidateGenerationService.js';
import { HybridRankedResult } from './hybridRankingPipeline.js';
import { UnifiedMusicDNA } from '../schemas/musicDnaSchema.js';
import { PersonalMusicTwinAttributes } from '../schemas/personalMusicTwinSchema.js';

export type OutsideZoneCategory =
  | 'ADJACENT_GENRE'
  | 'RELATED_ARTIST'
  | 'FAMILIAR_MOOD_FRESH_SOUND'
  | 'EMERGING_FRONTIER'
  | 'CROSS_GENRE_HYBRID';

export interface OutsideComfortZoneItemDiagnostics {
  relevanceScore: number;       // [0.0, 1.0] - How connected the track is to user's musical taste
  noveltyScore: number;         // [0.0, 1.0] - How fresh/unfamiliar the track is relative to comfort zone
  compositeScore: number;       // [0.0, 1.0] - Weighted balance score
  discoveryCategory: OutsideZoneCategory;
  isAdjacentGenre: boolean;
  isRelatedArtist: boolean;
  isFamiliarMood: boolean;
  anchorGenre?: string;
  explanation: string;
}

export interface OutsideComfortZoneRankedResult extends HybridRankedResult {
  outsideComfortZoneDiagnostics: OutsideComfortZoneItemDiagnostics;
}

export interface OutsideComfortZoneRankingInputs {
  userId: string;
  candidates: HybridCandidate[];
  limit?: number;
  tasteBoundaries?: TasteBoundaryProfile | null;
  comfortDiscoveryScore?: ComfortDiscoveryScoreResult | null;
  musicDna?: UnifiedMusicDNA | any | null;
  personalMusicTwin?: PersonalMusicTwinAttributes | any | null;
  userEncounteredSongIds?: Set<string> | Map<string, number>;
  configOverride?: Partial<OutsideComfortZoneConfig>;
}

export interface OutsideComfortZoneResult {
  userId: string;
  strategyUsed: 'OUTSIDE_COMFORT_ZONE';
  recommendations: OutsideComfortZoneRankedResult[];
  diagnostics: {
    totalCandidatesEvaluated: number;
    qualifiedCount: number;
    rejectedUnrelatedCount: number;
    rejectedTooFamiliarCount: number;
    userDominantMode: string;
    effectiveRelevanceWeight: number;
    effectiveNoveltyWeight: number;
    averageRelevanceScore: number;
    averageNoveltyScore: number;
  };
  summaryNarrative: string;
}

export class OutsideComfortZoneRecommendationService {
  /**
   * Pure ranking function: Takes candidate songs and re-ranks them specifically for discovery
   * slightly outside the user's comfort zone, ensuring candidate relevance is preserved
   * while filtering out songs that are either too familiar or completely unrelated.
   */
  static rankOutsideComfortZone(
    inputs: OutsideComfortZoneRankingInputs
  ): OutsideComfortZoneResult {
    const config: OutsideComfortZoneConfig = {
      ...getOutsideComfortZoneConfig(),
      ...inputs.configOverride,
    };

    const userIdStr = inputs.userId ? inputs.userId.toString() : '';
    const candidates = inputs.candidates || [];
    const limit = inputs.limit ?? 10;

    // 1. Resolve Taste Boundaries if not provided
    const boundaries: TasteBoundaryProfile =
      inputs.tasteBoundaries ||
      TasteBoundaryDetectionService.detectTasteBoundaries({
        userId: userIdStr,
        musicDna: inputs.musicDna,
        personalMusicTwin: inputs.personalMusicTwin,
      });

    // 2. Resolve Comfort vs Discovery Scores if not provided
    const cdScore: ComfortDiscoveryScoreResult =
      inputs.comfortDiscoveryScore ||
      ComfortDiscoveryScoringService.calculateScores({
        userId: userIdStr,
        musicDna: inputs.musicDna,
        personalMusicTwin: inputs.personalMusicTwin,
      });

    // 3. User Balance Weights Modulation
    let effectiveRelevanceWeight = config.defaultRelevanceWeight;
    let effectiveNoveltyWeight = config.defaultNoveltyWeight;

    if (cdScore.dominantMode === 'COMFORT' || cdScore.comfortScore > cdScore.discoveryScore) {
      // Comfort-leaning user: keep relevance anchor tighter
      effectiveRelevanceWeight = Math.min(0.85, effectiveRelevanceWeight + config.comfortLeaningRelevanceBoost);
      effectiveNoveltyWeight = Math.max(0.15, effectiveNoveltyWeight - config.comfortLeaningRelevanceBoost);
    } else if (cdScore.dominantMode === 'DISCOVERY' || cdScore.discoveryScore > cdScore.comfortScore) {
      // Discovery-leaning user: allow wider frontier expansion
      effectiveNoveltyWeight = Math.min(0.70, effectiveNoveltyWeight + config.exploratoryNoveltyBoost);
      effectiveRelevanceWeight = Math.max(0.30, effectiveRelevanceWeight - config.exploratoryNoveltyBoost);
    }

    // Normalize weights to sum to 1.0
    const sumW = effectiveRelevanceWeight + effectiveNoveltyWeight;
    effectiveRelevanceWeight = Number((effectiveRelevanceWeight / sumW).toFixed(4));
    effectiveNoveltyWeight = Number((effectiveNoveltyWeight / sumW).toFixed(4));

    // Fast lookup sets
    const stronglyPreferred = boundaries.stronglyPreferredAreas || [];
    const coreGenreSet = new Set(
      stronglyPreferred
        .filter((i) => i.type === 'genre')
        .map((g) => g.name.toLowerCase().trim())
    );

    const coreArtistSet = new Set(
      stronglyPreferred
        .filter((i) => i.type === 'artist')
        .map((a) => a.name.toLowerCase().trim())
    );

    const adjacentGenreMap = new Map<string, TasteBoundaryItem>();
    for (const g of (boundaries.adjacentGenres || [])) {
      const gName = (g.name || (g as any).adjacentGenre || '').toLowerCase().trim();
      if (gName) adjacentGenreMap.set(gName, g);
    }

    const adjacentArtistMap = new Map<string, TasteBoundaryItem>();
    for (const a of (boundaries.adjacentArtists || [])) {
      const aName = (a.name || (a as any).adjacentArtist || (a as any).artist || '').toLowerCase().trim();
      if (aName) adjacentArtistMap.set(aName, a);
    }

    const underexploredGenreMap = new Map<string, TasteBoundaryItem>();
    for (const g of (boundaries.familiarUnderexploredAreas || []).filter((i) => i.type === 'genre')) {
      const gName = (g.name || '').toLowerCase().trim();
      if (gName) underexploredGenreMap.set(gName, g);
    }

    const potentialFrontierMap = new Map<string, TasteBoundaryItem>();
    for (const g of (boundaries.potentiallyInterestingAreas || [])) {
      const gName = (g.name || '').toLowerCase().trim();
      if (gName) potentialFrontierMap.set(gName, g);
    }

    // Dominant moods
    const preferredMoodSet = new Set<string>();
    const twinMoods = inputs.personalMusicTwin?.moodIdentity?.dominantMoods || [];
    for (const m of twinMoods) {
      if (typeof m === 'string') {
        preferredMoodSet.add(m.toLowerCase().trim());
      } else if (m?.mood) {
        preferredMoodSet.add(m.mood.toLowerCase().trim());
      }
    }
    const dnaMoods = inputs.musicDna?.moodProfile?.preferredMoods || inputs.musicDna?.moods || [];
    for (const m of dnaMoods) {
      const name = (typeof m === 'string' ? m : m.name || m.mood || '').toLowerCase().trim();
      if (name) preferredMoodSet.add(name);
    }

    // Target acoustic features
    const targetEnergy =
      inputs.personalMusicTwin?.dominantMusicalTraits?.energyPreference ??
      inputs.musicDna?.listeningPatterns?.audioFeaturePreferences?.energy ??
      0.60;

    let rejectedUnrelatedCount = 0;
    let rejectedTooFamiliarCount = 0;
    const scoredCandidates: OutsideComfortZoneRankedResult[] = [];

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

      const playCount =
        typeof candAny.userPlayCount === 'number'
          ? candAny.userPlayCount
          : inputs.userEncounteredSongIds instanceof Map
          ? inputs.userEncounteredSongIds.get(songId) || 0
          : inputs.userEncounteredSongIds instanceof Set
          ? inputs.userEncounteredSongIds.has(songId) ? 3 : 0
          : typeof songDoc.userPlayCount === 'number'
          ? songDoc.userPlayCount
          : 0;

      // -----------------------------------------------------------------------
      // A. Relevance Scoring (Must remain connected to user taste)
      // -----------------------------------------------------------------------
      let genreRelevance = 0.05;
      let anchorGenre: string | undefined = undefined;

      const isAdjacentGenre = adjacentGenreMap.has(songGenre);
      const isUnderexploredGenre = underexploredGenreMap.has(songGenre);
      const isPotentialFrontier = potentialFrontierMap.has(songGenre);
      const isCoreGenre = coreGenreSet.has(songGenre);

      if (isAdjacentGenre) {
        genreRelevance = 0.90;
        anchorGenre = adjacentGenreMap.get(songGenre)?.anchor;
      } else if (isUnderexploredGenre) {
        genreRelevance = 0.85;
        anchorGenre = underexploredGenreMap.get(songGenre)?.anchor;
      } else if (isPotentialFrontier) {
        genreRelevance = 0.80;
        anchorGenre = potentialFrontierMap.get(songGenre)?.anchor;
      } else if (isCoreGenre) {
        // Core genre is relevant, but offers low novelty
        genreRelevance = 0.70;
        anchorGenre = songGenre;
      }

      // Mood Harmony
      const isFamiliarMood = preferredMoodSet.has(songMood);
      const moodRelevance = isFamiliarMood ? 0.90 : 0.15;

      // Acoustic Harmony
      let acousticRelevance = 0.35;
      if (typeof songDoc.energy === 'number') {
        const delta = Math.abs(songDoc.energy - targetEnergy);
        acousticRelevance = Math.max(0.10, 1.0 - delta * 1.5);
      }

      const relevanceScore = Number(
        (
          config.adjacentGenreWeight * genreRelevance +
          config.moodHarmonyWeight * moodRelevance +
          config.acousticHarmonyWeight * acousticRelevance
        ).toFixed(4)
      );

      // Rejection check: Filter out completely unrelated songs
      if (relevanceScore < config.minRelevanceFloor && !isAdjacentGenre && !isCoreGenre) {
        rejectedUnrelatedCount++;
        continue;
      }

      // -----------------------------------------------------------------------
      // B. Novelty Scoring (Must be outside the comfort zone)
      // -----------------------------------------------------------------------
      const isCoreArtist = coreArtistSet.has(songArtist);
      const isRelatedArtist = adjacentArtistMap.has(songArtist);

      // Penalty if song is already frequently heard by the user
      let playFamiliarityPenalty = 0.0;
      if (playCount > config.maxFamiliarPlaysThreshold) {
        playFamiliarityPenalty = Math.min(0.60, 0.15 * (playCount - config.maxFamiliarPlaysThreshold));
      }

      let rawNovelty = 0.50;
      if (isAdjacentGenre) {
        rawNovelty = 0.88; // Perfect outside-comfort-zone spot
      } else if (isPotentialFrontier) {
        rawNovelty = 0.95; // Emerging boundary
      } else if (isUnderexploredGenre) {
        rawNovelty = 0.75; // Familiar genre, fresh track
      } else if (isCoreGenre && !isCoreArtist) {
        rawNovelty = 0.65; // Familiar genre, novel artist
      } else if (isCoreGenre && isCoreArtist) {
        rawNovelty = 0.20; // 100% inside comfort zone - too familiar!
      }

      if (isRelatedArtist) {
        rawNovelty = Math.min(1.0, rawNovelty + 0.10);
      }

      const noveltyScore = Number(
        Math.max(0.05, Math.min(1.0, rawNovelty - playFamiliarityPenalty)).toFixed(4)
      );

      // If a song is completely inside the comfort zone (overplayed core track), deprioritize
      if (noveltyScore <= 0.25 && candidates.length > limit) {
        rejectedTooFamiliarCount++;
        continue;
      }

      // -----------------------------------------------------------------------
      // C. Weighted Composite Outside-Comfort-Zone Score
      // -----------------------------------------------------------------------
      const compositeScore = Number(
        (
          effectiveRelevanceWeight * relevanceScore +
          effectiveNoveltyWeight * noveltyScore
        ).toFixed(4)
      );

      // Determine category and explanation
      let discoveryCategory: OutsideZoneCategory = 'ADJACENT_GENRE';
      let explanation = '';

      if (isAdjacentGenre) {
        discoveryCategory = 'ADJACENT_GENRE';
        explanation = `Adjacent to your core ${anchorGenre || 'preferences'}: expands into ${songDoc.genre?.name || songGenre} while retaining familiar tempo and mood.`;
      } else if (isRelatedArtist) {
        discoveryCategory = 'RELATED_ARTIST';
        explanation = `Related creator: ${songDoc.artist?.name || songArtist} shares stylistic DNA with your favorite artists.`;
      } else if (isPotentialFrontier) {
        discoveryCategory = 'EMERGING_FRONTIER';
        explanation = `Emerging frontier: matches your surging interest in ${songDoc.genre?.name || songGenre}.`;
      } else if (isFamiliarMood && !isCoreGenre) {
        discoveryCategory = 'FAMILIAR_MOOD_FRESH_SOUND';
        explanation = `Familiar ${songDoc.primaryMood || songMood} mood layered over fresh genre textures.`;
      } else {
        discoveryCategory = 'CROSS_GENRE_HYBRID';
        explanation = `Explores new territory while harmonizing with your acoustic energy profile.`;
      }

      const diagnostics: OutsideComfortZoneItemDiagnostics = {
        relevanceScore,
        noveltyScore,
        compositeScore,
        discoveryCategory,
        isAdjacentGenre,
        isRelatedArtist,
        isFamiliarMood,
        anchorGenre,
        explanation,
      };

      scoredCandidates.push({
        song: songDoc,
        hybridScore: compositeScore,
        componentScores: {
          contentScore: relevanceScore,
          collaborativeScore: noveltyScore,
          userTasteAffinityScore: relevanceScore,
          popularityScore: (songDoc.playCount ? Math.min(1.0, songDoc.playCount / 1000) : 0.5),
          recencyScore: 0.5,
          noveltyScore: noveltyScore,
          personalMusicTwinScore: compositeScore,
        },
        sources: cand.sources || ['outside_comfort_zone'],
        outsideComfortZoneDiagnostics: diagnostics,
      });
    }

    // 4. Sort by Outside-Comfort-Zone composite score descending
    scoredCandidates.sort((a, b) => b.hybridScore - a.hybridScore);

    // 5. Diversity Re-ranking across top candidates (prevent single adjacent genre monopolization)
    const finalRecommendations: OutsideComfortZoneRankedResult[] = [];
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

    // If diversity filter left open slots, backfill from remaining scored items
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

    const avgRel =
      finalRecommendations.length > 0
        ? Number(
            (
              finalRecommendations.reduce((acc, r) => acc + r.outsideComfortZoneDiagnostics.relevanceScore, 0) /
              finalRecommendations.length
            ).toFixed(4)
          )
        : 0;

    const avgNov =
      finalRecommendations.length > 0
        ? Number(
            (
              finalRecommendations.reduce((acc, r) => acc + r.outsideComfortZoneDiagnostics.noveltyScore, 0) /
              finalRecommendations.length
            ).toFixed(4)
          )
        : 0;

    const summaryNarrative =
      `Outside-Comfort-Zone mode active for ${userIdStr}: generated ${finalRecommendations.length} recommendations ` +
      `balancing ${Math.round(effectiveRelevanceWeight * 100)}% musical relevance against ${Math.round(effectiveNoveltyWeight * 100)}% novelty.`;

    return {
      userId: userIdStr,
      strategyUsed: 'OUTSIDE_COMFORT_ZONE',
      recommendations: finalRecommendations,
      diagnostics: {
        totalCandidatesEvaluated: candidates.length,
        qualifiedCount: scoredCandidates.length,
        rejectedUnrelatedCount,
        rejectedTooFamiliarCount,
        userDominantMode: cdScore.dominantMode,
        effectiveRelevanceWeight,
        effectiveNoveltyWeight,
        averageRelevanceScore: avgRel,
        averageNoveltyScore: avgNov,
      },
      summaryNarrative,
    };
  }

  /**
   * End-to-end asynchronous helper: Fetches user profiles and generates outside-comfort-zone recommendations.
   */
  static async getOutsideComfortZoneRecommendations(params: {
    userId: string;
    candidates?: HybridCandidate[];
    limit?: number;
    configOverride?: Partial<OutsideComfortZoneConfig>;
  }): Promise<OutsideComfortZoneResult> {
    const userIdStr = params.userId.toString();

    // Fetch upstream intelligence concurrently
    const [boundaries, cdScore, dna, twin] = await Promise.all([
      TasteBoundaryDetectionService.getUserTasteBoundaries(userIdStr).catch(() => null),
      ComfortDiscoveryScoringService.getUserComfortDiscoveryScores(userIdStr).catch(() => null),
      undefined,
      undefined,
    ]);

    return this.rankOutsideComfortZone({
      userId: userIdStr,
      candidates: params.candidates || [],
      limit: params.limit,
      tasteBoundaries: boundaries,
      comfortDiscoveryScore: cdScore,
      musicDna: dna,
      personalMusicTwin: twin,
      configOverride: params.configOverride,
    });
  }
}

export default OutsideComfortZoneRecommendationService;
