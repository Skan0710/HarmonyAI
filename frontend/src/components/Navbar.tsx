import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Link, useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut, UserButton } from '@clerk/clerk-react';
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
      setNavSearch('');
      setIsFocused(false);
    }
  };

  const handleSelectRecent = (searchTerm: string) => {
    addSearch(searchTerm);
    navigate(`/search?q=${encodeURIComponent(searchTerm)}`);
    setNavSearch('');
    setIsFocused(false);
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
    <header className="h-16 bg-slate-900 text-white flex items-center justify-between px-4 sm:px-6 border-b border-slate-800 shadow-sm gap-4 relative z-40">
      {/* Brand Logo */}
      <div className="flex items-center gap-3 shrink-0">
        <Link to="/" className="font-bold text-xl tracking-wide text-white hover:text-indigo-400 transition-colors flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-black text-sm shadow-md shadow-indigo-600/50">H</span>
          <span className="hidden sm:inline">HarmonyAI</span>
        </Link>
      </div>

      {/* Global Navbar Quick Search Input with Live Suggestions */}
      <div ref={searchContainerRef} className="flex-1 max-w-xs sm:max-w-md relative">
        <form onSubmit={handleSearchSubmit}>
          <div className="relative flex items-center">
            <svg className="w-4 h-4 absolute left-3 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={navSearch}
              onChange={(e) => setNavSearch(e.target.value)}
              onFocus={() => setIsFocused(true)}
              placeholder="Search songs, artists..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-800/80 border border-slate-700/70 focus:border-indigo-500 rounded-full text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>
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

      {/* Right User Actions with Clerk Auth Controls */}
      <div className="flex items-center gap-4 text-sm shrink-0">
        <SignedIn>
          <div className="flex items-center gap-3">
            <UserButton
              appearance={{
                elements: {
                  userButtonAvatarBox: 'w-8 h-8 rounded-full ring-2 ring-indigo-500/50',
                },
              }}
            />
          </div>
        </SignedIn>

        <SignedOut>
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
        </SignedOut>
      </div>
    </header>
  );
};

