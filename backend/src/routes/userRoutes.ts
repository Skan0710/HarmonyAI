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
import { getTemporalTasteProfile } from '../controllers/temporalTasteProfileController.js';
import { getMusicDNAProfile, refreshMusicDNAProfile } from '../controllers/musicDnaController.js';
import {
  getEvolutionOverview,
  getEvolutionTimeline,
  getTasteStability,
  getTasteChanges,
  getEmergingTastes,
  getSnapshots,
  createSnapshot,
} from '../controllers/musicDnaEvolutionController.js';
import {
  getPersonalMusicTwin,
  refreshPersonalMusicTwin,
} from '../controllers/personalMusicTwinController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = Router();

// Protected user profile routes
router.get('/me', protect, getCurrentUser);
router.put('/me', protect, updateCurrentUser);

// Music DNA routes
router.get('/me/music-dna', protect, getMusicDNAProfile);
router.get('/music-dna', protect, getMusicDNAProfile);
router.post('/me/music-dna/refresh', protect, refreshMusicDNAProfile);
router.post('/music-dna/refresh', protect, refreshMusicDNAProfile);

// Personal Music Twin routes
router.get('/me/personal-music-twin', protect, getPersonalMusicTwin);
router.get('/personal-music-twin', protect, getPersonalMusicTwin);
router.post('/me/personal-music-twin/refresh', protect, refreshPersonalMusicTwin);
router.post('/personal-music-twin/refresh', protect, refreshPersonalMusicTwin);

// Music DNA Evolution routes
router.get('/me/music-dna/evolution', protect, getEvolutionOverview);
router.get('/music-dna/evolution', protect, getEvolutionOverview);
router.get('/me/music-dna/evolution/timeline', protect, getEvolutionTimeline);
router.get('/music-dna/evolution/timeline', protect, getEvolutionTimeline);
router.get('/me/music-dna/evolution/stability', protect, getTasteStability);
router.get('/music-dna/evolution/stability', protect, getTasteStability);
router.get('/me/music-dna/evolution/changes', protect, getTasteChanges);
router.get('/music-dna/evolution/changes', protect, getTasteChanges);
router.get('/me/music-dna/evolution/emerging', protect, getEmergingTastes);
router.get('/music-dna/evolution/emerging', protect, getEmergingTastes);
router.get('/me/music-dna/snapshots', protect, getSnapshots);
router.get('/music-dna/snapshots', protect, getSnapshots);
router.post('/me/music-dna/snapshots', protect, createSnapshot);
router.post('/music-dna/snapshots', protect, createSnapshot);

// Temporal Taste Profile routes
router.get('/me/temporal-taste-profile', protect, getTemporalTasteProfile);
router.get('/temporal-taste-profile', protect, getTemporalTasteProfile);

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
