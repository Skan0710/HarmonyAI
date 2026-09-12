import { Request, Response } from 'express';

/**
 * Session lives in an httpOnly cookie instead of a value the frontend stores
 * in localStorage — JS on the page (including injected/XSS JS) can no longer
 * read the token at all, only the browser can send it back automatically.
 */
export const AUTH_COOKIE_NAME = 'harmonyai_session';

// Matches the default JWT_EXPIRES_IN ('7d'). If you change JWT_EXPIRES_IN,
// update this to match so the cookie doesn't outlive (or expire before) the
// token it carries.
const AUTH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const setAuthCookie = (res: Response, token: string): void => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
    path: '/',
  });
};

export const clearAuthCookie = (res: Response): void => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
  });
};

export const extractAuthToken = (req: Request): string | null => {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer')) {
    return header.split(' ')[1];
  }
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];
  return typeof cookieToken === 'string' && cookieToken ? cookieToken : null;
};
