import { Router } from 'express';
import { getTrendingSongs } from '../controllers/trendingController.js';
import { getNewReleases } from '../controllers/newReleasesController.js';
import { getPersonalizedFeed } from '../controllers/personalizedFeedController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = Router();

// Public music discovery routes
router.get('/trending', getTrendingSongs);
router.get('/new-releases', getNewReleases);

// Protected personalized feed route
router.get('/personalized-feed', protect, getPersonalizedFeed);

export default router;
