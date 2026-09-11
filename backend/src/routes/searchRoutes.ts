import { Router } from 'express';
import {
  globalSearch,
  semanticSearch,
  unifiedDiscovery,
  searchSuggestions,
} from '../controllers/searchController.js';
import { protect, optionalAuth } from '../middlewares/authMiddleware.js';
import { perUserAiLimiter } from '../middlewares/aiRateLimiter.js';

const router = Router();

// Semantic search and semantic-capable discovery both call out to the Gemini
// embedding API, which costs money per call — cap per-user, not just per-IP.
const semanticSearchLimiter = perUserAiLimiter(20, 5 * 60 * 1000);
const discoveryLimiter = perUserAiLimiter(30, 5 * 60 * 1000);

// GET /api/search?q=query&limit=10 (Keyword Search)
router.get('/', globalSearch);

// GET /api/search/suggestions?q=query&limit=6 (Fast Prefix & Partial Autocomplete Suggestions)
router.get('/suggestions', searchSuggestions);

// GET /api/search/semantic?q=query&limit=10 (Natural-Language Semantic Vector Search)
// Requires auth — this is a paid Gemini call per request and must not be reachable anonymously.
router.get('/semantic', protect, semanticSearchLimiter, semanticSearch);

// GET /api/search/discover?q=query&mode=all&limit=10 (Unified Music Discovery: Keyword + Semantic + Recommendations)
// Anonymous requests are allowed but downgraded to keyword-only mode in the controller
// (semantic/hybrid/recommendation modes require req.user) so anonymous discovery can't
// trigger Gemini calls.
router.get('/discover', optionalAuth, discoveryLimiter, unifiedDiscovery);
router.get('/unified', optionalAuth, discoveryLimiter, unifiedDiscovery);

export default router;
