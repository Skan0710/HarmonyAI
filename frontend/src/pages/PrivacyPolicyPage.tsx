import React from 'react';
import { AudioLines } from 'lucide-react';
import { Seo } from '../components/Seo';
import { PublicFooter } from '../components/PublicFooter';
import { Breadcrumbs } from '../components/Breadcrumbs';

const SECTIONS: { heading: string; body: string }[] = [
  {
    heading: 'What we collect',
    body: 'When you create a HarmonyAI account we store your name, email address, and a securely hashed password. As you use the app we record your listening activity — plays, skips, likes, and playlists — to build your Music DNA profile and generate recommendations.',
  },
  {
    heading: 'How we use your data',
    body: 'Your listening history and preferences are used only to personalize recommendations, playlists, and the Music DNA / Music Twin features inside your own account. We never sell your personal data to third parties.',
  },
  {
    heading: 'Cookies & sessions',
    body: 'HarmonyAI uses a single, secure, HTTP-only session cookie to keep you signed in. It cannot be read by JavaScript and is cleared immediately when you log out.',
  },
  {
    heading: 'Data retention & deletion',
    body: 'Your data is retained for as long as your account is active. You can request deletion of your account and all associated listening history at any time by contacting support.',
  },
  {
    heading: 'Contact',
    body: 'Questions about this policy or your data can be sent to our support team — we respond to every request within 24 hours.',
  },
];

export const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-surface-0 flex flex-col items-center p-4 pt-10">
      <Seo
        title="Privacy Policy"
        description="Learn what data HarmonyAI collects, how it's used to power your Music DNA and recommendations, and how to request deletion of your account."
        path="/privacy-policy"
      />

      <div className="w-full max-w-2xl">
        <Breadcrumbs items={[{ label: 'Privacy Policy' }]} />

        <div className="text-center mb-7 mt-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent-wash text-accent mb-4">
            <AudioLines size={22} strokeWidth={1.75} />
          </div>
          <h1 className="font-display italic text-3xl text-text-primary tracking-tight">
            Privacy <span className="text-accent not-italic">Policy</span>
          </h1>
          <p className="text-xs text-text-tertiary mt-2">Last updated September 2026</p>
        </div>

        <div className="bg-surface-1 border border-border-subtle rounded-[var(--radius-lg)] p-6 sm:p-8 space-y-6">
          {SECTIONS.map((section) => (
            <div key={section.heading}>
              <h2 className="text-sm font-semibold text-text-primary mb-1.5">{section.heading}</h2>
              <p className="text-sm text-text-tertiary leading-relaxed">{section.body}</p>
            </div>
          ))}
        </div>
      </div>

      <PublicFooter />
    </div>
  );
};
