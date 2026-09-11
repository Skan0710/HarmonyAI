import jwt, { Secret, SignOptions } from 'jsonwebtoken';

/**
 * Retrieve the JWT secret from environment variables.
 * Always required — no hardcoded fallback, since a fallback baked into
 * source is just as forgeable as never having a secret at all.
 */
function getJwtSecret(): Secret {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required. Set it in your .env file.');
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
