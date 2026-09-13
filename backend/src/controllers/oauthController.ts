import { Request, Response } from 'express';
import crypto from 'crypto';
import { AuthService } from '../services/authService.js';
import { buildAuthorizationUrl, isOAuthProviderConfigured, resolveOAuthProfile, OAuthProvider } from '../services/oauthService.js';
import { setAuthCookie } from '../utils/authCookie.js';

const STATE_COOKIE_PREFIX = 'harmonyai_oauth_state_';
const STATE_COOKIE_MAX_AGE_MS = 10 * 60 * 1000; // just long enough to complete the redirect round trip

const getFrontendUrl = (): string => process.env.FRONTEND_URL || 'http://localhost:5173';

const stateCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: STATE_COOKIE_MAX_AGE_MS,
  path: '/',
});

const startOAuthFlow = (provider: OAuthProvider) => (req: Request, res: Response): void => {
  if (!isOAuthProviderConfigured(provider)) {
    res.redirect(`${getFrontendUrl()}/login?error=${provider}_not_configured`);
    return;
  }

  const state = crypto.randomBytes(24).toString('hex');
  res.cookie(`${STATE_COOKIE_PREFIX}${provider}`, state, stateCookieOptions());

  const authorizationUrl = buildAuthorizationUrl(provider, state);
  if (!authorizationUrl) {
    res.redirect(`${getFrontendUrl()}/login?error=${provider}_not_configured`);
    return;
  }

  res.redirect(authorizationUrl);
};

const handleOAuthCallback = (provider: OAuthProvider) => async (req: Request, res: Response): Promise<void> => {
  const frontendUrl = getFrontendUrl();
  const stateCookieName = `${STATE_COOKIE_PREFIX}${provider}`;

  try {
    const { code, state, error: providerError } = req.query as Record<string, string | undefined>;
    const expectedState = req.cookies?.[stateCookieName];
    res.clearCookie(stateCookieName, { path: '/' });

    if (providerError) {
      res.redirect(`${frontendUrl}/login?error=${provider}_denied`);
      return;
    }

    if (!code || !state || !expectedState || state !== expectedState) {
      res.redirect(`${frontendUrl}/login?error=${provider}_invalid_state`);
      return;
    }

    const profile = await resolveOAuthProfile(provider, code);
    if (!profile) {
      res.redirect(`${frontendUrl}/login?error=${provider}_failed`);
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
    res.redirect(frontendUrl);
  } catch (err) {
    console.error(`[OAuth] ${provider} callback failed:`, err instanceof Error ? err.message : err);
    res.redirect(`${frontendUrl}/login?error=${provider}_failed`);
  }
};

export const googleAuthStart = startOAuthFlow('google');
export const googleAuthCallback = handleOAuthCallback('google');
export const discordAuthStart = startOAuthFlow('discord');
export const discordAuthCallback = handleOAuthCallback('discord');
