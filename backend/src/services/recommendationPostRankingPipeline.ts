import { Types } from 'mongoose';
import { UserTasteProfile, UserTasteProfileService } from './userTasteProfileService.js';
import { NoveltyScoringService } from './noveltyScoringService.js';
import { GenreDiversityFilteringService } from './genreDiversityFilteringService.js';
import { ArtistDiversityFilteringService } from './artistDiversityFilteringService.js';
import { RecommendationHistoryService } from './recommendationHistoryService.js';
import {
  NoveltyScoringWeights,
  GenreDiversityWeights,
  RecommendationRepetitionConfig,
  getNoveltyConfigWeights,
  getGenreDiversityWeights,
  getRepetitionConfig,
} from '../config/recommendationConfig.js';

export interface PostRankingItemDiagnostics {
  originalScore: number;
  diversityAdjustment: number;
  noveltyAdjustment: number;
  repetitionPenalty: number;
  finalScore: number;
}

export interface PostRankingPipelineDiagnostics {
  isDebugEnabled: boolean;
  totalEvaluatedCandidates: number;
  finalCandidateCount: number;
  itemsDiagnostics: {
    songId: string;
    title?: string;
    originalScore: number;
    diversityAdjustment: number;
    noveltyAdjustment: number;
    repetitionPenalty: number;
    finalScore: number;
  }[];
}

export interface PostRankedResult<T = any> {
  song: any;
  originalScore: number;
  finalScore: number;
  componentBreakdown: {
    originalScore: number;
    userPreferenceScore: number;
    noveltyScore: number;
    repetitionPenalty: number;
  };
  sources?: string[];
  metadata?: {
    isRecentlyRecommended?: boolean;
    isRecentlySkipped?: boolean;
    isReappearanceAllowed?: boolean;
    [key: string]: any;
  };
  diagnostics?: PostRankingItemDiagnostics;
  item: T;
}

export interface PostRankingPipelineExecutionResult<T = any> {
  results: PostRankedResult<T>[];
  diagnostics?: PostRankingPipelineDiagnostics;
}

export interface PostRankingPipelineOptions<T = any> {
  userId?: string;
  items: T[];
  targetLimit?: number;
  tasteProfile?: UserTasteProfile | null;
  requestedGenres?: string[];
  lastPlayedArtistId?: string;
  maxSongsPerArtist?: number;
  maxConsecutiveSameArtist?: number;
  scoreExtractor?: (item: T) => number;
  songExtractor?: (item: T) => any;
  sourcesExtractor?: (item: T) => string[];
  customNoveltyWeights?: Partial<NoveltyScoringWeights>;
  customGenreWeights?: Partial<GenreDiversityWeights>;
  customRepetitionConfig?: Partial<RecommendationRepetitionConfig>;
  autoRecordImpressions?: boolean;
  isDebugMode?: boolean;
}

export class RecommendationPostRankingPipeline {
  /**
   * Default score extractor resolving recommendation score from any upstream engine.
   */
  static extractOriginalScore(item: any): number {
    if (!item) return 0;
    if (typeof item.originalScore === 'number') return item.originalScore;
    if (typeof item.hybridScore === 'number') return item.hybridScore;
    if (typeof item.sessionScore === 'number') return item.sessionScore;
    if (typeof item.contextScore === 'number') return item.contextScore;
    if (typeof item.autoplayScore === 'number') return item.autoplayScore;
    if (typeof item.candidateScore === 'number') return item.candidateScore;
    if (typeof item.finalScore === 'number') return item.finalScore;
    if (typeof item.score === 'number') return item.score;
    return 0;
  }

  /**
   * Default song extractor resolving the core song document.
   */
  static extractSong(item: any): any {
    if (!item) return null;
    return item.song || item.songDoc || item;
  }

