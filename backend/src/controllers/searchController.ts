import { Request, Response } from 'express';
import { searchCatalog } from '../services/searchService.js';

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
