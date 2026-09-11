import rateLimit from 'express-rate-limit';
import { Request } from 'express';

const keyGenerator = (req: Request): string => req.user?._id?.toString() ?? req.ip ?? 'unknown';

/**
 * Per-user rate limiter for endpoints that call out to a paid LLM/embedding
 * API. Keyed by authenticated user ID (falls back to IP only if somehow
 * unauthenticated) so a per-account ceiling actually limits spend, unlike
 * the shared IP-based global limiter.
 */
export const perUserAiLimiter = (max: number, windowMs: number) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    message: { success: false, message: 'You are sending requests too quickly. Please slow down.' },
  });
