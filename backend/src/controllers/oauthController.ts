import { Request, Response } from 'express';
import crypto from 'crypto';
import { AuthService } from '../services/authService.js';
import { buildAuthorizationUrl, isOAuthProviderConfigured, resolveOAuthProfile, OAuthProvider } from '../services/oauthService.js';
import { setAuthCookie } from '../utils/authCookie.js';

const STATE_COOKIE_PREFIX = 'harmonyai_oauth_state_';
const STATE_COOKIE_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes

const getFrontendUrl = (): string => {
  const raw = process.env.FRONTEND_URL || 'http://localhost:5173';
  return raw.replace(/\/+$/, '');
};

const getSecret = (): string => process.env.JWT_SECRET || 'harmonyai_default_oauth_secret';

const generateSignedState = (provider: OAuthProvider, returnTo?: string): string => {
  const timestamp = Date.now().toString();
  const random = crypto.randomBytes(16).toString('hex');
  const cleanReturnTo = returnTo ? Buffer.from(returnTo).toString('base64url') : '';
  const hmac = crypto.createHmac('sha256', getSecret()).update(`${provider}:${timestamp}:${random}:${cleanReturnTo}`).digest('hex');
  return `${timestamp}.${random}.${cleanReturnTo}.${hmac}`;
};

const verifyAndExtractReturnTo = (provider: OAuthProvider, state: string): { isValid: boolean; returnTo?: string } => {
  if (!state) return { isValid: false };
  const parts = state.split('.');
  if (parts.length === 3) {
    const [timestampStr, random, hmac] = parts;
    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp) || Date.now() - timestamp > STATE_COOKIE_MAX_AGE_MS || timestamp > Date.now() + 60000) {
      return { isValid: false };
    }
    const expectedHmac = crypto.createHmac('sha256', getSecret()).update(`${provider}:${timestampStr}:${random}`).digest('hex');
    try {
      const ok = crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(expectedHmac, 'hex'));
      return { isValid: ok };
    } catch {
      return { isValid: false };
    }
  }

  if (parts.length === 4) {
    const [timestampStr, random, cleanReturnTo, hmac] = parts;
    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp) || Date.now() - timestamp > STATE_COOKIE_MAX_AGE_MS || timestamp > Date.now() + 60000) {
      return { isValid: false };
    }
    const expectedHmac = crypto.createHmac('sha256', getSecret()).update(`${provider}:${timestampStr}:${random}:${cleanReturnTo}`).digest('hex');
    try {
      const ok = crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(expectedHmac, 'hex'));
      if (!ok) return { isValid: false };
      const returnTo = cleanReturnTo ? Buffer.from(cleanReturnTo, 'base64url').toString('utf8') : undefined;
      return { isValid: true, returnTo };
    } catch {
      return { isValid: false };
    }
  }

  return { isValid: false };
};

const stateCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? ('none' as const) : ('lax' as const),
  maxAge: STATE_COOKIE_MAX_AGE_MS,
  path: '/',
});

const startOAuthFlow = (provider: OAuthProvider) => (req: Request, res: Response): void => {
  const defaultFrontend = getFrontendUrl();
  let returnTo = defaultFrontend;
  if (typeof req.query.return_to === 'string' && (req.query.return_to.startsWith('http://') || req.query.return_to.startsWith('https://'))) {
    returnTo = req.query.return_to.replace(/\/+$/, '');
  } else if (req.headers.referer) {
    try {
      const u = new URL(req.headers.referer);
      returnTo = `${u.protocol}//${u.host}`;
    } catch {}
  }

  if (!isOAuthProviderConfigured(provider)) {
    res.redirect(`${returnTo}/login?error=${provider}_not_configured`);
    return;
  }

  const state = generateSignedState(provider, returnTo);
  res.cookie(`${STATE_COOKIE_PREFIX}${provider}`, state, stateCookieOptions());

  const authorizationUrl = buildAuthorizationUrl(provider, state);
  if (!authorizationUrl) {
    res.redirect(`${returnTo}/login?error=${provider}_not_configured`);
    return;
  }

  res.redirect(authorizationUrl);
};

const handleOAuthCallback = (provider: OAuthProvider) => async (req: Request, res: Response): Promise<void> => {
  const defaultFrontend = getFrontendUrl();
  const stateCookieName = `${STATE_COOKIE_PREFIX}${provider}`;

  try {
    const { code, state, error: providerError } = req.query as Record<string, string | undefined>;
    const expectedState = req.cookies?.[stateCookieName];
    res.clearCookie(stateCookieName, { path: '/' });

    const stateCheck = verifyAndExtractReturnTo(provider, state || '');
    const isStateValid = Boolean(state && ((expectedState && state === expectedState) || stateCheck.isValid));
    const targetFrontend = stateCheck.returnTo || defaultFrontend;

    if (providerError) {
      res.redirect(`${targetFrontend}/login?error=${provider}_denied`);
      return;
    }

    if (!code || !isStateValid) {
      console.warn(`[OAuth] ${provider} invalid state check failed: code=${Boolean(code)}, stateMatch=${Boolean(expectedState && state === expectedState)}, stateValid=${stateCheck.isValid}`);
      res.redirect(`${targetFrontend}/login?error=${provider}_invalid_state`);
      return;
    }

    const profile = await resolveOAuthProfile(provider, code);
    if (!profile) {
      res.redirect(`${targetFrontend}/login?error=${provider}_failed`);
      return;
    }

    const result = await AuthService.loginOrRegisterWithOAuth({
      provider,
      providerId: profile.providerId,
      email: profile.email,
      name: profile.name,
      profilePicture: profile.profilePicture,
    });

    setAuthCookie(res, result.token);
    // Redirect with token so cross-origin SPA frontends can persist it seamlessly
    res.redirect(`${targetFrontend}/?token=${encodeURIComponent(result.token)}`);
  } catch (err) {
    console.error(`[OAuth] ${provider} callback failed:`, err instanceof Error ? err.message : err);
    res.redirect(`${defaultFrontend}/login?error=${provider}_failed`);
  }
};

export const googleAuthStart = startOAuthFlow('google');
export const googleAuthCallback = handleOAuthCallback('google');
export const discordAuthStart = startOAuthFlow('discord');
export const discordAuthCallback = handleOAuthCallback('discord');
