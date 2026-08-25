import { Request, Response } from 'express';
import { searchCatalog } from '../services/searchService.js';
import { SemanticSearchService } from '../services/semanticSearchService.js';
import { UnifiedMusicDiscoveryService } from '../services/unifiedMusicDiscoveryService.js';
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

export const unifiedDiscovery = controllerWrapper(async (req: Request, res: Response) => {
  const query = String(req.query.q || req.query.query || '');
  const mode = (req.query.mode as any) || 'all';
  const seedSongId = req.query.seedSongId ? String(req.query.seedSongId) : undefined;
  const userId = req.user ? String(req.user._id) : (req.query.userId ? String(req.query.userId) : undefined);

  const q = extractQueryParams(req, { limit: 'int' });
  const parsedLimit = isNaN(q.limit) || q.limit < 1 ? 10 : Math.min(50, q.limit);

  if (query.trim().length > 500) {
    throw new ControllerError(400, 'Search query exceeds maximum allowed length of 500 characters');
  }

  const discoveryResult = await UnifiedMusicDiscoveryService.discover({
    query: query.trim(),
    mode,
    userId,
    seedSongId,
    limit: parsedLimit,
  });

  res.status(200).json({
    success: true,
    data: discoveryResult,
  });
});
