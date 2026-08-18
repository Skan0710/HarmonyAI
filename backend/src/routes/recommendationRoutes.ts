import { Router } from 'express';
import {
  getSimilarSongs,
  getCollaborativeRecommendations,
  getHybridRecommendations,
  getContextualRecommendations,
  processContextualAssistantRequest,
  getSessionRecommendations,
} from '../controllers/recommendationController.js';
import {
  trackInteraction,
  trackBulkImpressions,
  submitFeedback,
  getUserFeedback,
} from '../controllers/recommendationInteractionController.js';
import { protect, optionalAuth } from '../middlewares/authMiddleware.js';

const router = Router();

// GET /api/recommendations/session?limit=10 (Protected JWT)
router.get('/session', protect, getSessionRecommendations);

// POST /api/recommendations/assistant (Optional Auth - Natural-Language Context Assistant)
router.post('/assistant', optionalAuth, processContextualAssistantRequest);

// GET /api/recommendations/contextual?mood=...&activity=...&energy=...&duration=... (Optional Auth)
router.get('/contextual', optionalAuth, getContextualRecommendations);

// GET /api/recommendations/hybrid?limit=10&seedSongId=... (Protected JWT)
router.get('/hybrid', protect, getHybridRecommendations);

// GET /api/recommendations/collaborative?limit=10 (Protected JWT)
router.get('/collaborative', protect, getCollaborativeRecommendations);

// GET /api/recommendations/similar/:songId?limit=10
router.get('/similar/:songId', getSimilarSongs);

// GET /api/recommendations/feedback?limit=50 (Protected JWT)
router.get('/feedback', protect, getUserFeedback);

// POST /api/recommendations/feedback (Protected JWT - thumbs_up / thumbs_down)
router.post('/feedback', protect, submitFeedback);

// POST /api/recommendations/interactions (Protected JWT)
router.post('/interactions', protect, trackInteraction);

// POST /api/recommendations/interactions/bulk-impressions (Protected JWT)
router.post('/interactions/bulk-impressions', protect, trackBulkImpressions);

export default router;
