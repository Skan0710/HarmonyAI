import { Request, Response } from 'express';
import { UserService } from '../services/userService.js';
import { ListeningProfileService } from '../services/listeningProfileService.js';
import { controllerWrapper, ensureAuth, ControllerError } from '../utils/controllerHelpers.js';

export const getCurrentUser = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const profile = await UserService.getUserById(user._id.toString());

  if (!profile) {
    throw new ControllerError(404, 'User profile not found');
  }

  res.status(200).json({
    success: true,
    data: {
      id: profile._id,
      name: profile.name,
      email: profile.email,
      profilePicture: profile.profilePicture,
      likedSongs: profile.likedSongs?.map((id) => id.toString()) || [],
      favoriteArtists: profile.favoriteArtists || [],
      favoriteGenres: profile.favoriteGenres || [],
      createdAt: profile.createdAt,
    },
  });
});

export const updateCurrentUser = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const { name, profilePicture } = req.body;

  const updatedUser = await UserService.updateProfile(user._id.toString(), {
    name,
    profilePicture,
  });

  if (!updatedUser) {
    throw new ControllerError(404, 'User profile not found');
  }

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      profilePicture: updatedUser.profilePicture,
      likedSongs: updatedUser.likedSongs?.map((id) => id.toString()) || [],
      createdAt: updatedUser.createdAt,
    },
  });
});

export const getLikedSongs = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const songs = await UserService.getLikedSongs(user._id.toString());

  res.status(200).json({ success: true, data: songs });
});

export const likeSong = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const { songId } = req.params;
  const likedSongs = await UserService.likeSong(user._id.toString(), songId);

  res.status(200).json({
    success: true,
    message: 'Song added to liked songs',
    data: { likedSongs },
  });
});

export const unlikeSong = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const { songId } = req.params;
  const likedSongs = await UserService.unlikeSong(user._id.toString(), songId);

  res.status(200).json({
    success: true,
    message: 'Song removed from liked songs',
    data: { likedSongs },
  });
});

// Favorite Artists Handlers
export const addFavoriteArtist = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const { artistId } = req.params;
  const favoriteArtists = await UserService.addFavoriteArtist(user._id.toString(), artistId);

  res.status(200).json({
    success: true,
    message: 'Artist added to favorites',
    data: { favoriteArtists },
  });
});

export const removeFavoriteArtist = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const { artistId } = req.params;
  const favoriteArtists = await UserService.removeFavoriteArtist(user._id.toString(), artistId);

  res.status(200).json({
    success: true,
    message: 'Artist removed from favorites',
    data: { favoriteArtists },
  });
});

// Favorite Genres Handlers
export const addFavoriteGenre = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const { genreId } = req.params;
  const favoriteGenres = await UserService.addFavoriteGenre(user._id.toString(), genreId);

  res.status(200).json({
    success: true,
    message: 'Genre added to favorites',
    data: { favoriteGenres },
  });
});

export const removeFavoriteGenre = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const { genreId } = req.params;
  const favoriteGenres = await UserService.removeFavoriteGenre(user._id.toString(), genreId);

  res.status(200).json({
    success: true,
    message: 'Genre removed from favorites',
    data: { favoriteGenres },
  });
});

export const getUserPreferences = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const preferences = await UserService.getUserPreferences(user._id.toString());

  res.status(200).json({ success: true, data: preferences });
});

// Listening Profile & Analytics Handler
export const getListeningProfile = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const profile = await ListeningProfileService.getUserListeningProfile(user._id.toString());

  res.status(200).json({ success: true, data: profile });
});
