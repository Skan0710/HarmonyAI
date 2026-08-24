import React, { useState, useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAuth as useClerkAuth } from '@clerk/clerk-react';

export const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, isInitializing } = useAuth();
  const isClerkConfigured = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
  
  // Safe Clerk hook access
  let clerkLoaded = false;
  let clerkSignedIn = false;
  try {
    const clerkAuth = useClerkAuth();
    clerkLoaded = clerkAuth.isLoaded;
    clerkSignedIn = Boolean(clerkAuth.isSignedIn);
  } catch {
    // If ClerkProvider is not mounted or errored, treat as loaded without sign-in
    clerkLoaded = true;
    clerkSignedIn = false;
  }

  // Safety timeout: Never block on "Verifying authentication session..." for more than 1 second
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTimedOut(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // If already authenticated via standard JWT token, immediately proceed
  if (isAuthenticated) {
    return <Outlet />;
  }

  // If Clerk is signed in, immediately proceed
  if (isClerkConfigured && clerkLoaded && clerkSignedIn) {
    return <Outlet />;
  }

  // Only show loading while initializing and before timeout
  const isStillWaiting = (isInitializing || (isClerkConfigured && !clerkLoaded)) && !timedOut;

  if (isStillWaiting) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950 text-slate-400">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500 mx-auto mb-3"></div>
          <p className="text-sm font-medium">Verifying authentication session...</p>
        </div>
      </div>
    );
  }

  // Not authenticated -> redirect to login
  const authenticated = isAuthenticated || (isClerkConfigured && clerkSignedIn);

  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};
