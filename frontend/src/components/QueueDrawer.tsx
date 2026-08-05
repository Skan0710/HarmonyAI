import React from 'react';
import { usePlayer } from '../hooks/usePlayer';

export const QueueDrawer: React.FC = () => {
  const {
    currentSong,
    isPlaying,
    queue,
    queueIndex,
    isQueueOpen,
    setQueueOpen,
    playQueueIndex,
    removeFromQueue,
    clearQueue,
  } = usePlayer();

  if (!isQueueOpen) return null;

  const getArtistName = (artist: any): string => {
    if (!artist) return 'Unknown Artist';
    if (typeof artist === 'object' && 'name' in artist) {
      return artist.name;
    }
    return String(artist);
  };

  const formatDuration = (seconds: number): string => {
    if (!seconds || seconds <= 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const fallbackCover =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23818cf8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="background:%231e293b;"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';

  return (
    <>
      {/* Dimmed Overlay Backdrop */}
      <div
        onClick={() => setQueueOpen(false)}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity"
      />

      {/* Side Panel Drawer */}
      <aside className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-96 bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h10M4 18h10" />
            </svg>
            <div>
              <h3 className="font-bold text-slate-100 text-base">Playback Queue</h3>
              <p className="text-xs text-slate-400 mt-0.5">{queue.length} {queue.length === 1 ? 'song' : 'songs'} in queue</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {queue.length > 0 && (
              <button
                onClick={clearQueue}
                className="text-xs text-rose-400 hover:text-rose-300 font-semibold px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors"
                title="Clear entire queue"
              >
                Clear
              </button>
            )}

            <button
              onClick={() => setQueueOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors text-sm font-bold"
              aria-label="Close Queue Drawer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Queue Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 scrollbar-thin scrollbar-thumb-slate-700">
          {queue.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-400">Your queue is empty</p>
              <p className="text-xs text-slate-500 max-w-xs">
                Play a song or album from the catalog to build your queue.
              </p>
            </div>
          ) : (
            queue.map((song, idx) => {
              const isCurrent = idx === queueIndex || currentSong?._id === song._id;

              return (
                <div
                  key={`${song._id}-${idx}`}
                  onClick={() => playQueueIndex(idx)}
                  className={`group relative cursor-pointer rounded-xl p-2.5 transition-all flex items-center justify-between gap-3 border ${
                    isCurrent
                      ? 'bg-indigo-950/60 border-indigo-500/60 shadow-md shadow-indigo-950/40 ring-1 ring-indigo-500/30'
                      : 'bg-slate-800/40 hover:bg-slate-800/80 border-slate-800 hover:border-slate-700/80'
                  }`}
                >
                  {/* Left Metadata */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Index / Playing Equalizer Indicator */}
                    <div className="w-5 text-center text-xs font-mono text-slate-500 shrink-0">
                      {isCurrent ? (
                        isPlaying ? (
                          <div className="flex items-end justify-center gap-0.5 h-3">
                            <span className="w-1 bg-indigo-400 h-full animate-pulse" />
                            <span className="w-1 bg-indigo-400 h-2/3 animate-pulse delay-75" />
                            <span className="w-1 bg-indigo-400 h-4/5 animate-pulse delay-150" />
                          </div>
                        ) : (
                          <span className="text-indigo-400 font-bold">▶</span>
                        )
                      ) : (
                        <span>{idx + 1}</span>
                      )}
                    </div>

                    {/* Artwork Cover */}
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-800 shrink-0 border border-slate-700/60">
                      <img
                        src={song.coverImage || fallbackCover}
                        alt={song.title}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Titles */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h4
                          className={`text-xs font-semibold truncate ${
                            isCurrent ? 'text-indigo-300 font-bold' : 'text-slate-200 group-hover:text-white'
                          }`}
                        >
                          {song.title}
                        </h4>
                        {isCurrent && (
                          <span className="px-1.5 py-0.2 text-[9px] font-extrabold uppercase bg-indigo-500/30 text-indigo-200 rounded border border-indigo-400/40 shrink-0">
                            Now Playing
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">{getArtistName(song.artist)}</p>
                    </div>
                  </div>

                  {/* Right Duration & Delete Action */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-mono text-slate-500">{formatDuration(song.duration)}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromQueue(idx);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 transition-opacity rounded hover:bg-slate-700/60"
                      title="Remove from queue"
                      aria-label="Remove from queue"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </>
  );
};
