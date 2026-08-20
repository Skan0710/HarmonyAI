import { ICandidateGenerationStage, PipelineItem, RecommendationPipelineContext } from '../recommendationPipelineTypes.js';
import { CandidateGenerationService } from '../../services/candidateGenerationService.js';
import { ColdStartRecommendationService } from '../../services/coldStartRecommendationService.js';

export class CandidateGenerationStage implements ICandidateGenerationStage {
  /**
   * Generates candidates using hybrid candidate retrieval or cold start fallback.
   */
  async generateCandidates(context: RecommendationPipelineContext): Promise<PipelineItem[]> {
    const { userId, seedSongId, limit = 10 } = context;

    try {
      const hybridCandidates = await CandidateGenerationService.generateHybridCandidates({
        userId,
        seedSongId,
        candidateLimit: Math.max(50, limit * 4),
      });

      if (hybridCandidates && hybridCandidates.length > 0) {
        return hybridCandidates.map((c) => ({
          songId: c.songId,
          song: c.songDoc,
          sources: c.sources || [],
          rawFeatures: {
            contentScore: c.contentScore || 0,
            collaborativeScore: c.collaborativeScore || 0,
            userTasteAffinityScore: c.userTasteAffinityScore || 0,
            popularitySignal: c.popularitySignal || 0,
            recencySignal: c.recencySignal || 0,
          },
          normalizedScores: {},
          finalScore: 0,
        }));
      }
    } catch (e) {
      // Fallback below
    }

    // Fallback to cold start / popular candidates
    const coldStartRes = await ColdStartRecommendationService.getColdStartRecommendations({
      userId,
      limit: Math.max(20, limit * 2),
    });

    return coldStartRes.songs.map((songDoc) => ({
      songId: songDoc._id.toString(),
      song: songDoc,
      sources: coldStartRes.candidateSources || ['cold_start'],
      rawFeatures: {
        contentScore: 0,
        collaborativeScore: 0,
        userTasteAffinityScore: 0.5,
        popularitySignal: songDoc.playCount || 0,
        recencySignal: 0.8,
      },
      normalizedScores: {},
      finalScore: 0,
    }));
  }
}
