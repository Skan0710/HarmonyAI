import { Router } from 'express';
import {
  getSimilarSongs,
  getCollaborativeRecommendations,
} from '../controllers/recommendationController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = Router();

// GET /api/recommendations/collaborative?limit=10 (Protected JWT)
router.get('/collaborative', protect, getCollaborativeRecommendations);

// GET /api/recommendations/similar/:songId?limit=10
router.get('/similar/:songId', getSimilarSongs);

export default router;
