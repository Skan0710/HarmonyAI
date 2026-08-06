import { Request, Response } from 'express';
import { HistoryService } from '../services/historyService.js';

export const recordPlayback = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized access',
      });
      return;
    }

    const { songId } = req.params;
    const historyItem = await HistoryService.recordPlayback(req.user._id.toString(), songId);

    res.status(200).json({
      success: true,
      message: 'Playback recorded successfully',
      data: historyItem,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to record playback',
    });
  }
};

export const getListeningHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized access',
      });
      return;
    }

    const limit = parseInt(req.query.limit as string, 10) || 50;
    const history = await HistoryService.getListeningHistory(req.user._id.toString(), limit);

    res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch listening history',
      error: error.message,
    });
  }
};

export const getRecentlyPlayed = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized access',
      });
      return;
    }

    const limit = parseInt(req.query.limit as string, 10) || 20;
    const songs = await HistoryService.getRecentlyPlayed(req.user._id.toString(), limit);

    res.status(200).json({
      success: true,
      data: songs,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recently played songs',
      error: error.message,
    });
  }
};
