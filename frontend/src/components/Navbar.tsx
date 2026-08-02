import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { Link, useNavigate } from 'react-router-dom';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="h-16 bg-slate-900 text-white flex items-center justify-between px-6 border-b border-slate-800 shadow-sm">
      <div className="flex items-center gap-3">
        <Link to="/" className="font-bold text-xl tracking-wide text-white hover:text-indigo-400 transition-colors flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-black text-sm">H</span>
          <span>HarmonyAI</span>
        </Link>
      </div>

      <div className="flex items-center gap-4 text-sm">
        {isAuthenticated && user ? (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5 bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700/60">
              <div className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                {getInitials(user.name)}
              </div>
              <span className="text-slate-200 font-medium text-xs">
                {user.name}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-red-900/60 text-slate-300 hover:text-red-200 rounded-lg text-xs font-medium border border-slate-700/80 hover:border-red-700/60 transition-colors flex items-center gap-1.5"
              title="Sign Out"
            >
              <span>Sign Out</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="px-3.5 py-1.5 text-slate-300 hover:text-white text-xs font-medium transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
            >
              Register
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};
