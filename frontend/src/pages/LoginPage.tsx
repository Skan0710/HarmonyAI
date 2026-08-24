import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SignIn, useAuth as useClerkAuth } from '@clerk/clerk-react';
import { useAuth } from '../hooks/useAuth';

export const LoginPage: React.FC = () => {
  const { isAuthenticated, isInitializing } = useAuth();
  const { isSignedIn, isLoaded } = useClerkAuth();
  const navigate = useNavigate();

  const isClerkConfigured = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

  useEffect(() => {
    if (!isInitializing && (isAuthenticated || (isClerkConfigured && isLoaded && isSignedIn))) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, isInitializing, isSignedIn, isLoaded, isClerkConfigured, navigate]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {isClerkConfigured ? (
        <SignIn
          appearance={{
            elements: {
              rootBox: 'w-full max-w-md',
              card: 'bg-slate-900 border border-slate-800 shadow-2xl text-white',
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
          path="/login"
          signUpUrl="/register"
          fallbackRedirectUrl="/"
        />
      ) : (
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600/20 text-indigo-400 font-bold text-xl mb-3 border border-indigo-500/30">
              H
            </div>
            <h1 className="text-2xl font-bold text-white tracking-wide">HarmonyAI</h1>
            <p className="text-sm text-slate-400 mt-1">Sign in to your account</p>
          </div>
        </div>
      )}
    </div>
  );
};
