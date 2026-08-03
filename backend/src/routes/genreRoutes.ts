import { Router } from 'express';
import {
  createGenre,
  getGenres,
  getGenreById,
  updateGenre,
  deleteGenre,
} from '../controllers/genreController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = Router();

// Public routes
router.get('/', getGenres);
router.get('/:id', getGenreById);

// Protected routes (Admin / Authorized Users)
router.post('/', protect, createGenre);
router.put('/:id', protect, updateGenre);
router.delete('/:id', protect, deleteGenre);

export default router;
