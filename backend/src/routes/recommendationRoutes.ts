import { Router } from 'express';
import {
  getSimilarSongs,
  getCollaborativeRecommendations,
  getHybridRecommendations,
} from '../controllers/recommendationController.js';
import {
  trackInteraction,
  trackBulkImpressions,
} from '../controllers/recommendationInteractionController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = Router();

// GET /api/recommendations/hybrid?limit=10&seedSongId=... (Protected JWT)
router.get('/hybrid', protect, getHybridRecommendations);

// GET /api/recommendations/collaborative?limit=10 (Protected JWT)
router.get('/collaborative', protect, getCollaborativeRecommendations);

// GET /api/recommendations/similar/:songId?limit=10
router.get('/similar/:songId', getSimilarSongs);

// POST /api/recommendations/interactions (Protected JWT)
router.post('/interactions', protect, trackInteraction);

// POST /api/recommendations/interactions/bulk-impressions (Protected JWT)
router.post('/interactions/bulk-impressions', protect, trackBulkImpressions);

export default router;
