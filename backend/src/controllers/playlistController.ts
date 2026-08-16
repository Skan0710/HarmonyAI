import { Request, Response } from 'express';
import { PlaylistService } from '../services/playlistService.js';
import { AIPlaylistPipelineService } from '../services/aiPlaylistPipelineService.js';

export const createPlaylist = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized access' });
      return;
    }

    const { name, description, coverImage, visibility, isCollaborative } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ success: false, message: 'Playlist name is required' });
      return;
    }

    const playlist = await PlaylistService.createPlaylist(req.user._id.toString(), {
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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create playlist',
    });
  }
};

export const getUserPlaylists = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized access' });
      return;
    }

    const playlists = await PlaylistService.getUserPlaylists(req.user._id.toString());

    res.status(200).json({
      success: true,
      data: playlists,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch playlists',
    });
  }
};

export const getPlaylistById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?._id?.toString();

    const playlist = await PlaylistService.getPlaylistById(id, userId);

    if (!playlist) {
      res.status(404).json({ success: false, message: 'Playlist not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: playlist,
    });
  } catch (error: any) {
    if (error.message === 'Access denied to private playlist') {
      res.status(403).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch playlist details',
    });
  }
};

export const updatePlaylist = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized access' });
      return;
    }

    const { id } = req.params;
    const updated = await PlaylistService.updatePlaylist(id, req.user._id.toString(), req.body);

    if (!updated) {
      res.status(404).json({ success: false, message: 'Playlist not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Playlist updated successfully',
      data: updated,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to update playlist',
    });
  }
};

export const deletePlaylist = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized access' });
      return;
    }

    const { id } = req.params;
    const deleted = await PlaylistService.deletePlaylist(id, req.user._id.toString());

    if (!deleted) {
      res.status(404).json({ success: false, message: 'Playlist not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Playlist deleted successfully',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to delete playlist',
    });
  }
};

export const addSongToPlaylist = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized access' });
      return;
    }

    const { id } = req.params;
    const { songId } = req.body;

    if (!songId) {
      res.status(400).json({ success: false, message: 'songId is required' });
      return;
    }

    const playlist = await PlaylistService.addSongToPlaylist(id, req.user._id.toString(), songId);

    res.status(200).json({
      success: true,
      message: 'Song added to playlist',
      data: playlist,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to add song to playlist',
    });
  }
};

export const removeSongFromPlaylist = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized access' });
      return;
    }

    const { id, songId } = req.params;

    const playlist = await PlaylistService.removeSongFromPlaylist(id, req.user._id.toString(), songId);

    res.status(200).json({
      success: true,
      message: 'Song removed from playlist',
      data: playlist,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to remove song from playlist',
    });
  }
};

export const generateAIPlaylistEndpoint = async (req: Request, res: Response): Promise<void> => {
  try {
    const { prompt, count } = req.body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({
        success: false,
        message: 'Prompt is required for AI playlist generation',
      });
      return;
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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate AI playlist',
    });
  }
};
