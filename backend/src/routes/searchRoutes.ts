import { Router } from 'express';
import { globalSearch } from '../controllers/searchController.js';

const router = Router();

// GET /api/search?q=query&limit=10
router.get('/', globalSearch);

export default router;
