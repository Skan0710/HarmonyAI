import { Router } from 'express';
import {
  getSimilarSongs,
  getCollaborativeRecommendations,
  getHybridRecommendations,
  getContextualRecommendations,
  processContextualAssistantRequest,
  getSessionRecommendations,
  getSmartAutoplayCandidates,
  getRecommendationExplanation,
  getContextAwareRecommendations,
} from '../controllers/recommendationController.js';
import {
  trackInteraction,
  trackBulkImpressions,
  submitFeedback,
  getUserFeedback,
  processFeedbackLoop,
} from '../controllers/recommendationInteractionController.js';
import { getTemporalTasteProfile } from '../controllers/temporalTasteProfileController.js';
import {
  getRecommendationPerformance,
  getSignalPerformance,
  getEngagementMetrics,
} from '../controllers/recommendationPerformanceController.js';
import { protect, optionalAuth } from '../middlewares/authMiddleware.js';

const router = Router();

// GET /api/recommendations/performance (Protected JWT - Quality & Performance Tracking)
router.get('/performance', protect, getRecommendationPerformance);
router.get('/performance/signals', protect, getSignalPerformance);
router.get('/performance/engagement', protect, getEngagementMetrics);

// GET /api/recommendations/temporal-taste-profile (Protected JWT - Multi-Horizon Temporal Taste Profile)
router.get('/temporal-taste-profile', protect, getTemporalTasteProfile);
router.get('/temporal-profile', protect, getTemporalTasteProfile);

// GET & POST /api/recommendations/context (Protected JWT - Context-Aware Recommendations)
router.get('/context', protect, getContextAwareRecommendations);
router.post('/context', protect, getContextAwareRecommendations);
router.get('/context-aware', protect, getContextAwareRecommendations);

// GET /api/recommendations/explain/:songId (Protected JWT - Recommendation Explanations)
router.get('/explain/:songId', protect, getRecommendationExplanation);
router.get('/explanation/:songId', protect, getRecommendationExplanation);
router.get('/:songId/explanation', protect, getRecommendationExplanation);

// GET & POST /api/recommendations/autoplay (Protected JWT - Smart Autoplay & Adaptive Queue)
router.get('/autoplay', protect, getSmartAutoplayCandidates);
router.post('/autoplay', protect, getSmartAutoplayCandidates);
router.get('/smart-autoplay', protect, getSmartAutoplayCandidates);
router.post('/smart-autoplay', protect, getSmartAutoplayCandidates);

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

// POST /api/recommendations/feedback (Protected JWT - feedback on recommendations/explanations)
router.post('/feedback', protect, submitFeedback);
router.post('/explanation/feedback', protect, submitFeedback);
router.post('/feedback/loop', protect, processFeedbackLoop);
router.post('/evaluate', protect, processFeedbackLoop);

// POST /api/recommendations/interactions (Protected JWT)
router.post('/interactions', protect, trackInteraction);

// POST /api/recommendations/interactions/bulk-impressions (Protected JWT)
router.post('/interactions/bulk-impressions', protect, trackBulkImpressions);

export default router;
