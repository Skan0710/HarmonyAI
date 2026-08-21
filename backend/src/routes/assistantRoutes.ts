import { Router } from 'express';
import { handleAssistantChat } from '../controllers/assistantController.js';
import { optionalAuth } from '../middlewares/authMiddleware.js';

const router = Router();

// Assistant chat endpoint (supports authenticated user operations and anonymous discovery)
router.post('/chat', optionalAuth, handleAssistantChat);

export default router;
