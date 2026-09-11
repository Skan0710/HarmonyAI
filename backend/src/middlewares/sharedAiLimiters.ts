import { perUserAiLimiter } from './aiRateLimiter.js';

/**
 * `/api/assistant/chat` and `/api/recommendations/assistant` both ultimately
 * spend the same Gemini budget on behalf of a user, so they share a single
 * limiter instance (and therefore a single counter) rather than each getting
 * their own — otherwise a user could just switch endpoints to double their
 * effective quota.
 */
export const assistantAiLimiter = perUserAiLimiter(15, 5 * 60 * 1000); // 15 / 5 min
export const dailyAiLimiter = perUserAiLimiter(200, 24 * 60 * 60 * 1000); // 200 / day
