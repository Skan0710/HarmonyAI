import { Request, Response } from 'express';
import { ArtistService } from '../services/artistService.js';

export const createArtist = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, bio, avatar, bannerImage, genres, socialLinks, verified, tags } = req.body;

    if (!name) {
      res.status(400).json({ success: false, message: 'Artist name is required' });
      return;
    }

    const artist = await ArtistService.createArtist({
      name,
      bio,
      avatar,
      bannerImage,
      genres,
      socialLinks,
      verified,
      tags,
    });

    res.status(201).json({
      success: true,
      message: 'Artist created successfully',
      data: artist,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create artist',
    });
  }
};

export const getArtists = async (req: Request, res: Response): Promise<void> => {
  try {
    const search = req.query.search ? String(req.query.search) : undefined;
    const genreId = req.query.genreId ? String(req.query.genreId) : undefined;
    const verified = req.query.verified !== undefined ? req.query.verified === 'true' : undefined;
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;

    const result = await ArtistService.getAllArtists({
      search,
      genreId,
      verified,
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
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch artist',
    });
  }
};

export const updateArtist = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
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
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete artist',
    });
  }
};
