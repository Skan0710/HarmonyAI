import React from 'react';
import { NavLink } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { LineHoverText } from './ui/line-hover-link';
import {
  Home,
  Compass,
  Search,
  LayoutGrid,
  Library,
  ListMusic,
  Heart,
  History,
  Wand2,
  Sparkles,
  SlidersHorizontal,
  Fingerprint,
  Sparkle,
  History as HistoryIcon,
  X,
} from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  end?: boolean;
  tag?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    title: 'Listen',
    items: [
      { to: '/', label: 'Home', icon: Home, end: true },
      { to: '/discover', label: 'Discover', icon: Compass },
      { to: '/search', label: 'Search', icon: Search },
      { to: '/genres', label: 'Browse Genres', icon: LayoutGrid },
    ],
  },
  {
    title: 'Your Sound',
    items: [
      { to: '/music-dna', label: 'Music DNA', icon: Fingerprint },
      { to: '/music-twin', label: 'Music Twin', icon: Sparkle },
      { to: '/taste-evolution', label: 'Taste Evolution', icon: HistoryIcon },
    ],
  },
  {
    title: 'Your Library',
    items: [
      { to: '/library', label: 'Music Library', icon: Library },
      { to: '/playlists', label: 'Playlists', icon: ListMusic },
      { to: '/liked-songs', label: 'Liked Songs', icon: Heart },
      { to: '/history', label: 'Listening History', icon: History },
    ],
  },
  {
    title: 'Create',
    items: [
      { to: '/ai-playlist', label: 'AI Playlist Generator', icon: Wand2 },
      { to: '/assistant', label: 'AI Assistant', icon: Sparkles },
    ],
  },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

const SidebarContent: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => (
  <>
    <nav className="flex-1 overflow-y-auto px-3 pb-4" onClick={onNavigate}>
        {sections.map((section) => (
          <div key={section.title} className="mb-6">
            <p className="px-3 mb-2 text-2xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
              {section.title}
            </p>
            <div className="flex flex-col gap-0.5">
              {section.items.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `group relative flex items-center gap-3.5 pl-3.5 pr-3 py-2.5 rounded-[var(--radius-sm)] text-[15px] transition-colors duration-[var(--duration-fast)] ${
                      isActive
                        ? 'bg-accent-wash text-text-primary'
                        : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full transition-colors duration-[var(--duration-fast)] ${
                          isActive ? 'bg-accent' : 'bg-transparent'
                        }`}
                      />
                      <Icon size={18} strokeWidth={1.75} />
                      <span className="flex-1 min-w-0">
                        <LineHoverText variant="slide" className="font-medium">
                          {label}
                        </LineHoverText>
                      </span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

    <div className="px-3 pb-5 pt-2 border-t border-border-subtle">
      <NavLink
        to="/preferences"
        className={({ isActive }) =>
          `flex items-center gap-3.5 pl-3.5 pr-3 py-2.5 text-[15px] font-medium rounded-[var(--radius-sm)] transition-colors duration-[var(--duration-fast)] ${
            isActive ? 'text-text-primary bg-accent-wash' : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'
          }`
        }
      >
        <SlidersHorizontal size={18} strokeWidth={1.75} />
        Preferences
      </NavLink>
    </div>
  </>
);

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen = false, onClose }) => {
  return (
    <>
      <aside className="hidden md:flex w-60 shrink-0 flex-col bg-surface-1 bg-[radial-gradient(circle_420px_at_15%_-5%,rgba(255,106,67,0.16),transparent),radial-gradient(circle_360px_at_100%_100%,rgba(217,161,91,0.12),transparent)] border-r border-border-subtle pt-5">
        <SidebarContent />
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={onClose}
              className="md:hidden fixed inset-0 z-40 bg-black/60"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 flex flex-col bg-surface-1 bg-[radial-gradient(circle_420px_at_15%_-5%,rgba(255,106,67,0.16),transparent),radial-gradient(circle_360px_at_100%_100%,rgba(217,161,91,0.12),transparent)] border-r border-border-subtle"
            >
              <div className="px-6 pt-6 pb-6 flex items-center justify-between">
                <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">Navigation</p>
                <button
                  onClick={onClose}
                  aria-label="Close navigation"
                  className="p-1.5 text-text-secondary hover:text-text-primary cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
              <SidebarContent onNavigate={onClose} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
