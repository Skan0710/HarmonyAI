import { Router } from 'express';
import { evaluateRecommendationStrategy } from '../controllers/recommendationEvaluationController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = Router();

// GET /api/admin/recommendations/evaluate?strategy=hybrid&k=10&userId=... (Protected Development/Admin)
router.get('/evaluate', protect, evaluateRecommendationStrategy);

export default router;
