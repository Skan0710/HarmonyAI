import { Request, Response } from 'express';
import { UserService } from '../services/userService.js';

export const getCurrentUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized access',
      });
      return;
    }

    const user = await UserService.getUserById(req.user._id.toString());

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User profile not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
        likedSongs: user.likedSongs?.map((id) => id.toString()) || [],
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user profile',
    });
  }
};

export const updateCurrentUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized access',
      });
      return;
    }

    const { name, profilePicture } = req.body;

    const updatedUser = await UserService.updateProfile(req.user._id.toString(), {
      name,
      profilePicture,
    });

    if (!updatedUser) {
      res.status(404).json({
        success: false,
        message: 'User profile not found',
      });
      return;
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
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update user profile',
    });
  }
};

export const getLikedSongs = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized access',
      });
      return;
    }

    const songs = await UserService.getLikedSongs(req.user._id.toString());

    res.status(200).json({
      success: true,
      data: songs,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve liked songs',
      error: error.message,
    });
  }
};

export const likeSong = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized access',
      });
      return;
    }

    const { songId } = req.params;
    const likedSongs = await UserService.likeSong(req.user._id.toString(), songId);

    res.status(200).json({
      success: true,
      message: 'Song added to liked songs',
      data: { likedSongs },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to like song',
    });
  }
};

export const unlikeSong = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized access',
      });
      return;
    }

    const { songId } = req.params;
    const likedSongs = await UserService.unlikeSong(req.user._id.toString(), songId);

    res.status(200).json({
      success: true,
      message: 'Song removed from liked songs',
      data: { likedSongs },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to unlike song',
    });
  }
};
