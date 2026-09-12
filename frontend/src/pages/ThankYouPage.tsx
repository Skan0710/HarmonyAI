import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Seo } from '../components/Seo';
import { PublicFooter } from '../components/PublicFooter';
import { Button } from '../components/ui/Button';

export const ThankYouPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-surface-0 flex flex-col items-center justify-center p-4">
      <Seo
        title="Welcome to HarmonyAI"
        description="Your HarmonyAI account is ready. Start listening to get personalized recommendations built from your own Music DNA."
        path="/thank-you"
        noIndex
      />

      <div className="w-full max-w-md text-center bg-surface-1 border border-border-subtle rounded-[var(--radius-lg)] p-8 sm:p-10 space-y-5">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent-wash text-accent">
          <CheckCircle2 size={28} strokeWidth={1.75} />
        </div>

        <div className="space-y-2">
          <h1 className="font-display text-2xl sm:text-3xl text-text-primary tracking-tight">
            Thanks for joining HarmonyAI
          </h1>
          <p className="text-sm text-text-tertiary leading-relaxed">
            Your account is set up. The more you listen, the sharper your recommendations get — let's get your
            first Music DNA snapshot started.
          </p>
        </div>

        <Button className="w-full" onClick={() => navigate('/')}>
          Enter HarmonyAI
        </Button>
      </div>

      <PublicFooter />
    </div>
  );
};
