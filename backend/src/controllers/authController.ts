import { Request, Response } from 'express';
import { AuthService } from '../services/authService.js';
import { controllerWrapper, ControllerError } from '../utils/controllerHelpers.js';
import { setAuthCookie, clearAuthCookie } from '../utils/authCookie.js';
import { isValidHttpUrl } from '../utils/validators.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const register = controllerWrapper(async (req: Request, res: Response) => {
  const { name, email, password, profilePicture } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new ControllerError(400, 'Name is required');
  }

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    throw new ControllerError(400, 'A valid email address is required');
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    throw new ControllerError(400, 'Password must be at least 8 characters long');
  }

  if (!isValidHttpUrl(profilePicture)) {
    throw new ControllerError(400, 'profilePicture must be a valid http(s) URL');
  }

  const result = await AuthService.register({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password,
    profilePicture,
  });

  setAuthCookie(res, result.token);

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: { user: result.user },
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

  setAuthCookie(res, result.token);

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: { user: result.user },
  });
});

export const getMe = controllerWrapper(async (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      user: req.user,
    },
  });
});

export const logout = controllerWrapper(async (_req: Request, res: Response) => {
  clearAuthCookie(res);
  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});
