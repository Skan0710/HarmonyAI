import { Router } from 'express';
import {
  createArtist,
  getArtists,
  getArtistById,
  updateArtist,
  deleteArtist,
  getSimilarArtists,
} from '../controllers/artistController.js';
import { protect, requireAdmin } from '../middlewares/authMiddleware.js';

const router = Router();

// Public routes
router.get('/', getArtists);
router.get('/:id', getArtistById);
router.get('/:id/similar', getSimilarArtists);

// Admin-only routes
router.post('/', protect, requireAdmin, createArtist);
router.put('/:id', protect, requireAdmin, updateArtist);
router.delete('/:id', protect, requireAdmin, deleteArtist);

export default router;
