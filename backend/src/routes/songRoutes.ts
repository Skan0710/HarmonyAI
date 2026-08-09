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
import { protect } from '../middlewares/authMiddleware.js';

const router = Router();

// Public routes
router.get('/', getSongs);
router.get('/trending', getTrendingSongs);
router.get('/recommendations', getRecommendations);
router.get('/:id', getSongById);
router.post('/:id/play', recordPlay);

// Protected routes
router.post('/', protect, createSong);
router.put('/:id', protect, updateSong);
router.delete('/:id', protect, deleteSong);

export default router;
