import React from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { Link } from 'react-router-dom';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuthStore();

  return (
    <header className="h-16 bg-slate-900 text-white flex items-center justify-between px-6 border-b border-slate-800">
      <div className="flex items-center gap-3">
        <Link to="/" className="font-bold text-xl tracking-wide hover:text-indigo-400 transition-colors">
          HarmonyAI
        </Link>
      </div>

      <div className="flex items-center gap-4 text-sm">
        {isAuthenticated && user ? (
          <div className="flex items-center gap-4">
            <span className="text-slate-300 font-medium">
              Hello, <span className="text-white">{user.name}</span>
            </span>
            <button
              onClick={logout}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-md text-xs font-medium border border-slate-700 transition-colors"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="px-3 py-1.5 text-slate-300 hover:text-white text-xs font-medium transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-medium transition-colors"
            >
              Register
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};
