import { Router } from 'express';
import {
  createArtist,
  getArtists,
  getArtistById,
  updateArtist,
  deleteArtist,
  getSimilarArtists,
} from '../controllers/artistController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = Router();

// Public routes
router.get('/', getArtists);
router.get('/:id', getArtistById);
router.get('/:id/similar', getSimilarArtists);

// Protected routes
router.post('/', protect, createArtist);
router.put('/:id', protect, updateArtist);
router.delete('/:id', protect, deleteArtist);

export default router;
