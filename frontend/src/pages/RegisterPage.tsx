import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AudioLines } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { AnimatedLink } from '../components/ui/AnimatedLink';
import { Seo } from '../components/Seo';
import { PublicFooter } from '../components/PublicFooter';
import { Testimonials } from '../components/Testimonials';

export const RegisterPage: React.FC = () => {
  const { isAuthenticated, isInitializing, register, isLoading, error } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [justRegistered, setJustRegistered] = useState(false);

  useEffect(() => {
    if (isAuthenticated && !justRegistered) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, justRegistered, navigate]);

  const handleStandardRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) return;
    const success = await register({ name: name.trim(), email: email.trim(), password });
    if (success) {
      setJustRegistered(true);
      navigate('/thank-you', { replace: true });
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
    <div className="min-h-screen bg-surface-0 flex flex-col items-center justify-center p-4">
      <Seo
        title="Create Your Free Account"
        description="Create a free HarmonyAI account to get AI-generated playlists and recommendations built from your own Music DNA."
        path="/register"
      />
      <div className="text-center mb-7">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent-wash text-accent mb-4">
          <AudioLines size={22} strokeWidth={1.75} />
        </div>
        <h1 className="font-display italic text-3xl text-text-primary tracking-tight">
          Harmony<span className="text-accent not-italic">AI</span>
        </h1>
        <p className="text-xs text-text-tertiary mt-2">Create your personalized music account</p>
      </div>

      <div className="w-full max-w-md bg-surface-1 border border-border-subtle rounded-[var(--radius-lg)] p-6 sm:p-8 space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-text-primary font-body">Create account</h2>
          <p className="text-xs text-text-tertiary mt-1">Join HarmonyAI today</p>
        </div>

        {error && (
          <div className="p-3 bg-danger-wash rounded-[var(--radius-sm)] text-danger text-xs">{error}</div>
        )}

        <form onSubmit={handleStandardRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex Mercer"
              autoComplete="name"
              className="w-full px-3.5 py-2.5 bg-surface-2 border border-transparent rounded-[var(--radius-sm)] text-text-primary text-sm focus:outline-none focus:border-border-strong placeholder-text-tertiary transition-colors"
            />
          </div>

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
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="•••••••• (min 6 characters)"
              autoComplete="new-password"
              className="w-full px-3.5 py-2.5 bg-surface-2 border border-transparent rounded-[var(--radius-sm)] text-text-primary text-sm focus:outline-none focus:border-border-strong placeholder-text-tertiary transition-colors"
            />
          </div>

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-text-on-accent/30 border-t-text-on-accent rounded-full animate-spin" />
                <span>Creating Account…</span>
              </>
            ) : (
              <span>Create Account</span>
            )}
          </Button>
        </form>

        <div className="text-center text-xs text-text-tertiary">
          Already have an account?{' '}
          <AnimatedLink to="/login" showArrow={false} className="text-accent hover:text-accent-strong font-medium">
            Sign in
          </AnimatedLink>
        </div>
      </div>

      <Testimonials />

      <PublicFooter />
    </div>
  );
};
