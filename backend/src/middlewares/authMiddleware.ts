import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';
import { supabase } from '../config/supabase.js';

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
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, profile_picture, created_at, updated_at')
      .eq('id', decoded.id)
      .maybeSingle();

    if (error || !user) {
      res.status(401).json({
        success: false,
        message: 'User account not found or deactivated.',
      });
      return;
    }

    req.user = {
      _id: user.id,
      id: user.id,
      name: user.name,
      email: user.email,
      profilePicture: user.profile_picture,
      createdAt: user.created_at ? new Date(user.created_at) : new Date(),
      updatedAt: user.updated_at ? new Date(user.updated_at) : new Date(),
    } as any;
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
    const { data: user } = await supabase
      .from('users')
      .select('id, name, email, profile_picture, created_at, updated_at')
      .eq('id', decoded.id)
      .maybeSingle();

    if (user) {
      req.user = {
        _id: user.id,
        id: user.id,
        name: user.name,
        email: user.email,
        profilePicture: user.profile_picture,
        createdAt: user.created_at ? new Date(user.created_at) : new Date(),
        updatedAt: user.updated_at ? new Date(user.updated_at) : new Date(),
      } as any;
    }
  } catch {
    // Ignore invalid tokens in optionalAuth
  }
  next();
};
