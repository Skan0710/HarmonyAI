import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, Search, LogOut, Command } from 'lucide-react';
import { searchGlobal } from '../services/searchService';
import type { GroupedSearchResults } from '../services/searchService';
import { SearchSuggestionsDropdown } from './SearchSuggestionsDropdown';
import { useRecentSearchesStore } from '../store/useRecentSearchesStore';
import { Button } from './ui/Button';
import { Wordmark } from './Wordmark';
import { useCommandPaletteStore } from '../store/useCommandPaletteStore';

interface NavbarProps {
  onMenuClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onMenuClick }) => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isSearchPage = location.pathname === '/search';
  const addSearch = useRecentSearchesStore((state) => state.addSearch);
  const openCommandPalette = useCommandPaletteStore((state) => state.open);

  const [navSearch, setNavSearch] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<GroupedSearchResults | null>(null);
  const [loading, setLoading] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement | null>(null);

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
    <header className="h-16 bg-surface-1/90 backdrop-blur-md border-b border-border-subtle flex items-center gap-3 px-4 sm:px-6 sticky top-0 z-30">
      <button
        onClick={onMenuClick}
        aria-label="Open navigation"
        className="md:hidden p-1.5 -ml-1 text-text-secondary hover:text-text-primary cursor-pointer"
      >
        <Menu size={20} />
      </button>

      <Wordmark className="text-lg shrink-0" />

      {isSearchPage ? (
        <div className="flex-1" />
      ) : (
        <div ref={searchContainerRef} className="relative flex-1 max-w-lg mx-auto">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search
              size={15}
              strokeWidth={1.75}
              className="text-text-tertiary absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            />
            <input
              type="text"
              value={navSearch}
              onChange={(e) => setNavSearch(e.target.value)}
              onFocus={() => setIsFocused(true)}
              placeholder="Search songs, artists, albums, or a mood…"
              className="w-full bg-surface-2 text-text-primary placeholder-text-tertiary pl-10 pr-4 py-2 rounded-[var(--radius-pill)] text-sm border border-transparent focus:outline-none focus:border-border-strong transition-colors duration-[var(--duration-fast)]"
            />
            {loading && (
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
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
      )}

      <div className="flex items-center gap-3 text-sm shrink-0">
        <button
          onClick={openCommandPalette}
          aria-label="Open command palette"
          title="Open command palette"
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-pill)] bg-surface-2 hover:bg-surface-3 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
        >
          <Command size={13} strokeWidth={1.75} />
          <kbd className="flex items-center gap-0.5 font-sans text-[11px] font-medium">
            <span className="leading-none">⌘</span>K
          </kbd>
        </button>

        {isAuthenticated && user ? (
          <div className="flex items-center gap-3">
            <Link
              to="/profile"
              className="hidden sm:flex items-center gap-2 px-2 py-1 -mx-2 -my-1 rounded-[var(--radius-pill)] hover:bg-surface-2 transition-colors cursor-pointer"
              title="View profile"
            >
              <div className="w-7 h-7 rounded-full bg-accent-wash text-accent text-xs font-semibold flex items-center justify-center">
                {getInitials(user.name)}
              </div>
              <span className="text-text-secondary font-medium text-xs">{user.name}</span>
            </Link>
            <button
              onClick={handleLogout}
              className="p-2 text-text-tertiary hover:text-danger transition-colors cursor-pointer"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut size={16} strokeWidth={1.75} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link to="/login" className="px-3 py-1.5 text-text-secondary hover:text-text-primary text-xs font-medium transition-colors">
              Sign In
            </Link>
            <Button size="sm" onClick={() => navigate('/register')}>
              Register
            </Button>
          </div>
        )}
      </div>
    </header>
  );
};
