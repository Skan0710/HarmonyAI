import { Request, Response } from 'express';
import { NewReleasesService } from '../services/newReleasesService.js';
import { controllerWrapper } from '../utils/controllerHelpers.js';
import { extractQueryParams } from '../utils/validators.js';

export const getNewReleases = controllerWrapper(async (req: Request, res: Response) => {
  const q = extractQueryParams(req, { page: 'int', limit: 'int' });

  const page = isNaN(q.page) || q.page < 1 ? 1 : q.page;
  const limit = isNaN(q.limit) || q.limit < 1 ? 10 : q.limit;

  const result = await NewReleasesService.getNewReleases(page, limit);

  res.status(200).json({
    success: true,
    data: result,
  });
});
