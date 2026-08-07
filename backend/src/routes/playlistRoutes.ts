import { Router } from 'express';
import {
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  updatePlaylist,
  deletePlaylist,
  addSongToPlaylist,
  removeSongFromPlaylist,
} from '../controllers/playlistController.js';
import { protect, optionalAuth } from '../middlewares/authMiddleware.js';

const router = Router();

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
