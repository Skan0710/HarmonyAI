import { Request, Response } from 'express';
import { NewReleasesService } from '../services/newReleasesService.js';

export const getNewReleases = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 10;

    const result = await NewReleasesService.getNewReleases(
      isNaN(page) || page < 1 ? 1 : page,
      isNaN(limit) || limit < 1 ? 10 : limit
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch new releases',
    });
  }
};
