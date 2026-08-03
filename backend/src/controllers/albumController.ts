import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { AlbumService } from '../services/albumService.js';
import { Artist } from '../models/Artist.js';
import { AlbumType } from '../models/Album.js';

export const createAlbum = async (req: Request, res: Response): Promise<void> => {
  try {
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

    // Validation
    if (!title || typeof title !== 'string' || !title.trim()) {
      res.status(400).json({ success: false, message: 'Album title is required and must be a non-empty string' });
      return;
    }

    if (!artist || typeof artist !== 'string' || !Types.ObjectId.isValid(artist)) {
      res.status(400).json({ success: false, message: 'Valid primary artist ID is required' });
      return;
    }

    // Check if artist exists
    const existingArtist = await Artist.findById(artist);
    if (!existingArtist) {
      res.status(404).json({ success: false, message: 'Referenced artist does not exist' });
      return;
    }

    if (releaseYear !== undefined && (typeof releaseYear !== 'number' || releaseYear < 1800 || releaseYear > 2100)) {
      res.status(400).json({ success: false, message: 'Release year must be a valid year between 1800 and 2100' });
      return;
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
  } catch (error: any) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      res.status(400).json({ success: false, message: error.message || 'Invalid input data' });
      return;
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create album',
    });
  }
};

export const getAlbums = async (req: Request, res: Response): Promise<void> => {
  try {
    const search = req.query.search ? String(req.query.search) : undefined;
    const artistId = (req.query.artistId || req.query.artist) ? String(req.query.artistId || req.query.artist) : undefined;
    const genreId = (req.query.genreId || req.query.genre) ? String(req.query.genreId || req.query.genre) : undefined;
    const albumType = req.query.albumType ? (String(req.query.albumType) as AlbumType) : undefined;
    const releaseYear = req.query.releaseYear ? parseInt(String(req.query.releaseYear), 10) : undefined;
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;

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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch albums',
    });
  }
};

export const getAlbumById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const album = await AlbumService.getAlbumById(id);

    if (!album) {
      res.status(404).json({ success: false, message: 'Album not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: album,
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ success: false, message: 'Invalid album ID format' });
      return;
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch album',
    });
  }
};

export const updateAlbum = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, artist, releaseYear } = req.body;

    if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
      res.status(400).json({ success: false, message: 'Album title must be a non-empty string' });
      return;
    }

    if (artist !== undefined && (!Types.ObjectId.isValid(artist))) {
      res.status(400).json({ success: false, message: 'Valid primary artist ID is required' });
      return;
    }

    if (releaseYear !== undefined && (typeof releaseYear !== 'number' || releaseYear < 1800 || releaseYear > 2100)) {
      res.status(400).json({ success: false, message: 'Release year must be a valid year between 1800 and 2100' });
      return;
    }

    const updatedAlbum = await AlbumService.updateAlbum(id, req.body);

    if (!updatedAlbum) {
      res.status(404).json({ success: false, message: 'Album not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Album updated successfully',
      data: updatedAlbum,
    });
  } catch (error: any) {
    if (error.name === 'CastError' || error.name === 'ValidationError') {
      res.status(400).json({ success: false, message: error.message || 'Invalid input data' });
      return;
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update album',
    });
  }
};

export const deleteAlbum = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const deletedAlbum = await AlbumService.deleteAlbum(id);

    if (!deletedAlbum) {
      res.status(404).json({ success: false, message: 'Album not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Album deleted successfully',
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ success: false, message: 'Invalid album ID format' });
      return;
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete album',
    });
  }
};
