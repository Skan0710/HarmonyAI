import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AudioLines, Zap } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { AnimatedLink } from '../components/ui/AnimatedLink';
import AnimatedButton from '../components/ui/animated-button';
import { Seo } from '../components/Seo';
import { PublicFooter } from '../components/PublicFooter';
import { StickyMobileCta } from '../components/StickyMobileCta';

export const LoginPage: React.FC = () => {
  const { isAuthenticated, isInitializing, login, isLoading, error } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleStandardLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    const success = await login({ email: email.trim(), password });
    if (success) {
      navigate('/', { replace: true });
    }
  };

  const handleDemoLogin = async () => {
    const demoEmail = 'demo@harmonyai.com';
    const demoPassword = 'password123';
    const success = await login({ email: demoEmail, password: demoPassword });
    if (success) {
      navigate('/', { replace: true });
    } else {
      setEmail(demoEmail);
      setPassword(demoPassword);
    }
  };

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-0 text-text-tertiary">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-0 flex flex-col items-center justify-center p-4 pb-20 sm:pb-4">
      <Seo
        title="Sign In"
        description="Sign in to HarmonyAI to pick up your personalized recommendations, playlists, and Music DNA profile."
        path="/login"
      />
      <div className="text-center mb-7">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent-wash text-accent mb-4">
          <AudioLines size={22} strokeWidth={1.75} />
        </div>
        <h1 className="font-display italic text-3xl text-text-primary tracking-tight">
          Harmony<span className="text-accent not-italic">AI</span>
        </h1>
        <p className="text-xs text-text-tertiary mt-2">Intelligent AI music discovery & personalization</p>
      </div>

      <div className="w-full max-w-md bg-surface-1 border border-border-subtle rounded-[var(--radius-lg)] p-6 sm:p-8 space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-text-primary font-body">Welcome back</h2>
          <p className="text-xs text-text-tertiary mt-1">Enter your credentials to continue</p>
        </div>

        {error && (
          <div className="p-3 bg-danger-wash rounded-[var(--radius-sm)] text-danger text-xs">{error}</div>
        )}

        <form onSubmit={handleStandardLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="w-full px-3.5 py-2.5 bg-surface-2 border border-transparent rounded-[var(--radius-sm)] text-text-primary text-sm focus:outline-none focus:border-border-strong placeholder-text-tertiary transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full px-3.5 py-2.5 bg-surface-2 border border-transparent rounded-[var(--radius-sm)] text-text-primary text-sm focus:outline-none focus:border-border-strong placeholder-text-tertiary transition-colors"
            />
          </div>

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-text-on-accent/30 border-t-text-on-accent rounded-full animate-spin" />
                <span>Signing in…</span>
              </>
            ) : (
              <span>Sign In</span>
            )}
          </Button>
        </form>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-border-subtle"></div>
          <span className="flex-shrink mx-3 text-text-tertiary text-2xs">OR</span>
          <div className="flex-grow border-t border-border-subtle"></div>
        </div>

        <AnimatedButton type="button" onClick={handleDemoLogin} disabled={isLoading} className="w-full">
          <Zap size={13} className="text-gold" />
          Quick Demo Login
        </AnimatedButton>

        <div className="text-center text-xs text-text-tertiary">
          Don't have an account?{' '}
          <AnimatedLink to="/register" showArrow={false} className="text-accent hover:text-accent-strong font-medium">
            Sign up
          </AnimatedLink>
        </div>
      </div>
      <PublicFooter />
      <StickyMobileCta />
    </div>
  );
};
