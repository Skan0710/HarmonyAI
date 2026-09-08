import mongoose, { Types } from 'mongoose';
import {
  PersonalizedDiscoveryMode,
  PersonalizedDiscoveryModeConfig,
  getDiscoveryModeConfig,
  getAllDiscoveryModeConfigs,
  resolvePersonalizedDiscoveryMode,
} from '../config/personalizedDiscoveryModeConfig.js';
import {
  HybridScoringWeights,
  NoveltyScoringWeights,
} from '../config/recommendationConfig.js';
import { HybridCandidate } from './candidateGenerationService.js';
import { HybridRankedResult } from './hybridRankingPipeline.js';
import {
  AdaptiveRecommendationRankingPipeline,
  AdaptivePipelineStageDiagnostics,
} from './adaptiveRecommendationRankingPipeline.js';
import { PersonalMusicTwinAttributes } from '../schemas/personalMusicTwinSchema.js';
import { ComfortDiscoveryScoreResult } from './comfortDiscoveryScoringService.js';
import { TasteBoundaryProfile } from './tasteBoundaryDetectionService.js';
import { UnifiedMusicDNA } from '../schemas/musicDnaSchema.js';
import { UnifiedLayeredTasteProfile } from './layeredTemporalTasteProfileService.js';
import { RecommendationContextAttributes } from '../schemas/recommendationContextSchema.js';
import { PersonalMusicTwinService } from './personalMusicTwinService.js';
import { ComfortDiscoveryScoringService } from './comfortDiscoveryScoringService.js';
import { TasteBoundaryDetectionService } from './tasteBoundaryDetectionService.js';
import { UnifiedMusicDNAService } from './unifiedMusicDnaService.js';

export interface TwinAlignmentDiagnostics {
  applied: boolean;
  archetype?: string;
  discoveryTendency?: number;
  familiarityTendency?: number;
  dominantComfortMode?: string;
  comfortScore?: number;
  discoveryScore?: number;
  adaptationsApplied: string[];
}

export interface PersonalizedDiscoveryModeDiagnostics {
  mode: PersonalizedDiscoveryMode;
  label: string;
  description: string;
  strategyType: 'STANDARD' | 'OUTSIDE_COMFORT_ZONE' | 'TASTE_EVOLUTION_DISCOVERY';
  effectiveHybridWeights: HybridScoringWeights;
  effectiveNoveltyWeights: NoveltyScoringWeights;
  effectiveExplorationRate: number;
  effectiveDiversityStrength: number;
  musicDnaInfluence: number;
  personalMusicTwinInfluence: number;
  twinAlignment: TwinAlignmentDiagnostics;
  pipelineDiagnostics?: AdaptivePipelineStageDiagnostics;
}

export interface PersonalizedDiscoveryModeResult {
  userId: string;
  mode: PersonalizedDiscoveryMode;
  label: string;
  description: string;
  strategyUsed: 'COLD_START' | 'HYBRID_PERSONALIZED' | 'OUTSIDE_COMFORT_ZONE' | 'TASTE_EVOLUTION_DISCOVERY';
  userClassification: 'NEW' | 'LIMITED_DATA' | 'ACTIVE' | 'WELL_ESTABLISHED';
  recommendations: HybridRankedResult[];
  diagnostics: PersonalizedDiscoveryModeDiagnostics;
}

export interface PersonalizedDiscoveryModeParams {
  userId: string | Types.ObjectId;
  mode?: PersonalizedDiscoveryMode | string | null;
  limit?: number;
  seedSongId?: string;
  candidates?: HybridCandidate[];
  context?: RecommendationContextAttributes | string | null;
  contextInfluence?: number;
  musicDna?: UnifiedMusicDNA | any | null;
  personalMusicTwin?: PersonalMusicTwinAttributes | any | null;
  comfortDiscoveryScore?: ComfortDiscoveryScoreResult | any | null;
  tasteBoundaries?: TasteBoundaryProfile | any | null;
  temporalProfile?: UnifiedLayeredTasteProfile | any | null;
  configOverride?: Partial<PersonalizedDiscoveryModeConfig>;
}

