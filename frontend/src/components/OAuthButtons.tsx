import React from 'react';
import { API_CONFIG } from '../config/api';

// OAuth needs a real full-page navigation (so the provider's own login page
// can render and redirect back with a code) — it can't go through the
// fetch-based apiClient like the rest of the app's requests.
const startOAuth = (provider: 'google' | 'discord') => {
  window.location.href = `${API_CONFIG.baseURL}/auth/${provider}`;
};

const GoogleIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
    <path
      fill="#FFC107"
      d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.5 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
    />
    <path
      fill="#FF3D00"
      d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.5 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
    />
    <path
      fill="#4CAF50"
      d="M24 44c5.5 0 10.5-2.1 14.3-5.6l-6.6-5.6C29.6 34.7 26.9 36 24 36c-5.2 0-9.6-3.3-11.2-7.9l-6.6 5.1C9.5 39.6 16.2 44 24 44z"
    />
    <path
      fill="#1976D2"
      d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.4l6.6 5.6C41.5 35.9 44 30.5 44 24c0-1.3-.1-2.7-.4-3.5z"
    />
  </svg>
);

const DiscordIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="#5865F2" aria-hidden="true">
    <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.927 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .079.009c.12.099.245.198.372.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.076.076 0 0 0-.04.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.003-3.03.077.077 0 0 0 .032-.055c.5-5.177-.838-9.673-3.548-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.955 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.946 2.419-2.157 2.419z" />
  </svg>
);

export const OAuthButtons: React.FC = () => (
  <div className="grid grid-cols-2 gap-3">
    <button
      type="button"
      onClick={() => startOAuth('google')}
      className="inline-flex items-center justify-center gap-2 h-10 px-3 bg-surface-2 hover:bg-surface-3 border border-border-subtle rounded-[var(--radius-sm)] text-text-primary text-sm font-medium transition-colors cursor-pointer"
    >
      <GoogleIcon />
      Google
    </button>
    <button
      type="button"
      onClick={() => startOAuth('discord')}
      className="inline-flex items-center justify-center gap-2 h-10 px-3 bg-surface-2 hover:bg-surface-3 border border-border-subtle rounded-[var(--radius-sm)] text-text-primary text-sm font-medium transition-colors cursor-pointer"
    >
      <DiscordIcon />
      Discord
    </button>
  </div>
);
