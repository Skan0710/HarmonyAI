import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Link, useNavigate } from 'react-router-dom';
import { searchGlobal } from '../services/searchService';
import type { GroupedSearchResults } from '../services/searchService';
import { SearchSuggestionsDropdown } from './SearchSuggestionsDropdown';
import { useRecentSearchesStore } from '../store/useRecentSearchesStore';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const addSearch = useRecentSearchesStore((state) => state.addSearch);

  const [navSearch, setNavSearch] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<GroupedSearchResults | null>(null);
  const [loading, setLoading] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  // Debounced search suggestions while typing in navbar
  useEffect(() => {
    const trimmed = navSearch.trim();
    if (!trimmed) {
      setSuggestions(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const handler = setTimeout(async () => {
      const { results } = await searchGlobal(trimmed, 5);
      setSuggestions(results);
      setLoading(false);
    }, 300);

    return () => clearTimeout(handler);
  }, [navSearch]);

  // Click outside to dismiss dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (navSearch.trim()) {
      addSearch(navSearch.trim());
      navigate(`/search?q=${encodeURIComponent(navSearch.trim())}`);
      setIsFocused(false);
    }
  };

  const handleSelectRecent = (term: string) => {
    setNavSearch(term);
    addSearch(term);
    navigate(`/search?q=${encodeURIComponent(term)}`);
    setIsFocused(false);
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <header className="h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-6 sticky top-0 z-30">
      {/* Mobile Nav Toggle Button */}
      <div className="flex items-center gap-3">
        <span className="font-bold text-white tracking-wide text-lg md:hidden">HarmonyAI</span>
      </div>

      {/* Global Instant Search Bar */}
      <div ref={searchContainerRef} className="relative flex-1 max-w-lg mx-4">
        <form onSubmit={handleSearchSubmit} className="relative">
          <input
            type="text"
            value={navSearch}
            onChange={(e) => setNavSearch(e.target.value)}
            onFocus={() => setIsFocused(true)}
            placeholder="Search songs, artists, albums, or vibes..."
            className="w-full bg-slate-950/80 text-white placeholder-slate-500 pl-10 pr-4 py-2 rounded-full text-sm border border-slate-700/60 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-inner"
          />
          <svg
            className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          {loading && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          )}
        </form>

        {isFocused && (
          <SearchSuggestionsDropdown
            query={navSearch}
            suggestions={suggestions}
            loading={loading}
            onSelectSearch={handleSelectRecent}
            onClose={() => setIsFocused(false)}
          />
        )}
      </div>

      {/* Right User Actions */}
      <div className="flex items-center gap-4 text-sm shrink-0">
        {isAuthenticated && user ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700/60">
              <div className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                {getInitials(user.name)}
              </div>
              <span className="text-slate-200 font-medium text-xs hidden md:inline">
                {user.name}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-200 rounded-lg text-xs font-medium border border-slate-700/80 hover:border-rose-700/60 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Sign Out"
            >
              <span>Sign Out</span>
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
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
            >
              Register
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};
