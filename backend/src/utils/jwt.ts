import jwt, { Secret, SignOptions } from 'jsonwebtoken';

/**
 * Retrieve the JWT secret from environment variables.
 * Throws if not configured in production to prevent use of weak secrets.
 */
function getJwtSecret(): Secret {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    console.warn('[Security] JWT_SECRET not set. Using development fallback — do NOT deploy without JWT_SECRET.');
    return 'dev_fallback_secret_do_not_use_in_production';
  }
  return secret;
}

export const generateToken = (userId: string): string => {
  const secret = getJwtSecret();
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  const options: SignOptions = {
    expiresIn: expiresIn as SignOptions['expiresIn'],
  };

  return jwt.sign({ id: userId }, secret, options);
};

export const verifyToken = (token: string): jwt.JwtPayload | string => {
  const secret = getJwtSecret();
  return jwt.verify(token, secret);
};
