// Minimal, dependency-free OAuth2 authorization-code flow for the two
// "Sign in with ..." providers. Deliberately not using passport — the app
// only needs "redirect, exchange code, fetch profile", and passport's
// strategy abstraction adds more surface than that warrants here.

export type OAuthProvider = 'google' | 'discord';

export interface OAuthProfile {
  providerId: string;
  email: string | null;
  name: string;
  profilePicture?: string;
}

interface ProviderConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
}

function getProviderConfig(provider: OAuthProvider): ProviderConfig | null {
  if (provider === 'google') {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_CALLBACK_URL;
    if (!clientId || !clientSecret || !redirectUri) return null;
    return {
      clientId,
      clientSecret,
      redirectUri,
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scope: 'openid email profile',
    };
  }

  if (provider === 'discord') {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    const redirectUri = process.env.DISCORD_CALLBACK_URL;
    if (!clientId || !clientSecret || !redirectUri) return null;
    return {
      clientId,
      clientSecret,
      redirectUri,
      authorizeUrl: 'https://discord.com/oauth2/authorize',
      tokenUrl: 'https://discord.com/api/oauth2/token',
      scope: 'identify email',
    };
  }

  return null;
}

export function isOAuthProviderConfigured(provider: OAuthProvider): boolean {
  return getProviderConfig(provider) !== null;
}

export function buildAuthorizationUrl(provider: OAuthProvider, state: string): string | null {
  const config = getProviderConfig(provider);
  if (!config) return null;

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.scope,
    state,
  });

  if (provider === 'google') {
    // Only ever need to look the account up again by ID/email — no
    // incremental scopes, no offline access, so skip refresh tokens.
    params.set('access_type', 'online');
    params.set('prompt', 'select_account');
  }

  return `${config.authorizeUrl}?${params.toString()}`;
}

async function exchangeCodeForToken(provider: OAuthProvider, code: string): Promise<string | null> {
  const config = getProviderConfig(provider);
  if (!config) return null;

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: config.redirectUri,
  });

  try {
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body,
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { access_token?: string };
    return data.access_token || null;
  } catch {
    return null;
  }
}

async function fetchGoogleProfile(accessToken: string): Promise<OAuthProfile | null> {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      sub: string;
      email?: string;
      name?: string;
      picture?: string;
    };
    return {
      providerId: data.sub,
      email: data.email || null,
      name: data.name || 'Google User',
      profilePicture: data.picture,
    };
  } catch {
    return null;
  }
}

async function fetchDiscordProfile(accessToken: string): Promise<OAuthProfile | null> {
  try {
    const response = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      id: string;
      email?: string;
      username?: string;
      global_name?: string;
      avatar?: string;
    };
    const avatarUrl = data.avatar
      ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png`
      : undefined;
    return {
      providerId: data.id,
      email: data.email || null,
      name: data.global_name || data.username || 'Discord User',
      profilePicture: avatarUrl,
    };
  } catch {
    return null;
  }
}

export async function resolveOAuthProfile(provider: OAuthProvider, code: string): Promise<OAuthProfile | null> {
  const accessToken = await exchangeCodeForToken(provider, code);
  if (!accessToken) return null;

  return provider === 'google' ? fetchGoogleProfile(accessToken) : fetchDiscordProfile(accessToken);
}
