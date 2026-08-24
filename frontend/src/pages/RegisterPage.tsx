import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { SignUp, useAuth as useClerkAuth } from '@clerk/clerk-react';
import { useAuth } from '../hooks/useAuth';

export const RegisterPage: React.FC = () => {
  const { isAuthenticated, isInitializing, register, isLoading, error } = useAuth();
  const navigate = useNavigate();

  let clerkLoaded = false;
  let clerkSignedIn = false;
  try {
    const clerkAuth = useClerkAuth();
    clerkLoaded = clerkAuth.isLoaded;
    clerkSignedIn = Boolean(clerkAuth.isSignedIn);
  } catch {
    clerkLoaded = true;
    clerkSignedIn = false;
  }

  const isClerkConfigured = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [useLocalAuth, setUseLocalAuth] = useState(false);

  useEffect(() => {
    if (isAuthenticated || (isClerkConfigured && clerkLoaded && clerkSignedIn)) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, clerkLoaded, clerkSignedIn, isClerkConfigured, navigate]);

  const handleStandardRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) return;
    const success = await register({ name: name.trim(), email: email.trim(), password });
    if (success) {
      navigate('/', { replace: true });
    }
  };

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      {/* Brand Logo */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 font-bold text-xl mb-3 border border-indigo-500/30 shadow-lg shadow-indigo-600/20">
          ♪
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-wide">HarmonyAI</h1>
        <p className="text-xs text-slate-400 mt-1">Create your personalized music account</p>
      </div>

      {isClerkConfigured && !useLocalAuth ? (
        <div className="w-full max-w-md space-y-4">
          <SignUp
            appearance={{
              elements: {
                rootBox: 'w-full max-w-md',
                card: 'bg-slate-900 border border-slate-800 shadow-2xl text-white rounded-2xl',
                headerTitle: 'text-white font-bold',
                headerSubtitle: 'text-slate-400',
                socialButtonsBlockButton: 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700',
                socialButtonsBlockButtonText: 'text-white font-medium',
                dividerLine: 'bg-slate-800',
                dividerText: 'text-slate-500',
                formButtonPrimary: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30',
                formFieldLabel: 'text-slate-300',
                formFieldInput: 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500',
                footerActionText: 'text-slate-400',
                footerActionLink: 'text-indigo-400 hover:text-indigo-300',
              },
            }}
            routing="path"
            path="/register"
            signInUrl="/login"
            fallbackRedirectUrl="/"
          />

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => setUseLocalAuth(true)}
              className="text-xs text-slate-400 hover:text-indigo-400 transition-colors underline"
            >
              Or create an account with email & password
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-bold text-white">Create Account</h2>
            <p className="text-xs text-slate-400 mt-1">Join HarmonyAI today</p>
          </div>

          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-rose-300 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleStandardRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Mercer"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="•••••••• (min 6 characters)"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-600"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-600/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <span>Create Account</span>
              )}
            </button>
          </form>

          {isClerkConfigured && (
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setUseLocalAuth(false)}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors underline"
              >
                ← Back to Clerk Auth
              </button>
            </div>
          )}

          <div className="text-center text-xs text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-semibold">
              Sign in
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
