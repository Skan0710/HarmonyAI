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
import { protect } from '../middlewares/authMiddleware.js';

const router = Router();

// Routes
router.post('/', protect, createPlaylist);
router.get('/', protect, getUserPlaylists);
router.get('/:id', getPlaylistById); // Allows public or authenticated retrieval
router.put('/:id', protect, updatePlaylist);
router.delete('/:id', protect, deletePlaylist);

// Playlist Song management
router.post('/:id/songs', protect, addSongToPlaylist);
router.delete('/:id/songs/:songId', protect, removeSongFromPlaylist);

export default router;
