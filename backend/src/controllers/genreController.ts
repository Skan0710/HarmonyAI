import { Request, Response } from 'express';
import { GenreService } from '../services/genreService.js';

export const createGenre = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, coverImage, parentGenre, tags, isFeatured } = req.body;

    if (!name) {
      res.status(400).json({ success: false, message: 'Genre name is required' });
      return;
    }

    const genre = await GenreService.createGenre({
      name,
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
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ success: false, message: 'Genre name or slug already exists' });
      return;
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create genre',
    });
  }
};

export const getGenres = async (req: Request, res: Response): Promise<void> => {
  try {
    const isFeatured = req.query.isFeatured !== undefined ? req.query.isFeatured === 'true' : undefined;
    const search = req.query.search ? String(req.query.search) : undefined;

    const genres = await GenreService.getAllGenres({ isFeatured, search });

    res.status(200).json({
      success: true,
      data: genres,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch genres',
    });
  }
};

export const getGenreById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const genre = await GenreService.getGenreById(id);

    if (!genre) {
      res.status(404).json({ success: false, message: 'Genre not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: genre,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch genre',
    });
  }
};

export const updateGenre = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updatedGenre = await GenreService.updateGenre(id, req.body);

    if (!updatedGenre) {
      res.status(404).json({ success: false, message: 'Genre not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Genre updated successfully',
      data: updatedGenre,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update genre',
    });
  }
};

export const deleteGenre = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const deletedGenre = await GenreService.deleteGenre(id);

    if (!deletedGenre) {
      res.status(404).json({ success: false, message: 'Genre not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Genre deleted successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete genre',
    });
  }
};
