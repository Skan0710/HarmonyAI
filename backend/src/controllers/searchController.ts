import { Request, Response } from 'express';
import { searchCatalog } from '../services/searchService.js';
import { SemanticSearchService } from '../services/semanticSearchService.js';

export const globalSearch = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = (req.query.q || req.query.query || '') as string;
    const limit = parseInt(req.query.limit as string, 10) || 10;

    if (!query || !query.trim()) {
      res.status(200).json({
        success: true,
        data: {
          songs: [],
          artists: [],
          albums: [],
          total: 0,
        },
        message: 'Query parameter q is required',
      });
      return;
    }

    const results = await searchCatalog(query, limit);

    res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error: any) {
    console.error('[SearchController Error]:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform search query',
      error: error.message || 'Internal Server Error',
    });
  }
};

export const semanticSearch = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = (req.query.q || req.query.query || '') as string;
    const trimmedQuery = String(query).trim();

    // 1. Validation: Empty Query
    if (!trimmedQuery) {
      res.status(400).json({
        success: false,
        message: 'Query parameter q is required and cannot be empty',
      });
      return;
    }

    // 2. Validation: Excessively Long Query (> 500 chars)
    if (trimmedQuery.length > 500) {
      res.status(400).json({
        success: false,
        message: 'Search query exceeds maximum allowed length of 500 characters',
      });
      return;
    }

    const limitParam = req.query.limit ? parseInt(String(req.query.limit), 10) : 10;
    const parsedLimit = isNaN(limitParam) || limitParam < 1 ? 10 : Math.min(50, limitParam);

    // 3. Perform Semantic Vector Search
    const results = await SemanticSearchService.searchSongsBySemanticQuery(trimmedQuery, parsedLimit);

    res.status(200).json({
      success: true,
      query: trimmedQuery,
      count: results.length,
      data: results || [],
    });
  } catch (error: any) {
    console.error('[SemanticSearchController Error]:', error);

    // 4. Handle Embedding and Search Failures Gracefully
    res.status(200).json({
      success: true,
      query: (req.query.q || req.query.query || '') as string,
      count: 0,
      data: [],
      message: error.message || 'Semantic search encountered an issue safely',
    });
  }
};
