import { Request, Response } from 'express';
import { supabase } from '../config/supabase.js';
import { ContentRecommendationService } from '../services/recommendationService.js';
import { CollaborativeFilteringService } from '../services/collaborativeFilteringService.js';
import { HybridRecommendationService } from '../services/hybridRecommendationService.js';
import { RecommendationEvaluationService } from '../services/recommendationEvaluationService.js';
import {
  RecommendationDiversityService,
  DiversitySongItem,
} from '../services/recommendationDiversityService.js';
import { controllerWrapper, ensureAuth } from '../utils/controllerHelpers.js';
import { extractQueryParams, isValidObjectId } from '../utils/validators.js';

export const evaluateRecommendationStrategy = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const q = extractQueryParams(req, { strategy: 'string', k: 'int', seedSongId: 'string' });

  const validStrategies = ['content', 'collaborative', 'hybrid'];
  const strategy = validStrategies.includes(q.strategy) ? q.strategy : 'hybrid';
  const k = isNaN(q.k) || q.k < 1 ? 10 : Math.min(50, q.k);

  // Security: always use the authenticated user's ID; never accept userId from query params
  // to prevent one user from evaluating another user's recommendations
  const targetUserId = user._id.toString();

  let seedSongId = q.seedSongId;

  // 1. Fetch User Liked Songs & History (Ground Truth Relevant Items) concurrently
  const [{ data: likedRows }, { data: historyRows }] = await Promise.all([
    supabase.from('user_liked_songs').select('song_id').eq('user_id', targetUserId),
    supabase
      .from('listening_history')
      .select('song_id')
      .eq('user_id', targetUserId)
      .eq('completed', true)
      .limit(50),
  ]);

  const likedSongIds = (likedRows || []).map((r) => r.song_id).filter(Boolean);
  const historySongIds = (historyRows || []).map((r) => r.song_id).filter(Boolean);
  const relevantSet = new Set<string>([...likedSongIds, ...historySongIds]);
  const relevantSongIds = Array.from(relevantSet);

  // If no seed song provided for content strategy, use first liked song
  if (strategy === 'content' && (!seedSongId || !isValidObjectId(seedSongId))) {
    seedSongId = relevantSongIds[0];
  }

  // 2. Fetch Recommended Songs based on Strategy
  let recommendedSongDocs: any[] = [];

  if (strategy === 'content') {
    if (seedSongId && isValidObjectId(seedSongId)) {
      recommendedSongDocs = await ContentRecommendationService.getRecommendationsForSong(
        seedSongId,
        k
      );
    }
  } else if (strategy === 'collaborative') {
    const collabRes = await CollaborativeFilteringService.getRecommendationsForUser(
      targetUserId,
      k
    );
    recommendedSongDocs = Array.isArray(collabRes) ? collabRes : [];
  } else {
    const hybridRes = await HybridRecommendationService.getHybridRecommendations({
      userId: targetUserId,
      seedSongId,
      limit: k,
    });
    recommendedSongDocs = (hybridRes?.recommendations || []).map((item) => item.song).filter(Boolean);
  }

  const recommendedSongIds = recommendedSongDocs
    .map((s) => s._id?.toString() || s.id?.toString())
    .filter(Boolean);

  // 3. Compute Precision@K, Recall@K, and F1@K Metrics
  const relevanceMetrics = RecommendationEvaluationService.evaluateRecommendationSet(
    recommendedSongIds,
    relevantSongIds,
    k
  );

  // 4. Compute Diversity, Novelty, and Catalog Coverage Metrics
  const [{ count: totalCatalogCountRaw }, { data: topPopularSong }] = await Promise.all([
    supabase.from('songs').select('*', { count: 'exact', head: true }).eq('is_published', true),
    supabase
      .from('songs')
      .select('play_count')
      .eq('is_published', true)
      .order('play_count', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const totalCatalogCount = totalCatalogCountRaw || 0;
  const maxCatalogPlayCount = topPopularSong?.play_count || 1000;

  const diversityInputItems: DiversitySongItem[] = recommendedSongDocs.map((s) => ({
    songId: s._id?.toString() || '',
    genreId: typeof s.genre === 'object' && s.genre?._id ? s.genre._id.toString() : String(s.genre || ''),
    artistId: typeof s.artist === 'object' && s.artist?._id ? s.artist._id.toString() : String(s.artist || ''),
    playCount: s.playCount || 0,
  }));

  const diversityMetrics = RecommendationDiversityService.evaluateDiversityAndNovelty(
    diversityInputItems,
    totalCatalogCount,
    maxCatalogPlayCount
  );

  // 5. Combine and Return Structured Evaluation Payload
  res.status(200).json({
    success: true,
    strategy,
    k,
    targetUserId,
    metrics: {
      precisionAtK: relevanceMetrics.precisionAtK,
      recallAtK: relevanceMetrics.recallAtK,
      f1AtK: relevanceMetrics.f1AtK,
      diversityScore: diversityMetrics.diversityScore,
      genreDiversity: diversityMetrics.genreDiversity,
      artistDiversity: diversityMetrics.artistDiversity,
      noveltyScore: diversityMetrics.noveltyScore,
      catalogCoverage: diversityMetrics.catalogCoverage,
      hitsCount: relevanceMetrics.hitsCount,
      recommendedCount: relevanceMetrics.recommendedCount,
      relevantCount: relevanceMetrics.relevantCount,
      totalCatalogCount,
    },
  });
});
