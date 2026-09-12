import { Router } from 'express';
import {
  createGenre,
  getGenres,
  getGenreById,
  updateGenre,
  deleteGenre,
} from '../controllers/genreController.js';
import { protect, requireAdmin } from '../middlewares/authMiddleware.js';

const router = Router();

// Public routes
router.get('/', getGenres);
router.get('/:id', getGenreById);

// Admin-only routes
router.post('/', protect, requireAdmin, createGenre);
router.put('/:id', protect, requireAdmin, updateGenre);
router.delete('/:id', protect, requireAdmin, deleteGenre);

export default router;
