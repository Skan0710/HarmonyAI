import { Request, Response } from 'express';
import { searchCatalog } from '../services/searchService.js';
import { SemanticSearchService } from '../services/semanticSearchService.js';
import {
  UnifiedMusicDiscoveryService,
  DiscoveryMode,
} from '../services/unifiedMusicDiscoveryService.js';
import { SearchSuggestionService } from '../services/searchSuggestionService.js';
import { controllerWrapper, ControllerError } from '../utils/controllerHelpers.js';
import { extractQueryParams } from '../utils/validators.js';

export const globalSearch = controllerWrapper(async (req: Request, res: Response) => {
  const q = extractQueryParams(req, { limit: 'int' });
  const query = String(req.query.q || req.query.query || '');

  if (!query.trim()) {
    res.status(200).json({
      success: true,
      data: { songs: [], artists: [], albums: [], total: 0 },
      message: 'Query parameter q is required',
    });
    return;
  }

  const results = await searchCatalog(query, q.limit || 10);

  res.status(200).json({
    success: true,
    data: results,
  });
});

export const semanticSearch = controllerWrapper(async (req: Request, res: Response) => {
  const query = String(req.query.q || req.query.query || '');
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    throw new ControllerError(400, 'Query parameter q is required and cannot be empty');
  }

  if (trimmedQuery.length > 500) {
    throw new ControllerError(400, 'Search query exceeds maximum allowed length of 500 characters');
  }

  const q = extractQueryParams(req, { limit: 'int' });
  const parsedLimit = isNaN(q.limit) || q.limit < 1 ? 10 : Math.min(50, q.limit);

  const results = await SemanticSearchService.searchSongsBySemanticQuery(trimmedQuery, parsedLimit);

  res.status(200).json({
    success: true,
    query: trimmedQuery,
    count: results.length,
    data: results || [],
  });
});

const ALLOWED_DISCOVERY_MODES: DiscoveryMode[] = ['all', 'keyword', 'semantic', 'recommendations', 'hybrid'];

export const unifiedDiscovery = controllerWrapper(async (req: Request, res: Response) => {
  const rawQuery = String(req.query.q || req.query.query || '');
  const trimmedQuery = rawQuery.trim();

  if (trimmedQuery.length > 500) {
    throw new ControllerError(400, 'Search query exceeds maximum allowed length of 500 characters');
  }

  const rawMode = req.query.mode ? String(req.query.mode).toLowerCase() : 'all';
  if (!ALLOWED_DISCOVERY_MODES.includes(rawMode as DiscoveryMode)) {
    throw new ControllerError(
      400,
      `Invalid search mode '${rawMode}'. Supported modes: ${ALLOWED_DISCOVERY_MODES.join(', ')}`
    );
  }
  const mode = rawMode as DiscoveryMode;

  const q = extractQueryParams(req, { limit: 'int', page: 'int' });
  const page = !isNaN(q.page) && q.page > 0 ? q.page : 1;
  const limit = !isNaN(q.limit) && q.limit > 0 ? Math.min(50, q.limit) : 10;

  const seedSongId = req.query.seedSongId ? String(req.query.seedSongId) : undefined;
  const userId = req.user ? String(req.user._id) : (req.query.userId ? String(req.query.userId) : undefined);

  const discoveryResult = await UnifiedMusicDiscoveryService.discover({
    query: trimmedQuery,
    mode,
    userId,
    seedSongId,
    page,
    limit,
  });

  res.status(200).json({
    success: true,
    data: discoveryResult,
  });
});

export const searchSuggestions = controllerWrapper(async (req: Request, res: Response) => {
  const rawQuery = String(req.query.q || req.query.query || '');
  const trimmedQuery = rawQuery.trim();

  if (trimmedQuery.length > 200) {
    throw new ControllerError(400, 'Suggestion query exceeds maximum allowed length of 200 characters');
  }

  const q = extractQueryParams(req, { limit: 'int' });
  const limit = !isNaN(q.limit) && q.limit > 0 ? Math.min(20, q.limit) : 6;

  const results = await SearchSuggestionService.getSuggestions({
    query: trimmedQuery,
    limit,
  });

  res.status(200).json({
    success: true,
    data: results,
  });
});
