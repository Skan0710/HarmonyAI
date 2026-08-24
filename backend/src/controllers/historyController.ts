import { Request, Response } from 'express';
import { HistoryService } from '../services/historyService.js';
import { controllerWrapper, ensureAuth } from '../utils/controllerHelpers.js';
import { extractQueryParams } from '../utils/validators.js';

export const recordPlayback = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const { songId } = req.params;
  const historyItem = await HistoryService.recordPlayback(user._id.toString(), songId);

  res.status(200).json({
    success: true,
    message: 'Playback recorded successfully',
    data: historyItem,
  });
});

export const getListeningHistory = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const q = extractQueryParams(req, { limit: 'int' });
  const history = await HistoryService.getListeningHistory(user._id.toString(), q.limit || 50);

  res.status(200).json({
    success: true,
    data: history,
  });
});

export const getRecentlyPlayed = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const q = extractQueryParams(req, { limit: 'int' });
  const songs = await HistoryService.getRecentlyPlayed(user._id.toString(), q.limit || 20);

  res.status(200).json({
    success: true,
    data: songs,
  });
});
