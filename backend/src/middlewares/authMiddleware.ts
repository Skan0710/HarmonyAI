import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';
import { User, IUser } from '../models/User.js';

export const extractBearerToken = (req: Request): string | null => {
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    return req.headers.authorization.split(' ')[1];
  }
  return null;
};

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = extractBearerToken(req);

  if (!token) {
    res.status(401).json({
      success: false,
      message: 'Access denied. No authentication token provided.',
    });
    return;
  }

  try {
    const decoded = verifyToken(token) as { id: string };
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User account not found or deactivated.',
      });
      return;
    }

    req.user = user as IUser;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid, expired, or malformed authentication token.',
    });
  }
};

export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = extractBearerToken(req);

  if (!token) {
    return next();
  }

  try {
    const decoded = verifyToken(token) as { id: string };
    const user = await User.findById(decoded.id).select('-password');
    if (user) {
      req.user = user as IUser;
    }
  } catch {
    // Ignore invalid tokens in optionalAuth
  }
  next();
};
