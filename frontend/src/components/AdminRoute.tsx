import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/**
 * Nests inside ProtectedRoute (auth is already guaranteed) and additionally
 * requires an admin role. The backend independently enforces this on the
 * actual data endpoints — this is a UI-layer guard so a non-admin never
 * lands on an admin page shell in the first place, rather than relying
 * solely on every future endpoint on that page remembering the same check.
 */
export const AdminRoute: React.FC = () => {
  const { user } = useAuth();

  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};
