import { Request, Response } from 'express';
import { GenreService } from '../services/genreService.js';
import { controllerWrapper, ControllerError } from '../utils/controllerHelpers.js';

export const createGenre = controllerWrapper(async (req: Request, res: Response) => {
  const { name, description, coverImage, parentGenre, tags, isFeatured } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new ControllerError(400, 'Genre name is required and must be a non-empty string');
  }

  const genre = await GenreService.createGenre({
    name: name.trim(),
    description,
    coverImage,
    parentGenre,
    tags,
    isFeatured,
  });

  res.status(201).json({
    success: true,
    message: 'Genre created successfully',
    data: genre,
  });
});

export const getGenres = controllerWrapper(async (req: Request, res: Response) => {
  const isFeatured = req.query.isFeatured !== undefined ? req.query.isFeatured === 'true' : undefined;
  const search = req.query.search ? String(req.query.search) : undefined;

  const genres = await GenreService.getAllGenres({ isFeatured, search });

  res.status(200).json({ success: true, data: genres });
});

export const getGenreById = controllerWrapper(async (req: Request, res: Response) => {
  const { id } = req.params;
  let genre = await GenreService.getGenreById(id);

  if (!genre && typeof id === 'string') {
    genre = await GenreService.getGenreBySlug(id);
  }

  if (!genre) {
    throw new ControllerError(404, 'Genre not found');
  }

  res.status(200).json({ success: true, data: genre });
});

export const updateGenre = controllerWrapper(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name } = req.body;

  if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
    throw new ControllerError(400, 'Genre name must be a non-empty string');
  }

  const updatedGenre = await GenreService.updateGenre(id, req.body);

  if (!updatedGenre) {
    throw new ControllerError(404, 'Genre not found');
  }

  res.status(200).json({
    success: true,
    message: 'Genre updated successfully',
    data: updatedGenre,
  });
});

export const deleteGenre = controllerWrapper(async (req: Request, res: Response) => {
  const { id } = req.params;
  const deletedGenre = await GenreService.deleteGenre(id);

  if (!deletedGenre) {
    throw new ControllerError(404, 'Genre not found');
  }

  res.status(200).json({
    success: true,
    message: 'Genre deleted successfully',
  });
});
