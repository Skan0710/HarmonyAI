import { Request, Response } from 'express';
import { PlaylistService } from '../services/playlistService.js';
import { AIPlaylistGenerationService } from '../services/aiPlaylistGenerationService.js';
import { DedicatedPlaylistGenerationService, AIPlaylistGenerationInput } from '../services/dedicatedPlaylistGenerationService.js';
import { controllerWrapper, ensureAuth, ControllerError } from '../utils/controllerHelpers.js';
import { SequencingStrategy } from '../services/playlistSequencingService.js';

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

/**
 * Authenticated AI Playlist Generation API Endpoint
 * Accepts prompt, duration, mood, activity, genre, artist, discovery level, and sequencing options.
 */
export const generateAIPlaylistEndpoint = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const {
    prompt,
    duration,
    targetDurationMinutes,
    mood,
    activity,
    genre,
    genres,
    artist,
    artists,
    discoveryLevel,
    discoveryPercentage,
    noveltyPreference,
    diversityPreference,
    count,
    targetSongCount,
    sequencingStrategy,
    sessionId,
  } = req.body;

  // 1. Validate & Parse Optional Parameters
  let cleanPrompt: string | undefined = undefined;
  if (prompt !== undefined && prompt !== null) {
    if (typeof prompt !== 'string') {
      throw new ControllerError(400, 'Prompt must be a text string');
    }
    cleanPrompt = prompt.trim();
    if (cleanPrompt.length > 500) {
      throw new ControllerError(400, 'Prompt cannot exceed 500 characters');
    }
  }

  // Parse duration in minutes
  let parsedDuration: number | undefined = undefined;
  const rawDuration = targetDurationMinutes !== undefined ? targetDurationMinutes : duration;
  if (rawDuration !== undefined && rawDuration !== null) {
    const num = Number(rawDuration);
    if (isNaN(num) || num <= 0 || num > 360) {
      throw new ControllerError(400, 'Duration must be a positive number up to 360 minutes (6 hours)');
    }
    parsedDuration = num;
  }

  // Parse target track count
  let parsedCount: number | undefined = undefined;
  const rawCount = targetSongCount !== undefined ? targetSongCount : count;
  if (rawCount !== undefined && rawCount !== null) {
    const num = Number(rawCount);
    if (isNaN(num) || num <= 0 || num > 50) {
      throw new ControllerError(400, 'Target song count must be between 1 and 50');
    }
    parsedCount = num;
  }

  // Normalize genres
  const preferredGenres: string[] = [];
  if (Array.isArray(genres)) {
    genres.forEach((g) => {
      if (typeof g === 'string' && g.trim()) preferredGenres.push(g.trim());
    });
  } else if (typeof genre === 'string' && genre.trim()) {
    preferredGenres.push(genre.trim());
  }

  // Normalize artists
  const preferredArtists: string[] = [];
  if (Array.isArray(artists)) {
    artists.forEach((a) => {
      if (typeof a === 'string' && a.trim()) preferredArtists.push(a.trim());
    });
  } else if (typeof artist === 'string' && artist.trim()) {
    preferredArtists.push(artist.trim());
  }

  // Normalize discovery level / novelty preference
  let parsedNovelty: number | undefined = undefined;
  const rawDiscovery =
    discoveryLevel !== undefined
      ? discoveryLevel
      : discoveryPercentage !== undefined
      ? discoveryPercentage
      : noveltyPreference;

  if (rawDiscovery !== undefined && rawDiscovery !== null) {
    if (typeof rawDiscovery === 'string') {
      const lower = rawDiscovery.trim().toLowerCase();
      if (lower === 'low' || lower === 'familiar') parsedNovelty = 0.2;
      else if (lower === 'medium' || lower === 'balanced') parsedNovelty = 0.5;
      else if (lower === 'high' || lower === 'adventurous') parsedNovelty = 0.8;
      else if (lower === 'extreme' || lower === 'maximum') parsedNovelty = 1.0;
      else if (!isNaN(Number(lower))) {
        const val = Number(lower);
        parsedNovelty = val > 1 ? val / 100 : Math.max(0, Math.min(1, val));
      }
    } else if (typeof rawDiscovery === 'number') {
      parsedNovelty = rawDiscovery > 1 ? rawDiscovery / 100 : Math.max(0, Math.min(1, rawDiscovery));
    }
  }

  // Validate sequencing strategy if provided
  let strategy: SequencingStrategy = 'balanced';
  if (sequencingStrategy) {
    const validStrategies: SequencingStrategy[] = ['balanced', 'energetic', 'gradual', 'discovery'];
    if (validStrategies.includes(sequencingStrategy)) {
      strategy = sequencingStrategy;
    } else {
      throw new ControllerError(400, `Invalid sequencing strategy. Allowed values: ${validStrategies.join(', ')}`);
    }
  }

  // 2. Natural Language Prompt Extraction (if prompt provided)
  let extractedPreferences: any = {};
  if (cleanPrompt) {
    try {
      extractedPreferences = await AIPlaylistGenerationService.extractPlaylistPreferences(cleanPrompt);
    } catch (err: any) {
      console.warn(`[generateAIPlaylistEndpoint] Prompt extraction warning: ${err.message}`);
    }
  }

  // 3. Merge Prompt-Extracted Preferences with Explicit Request Parameters (Explicit params override extracted ones)
  const mergedMood = mood ? String(mood).trim() : extractedPreferences.requestedMood || undefined;
  const mergedActivity = activity ? String(activity).trim() : undefined;

  const mergedGenres = Array.from(
    new Set([...preferredGenres, ...(extractedPreferences.genres || [])])
  ).filter((g) => g && g !== 'Music');

  const mergedArtists = Array.from(
    new Set([...preferredArtists, ...(extractedPreferences.artists || [])])
  ).filter(Boolean);

  const mergedSongCount = parsedCount || extractedPreferences.requestedSongCount || undefined;

  const playlistInput: AIPlaylistGenerationInput = {
    userId: user._id.toString(),
    sessionId: typeof sessionId === 'string' ? sessionId.trim() : undefined,
    mood: mergedMood,
    activity: mergedActivity,
    targetDurationMinutes: parsedDuration,
    targetSongCount: mergedSongCount,
    preferredGenres: mergedGenres.length > 0 ? mergedGenres : undefined,
    preferredArtists: mergedArtists.length > 0 ? mergedArtists : undefined,
    noveltyPreference: parsedNovelty !== undefined ? parsedNovelty : extractedPreferences.energyLevel ? undefined : 0.5,
    diversityPreference: typeof diversityPreference === 'number' ? diversityPreference : 0.5,
    sequencingStrategy: strategy,
    searchPrompt: cleanPrompt,
  };

  // 4. Generate AI Playlist via Dedicated Playlist Generation Service
  const result = await DedicatedPlaylistGenerationService.generatePlaylist(playlistInput);

  // If prompt extracted a specific title or description and dedicated service used default, preserve extracted title
  if (extractedPreferences.title && (!result.title || result.title === 'AI Curated Playlist')) {
    result.title = extractedPreferences.title;
  }
  if (extractedPreferences.description && (!result.description || result.description.startsWith('AI curated'))) {
    result.description = extractedPreferences.description;
  }

  res.status(200).json({
    success: true,
    message: 'AI Playlist generated successfully',
    data: {
      ...result,
      metadata: {
        generatedAt: result.generatedAt,
        requestedBy: user._id.toString(),
        strategy: `AI_DEDICATED_${strategy.toUpperCase()}_SEQUENCED`,
        promptUsed: cleanPrompt || null,
      },
    },
  });
});
