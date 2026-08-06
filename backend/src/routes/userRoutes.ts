import { Router } from 'express';
import {
  getCurrentUser,
  updateCurrentUser,
  getLikedSongs,
  likeSong,
  unlikeSong,
} from '../controllers/userController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = Router();

// Protected user profile routes
router.get('/me', protect, getCurrentUser);
router.put('/me', protect, updateCurrentUser);

// Liked Songs routes
router.get('/liked-songs', protect, getLikedSongs);
router.post('/liked-songs/:songId', protect, likeSong);
router.delete('/liked-songs/:songId', protect, unlikeSong);

export default router;
