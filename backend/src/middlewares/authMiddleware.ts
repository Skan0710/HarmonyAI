import { Request, Response, NextFunction } from 'express';
import { getAuth } from '@clerk/express';
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
  // 1. Check for Clerk Authentication first
  try {
    const auth = getAuth(req);
    if (auth && auth.userId) {
      let user = await User.findOne({ clerkId: auth.userId });
      if (!user) {
        // Auto-provision user record for Clerk authenticated user
        user = await User.create({
          clerkId: auth.userId,
          name: 'Clerk User',
          email: `${auth.userId}@clerk.harmonyai.local`,
          likedSongs: [],
          favoriteArtists: [],
          favoriteGenres: [],
        });
      }
      req.user = user as IUser;
      return next();
    }
  } catch {
    // Clerk check passed through or not configured
  }

  // 2. Fall back to standard JWT Bearer token
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
  // 1. Check Clerk Auth
  try {
    const auth = getAuth(req);
    if (auth && auth.userId) {
      let user = await User.findOne({ clerkId: auth.userId });
      if (user) {
        req.user = user as IUser;
        return next();
      }
    }
  } catch {
    // Ignore
  }

  // 2. Check standard JWT
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

