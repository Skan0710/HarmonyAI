import { Router } from 'express';
import {
  createAlbum,
  getAlbums,
  getAlbumById,
  updateAlbum,
  deleteAlbum,
} from '../controllers/albumController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = Router();

// Public routes
router.get('/', getAlbums);
router.get('/:id', getAlbumById);

// Protected routes
router.post('/', protect, createAlbum);
router.put('/:id', protect, updateAlbum);
router.delete('/:id', protect, deleteAlbum);

export default router;
