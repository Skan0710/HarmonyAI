import { Router } from 'express';
import {
  createAlbum,
  getAlbums,
  getAlbumById,
  updateAlbum,
  deleteAlbum,
} from '../controllers/albumController.js';
import { protect, requireAdmin } from '../middlewares/authMiddleware.js';

const router = Router();

// Public routes
router.get('/', getAlbums);
router.get('/:id', getAlbumById);

// Admin-only routes
router.post('/', protect, requireAdmin, createAlbum);
router.put('/:id', protect, requireAdmin, updateAlbum);
router.delete('/:id', protect, requireAdmin, deleteAlbum);

export default router;
