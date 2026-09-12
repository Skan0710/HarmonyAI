import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { evaluateRecommendationStrategy } from '../controllers/recommendationEvaluationController.js';
import { protect, requireAdmin } from '../middlewares/authMiddleware.js';

const router = Router();

const adminLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?._id?.toString() ?? ipKeyGenerator(req.ip ?? 'unknown'),
  message: { success: false, message: 'Too many requests, please try again later.' },
});

// GET /api/admin/recommendations/evaluate?strategy=hybrid&k=10 (Admin only)
router.get('/evaluate', protect, requireAdmin, adminLimiter, evaluateRecommendationStrategy);

export default router;
