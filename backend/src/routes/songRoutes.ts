import { Router } from 'express';
import {
  createSong,
  getSongs,
  getSongById,
  updateSong,
  deleteSong,
  recordPlay,
  getRecommendations,
} from '../controllers/songController.js';
import { getTrendingSongs } from '../controllers/trendingController.js';
import { protect, optionalAuth, requireAdmin } from '../middlewares/authMiddleware.js';

const router = Router();

// Public routes
router.get('/', getSongs);
router.get('/trending', getTrendingSongs);
router.get('/recommendations', getRecommendations);
router.get('/:id', getSongById);
router.post('/:id/play', optionalAuth, recordPlay);

// Admin-only routes
router.post('/', protect, requireAdmin, createSong);
router.put('/:id', protect, requireAdmin, updateSong);
router.delete('/:id', protect, requireAdmin, deleteSong);

export default router;
