import { Router } from 'express';
import { globalSearch, semanticSearch } from '../controllers/searchController.js';

const router = Router();

// GET /api/search?q=query&limit=10 (Keyword Search)
router.get('/', globalSearch);

// GET /api/search/semantic?q=query&limit=10 (Natural-Language Semantic Vector Search)
router.get('/semantic', semanticSearch);

export default router;
