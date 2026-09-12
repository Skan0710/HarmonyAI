import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Request } from 'express';

// IPv6 fallback must go through ipKeyGenerator, which truncates to a fixed
// prefix — an unnormalized req.ip lets an attacker rotate the low bits of an
// IPv6 address (trivially available within their own /64 allocation) to get
// a fresh rate-limit bucket on every request.
const keyGenerator = (req: Request): string =>
  req.user?._id?.toString() ?? ipKeyGenerator(req.ip ?? 'unknown');

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
