import { Router } from 'express';
import { getHealthStatus } from '../controllers/healthController.js';

const router = Router();

router.get('/health', getHealthStatus);

export default router;