export class PersonalizedDiscoveryModeService {
  /**
   * Resolves raw mode string into canonical PersonalizedDiscoveryMode.
   */
  static resolveMode(rawMode?: string | null): PersonalizedDiscoveryMode {
    return resolvePersonalizedDiscoveryMode(rawMode);
  }

  /**
   * Returns metadata and active configurations for all available discovery modes.
   */
  static getAvailableModes(): Record<PersonalizedDiscoveryMode, PersonalizedDiscoveryModeConfig> {
    return getAllDiscoveryModeConfigs();
  }

  /**
   * Adapts mode-specific weights dynamically based on user's current Music Twin
   * and Comfort vs Discovery scoring profile.
   */
  static adaptModeParameters(
    baseConfig: PersonalizedDiscoveryModeConfig,
    twin?: PersonalMusicTwinAttributes | any | null,
    cdScore?: ComfortDiscoveryScoreResult | any | null
  ): {
    hybridWeights: HybridScoringWeights;
    noveltyWeights: NoveltyScoringWeights;
    explorationRate: number;
    diversityStrength: number;
    musicDnaInfluence: number;
    personalMusicTwinInfluence: number;
    twinAlignment: TwinAlignmentDiagnostics;
  } {
    const adaptations: string[] = [];
    let hybridWeights: HybridScoringWeights = { ...baseConfig.hybridWeights };
    let noveltyWeights: NoveltyScoringWeights = { ...baseConfig.noveltyWeights };
    let explorationRate = baseConfig.explorationRate;
    let diversityStrength = baseConfig.diversityStrength;
    let musicDnaInfluence = baseConfig.musicDnaInfluence;
    let personalMusicTwinInfluence = baseConfig.personalMusicTwinInfluence;

    const hasTwin = Boolean(twin && (twin.listenerArchetype || twin.dominantMusicalTraits));
    const hasCdScore = Boolean(cdScore && (cdScore.comfortScore !== undefined || cdScore.discoveryScore !== undefined));

    const twinArchetype = twin?.listenerArchetype;
    const twinDiscovery = twin?.explorationTendency ?? twin?.listeningBehavior?.discoveryTendency;
    const twinFamiliarity = twin?.familiarityTendency ?? twin?.listeningBehavior?.repeatListeningTendency;
    const dominantComfortMode = cdScore?.dominantMode;
    const comfortScore = cdScore?.comfortScore;
    const discoveryScore = cdScore?.discoveryScore;

    if (hasTwin || hasCdScore) {
      switch (baseConfig.mode) {
        case 'COMFORT': {
          // If the user's twin or score demonstrates high comfort preference, tighten the familiarity anchor
          const famLevel = Math.max(twinFamiliarity ?? 0.5, comfortScore ?? 0.5);
          if (famLevel > 0.6) {
            const boost = Number(((famLevel - 0.5) * 0.15).toFixed(4));
            hybridWeights.userTasteAffinityWeight = Math.min(0.50, hybridWeights.userTasteAffinityWeight + boost);
            hybridWeights.recencyWeight = Math.max(0.02, hybridWeights.recencyWeight - boost * 0.5);
            explorationRate = Math.max(0.01, explorationRate - 0.02);
            diversityStrength = Math.max(0.05, diversityStrength - 0.03);
            adaptations.push(`Reinforced comfort anchor (+${boost} taste affinity) from high familiarity (${famLevel.toFixed(2)})`);
          }
          break;
        }

        case 'DISCOVER': {
          // If the user's twin or score demonstrates high discovery drive, expand exploration parameters
          const discLevel = Math.max(twinDiscovery ?? 0.5, discoveryScore ?? 0.5);
          if (discLevel > 0.6) {
            const boost = Number(((discLevel - 0.5) * 0.20).toFixed(4));
            noveltyWeights.noveltyWeight = Math.min(0.60, noveltyWeights.noveltyWeight + boost);
            explorationRate = Math.min(0.65, explorationRate + boost);
            diversityStrength = Math.min(0.60, diversityStrength + boost * 0.5);
            adaptations.push(`Elevated discovery threshold (+${boost} exploration) from high discovery drive (${discLevel.toFixed(2)})`);
          }
          break;
        }

        case 'FOR_YOU': {
          // Smoothly calibrate between comfort and discovery based on dominant listening behavior
          if (dominantComfortMode === 'COMFORT' || (comfortScore && comfortScore > 0.65)) {
            hybridWeights.userTasteAffinityWeight = Math.min(0.35, hybridWeights.userTasteAffinityWeight + 0.05);
            explorationRate = Math.max(0.10, explorationRate - 0.05);
            adaptations.push('Subtly biased balanced mode toward comfort based on user preference');
          } else if (dominantComfortMode === 'DISCOVERY' || (discoveryScore && discoveryScore > 0.65)) {
            explorationRate = Math.min(0.35, explorationRate + 0.05);
            diversityStrength = Math.min(0.35, diversityStrength + 0.05);
            adaptations.push('Subtly biased balanced mode toward discovery based on user preference');
          }
          break;
        }

        case 'OUTSIDE_YOUR_TASTE': {
          // If twin is highly eclectic or adventurous, allow higher frontier exploration
          const openness = twin?.compatibilityDimensions?.opennessScore ?? twinDiscovery ?? 0.5;
          if (openness > 0.65) {
            explorationRate = Math.min(0.65, explorationRate + 0.08);
            diversityStrength = Math.min(0.60, diversityStrength + 0.05);
            adaptations.push(`Expanded boundary exploration for high-openness twin profile (${openness.toFixed(2)})`);
          }
          break;
        }

        case 'WHATS_NEW_FOR_YOU': {
          // Align with active chapter or taste evolution velocity
          const velocity = twin?.tasteEvolution?.velocity;
          if (velocity === 'rapid') {
            explorationRate = Math.min(0.50, explorationRate + 0.08);
            personalMusicTwinInfluence = Math.min(0.50, personalMusicTwinInfluence + 0.05);
            adaptations.push('Accelerated taste evolution momentum for rapid velocity twin profile');
          }
          break;
        }
      }
    }

    return {
      hybridWeights,
      noveltyWeights,
      explorationRate,
      diversityStrength,
      musicDnaInfluence,
      personalMusicTwinInfluence,
      twinAlignment: {
        applied: hasTwin || hasCdScore,
        archetype: twinArchetype,
        discoveryTendency: twinDiscovery,
        familiarityTendency: twinFamiliarity,
        dominantComfortMode,
        comfortScore,
        discoveryScore,
        adaptationsApplied: adaptations,
      },
    };
  }

