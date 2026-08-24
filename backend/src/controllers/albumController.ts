import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { AlbumService } from '../services/albumService.js';
import { Artist } from '../models/Artist.js';
import { AlbumType } from '../models/Album.js';
import { controllerWrapper, ControllerError } from '../utils/controllerHelpers.js';
import { extractQueryParams, sanitizeString } from '../utils/validators.js';

export const createAlbum = controllerWrapper(async (req: Request, res: Response) => {
  const {
    title,
    artist,
    featuredArtists,
    genre,
    coverImage,
    releaseYear,
    releaseDate,
    albumType,
    totalTracks,
    tags,
  } = req.body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    throw new ControllerError(400, 'Album title is required and must be a non-empty string');
  }

  if (!artist || typeof artist !== 'string' || !Types.ObjectId.isValid(artist)) {
    throw new ControllerError(400, 'Valid primary artist ID is required');
  }

  const existingArtist = await Artist.findById(artist);
  if (!existingArtist) {
    throw new ControllerError(404, 'Referenced artist does not exist');
  }

  if (releaseYear !== undefined && (typeof releaseYear !== 'number' || releaseYear < 1800 || releaseYear > 2100)) {
    throw new ControllerError(400, 'Release year must be a valid year between 1800 and 2100');
  }

  const album = await AlbumService.createAlbum({
    title: title.trim(),
    artist,
    featuredArtists,
    genre,
    coverImage,
    releaseYear,
    releaseDate,
    albumType,
    totalTracks,
    tags,
  });

  res.status(201).json({
    success: true,
    message: 'Album created successfully',
    data: album,
  });
});

export const getAlbums = controllerWrapper(async (req: Request, res: Response) => {
  const q = extractQueryParams(req, {
    search: 'string',
    artistId: 'string',
    genreId: 'string',
    albumType: 'string',
    releaseYear: 'int',
    page: 'int',
    limit: 'int',
  });

  const search = sanitizeString(q.search);
  const artistId = sanitizeString(q.artistId) || sanitizeString(String(req.query.artist || ''));
  const genreId = sanitizeString(q.genreId) || sanitizeString(String(req.query.genre || ''));
  const albumType = q.albumType as AlbumType | undefined;
  const releaseYear = q.releaseYear || undefined;
  const page = q.page || 1;
  const limit = q.limit || 20;

  const result = await AlbumService.getAllAlbums({
    search,
    artistId,
    genreId,
    albumType,
    releaseYear,
    page,
    limit,
  });

  res.status(200).json({
    success: true,
    data: result.albums,
    pagination: {
      total: result.total,
      page,
      limit,
      pages: Math.ceil(result.total / limit),
    },
  });
});

export const getAlbumById = controllerWrapper(async (req: Request, res: Response) => {
  const { id } = req.params;
  const album = await AlbumService.getAlbumById(id);

  if (!album) {
    throw new ControllerError(404, 'Album not found');
  }

  res.status(200).json({ success: true, data: album });
});

export const updateAlbum = controllerWrapper(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, artist, releaseYear } = req.body;

  if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
    throw new ControllerError(400, 'Album title must be a non-empty string');
  }

  if (artist !== undefined && !Types.ObjectId.isValid(artist)) {
    throw new ControllerError(400, 'Valid primary artist ID is required');
  }

  if (releaseYear !== undefined && (typeof releaseYear !== 'number' || releaseYear < 1800 || releaseYear > 2100)) {
    throw new ControllerError(400, 'Release year must be a valid year between 1800 and 2100');
  }

  const updatedAlbum = await AlbumService.updateAlbum(id, req.body);

  if (!updatedAlbum) {
    throw new ControllerError(404, 'Album not found');
  }

  res.status(200).json({
    success: true,
    message: 'Album updated successfully',
    data: updatedAlbum,
  });
});

export const deleteAlbum = controllerWrapper(async (req: Request, res: Response) => {
  const { id } = req.params;
  const deletedAlbum = await AlbumService.deleteAlbum(id);

  if (!deletedAlbum) {
    throw new ControllerError(404, 'Album not found');
  }

  res.status(200).json({
    success: true,
    message: 'Album deleted successfully',
  });
});
