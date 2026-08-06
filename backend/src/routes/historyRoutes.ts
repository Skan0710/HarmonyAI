import { Router } from 'express';
import {
  recordPlayback,
  getListeningHistory,
  getRecentlyPlayed,
} from '../controllers/historyController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = Router();

// Protected Listening History Routes
router.post('/record/:songId', protect, recordPlayback);
router.get('/', protect, getListeningHistory);
router.get('/recently-played', protect, getRecentlyPlayed);

export default router;
