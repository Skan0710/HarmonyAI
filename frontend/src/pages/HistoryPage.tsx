import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchListeningHistoryApi } from '../services/historyService';
import type { HistoryItem } from '../services/historyService';
import { usePlayerStore } from '../store/usePlayerStore';
import { Breadcrumbs } from '../components/Breadcrumbs';
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
    if (typeof artist === 'object' && 'name' in artist) {
      return artist.name;
    }
    return String(artist);
  };

  const getAlbumTitle = (album: any): string => {
    if (!album) return 'Single';
    if (typeof album === 'object' && 'title' in album) {
      return album.title;
    }
    return String(album);
  };

  const fallbackCover =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23818cf8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="background:%231e293b;"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';

  return (
    <div className="space-y-8 pb-16">
      {/* Breadcrumbs Navigation */}
      <Breadcrumbs items={[{ label: 'Listening History' }]} />

      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 border border-indigo-500/20 p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-end gap-6">
          <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl bg-gradient-to-br from-indigo-600 to-slate-800 flex items-center justify-center shadow-xl shadow-indigo-600/30 shrink-0 border border-indigo-400/30">
            <svg className="w-14 h-14 sm:w-16 sm:h-16 text-indigo-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <div className="flex-1 text-center sm:text-left space-y-2">
            <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wider rounded-full border border-indigo-500/30">
              Activity History
            </span>
            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">Listening History</h1>
            <p className="text-slate-300 text-sm sm:text-base">
              Tracks you've recently played on HarmonyAI, ordered by newest first.
            </p>
          </div>

          {history.length > 0 && (
            <button
              onClick={handlePlayAll}
              className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm sm:text-base rounded-2xl shadow-xl shadow-indigo-600/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-2.5 shrink-0"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span>Replay All</span>
            </button>
          )}
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 bg-slate-800/60 rounded-xl w-full" />
          ))}
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="p-6 bg-slate-800/60 border border-rose-500/30 rounded-2xl text-center max-w-lg mx-auto">
          <p className="text-rose-400 font-medium text-sm">{error}</p>
        </div>
      )}

      {/* Empty History State */}
      {!loading && !error && history.length === 0 && (
        <div className="py-16 text-center max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 rounded-full bg-slate-800/80 border border-slate-700/60 text-indigo-400 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-200">No Listening History Yet</h3>
          <p className="text-slate-400 text-xs">
            Start playing tracks from the Music Library or Home page to build your listening log.
          </p>
        </div>
      )}

      {/* History Track List (Sorted Newest First) */}
      {!loading && !error && history.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-2">
          <div className="hidden sm:grid grid-cols-12 text-xs font-semibold text-slate-400 px-4 py-2 border-b border-slate-800 uppercase tracking-wider">
            <span className="col-span-1">#</span>
            <span className="col-span-5">Title</span>
            <span className="col-span-3">Album</span>
            <span className="col-span-2 text-right">Played</span>
            <span className="col-span-1 text-right">Duration</span>
          </div>

          {history.map((item, idx) => {
            const song = item.song;
            if (!song) return null;

            return (
              <div
                key={item._id || idx}
                onClick={() => handlePlayItem(item)}
                className="group cursor-pointer rounded-xl p-3 sm:px-4 sm:py-3 bg-slate-800/40 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700/80 transition-all flex sm:grid sm:grid-cols-12 items-center justify-between gap-3"
              >
                {/* Index */}
                <span className="hidden sm:inline col-span-1 text-xs font-mono text-slate-500 group-hover:text-indigo-400">
                  {idx + 1}
                </span>

                {/* Song Cover & Title */}
                <div className="col-span-5 flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-800 shrink-0 border border-slate-700/60 relative">
                    <img
                      src={song.coverImage || fallbackCover}
                      alt={song.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <span className="text-white text-xs font-bold">▶</span>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <h4
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/songs/${song._id}`);
                      }}
                      className="text-xs sm:text-sm font-semibold text-slate-200 group-hover:text-indigo-300 truncate hover:underline"
                    >
                      {song.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 truncate">{getArtistName(song.artist)}</p>
                  </div>
                </div>

                {/* Album Title */}
                <div className="hidden sm:block col-span-3 text-xs text-slate-400 truncate">
                  {getAlbumTitle(song.album)}
                </div>

                {/* Relative Timestamp */}
                <div className="col-span-2 text-right text-xs font-mono text-indigo-400/90 font-medium">
                  {formatRelativeTime(item.playedAt)}
                </div>

                {/* Duration */}
                <div className="hidden sm:block col-span-1 text-right text-xs font-mono text-slate-400">
                  {formatTime(song.duration)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
