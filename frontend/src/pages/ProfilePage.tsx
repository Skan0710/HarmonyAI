import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, ListMusic, History, SlidersHorizontal, LogOut, Mail, CalendarDays } from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { AnimatedLink } from '../components/ui/AnimatedLink';
import { useAuth } from '../hooks/useAuth';
import { useLikedSongsStore } from '../store/useLikedSongsStore';
import { fetchUserPlaylistsApi } from '../services/playlistService';
import { fetchListeningHistoryApi } from '../services/historyService';

export const ProfilePage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const likedSongs = useLikedSongsStore((state) => state.likedSongs);

  const [playlistCount, setPlaylistCount] = useState<number | null>(null);
  const [historyCount, setHistoryCount] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const [{ playlists }, { history }] = await Promise.all([
        fetchUserPlaylistsApi(),
        fetchListeningHistoryApi(200),
      ]);
      setPlaylistCount(playlists ? playlists.length : 0);
      setHistoryCount(history ? history.length : 0);
    })();
  }, []);

  const handleSignOut = () => {
    logout();
    navigate('/login', { replace: true });
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

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  const stats = [
    { label: 'Liked Songs', value: likedSongs.length, icon: Heart, to: '/liked-songs' },
    { label: 'Playlists', value: playlistCount, icon: ListMusic, to: '/playlists' },
    { label: 'Songs Played', value: historyCount, icon: History, to: '/history' },
  ];

  if (!user) return null;

  return (
    <div className="space-y-8 pb-16">
      <Breadcrumbs items={[{ label: 'Profile' }]} />

      {/* Header Hero Banner */}
      <div className="relative overflow-hidden rounded-[var(--radius-lg)] bg-surface-1 border border-border-subtle p-6 sm:p-10">
        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-end gap-6">
          {user.profilePicture ? (
            <img
              src={user.profilePicture}
              alt={user.name}
              className="w-24 h-24 sm:w-32 sm:h-32 rounded-[var(--radius-lg)] object-cover shrink-0 border border-border-subtle"
            />
          ) : (
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-[var(--radius-lg)] bg-accent-wash text-accent flex items-center justify-center shrink-0 border border-accent/30">
              <span className="text-3xl sm:text-4xl font-semibold">{getInitials(user.name)}</span>
            </div>
          )}

          <div className="flex-1 text-center sm:text-left space-y-2">
            <span className="px-3 py-1 bg-accent-wash text-accent text-xs font-bold uppercase tracking-wider rounded-[var(--radius-pill)] border border-accent/30">
              Your Account
            </span>
            <h1 className="font-display text-3xl sm:text-5xl text-text-primary tracking-tight">{user.name}</h1>
            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-4 text-text-tertiary text-xs sm:text-sm">
              <span className="flex items-center gap-1.5">
                <Mail size={13} strokeWidth={1.75} />
                {user.email}
              </span>
              {memberSince && (
                <span className="flex items-center gap-1.5">
                  <CalendarDays size={13} strokeWidth={1.75} />
                  Member since {memberSince}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="shrink-0 px-4 py-2.5 bg-surface-2 hover:bg-danger-wash text-text-secondary hover:text-danger font-medium text-sm rounded-[var(--radius-pill)] transition-colors flex items-center gap-2 cursor-pointer"
          >
            <LogOut size={15} strokeWidth={1.75} />
            Sign Out
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="px-1">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {stats.map(({ label, value, icon: Icon, to }) => (
            <button
              key={label}
              onClick={() => navigate(to)}
              className="group text-left bg-surface-1 hover:bg-surface-2 border border-border-subtle rounded-[var(--radius-lg)] p-5 transition-colors cursor-pointer"
            >
              <div className="w-10 h-10 rounded-[var(--radius-md)] bg-accent-wash text-accent flex items-center justify-center mb-4">
                <Icon size={18} strokeWidth={1.75} />
              </div>
              <p className="font-display text-3xl text-text-primary tabular-nums">
                {value === null ? (
                  <span className="inline-block h-8 w-12 bg-surface-2 rounded animate-pulse align-middle" />
                ) : (
                  value
                )}
              </p>
              <p className="text-xs text-text-tertiary mt-1 font-medium group-hover:text-text-secondary transition-colors">
                {label}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Manage preferences */}
      <div className="px-1">
        <div className="bg-surface-1 border border-border-subtle rounded-[var(--radius-lg)] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-[var(--radius-md)] bg-gold-wash text-gold flex items-center justify-center shrink-0">
              <SlidersHorizontal size={18} strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Taste preferences</h3>
              <p className="text-xs text-text-tertiary mt-0.5">Manage your favorite artists and genres</p>
            </div>
          </div>
          <AnimatedLink to="/preferences" className="text-sm font-medium text-accent hover:text-accent-strong shrink-0">
            Open Preferences
          </AnimatedLink>
        </div>
      </div>
    </div>
  );
};
