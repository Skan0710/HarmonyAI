import { Router } from 'express';
import { handleAssistantChat } from '../controllers/assistantController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { assistantAiLimiter, dailyAiLimiter } from '../middlewares/sharedAiLimiters.js';

const router = Router();

// Assistant chat endpoint — calls the Gemini LLM, so it must be authenticated
// and rate-limited per user, not just per IP.
router.post('/chat', protect, assistantAiLimiter, dailyAiLimiter, handleAssistantChat);

export default router;
