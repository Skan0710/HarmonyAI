import { Router } from 'express';
import { getTrendingSongs } from '../controllers/trendingController.js';

const router = Router();

// GET /api/music/trending
router.get('/trending', getTrendingSongs);

export default router;
