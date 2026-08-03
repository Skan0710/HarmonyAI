import { Request, Response } from 'express';
import { SongService } from '../services/songService.js';

export const createSong = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      title,
      artist,
      featuredArtists,
      album,
      genre,
      duration,
      coverImage,
      audioUrl,
      releaseYear,
      audioFeatures,
      tags,
      language,
      explicit,
      lyrics,
      vectorEmbedding,
      recommendationMetadata,
    } = req.body;

    if (!title || !artist || !genre || !duration || !audioUrl) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: title, artist, genre, duration, and audioUrl are required',
      });
      return;
    }

    const song = await SongService.createSong({
      title,
      artist,
      featuredArtists,
      album,
      genre,
      duration,
      coverImage,
      audioUrl,
      releaseYear,
      audioFeatures,
      tags,
      language,
      explicit,
      lyrics,
      vectorEmbedding,
      recommendationMetadata,
    });

    res.status(201).json({
      success: true,
      message: 'Song created successfully',
      data: song,
    });
  } catch (error: any) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      res.status(400).json({
        success: false,
        message: error.message || 'Validation error',
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create song',
    });
  }
};

export const getSongs = async (req: Request, res: Response): Promise<void> => {
  try {
    const search = req.query.search ? String(req.query.search) : undefined;
    const artistId = (req.query.artistId || req.query.artist) ? String(req.query.artistId || req.query.artist) : undefined;
    const albumId = (req.query.albumId || req.query.album) ? String(req.query.albumId || req.query.album) : undefined;
    const genreId = (req.query.genreId || req.query.genre) ? String(req.query.genreId || req.query.genre) : undefined;
    const tag = req.query.tag ? String(req.query.tag) : undefined;
    const releaseYear = req.query.releaseYear ? parseInt(String(req.query.releaseYear), 10) : undefined;
    const minBpm = req.query.minBpm ? parseFloat(String(req.query.minBpm)) : undefined;
    const maxBpm = req.query.maxBpm ? parseFloat(String(req.query.maxBpm)) : undefined;
    const minEnergy = req.query.minEnergy ? parseFloat(String(req.query.minEnergy)) : undefined;
    const maxEnergy = req.query.maxEnergy ? parseFloat(String(req.query.maxEnergy)) : undefined;
    const minValence = req.query.minValence ? parseFloat(String(req.query.minValence)) : undefined;
    const maxValence = req.query.maxValence ? parseFloat(String(req.query.maxValence)) : undefined;
    const sortBy = req.query.sortBy ? (String(req.query.sortBy) as any) : 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;

    const result = await SongService.getAllSongs({
      search,
      artistId,
      albumId,
      genreId,
      tag,
      releaseYear,
      minBpm,
      maxBpm,
      minEnergy,
      maxEnergy,
      minValence,
      maxValence,
      sortBy,
      sortOrder,
      page,
      limit,
    });

    res.status(200).json({
      success: true,
      data: result.songs,
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
      message: error.message || 'Failed to fetch songs',
    });
  }
};

export const getSongById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const song = await SongService.getSongById(id);

    if (!song) {
      res.status(404).json({ success: false, message: 'Song not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: song,
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ success: false, message: 'Invalid song ID format' });
      return;
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch song',
    });
  }
};

export const updateSong = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updatedSong = await SongService.updateSong(id, req.body);

    if (!updatedSong) {
      res.status(404).json({ success: false, message: 'Song not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Song updated successfully',
      data: updatedSong,
    });
  } catch (error: any) {
    if (error.name === 'CastError' || error.name === 'ValidationError') {
      res.status(400).json({ success: false, message: error.message || 'Invalid input data' });
      return;
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update song',
    });
  }
};

export const deleteSong = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const deletedSong = await SongService.deleteSong(id);

    if (!deletedSong) {
      res.status(404).json({ success: false, message: 'Song not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Song deleted successfully',
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ success: false, message: 'Invalid song ID format' });
      return;
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete song',
    });
  }
};

export const recordPlay = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const song = await SongService.incrementPlayCount(id);

    if (!song) {
      res.status(404).json({ success: false, message: 'Song not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Play count updated successfully',
      data: { id: song._id, playCount: song.playCount },
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ success: false, message: 'Invalid song ID format' });
      return;
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to record play count',
    });
  }
};

export const getRecommendations = async (req: Request, res: Response): Promise<void> => {
  try {
    const songId = req.query.songId ? String(req.query.songId) : undefined;
    const genreId = req.query.genreId ? String(req.query.genreId) : undefined;
    const targetBpm = req.query.targetBpm ? parseFloat(String(req.query.targetBpm)) : undefined;
    const targetEnergy = req.query.targetEnergy ? parseFloat(String(req.query.targetEnergy)) : undefined;
    const targetValence = req.query.targetValence ? parseFloat(String(req.query.targetValence)) : undefined;
    const tags = req.query.tags ? String(req.query.tags).split(',') : undefined;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 10;

    const recommendations = await SongService.getRecommendations({
      songId,
      genreId,
      targetBpm,
      targetEnergy,
      targetValence,
      tags,
      limit,
    });

    res.status(200).json({
      success: true,
      data: recommendations,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch recommendations',
    });
  }
};
