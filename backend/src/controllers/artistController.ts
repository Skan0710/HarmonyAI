import { Request, Response } from 'express';
import { ArtistService } from '../services/artistService.js';
import { controllerWrapper, ControllerError } from '../utils/controllerHelpers.js';
import { extractQueryParams, sanitizeString } from '../utils/validators.js';

export const createArtist = controllerWrapper(async (req: Request, res: Response) => {
  const {
    name,
    bio,
    profileImage,
    avatar,
    bannerImage,
    genres,
    socialLinks,
    monthlyListeners,
    verified,
    tags,
    similarArtists,
    vectorEmbedding,
    recommendationMetadata,
  } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new ControllerError(400, 'Artist name is required and must be a non-empty string');
  }

  if (monthlyListeners !== undefined && (typeof monthlyListeners !== 'number' || monthlyListeners < 0)) {
    throw new ControllerError(400, 'Monthly listeners must be a non-negative number');
  }

  const artist = await ArtistService.createArtist({
    name: name.trim(),
    bio,
    profileImage,
    avatar,
    bannerImage,
    genres,
    socialLinks,
    monthlyListeners,
    verified,
    tags,
    similarArtists,
    vectorEmbedding,
    recommendationMetadata,
  });

  res.status(201).json({
    success: true,
    message: 'Artist created successfully',
    data: artist,
  });
});

export const getArtists = controllerWrapper(async (req: Request, res: Response) => {
  const q = extractQueryParams(req, {
    search: 'string',
    genreId: 'string',
    sortBy: 'string',
    sortOrder: 'string',
    page: 'int',
    limit: 'int',
  });

  const search = sanitizeString(q.search);
  const genreId = sanitizeString(q.genreId) || sanitizeString(String(req.query.genre || ''));
  const verified = req.query.verified !== undefined ? req.query.verified === 'true' : undefined;
  const sortBy = (q.sortBy as any) || 'monthlyListeners';
  const sortOrder = q.sortOrder === 'asc' ? 'asc' : 'desc';
  const page = q.page || 1;
  const limit = q.limit || 20;

  const result = await ArtistService.getAllArtists({
    search,
    genreId,
    verified,
    sortBy,
    sortOrder,
    page,
    limit,
  });

  res.status(200).json({
    success: true,
    data: result.artists,
    pagination: {
      total: result.total,
      page,
      limit,
      pages: Math.ceil(result.total / limit),
    },
  });
});

export const getArtistById = controllerWrapper(async (req: Request, res: Response) => {
  const { id } = req.params;
  const artist = await ArtistService.getArtistById(id);

  if (!artist) {
    throw new ControllerError(404, 'Artist not found');
  }

  res.status(200).json({ success: true, data: artist });
});

export const updateArtist = controllerWrapper(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, monthlyListeners } = req.body;

  if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
    throw new ControllerError(400, 'Artist name must be a non-empty string');
  }

  if (monthlyListeners !== undefined && (typeof monthlyListeners !== 'number' || monthlyListeners < 0)) {
    throw new ControllerError(400, 'Monthly listeners must be a non-negative number');
  }

  const updatedArtist = await ArtistService.updateArtist(id, req.body);

  if (!updatedArtist) {
    throw new ControllerError(404, 'Artist not found');
  }

  res.status(200).json({
    success: true,
    message: 'Artist updated successfully',
    data: updatedArtist,
  });
});

export const deleteArtist = controllerWrapper(async (req: Request, res: Response) => {
  const { id } = req.params;
  const deletedArtist = await ArtistService.deleteArtist(id);

  if (!deletedArtist) {
    throw new ControllerError(404, 'Artist not found');
  }

  res.status(200).json({
    success: true,
    message: 'Artist deleted successfully',
  });
});

export const getSimilarArtists = controllerWrapper(async (req: Request, res: Response) => {
  const { id } = req.params;
  const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 5;

  const similar = await ArtistService.getRecommendedArtists(id, limit);

  res.status(200).json({ success: true, data: similar });
});
