import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Compass, Search, Library, Menu } from 'lucide-react';

interface MobileBottomNavProps {
  onOpenMenu: () => void;
}

interface TabItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  end?: boolean;
}

const tabs: TabItem[] = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/discover', label: 'Discover', icon: Compass },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/library', label: 'Library', icon: Library },
];

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onOpenMenu }) => {
  const location = useLocation();

  // Check if current route is under library or playlists/liked-songs
  const isLibraryActive =
    location.pathname === '/library' ||
    location.pathname === '/playlists' ||
    location.pathname === '/liked-songs' ||
    location.pathname === '/history';

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-16 bg-surface-1/95 backdrop-blur-xl border-t border-border-subtle/80 flex items-center justify-around px-2 pb-safe select-none shadow-[0_-4px_20px_rgba(0,0,0,0.35)]"
    >
      {tabs.map((tab) => {
        const isSelected = tab.to === '/library' ? isLibraryActive : undefined;
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => {
              const active = isSelected !== undefined ? isSelected : isActive;
              return `flex flex-col items-center justify-center flex-1 py-1 gap-1 text-[11px] font-medium transition-colors cursor-pointer active:scale-95 ${
                active ? 'text-accent font-semibold' : 'text-text-tertiary hover:text-text-secondary'
              }`;
            }}
          >
            {({ isActive }) => {
              const active = isSelected !== undefined ? isSelected : isActive;
              return (
                <>
                  <div className="relative flex items-center justify-center">
                    <tab.icon
                      size={20}
                      strokeWidth={active ? 2.2 : 1.75}
                      className={active ? 'text-accent' : ''}
                    />
                    {active && (
                      <span className="absolute -bottom-1 w-1 h-1 bg-accent rounded-full shadow-[0_0_6px_var(--accent)]" />
                    )}
                  </div>
                  <span className="truncate">{tab.label}</span>
                </>
              );
            }}
          </NavLink>
        );
      })}

      {/* Menu / Drawer Toggle */}
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open More Menu"
        className="flex flex-col items-center justify-center flex-1 py-1 gap-1 text-[11px] font-medium text-text-tertiary hover:text-text-secondary active:scale-95 transition-colors cursor-pointer"
      >
        <div className="relative flex items-center justify-center">
          <Menu size={20} strokeWidth={1.75} />
        </div>
        <span className="truncate">Menu</span>
      </button>
    </nav>
  );
};
