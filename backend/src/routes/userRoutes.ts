import { Router } from 'express';
import {
  getCurrentUser,
  updateCurrentUser,
  getLikedSongs,
  likeSong,
  unlikeSong,
  addFavoriteArtist,
  removeFavoriteArtist,
  addFavoriteGenre,
  removeFavoriteGenre,
  getUserPreferences,
  getListeningProfile,
} from '../controllers/userController.js';
import { getPersonalizedFeed } from '../controllers/personalizedFeedController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = Router();

// Protected user profile routes
router.get('/me', protect, getCurrentUser);
router.put('/me', protect, updateCurrentUser);

// Listening Profile & Stats analytics (accessible via /me/listening-profile and /listening-profile)
router.get('/me/listening-profile', protect, getListeningProfile);
router.get('/listening-profile', protect, getListeningProfile);

// Personalized Home Feed route
router.get('/me/personalized-feed', protect, getPersonalizedFeed);

// Liked Songs routes
router.get('/liked-songs', protect, getLikedSongs);
router.post('/liked-songs/:songId', protect, likeSong);
router.delete('/liked-songs/:songId', protect, unlikeSong);

// User Preferences routes (Favorite Artists & Genres)
router.get('/preferences', protect, getUserPreferences);
router.post('/favorite-artists/:artistId', protect, addFavoriteArtist);
router.delete('/favorite-artists/:artistId', protect, removeFavoriteArtist);
router.post('/favorite-genres/:genreId', protect, addFavoriteGenre);
router.delete('/favorite-genres/:genreId', protect, removeFavoriteGenre);

export default router;
