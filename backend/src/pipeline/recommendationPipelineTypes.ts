import { ISong } from '../models/Song.js';
import { ContextPreference } from '../schemas/contextPreferenceSchema.js';
import { IListeningSession } from '../models/ListeningSession.js';

export interface PipelineItem {
  songId: string;
  song: ISong | any;
  sources: string[];
  rawFeatures: Record<string, number>;
  normalizedScores: Record<string, number>;
  finalScore: number;
  metadata?: Record<string, any>;
}

export interface RecommendationPipelineContext {
  userId: string;
  seedSongId?: string;
  limit?: number;
  contextPreference?: ContextPreference;
  sessionDoc?: IListeningSession;
  excludedSongIds?: Set<string>;
  customWeights?: Record<string, any>;
  lastPlayedArtistId?: string;
  isDebugMode?: boolean;
  userClassification?: string;
  strategyUsed?: string;
  diagnostics?: Record<string, any>;
}

export interface ICandidateGenerationStage {
  generateCandidates(context: RecommendationPipelineContext): Promise<PipelineItem[]>;
}

export interface IFeatureScoringStage {
  scoreFeatures(items: PipelineItem[], context: RecommendationPipelineContext): Promise<PipelineItem[]>;
}

export interface IRankingStage {
  rank(items: PipelineItem[], context: RecommendationPipelineContext): Promise<PipelineItem[]>;
}

export interface IDiversityFilteringStage {
  filterDiversity(items: PipelineItem[], context: RecommendationPipelineContext): Promise<PipelineItem[]>;
}

export interface IPostRankingStage {
  processPostRanking(items: PipelineItem[], context: RecommendationPipelineContext): Promise<PipelineItem[]>;
}

export interface PipelineExecutionResult {
  strategyUsed: string;
  userClassification?: string;
  count: number;
  items: PipelineItem[];
  diagnostics?: Record<string, any>;
}
