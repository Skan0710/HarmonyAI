import jwt, { Secret, SignOptions } from 'jsonwebtoken';

export const generateToken = (userId: string): string => {
  const secret: Secret = process.env.JWT_SECRET || 'fallback_secret_harmonyai';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  const options: SignOptions = {
    expiresIn: expiresIn as SignOptions['expiresIn'],
  };

  return jwt.sign({ id: userId }, secret, options);
};

export const verifyToken = (token: string): jwt.JwtPayload | string => {
  const secret: Secret = process.env.JWT_SECRET || 'fallback_secret_harmonyai';
  return jwt.verify(token, secret);
};
