import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Play } from 'lucide-react';
import { fetchListeningHistoryApi } from '../services/historyService';
import type { HistoryItem } from '../services/historyService';
import { usePlayerStore } from '../store/usePlayerStore';
import { Button } from '../components/ui/Button';
import { formatTime } from '../utils/formatters';

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const playSong = usePlayerStore((state) => state.playSong);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);

    const { history: data, error: err } = await fetchListeningHistoryApi(50);

    if (err) {
      setError(err);
    } else if (data) {
      setHistory(data);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadHistory();
    const handleUpdate = () => {
      fetchListeningHistoryApi(50).then(({ history: data }) => {
        if (data) setHistory(data);
      });
    };
    window.addEventListener('harmony_history_updated', handleUpdate);
    return () => window.removeEventListener('harmony_history_updated', handleUpdate);
  }, []);

  const formatRelativeTime = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffSecs = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (diffSecs < 60) return 'Just now';
      if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
      if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
      if (diffSecs < 172800) return 'Yesterday';
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const handlePlayItem = (item: HistoryItem) => {
    if (!item.song) return;
    const songsQueue = history.map((h) => h.song).filter(Boolean);
    playSong(item.song, songsQueue);
  };

  const handlePlayAll = () => {
    const songsQueue = history.map((h) => h.song).filter(Boolean);
    if (songsQueue.length > 0) {
      playSong(songsQueue[0], songsQueue);
    }
  };

  const getArtistName = (artist: any): string => {
    if (!artist) return 'Unknown Artist';
    if (typeof artist === 'object' && 'name' in artist) return artist.name;
    return String(artist);
  };

  const getAlbumTitle = (album: any): string => {
    if (!album) return 'Single';
    if (typeof album === 'object' && 'title' in album) return album.title;
    return String(album);
  };

  const fallbackCover =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23d9a15b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="background:%231b1815;"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';

  return (
    <div className="pb-16">
      <section className="border-b border-border-subtle px-5 sm:px-8 lg:px-12 pt-10 pb-8 flex items-end justify-between gap-6 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-[var(--radius-md)] bg-surface-1 text-text-tertiary flex items-center justify-center shrink-0">
            <History size={22} strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-xs font-medium text-text-tertiary uppercase tracking-[0.14em]">Activity</p>
            <h1 className="font-display text-2xl sm:text-3xl text-text-primary leading-snug">Listening History</h1>
          </div>
        </div>

        {history.length > 0 && (
          <Button onClick={handlePlayAll}>
            <Play size={14} fill="currentColor" />
            Replay all
          </Button>
        )}
      </section>

      <div className="px-5 sm:px-8 lg:px-12 pt-8">
        {loading && (
          <div className="space-y-2 animate-pulse">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-14 bg-surface-1 rounded-[var(--radius-md)] w-full" />
            ))}
          </div>
        )}

        {error && !loading && (
          <div className="p-6 bg-danger-wash rounded-[var(--radius-md)] text-center max-w-lg">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && history.length === 0 && (
          <div className="py-16 text-center max-w-md mx-auto space-y-2">
            <History size={28} className="text-text-tertiary mx-auto" strokeWidth={1.5} />
            <h3 className="font-display text-lg text-text-primary">Nothing played yet</h3>
            <p className="text-text-tertiary text-sm">
              Tracks you play will show up here, newest first.
            </p>
          </div>
        )}

        {!loading && !error && history.length > 0 && (
          <div className="max-w-4xl">
            <div className="hidden sm:grid grid-cols-12 text-2xs font-semibold text-text-tertiary uppercase tracking-wide px-2 py-2 border-b border-border-subtle">
              <span className="col-span-1">#</span>
              <span className="col-span-5">Title</span>
              <span className="col-span-3">Album</span>
              <span className="col-span-2 text-right">Played</span>
              <span className="col-span-1 text-right">Duration</span>
            </div>

            <div className="divide-y divide-border-subtle">
              {history.map((item, idx) => {
                const song = item.song;
                if (!song) return null;

                return (
                  <div
                    key={item._id || idx}
                    onClick={() => handlePlayItem(item)}
                    className="group cursor-pointer px-2 py-3 hover:bg-surface-2 rounded-[var(--radius-sm)] transition-colors flex sm:grid sm:grid-cols-12 items-center justify-between gap-3"
                  >
                    <span className="hidden sm:inline col-span-1 text-2xs font-mono text-text-tertiary">
                      {idx + 1}
                    </span>

                    <div className="col-span-5 flex items-center gap-3 min-w-0">
                      <div className="relative w-10 h-10 rounded-[var(--radius-artwork)] overflow-hidden bg-surface-2 shrink-0">
                        <img src={song.coverImage || fallbackCover} alt={song.title} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-surface-0/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Play size={13} className="text-text-primary" fill="currentColor" strokeWidth={0} />
                        </div>
                      </div>

                      <div className="min-w-0">
                        <h4
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/songs/${song._id}`);
                          }}
                          className="text-sm font-medium text-text-primary truncate hover:text-accent transition-colors"
                        >
                          {song.title}
                        </h4>
                        <p className="text-xs text-text-tertiary truncate mt-0.5">{getArtistName(song.artist)}</p>
                      </div>
                    </div>

                    <div className="hidden sm:block col-span-3 text-xs text-text-tertiary truncate">
                      {getAlbumTitle(song.album)}
                    </div>

                    <div className="col-span-2 text-right text-2xs font-mono text-text-tertiary">
                      {formatRelativeTime(item.playedAt)}
                    </div>

                    <div className="hidden sm:block col-span-1 text-right text-2xs font-mono text-text-tertiary">
                      {formatTime(song.duration)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
