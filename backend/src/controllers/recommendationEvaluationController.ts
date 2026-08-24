import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Song } from '../models/Song.js';
import { User } from '../models/User.js';
import { ListeningHistory } from '../models/ListeningHistory.js';
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

  const q = extractQueryParams(req, { strategy: 'string', k: 'int', userId: 'string', seedSongId: 'string' });

  const validStrategies = ['content', 'collaborative', 'hybrid'];
  const strategy = validStrategies.includes(q.strategy) ? q.strategy : 'hybrid';
  const k = isNaN(q.k) || q.k < 1 ? 10 : q.k;

  const targetUserId =
    q.userId && isValidObjectId(q.userId)
      ? q.userId
      : user._id.toString();

  let seedSongId = q.seedSongId;

  // 1. Fetch User Liked Songs & History (Ground Truth Relevant Items)
  const userDoc = await User.findById(targetUserId).select('likedSongs').lean();
  const likedSongIds = (userDoc?.likedSongs || []).map((id) => id.toString());

  const historyDocs = await ListeningHistory.find({
    user: new Types.ObjectId(targetUserId),
    completed: true,
  })
    .select('song')
    .limit(50)
    .lean();

  const historySongIds = historyDocs.map((h) => h.song.toString());
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
  const totalCatalogCount = await Song.countDocuments({ isPublished: true });
  const topPopularSong = await Song.findOne({ isPublished: true })
    .sort({ playCount: -1 })
    .select('playCount')
    .lean();
  const maxCatalogPlayCount = topPopularSong?.playCount || 1000;

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
