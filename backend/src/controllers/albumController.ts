import { Request, Response } from 'express';
import { AlbumService } from '../services/albumService.js';
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

    if (!title || !artist) {
      res.status(400).json({ success: false, message: 'Album title and primary artist are required' });
      return;
    }

    const album = await AlbumService.createAlbum({
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
    });

    res.status(201).json({
      success: true,
      message: 'Album created successfully',
      data: album,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create album',
    });
  }
};

export const getAlbums = async (req: Request, res: Response): Promise<void> => {
  try {
    const search = req.query.search ? String(req.query.search) : undefined;
    const artistId = req.query.artistId ? String(req.query.artistId) : undefined;
    const genreId = req.query.genreId ? String(req.query.genreId) : undefined;
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
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch album',
    });
  }
};

export const updateAlbum = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
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
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete album',
    });
  }
};