  /**
   * Generates recommendations tailored to a specific personalized discovery mode.
   * Utilizes the existing recommendation engine and ranking infrastructure without engine duplication.
   */
  static async getRecommendationsForMode(
    params: PersonalizedDiscoveryModeParams
  ): Promise<PersonalizedDiscoveryModeResult> {
    const {
      userId,
      mode: rawMode,
      limit = 10,
      seedSongId,
      candidates,
      context,
      contextInfluence,
      musicDna,
      personalMusicTwin,
      comfortDiscoveryScore,
      tasteBoundaries,
      temporalProfile,
      configOverride,
    } = params;

    const resolvedMode = resolvePersonalizedDiscoveryMode(rawMode);
    const baseConfig = getDiscoveryModeConfig(resolvedMode);
    const mergedConfig: PersonalizedDiscoveryModeConfig = {
      ...baseConfig,
      ...configOverride,
      hybridWeights: {
        ...baseConfig.hybridWeights,
        ...(configOverride?.hybridWeights || {}),
      },
      noveltyWeights: {
        ...baseConfig.noveltyWeights,
        ...(configOverride?.noveltyWeights || {}),
      },
      outsideComfortZoneOverrides: {
        ...(baseConfig.outsideComfortZoneOverrides || {}),
        ...(configOverride?.outsideComfortZoneOverrides || {}),
      },
      tasteEvolutionOverrides: {
        ...(baseConfig.tasteEvolutionOverrides || {}),
        ...(configOverride?.tasteEvolutionOverrides || {}),
      },
    };

    const userIdStr = userId ? userId.toString() : '';

    // Asynchronously resolve upstream user intelligence if omitted and valid ObjectId is provided
    let effectiveDna = musicDna;
    let effectiveTwin = personalMusicTwin;
    let effectiveCdScore = comfortDiscoveryScore;
    let effectiveBoundaries = tasteBoundaries;

    const isDbConnected = mongoose.connection?.readyState === 1;
    if (userIdStr && Types.ObjectId.isValid(userIdStr) && !candidates && isDbConnected) {
      try {
        const [fetchedTwin, fetchedCdScore, fetchedBoundaries, fetchedDna] = await Promise.all([
          !effectiveTwin ? PersonalMusicTwinService.getOrGenerateTwin(userIdStr).catch(() => null) : Promise.resolve(effectiveTwin),
          !effectiveCdScore ? ComfortDiscoveryScoringService.getUserComfortDiscoveryScores(userIdStr).catch(() => null) : Promise.resolve(effectiveCdScore),
          !effectiveBoundaries ? TasteBoundaryDetectionService.getUserTasteBoundaries(userIdStr).catch(() => null) : Promise.resolve(effectiveBoundaries),
          !effectiveDna ? UnifiedMusicDNAService.getOrGenerateProfile(userIdStr).catch(() => null) : Promise.resolve(effectiveDna),
        ]);

        effectiveTwin = fetchedTwin;
        effectiveCdScore = fetchedCdScore;
        effectiveBoundaries = fetchedBoundaries;
        effectiveDna = fetchedDna;
      } catch {
        // Graceful non-blocking fallback
      }
    }

    // Dynamic adaptation based on user's Music Twin and Comfort/Discovery Scoring
    const adapted = this.adaptModeParameters(mergedConfig, effectiveTwin, effectiveCdScore);

    // Route directly into the existing Adaptive Recommendation Ranking Pipeline
    const pipelineRes = await AdaptiveRecommendationRankingPipeline.executePipeline({
      userId: userIdStr,
      seedSongId,
      limit,
      candidates,
      context,
      contextInfluence,
      temporalProfile,
      musicDnaProfile: effectiveDna,
      personalMusicTwin: effectiveTwin,
      tasteBoundaries: effectiveBoundaries,
      comfortDiscoveryScore: effectiveCdScore,
      customWeights: adapted.hybridWeights,
      noveltyWeights: adapted.noveltyWeights,
      useNoveltyScoring: mergedConfig.useNoveltyScoring,
      useAdaptiveExploration: mergedConfig.useAdaptiveExploration,
      explorationRate: adapted.explorationRate,
      useDiversityRanking: mergedConfig.useDiversityRanking,
      diversityStrength: adapted.diversityStrength,
      musicDnaInfluence: adapted.musicDnaInfluence,
      personalMusicTwinInfluence: adapted.personalMusicTwinInfluence,
      recommendationMode: mergedConfig.strategyType,
      outsideComfortZoneConfig: mergedConfig.outsideComfortZoneOverrides,
      tasteEvolutionDiscoveryConfig: mergedConfig.tasteEvolutionOverrides,
    });

    const diagnostics: PersonalizedDiscoveryModeDiagnostics = {
      mode: resolvedMode,
      label: mergedConfig.label,
      description: mergedConfig.description,
      strategyType: mergedConfig.strategyType,
      effectiveHybridWeights: adapted.hybridWeights,
      effectiveNoveltyWeights: adapted.noveltyWeights,
      effectiveExplorationRate: adapted.explorationRate,
      effectiveDiversityStrength: adapted.diversityStrength,
      musicDnaInfluence: adapted.musicDnaInfluence,
      personalMusicTwinInfluence: adapted.personalMusicTwinInfluence,
      twinAlignment: adapted.twinAlignment,
      pipelineDiagnostics: pipelineRes.diagnostics,
    };

    return {
      userId: userIdStr,
      mode: resolvedMode,
      label: mergedConfig.label,
      description: mergedConfig.description,
      strategyUsed: pipelineRes.strategyUsed,
      userClassification: pipelineRes.userClassification,
      recommendations: pipelineRes.recommendations,
      diagnostics,
    };
  }
}

export default PersonalizedDiscoveryModeService;
