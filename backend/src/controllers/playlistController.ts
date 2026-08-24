import { Request, Response } from 'express';
import { PlaylistService } from '../services/playlistService.js';
import { AIPlaylistPipelineService } from '../services/aiPlaylistPipelineService.js';
import { controllerWrapper, ensureAuth, ControllerError } from '../utils/controllerHelpers.js';

export const createPlaylist = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const { name, description, coverImage, visibility, isCollaborative } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new ControllerError(400, 'Playlist name is required');
  }

  const playlist = await PlaylistService.createPlaylist(user._id.toString(), {
    name: name.trim(),
    description,
    coverImage,
    visibility,
    isCollaborative,
  });

  res.status(201).json({
    success: true,
    message: 'Playlist created successfully',
    data: playlist,
  });
});

export const getUserPlaylists = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const playlists = await PlaylistService.getUserPlaylists(user._id.toString());

  res.status(200).json({
    success: true,
    data: playlists,
  });
});

export const getPlaylistById = controllerWrapper(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?._id?.toString();

  const playlist = await PlaylistService.getPlaylistById(id, userId);

  if (!playlist) {
    throw new ControllerError(404, 'Playlist not found');
  }

  res.status(200).json({
    success: true,
    data: playlist,
  });
});

export const updatePlaylist = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const { id } = req.params;
  const updated = await PlaylistService.updatePlaylist(id, user._id.toString(), req.body);

  if (!updated) {
    throw new ControllerError(404, 'Playlist not found');
  }

  res.status(200).json({
    success: true,
    message: 'Playlist updated successfully',
    data: updated,
  });
});

export const deletePlaylist = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const { id } = req.params;
  const deleted = await PlaylistService.deletePlaylist(id, user._id.toString());

  if (!deleted) {
    throw new ControllerError(404, 'Playlist not found');
  }

  res.status(200).json({
    success: true,
    message: 'Playlist deleted successfully',
  });
});

export const addSongToPlaylist = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const { id } = req.params;
  const { songId } = req.body;

  if (!songId) {
    throw new ControllerError(400, 'songId is required');
  }

  const playlist = await PlaylistService.addSongToPlaylist(id, user._id.toString(), songId);

  res.status(200).json({
    success: true,
    message: 'Song added to playlist',
    data: playlist,
  });
});

export const removeSongFromPlaylist = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const { id, songId } = req.params;

  const playlist = await PlaylistService.removeSongFromPlaylist(id, user._id.toString(), songId);

  res.status(200).json({
    success: true,
    message: 'Song removed from playlist',
    data: playlist,
  });
});

export const generateAIPlaylistEndpoint = controllerWrapper(async (req: Request, res: Response) => {
  const { prompt, count } = req.body;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    throw new ControllerError(400, 'Prompt is required for AI playlist generation');
  }

  const userId = req.user?._id?.toString();
  const parsedCount = count && !isNaN(parseInt(String(count), 10)) ? parseInt(String(count), 10) : undefined;

  const result = await AIPlaylistPipelineService.generateAIPlaylist({
    prompt: prompt.trim(),
    userId,
    count: parsedCount,
  });

  res.status(200).json({
    success: true,
    message: 'AI Playlist generated successfully',
    data: result,
  });
});
