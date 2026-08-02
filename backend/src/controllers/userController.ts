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
