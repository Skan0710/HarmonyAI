import { Request, Response } from 'express';
import { ArtistService } from '../services/artistService.js';

export const createArtist = async (req: Request, res: Response): Promise<void> => {
  try {
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

    // Input Validation
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({
        success: false,
        message: 'Artist name is required and must be a non-empty string',
      });
      return;
    }

    if (monthlyListeners !== undefined && (typeof monthlyListeners !== 'number' || monthlyListeners < 0)) {
      res.status(400).json({
        success: false,
        message: 'Monthly listeners must be a non-negative number',
      });
      return;
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
  } catch (error: any) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      res.status(400).json({
        success: false,
        message: error.message || 'Invalid input data',
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create artist',
    });
  }
};

export const getArtists = async (req: Request, res: Response): Promise<void> => {
  try {
    const search = req.query.search ? String(req.query.search) : undefined;
    const genreId = (req.query.genreId || req.query.genre) ? String(req.query.genreId || req.query.genre) : undefined;
    const verified = req.query.verified !== undefined ? req.query.verified === 'true' : undefined;
    const sortBy = req.query.sortBy ? (String(req.query.sortBy) as any) : 'monthlyListeners';
    const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;

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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch artists',
    });
  }
};

export const getArtistById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const artist = await ArtistService.getArtistById(id);

    if (!artist) {
      res.status(404).json({ success: false, message: 'Artist not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: artist,
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ success: false, message: 'Invalid artist ID format' });
      return;
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch artist',
    });
  }
};

export const updateArtist = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, monthlyListeners } = req.body;

    if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
      res.status(400).json({
        success: false,
        message: 'Artist name must be a non-empty string',
      });
      return;
    }

    if (monthlyListeners !== undefined && (typeof monthlyListeners !== 'number' || monthlyListeners < 0)) {
      res.status(400).json({
        success: false,
        message: 'Monthly listeners must be a non-negative number',
      });
      return;
    }

    const updatedArtist = await ArtistService.updateArtist(id, req.body);

    if (!updatedArtist) {
      res.status(404).json({ success: false, message: 'Artist not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Artist updated successfully',
      data: updatedArtist,
    });
  } catch (error: any) {
    if (error.name === 'CastError' || error.name === 'ValidationError') {
      res.status(400).json({
        success: false,
        message: error.message || 'Invalid input data',
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update artist',
    });
  }
};

export const deleteArtist = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const deletedArtist = await ArtistService.deleteArtist(id);

    if (!deletedArtist) {
      res.status(404).json({ success: false, message: 'Artist not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Artist deleted successfully',
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ success: false, message: 'Invalid artist ID format' });
      return;
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete artist',
    });
  }
};

export const getSimilarArtists = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 5;

    const similar = await ArtistService.getRecommendedArtists(id, limit);

    res.status(200).json({
      success: true,
      data: similar,
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ success: false, message: 'Invalid artist ID format' });
      return;
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch similar artists',
    });
  }
};
