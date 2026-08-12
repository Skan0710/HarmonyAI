import { Router } from 'express';
import {
  getSimilarSongs,
  getCollaborativeRecommendations,
  getHybridRecommendations,
} from '../controllers/recommendationController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = Router();

// GET /api/recommendations/hybrid?limit=10&seedSongId=... (Protected JWT)
router.get('/hybrid', protect, getHybridRecommendations);

// GET /api/recommendations/collaborative?limit=10 (Protected JWT)
router.get('/collaborative', protect, getCollaborativeRecommendations);

// GET /api/recommendations/similar/:songId?limit=10
router.get('/similar/:songId', getSimilarSongs);

export default router;
