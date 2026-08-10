import { Router } from 'express';
import { getSimilarSongs } from '../controllers/recommendationController.js';

const router = Router();

// GET /api/recommendations/similar/:songId?limit=10
router.get('/similar/:songId', getSimilarSongs);

export default router;
