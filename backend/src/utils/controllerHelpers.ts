import { Request, Response } from 'express';
import { IUser } from '../models/User.js';

/**
 * Wraps an async controller handler with automatic try/catch and standardized error responses.
 * Eliminates the repetitive try { ... } catch (error) { res.status(5xx).json(...) } pattern.
 *
 * For errors with specific status codes, throw a ControllerError.
 * CastError and ValidationError are automatically mapped to 400.
 */
export const controllerWrapper = (
  fn: (req: Request, res: Response) => Promise<void>
) => async (req: Request, res: Response): Promise<void> => {
  try {
    await fn(req, res);
  } catch (error: any) {
    // Named error types with specific HTTP status codes
    if (error instanceof ControllerError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }

    // Mongoose validation / cast errors
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      res.status(400).json({
        success: false,
        message: error.message || 'Invalid input data',
      });
      return;
    }

    // Duplicate key errors
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        message: error.message || 'A record with that value already exists',
      });
      return;
    }

    // Default 500
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * Custom error class for controllers that need a specific HTTP status code.
 * Used with controllerWrapper to distinguish business logic errors from unexpected errors.
 */
export class ControllerError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'ControllerError';
  }
}

/**
 * Extracts the authenticated user from the request or sends a 401 response.
 * Returns the user if authenticated, or undefined if the response was already sent.
 *
 * Usage:
 *   const user = ensureAuth(req, res);
 *   if (!user) return;
 */
export const ensureAuth = (req: Request, res: Response): IUser | undefined => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Unauthorized access',
    });
    return undefined;
  }
  return req.user;
};

/**
 * Send a standardized success JSON response.
 */
export const sendSuccess = (
  res: Response,
  data?: any,
  statusCode = 200,
  message?: string
): void => {
  const body: Record<string, any> = { success: true };
  if (message) body.message = message;
  if (data !== undefined) body.data = data;
  res.status(statusCode).json(body);
};

/**
 * Send a standardized error JSON response.
 */
export const sendError = (
  res: Response,
  statusCode: number,
  message: string
): void => {
  res.status(statusCode).json({
    success: false,
    message,
  });
};