  /**
   * Unified Post-Ranking Pipeline combining:
   * 1. Recommendation Relevance (original score from upstream engine)
   * 2. User Preference (taste profile affinity)
   * 3. Novelty (catalog & user exposure with relevance gating)
   * 4. Repetition Control (cooldown window, skip suppression, high relevance reappearance)
   * 5. Genre Diversity Filtering (distribution balancing and taste profile scaling)
   * 6. Artist Diversity Filtering (consecutive suppression and artist caps)
   * 
   * Returns both the original recommendation score and final post-ranking score.
   * Includes development-only diagnostics tracking when isDebugMode=true (omitted in production).
   */
  static async executePostRanking<T = any>(
    options: PostRankingPipelineOptions<T>
  ): Promise<PostRankedResult<T>[]> {
    const {
      userId,
      items,
      targetLimit = items?.length || 10,
      requestedGenres = [],
      lastPlayedArtistId,
      maxSongsPerArtist = 2,
      maxConsecutiveSameArtist = 1,
      scoreExtractor = this.extractOriginalScore,
      songExtractor = this.extractSong,
      sourcesExtractor = (it: any) => it.sources || [],
      customNoveltyWeights,
      customGenreWeights,
      customRepetitionConfig,
      autoRecordImpressions = false,
      isDebugMode = false,
    } = options;

    if (!Array.isArray(items) || items.length === 0) {
      return [];
    }

    const isDebugEnabled = isDebugMode && process.env.NODE_ENV !== 'production';
    const safeLimit = Math.max(1, targetLimit);

    // 1. Fetch User Taste Profile if not explicitly provided
    let tasteProfile = options.tasteProfile;
    if (!tasteProfile && userId && Types.ObjectId.isValid(userId)) {
      try {
        tasteProfile = await UserTasteProfileService.generateTasteProfile(userId);
      } catch (err) {
        // Fallback safely if profile is unavailable
      }
    }

    // 2. Fetch User Recommendation & Skip History
    let recentlyRecommendedMap = new Map();
    let recentlySkippedSet = new Set<string>();

    if (userId && Types.ObjectId.isValid(userId)) {
      try {
        const [recMap, skipSet] = await Promise.all([
          RecommendationHistoryService.getRecentlyRecommendedMap(
            userId,
            customRepetitionConfig?.cooldownWindowHours
          ),
          RecommendationHistoryService.getRecentlySkippedSongIds(
            userId,
            customRepetitionConfig?.skippedCooldownWindowHours
          ),
        ]);
        recentlyRecommendedMap = recMap;
        recentlySkippedSet = skipSet;
      } catch (err) {
        // Continue safely without blocking
      }
    }

    // 3. Stage 1: Feature Fusion (Relevance + User Preference + Novelty)
    const noveltyConfig = { ...getNoveltyConfigWeights(), ...customNoveltyWeights };
    const tasteAffinityMap = GenreDiversityFilteringService.buildUserGenreAffinityMap(tasteProfile);

    const scoredItems = items.map((rawItem) => {
      const song = songExtractor(rawItem);
      const originalScore = Number(scoreExtractor(rawItem).toFixed(4));
      const songId = song?._id?.toString() || (rawItem as any)?.songId || '';

      // User Preference Score (Genre Affinity from Taste Profile)
      const genreName = GenreDiversityFilteringService.extractGenre({ song });
      const userPreferenceScore = Number((tasteAffinityMap.get(genreName) || 0.5).toFixed(4));

      // Novelty Calculation (Catalog + User Exposure)
      const catalogPlayCount = song?.playCount || 0;
      const userPlayCount = recentlyRecommendedMap.get(songId)?.count || 0;

      const rawNovelty = NoveltyScoringService.computeCompositeNovelty({
        catalogPlayCount,
        userPlayCount,
        weights: noveltyConfig,
      });

      const { finalScore: noveltyEnhancedScore, gatedNoveltyScore } =
        NoveltyScoringService.combineNoveltyWithBaseScore(
          originalScore,
          rawNovelty,
          noveltyConfig
        );

      const noveltyAdjustment = Number((noveltyEnhancedScore - originalScore).toFixed(4));

      return {
        item: rawItem,
        song,
        songId,
        originalScore,
        currentScore: noveltyEnhancedScore,
        noveltyAdjustment,
        userPreferenceScore,
        noveltyScore: gatedNoveltyScore,
        sources: sourcesExtractor(rawItem),
      };
    });

    // 4. Stage 2: Repetition Control (Cooldown & Skip Suppression)
    const repetitionEvaluated = RecommendationHistoryService.applyRepetitionControl({
      items: scoredItems,
      recentlyRecommended: recentlyRecommendedMap,
      recentlySkipped: recentlySkippedSet,
      targetLimit: scoredItems.length,
      scoreExtractor: (i) => i.currentScore,
      songIdExtractor: (i) => i.songId,
      config: customRepetitionConfig,
    });

    const repetitionProcessed = repetitionEvaluated.map((rep) => ({
      ...rep.item,
      currentScore: rep.adjustedScore,
      repetitionPenalty: rep.penaltyApplied,
      metadata: {
        isRecentlyRecommended: rep.isRecentlyRecommended,
        isRecentlySkipped: rep.isRecentlySkipped,
        isReappearanceAllowed: rep.isReappearanceAllowed,
      },
    }));

    // 5. Stage 3: Genre Diversity Filtering
    const genreBalanced = GenreDiversityFilteringService.applyGenreDiversity({
      items: repetitionProcessed,
      tasteProfile,
      requestedGenres,
      targetLimit: repetitionProcessed.length,
      scoreExtractor: (i) => i.currentScore,
      genreExtractor: (i) => GenreDiversityFilteringService.extractGenre({ song: i.song }),
      customWeights: customGenreWeights,
    });

    // 6. Stage 4: Artist Diversity Filtering
    const artistBalanced = ArtistDiversityFilteringService.applyArtistDiversity({
      items: genreBalanced,
      targetLimit: safeLimit,
      maxSongsPerArtist,
      maxConsecutiveSameArtist,
      scoreExtractor: (i) => i.currentScore,
      artistExtractor: (i) => ArtistDiversityFilteringService.extractArtistId({ song: i.song }),
    });

    // 7. Stage 5: Final Packaging & Diagnostics Attachment
    const finalResults: PostRankedResult<T>[] = artistBalanced.map((item) => {
      const repPenalty = item.repetitionPenalty || 0;
      const novAdj = item.noveltyAdjustment || 0;
      const expectedScore = item.originalScore + novAdj - repPenalty;
      const divAdj = Number((item.currentScore - expectedScore).toFixed(4));

      const diagnostics: PostRankingItemDiagnostics | undefined = isDebugEnabled
        ? {
            originalScore: item.originalScore,
            noveltyAdjustment: novAdj,
            diversityAdjustment: divAdj,
            repetitionPenalty: repPenalty,
            finalScore: item.currentScore,
          }
        : undefined;

      return {
        song: item.song,
        originalScore: item.originalScore,
        finalScore: item.currentScore,
        componentBreakdown: {
          originalScore: item.originalScore,
          userPreferenceScore: item.userPreferenceScore,
          noveltyScore: item.noveltyScore,
          repetitionPenalty: repPenalty,
        },
        sources: item.sources || [],
        metadata: item.metadata || {},
        ...(diagnostics ? { diagnostics } : {}),
        item: item.item,
      };
    });

    if (autoRecordImpressions && userId && Types.ObjectId.isValid(userId)) {
      const songIds = finalResults.map((r) => r.song?._id?.toString()).filter(Boolean);
      if (songIds.length > 0) {
        RecommendationHistoryService.recordRecommendationImpressions(
          userId,
          songIds,
          'post_ranking_pipeline'
        ).catch(() => {});
      }
    }

    return finalResults;
  }
}
