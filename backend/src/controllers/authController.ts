import { Request, Response } from 'express';
import { AuthService } from '../services/authService.js';
import { controllerWrapper, ControllerError } from '../utils/controllerHelpers.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const register = controllerWrapper(async (req: Request, res: Response) => {
  const { name, email, password, profilePicture } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new ControllerError(400, 'Name is required');
  }

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    throw new ControllerError(400, 'A valid email address is required');
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    throw new ControllerError(400, 'Password must be at least 6 characters long');
  }

  const result = await AuthService.register({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password,
    profilePicture,
  });

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: result,
  });
});

export const login = controllerWrapper(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    throw new ControllerError(400, 'A valid email address is required');
  }

  if (!password || typeof password !== 'string') {
    throw new ControllerError(400, 'Password is required');
  }

  const result = await AuthService.login({
    email: email.trim().toLowerCase(),
    password,
  });

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: result,
  });
});

export const getMe = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({
    success: true,
    data: {
      user: req.user,
    },
  });
};
