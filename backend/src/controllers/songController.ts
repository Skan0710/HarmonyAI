import { Request, Response } from 'express';
import { SongService } from '../services/songService.js';
import { controllerWrapper, ControllerError } from '../utils/controllerHelpers.js';
import { extractQueryParams, sanitizeString } from '../utils/validators.js';

export const createSong = controllerWrapper(async (req: Request, res: Response) => {
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
    throw new ControllerError(400, 'Missing required fields: title, artist, genre, duration, and audioUrl are required');
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
});

export const getSongs = controllerWrapper(async (req: Request, res: Response) => {
  const q = extractQueryParams(req, {
    search: 'string',
    artistId: 'string',
    albumId: 'string',
    genreId: 'string',
    tag: 'string',
    releaseYear: 'int',
    minBpm: 'number',
    maxBpm: 'number',
    minEnergy: 'number',
    maxEnergy: 'number',
    minValence: 'number',
    maxValence: 'number',
    sortBy: 'string',
    sortOrder: 'string',
    page: 'int',
    limit: 'int',
  });

  // Support alias query params
  const search = sanitizeString(q.search);
  const artistId = sanitizeString(q.artistId) || sanitizeString(String(req.query.artist || ''));
  const albumId = sanitizeString(q.albumId) || sanitizeString(String(req.query.album || ''));
  const genreId = sanitizeString(q.genreId) || sanitizeString(String(req.query.genre || ''));
  const tag = sanitizeString(q.tag);
  const releaseYear = q.releaseYear || undefined;
  const minBpm = q.minBpm || undefined;
  const maxBpm = q.maxBpm || undefined;
  const minEnergy = q.minEnergy || undefined;
  const maxEnergy = q.maxEnergy || undefined;
  const minValence = q.minValence || undefined;
  const maxValence = q.maxValence || undefined;
  const sortBy = (q.sortBy as any) || 'createdAt';
  const sortOrder = q.sortOrder === 'asc' ? 'asc' : 'desc';
  const page = q.page || 1;
  const limit = q.limit || 20;

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
});

export const getSongById = controllerWrapper(async (req: Request, res: Response) => {
  const { id } = req.params;
  const song = await SongService.getSongById(id);

  if (!song) {
    throw new ControllerError(404, 'Song not found');
  }

  res.status(200).json({ success: true, data: song });
});

export const updateSong = controllerWrapper(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updatedSong = await SongService.updateSong(id, req.body);

  if (!updatedSong) {
    throw new ControllerError(404, 'Song not found');
  }

  res.status(200).json({
    success: true,
    message: 'Song updated successfully',
    data: updatedSong,
  });
});

export const deleteSong = controllerWrapper(async (req: Request, res: Response) => {
  const { id } = req.params;
  const deletedSong = await SongService.deleteSong(id);

  if (!deletedSong) {
    throw new ControllerError(404, 'Song not found');
  }

  res.status(200).json({
    success: true,
    message: 'Song deleted successfully',
  });
});

export const recordPlay = controllerWrapper(async (req: Request, res: Response) => {
  const { id } = req.params;
  const song = await SongService.incrementPlayCount(id);

  if (!song) {
    throw new ControllerError(404, 'Song not found');
  }

  res.status(200).json({
    success: true,
    message: 'Play count updated successfully',
    data: { id: song._id, playCount: song.playCount },
  });
});

export const getRecommendations = controllerWrapper(async (req: Request, res: Response) => {
  const q = extractQueryParams(req, {
    songId: 'string',
    genreId: 'string',
    targetBpm: 'number',
    targetEnergy: 'number',
    targetValence: 'number',
    limit: 'int',
  });

  const tags = req.query.tags ? String(req.query.tags).split(',') : undefined;

  const recommendations = await SongService.getRecommendations({
    songId: q.songId,
    genreId: q.genreId,
    targetBpm: q.targetBpm,
    targetEnergy: q.targetEnergy,
    targetValence: q.targetValence,
    tags,
    limit: q.limit || 10,
  });

  res.status(200).json({
    success: true,
    data: recommendations,
  });
});
