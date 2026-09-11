import { Router } from 'express';
import {
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  updatePlaylist,
  deletePlaylist,
  addSongToPlaylist,
  removeSongFromPlaylist,
  generateAIPlaylistEndpoint,
} from '../controllers/playlistController.js';
import { protect, optionalAuth } from '../middlewares/authMiddleware.js';
import { perUserAiLimiter } from '../middlewares/aiRateLimiter.js';

const router = Router();

// AI Playlist Generation Endpoints (Authenticated, In-memory generation pipeline)
// Calls Gemini per request — generous ceiling for real use, pointless to script past it.
const hourlyPlaylistLimiter = perUserAiLimiter(10, 60 * 60 * 1000);
const dailyPlaylistLimiter = perUserAiLimiter(30, 24 * 60 * 60 * 1000);
router.post('/ai-generate', protect, hourlyPlaylistLimiter, dailyPlaylistLimiter, generateAIPlaylistEndpoint);
router.post('/generate', protect, hourlyPlaylistLimiter, dailyPlaylistLimiter, generateAIPlaylistEndpoint);

// Protected & Public Playlist Routes
router.post('/', protect, createPlaylist);
router.get('/', protect, getUserPlaylists);
router.get('/:id', optionalAuth, getPlaylistById); // Allows public retrieval for public playlists and authenticated for private playlists
router.put('/:id', protect, updatePlaylist);
router.delete('/:id', protect, deletePlaylist);

// Playlist Song management
router.post('/:id/songs', protect, addSongToPlaylist);
router.delete('/:id/songs/:songId', protect, removeSongFromPlaylist);

export default router;
