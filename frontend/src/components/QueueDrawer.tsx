import React, { useEffect, useState, useCallback } from 'react';
import { usePlayer } from '../hooks/usePlayer';
import { useAuth } from '../hooks/useAuth';
import { fetchSessionRecommendationsApi } from '../services/recommendationService';
import type { SessionItemResponse } from '../services/recommendationService';

export const QueueDrawer: React.FC = () => {
  const {
    currentSong,
    isPlaying,
    queue,
    queueIndex,
    isQueueOpen,
    isAutoplayEnabled,
    toggleAutoplay,
    setQueueOpen,
    playQueueIndex,
    removeFromQueue,
    clearQueue,
    addToQueue,
  } = usePlayer();

  const { isAuthenticated } = useAuth();

  const [sessionRecs, setSessionRecs] = useState<SessionItemResponse[]>([]);
  const [loadingRecs, setLoadingRecs] = useState<boolean>(false);
  const [addedRecIds, setAddedRecIds] = useState<Set<string>>(new Set());

  const loadSessionRecommendations = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoadingRecs(true);
    const { rawItems } = await fetchSessionRecommendationsApi(6);
    setSessionRecs(rawItems || []);
    setLoadingRecs(false);
  }, [isAuthenticated]);

  useEffect(() => {
    if (isQueueOpen) {
      loadSessionRecommendations();
    }
  }, [isQueueOpen, currentSong?._id, loadSessionRecommendations]);

  if (!isQueueOpen) return null;

  const handleAddRecToQueue = (e: React.MouseEvent, item: SessionItemResponse) => {
    e.stopPropagation();
    if (!item.song) return;

    addToQueue(item.song);
    setAddedRecIds((prev) => new Set(prev).add(item.song._id));
  };

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
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-2.5">
            <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h10M4 18h10" />
            </svg>
            <div>
              <h3 className="font-bold text-slate-100 text-base">Playback Queue</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {queue.length} {queue.length === 1 ? 'song' : 'songs'} in active queue
              </p>
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

        {/* Scrollable Container for Current Queue + Smart Autoplay Control + Up Next Recommendations */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-700">
          {/* Smart Autoplay Control Card & Explanation */}
          <div className="bg-slate-950/60 border border-purple-500/30 rounded-2xl p-3.5 space-y-2.5 shadow-md shadow-purple-950/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    Smart Autoplay
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase ${
                        isAutoplayEnabled
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {isAutoplayEnabled ? 'ON' : 'OFF'}
                    </span>
                  </h4>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                onClick={toggleAutoplay}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  isAutoplayEnabled ? 'bg-purple-600' : 'bg-slate-700'
                }`}
                aria-label="Toggle Smart Autoplay"
                title={isAutoplayEnabled ? 'Disable Smart Autoplay' : 'Enable Smart Autoplay'}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    isAutoplayEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              When enabled, Smart Autoplay keeps music going with fresh songs tailored to your active session vibe once the queue ends.
            </p>
          </div>

          {/* SECTION 1: Current Active Queue */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
              Current Queue
            </h4>

            {queue.length === 0 ? (
              <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-6 text-center text-slate-500 space-y-2">
                <p className="text-xs font-medium text-slate-400">Queue is currently empty</p>
                <p className="text-[11px] text-slate-500">Play tracks from the catalog or add from Up Next recommendations below.</p>
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
                    <div className="flex items-center gap-3 min-w-0 flex-1">
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

                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-800 shrink-0 border border-slate-700/60">
                        <img
                          src={song.coverImage || fallbackCover}
                          alt={song.title}
                          className="w-full h-full object-cover"
                        />
                      </div>

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
                              Playing
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{getArtistName(song.artist)}</p>
                      </div>
                    </div>

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

          {/* SECTION 2: Up Next Session Recommendations */}
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-purple-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300">
                  Up Next (Session AI Recommendations)
                </h4>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Real-Time Vibe</span>
            </div>

            {/* Loading Skeleton State */}
            {loadingRecs && (
              <div className="space-y-2 animate-pulse">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="flex items-center gap-3 p-2 bg-slate-800/30 rounded-xl">
                    <div className="w-9 h-9 bg-slate-700/50 rounded-lg shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-3 bg-slate-700/50 rounded w-1/2" />
                      <div className="h-2.5 bg-slate-700/30 rounded w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty State */}
            {!loadingRecs && sessionRecs.length === 0 && (
              <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-4 text-center space-y-1">
                <p className="text-xs text-slate-400 font-medium">No session recommendations yet</p>
                <p className="text-[11px] text-slate-500">Play songs in this session to generate tailored Up Next tracks.</p>
              </div>
            )}

            {/* Recommended Songs List */}
            {!loadingRecs && sessionRecs.length > 0 && (
              <div className="space-y-2">
                {sessionRecs.map((item, i) => {
                  const song = item.song;
                  if (!song) return null;
                  const isAdded = addedRecIds.has(song._id);
                  const matchPercent = Math.round((item.sessionScore || 0.8) * 100);

                  return (
                    <div
                      key={song._id || i}
                      className="group bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-xl p-2.5 transition-all flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <img
                          src={song.coverImage || fallbackCover}
                          alt={song.title}
                          className="w-9 h-9 rounded-lg object-cover bg-slate-900 shrink-0 border border-slate-700/50"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <h5 className="text-xs font-semibold text-slate-200 truncate group-hover:text-white">
                              {song.title}
                            </h5>
                            <span className="px-1.5 py-0.2 text-[9px] font-mono text-purple-300 bg-purple-500/20 rounded border border-purple-500/30 shrink-0">
                              {matchPercent}% Match
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">{getArtistName(song.artist)}</p>
                        </div>
                      </div>

                      {/* Action: Add to Queue */}
                      <button
                        onClick={(e) => handleAddRecToQueue(e, item)}
                        disabled={isAdded}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 shrink-0 ${
                          isAdded
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 cursor-default'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30'
                        }`}
                        title={isAdded ? 'Added to queue' : 'Add to queue'}
                      >
                        {isAdded ? (
                          <>
                            <span>✓</span>
                            <span>Added</span>
                          </>
                        ) : (
                          <>
                            <span>+</span>
                            <span>Queue</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
