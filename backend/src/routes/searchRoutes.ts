import { Router } from 'express';
import {
  globalSearch,
  semanticSearch,
  unifiedDiscovery,
  searchSuggestions,
} from '../controllers/searchController.js';
import { optionalAuth } from '../middlewares/authMiddleware.js';

const router = Router();

// GET /api/search?q=query&limit=10 (Keyword Search)
router.get('/', globalSearch);

// GET /api/search/suggestions?q=query&limit=6 (Fast Prefix & Partial Autocomplete Suggestions)
router.get('/suggestions', searchSuggestions);

// GET /api/search/semantic?q=query&limit=10 (Natural-Language Semantic Vector Search)
router.get('/semantic', semanticSearch);

// GET /api/search/discover?q=query&mode=all&limit=10 (Unified Music Discovery: Keyword + Semantic + Recommendations)
router.get('/discover', optionalAuth, unifiedDiscovery);
router.get('/unified', optionalAuth, unifiedDiscovery);

export default router;
