import { Router } from 'express';
import { getTrendingSongs } from '../controllers/trendingController.js';
import { getNewReleases } from '../controllers/newReleasesController.js';

const router = Router();

// Public music discovery routes
router.get('/trending', getTrendingSongs);
router.get('/new-releases', getNewReleases);

export default router;
