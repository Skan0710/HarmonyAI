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
    isAutoplayLoading,
    autoplayQueue,
    autoplayError,
    toggleAutoplay,
    setAutoplayEnabled,
    removeAutoplayTrack,
    skipToAutoplayTrack,
    replenishAutoplayQueue,
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
      if (isAutoplayEnabled && autoplayQueue.length === 0 && currentSong) {
        replenishAutoplayQueue().catch(() => {});
      }
    }
  }, [isQueueOpen, currentSong?._id, isAutoplayEnabled, autoplayQueue.length, loadSessionRecommendations, replenishAutoplayQueue]);

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
                {queue.length} in active queue • {autoplayQueue.length} autoplay upcoming
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {queue.length > 0 && (
              <button
                onClick={clearQueue}
                className="text-xs text-rose-400 hover:text-rose-300 font-semibold px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors cursor-pointer"
                title="Clear active queue"
              >
                Clear
              </button>
            )}

            <button
              onClick={() => setQueueOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors text-sm font-bold cursor-pointer"
              aria-label="Close Queue Drawer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable Container for Current Queue + Smart Autoplay Control + Upcoming Autoplay + Up Next */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-700">
          {/* Smart Autoplay Control Card & Explanation */}
          <div
            className={`border rounded-2xl p-3.5 space-y-2.5 shadow-md transition-all ${
              isAutoplayEnabled
                ? 'bg-slate-950/70 border-purple-500/40 shadow-purple-950/30'
                : 'bg-slate-950/40 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all ${
                    isAutoplayEnabled
                      ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 shadow-sm shadow-purple-900/50'
                      : 'bg-slate-800/80 border-slate-700 text-slate-500'
                  }`}
                >
                  <svg
                    className={`w-4 h-4 ${isAutoplayLoading ? 'animate-spin text-purple-400' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    Smart Autoplay
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-extrabold uppercase ${
                        isAutoplayEnabled
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {isAutoplayEnabled ? 'ON' : 'OFF'}
                    </span>
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    {isAutoplayEnabled
                      ? `${autoplayQueue.length} AI tracks buffered • Continuous playback`
                      : 'Disabled • Playback stops when queue ends'}
                  </p>
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

            {/* Error banner if autoplay fetch failed */}
            {autoplayError && isAutoplayEnabled && (
              <div className="flex items-center justify-between p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300">
                <span className="truncate">{autoplayError}</span>
                <button
                  onClick={() => replenishAutoplayQueue(true)}
                  className="px-2 py-0.5 ml-2 font-bold rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[10px] transition-colors cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}
          </div>

          {/* SECTION 1: Current Active Queue (Manual / Playlist Tracks) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <span>Active Queue</span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Manual Priority
                </span>
              </h4>
              <span className="text-[10px] font-mono text-slate-500">
                {queue.length > 0 ? `${queueIndex + 1} of ${queue.length}` : '0 songs'}
              </span>
            </div>

            {queue.length === 0 ? (
              <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-6 text-center text-slate-500 space-y-2">
                <p className="text-xs font-medium text-slate-400">Queue is currently empty</p>
                <p className="text-[11px] text-slate-500">
                  Play tracks from the catalog or let Smart Autoplay take over.
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
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 transition-opacity rounded hover:bg-slate-700/60 cursor-pointer"
                        title="Remove from queue"
                        aria-label="Remove from queue"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* SECTION 2: Upcoming Smart Autoplay Queue */}
          <div className="space-y-3 pt-4 border-t border-purple-500/20">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <svg
                  className={`w-4 h-4 text-purple-400 ${isAutoplayLoading ? 'animate-spin' : 'animate-pulse'}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                  Upcoming Smart Autoplay
                  <span className="px-1.5 py-0.2 text-[9px] font-mono text-purple-300 bg-purple-500/20 rounded border border-purple-500/30">
                    AI Flow
                  </span>
                </h4>
              </div>

              {/* Action buttons: Skip next or Refresh */}
              {isAutoplayEnabled && (
                <div className="flex items-center gap-1.5">
                  {autoplayQueue.length > 0 && (
                    <button
                      onClick={() => skipToAutoplayTrack(0)}
                      className="text-[10px] text-purple-300 hover:text-purple-200 bg-purple-500/20 hover:bg-purple-500/30 px-2 py-0.5 rounded-md border border-purple-500/30 font-semibold transition-colors cursor-pointer flex items-center gap-1"
                      title="Skip to first autoplay track immediately"
                    >
                      <span>Skip to AI</span>
                      <span>▶</span>
                    </button>
                  )}
                  <button
                    onClick={() => replenishAutoplayQueue(true)}
                    disabled={isAutoplayLoading}
                    className="p-1 text-slate-400 hover:text-purple-300 rounded hover:bg-purple-500/10 transition-colors cursor-pointer disabled:opacity-40"
                    title="Refresh Autoplay Queue"
                    aria-label="Refresh Autoplay Queue"
                  >
                    <svg
                      className={`w-3.5 h-3.5 ${isAutoplayLoading ? 'animate-spin' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {/* If Autoplay is Disabled */}
            {!isAutoplayEnabled && (
              <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 text-center space-y-2">
                <p className="text-xs font-semibold text-slate-300">Smart Autoplay is currently off</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Enable Smart Autoplay to automatically queue harmonious next tracks once the active queue ends.
                </p>
                <button
                  onClick={() => setAutoplayEnabled(true)}
                  className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-600/30 transition-colors cursor-pointer"
                >
                  Enable Smart Autoplay
                </button>
              </div>
            )}

            {/* Loading Skeleton */}
            {isAutoplayEnabled && isAutoplayLoading && autoplayQueue.length === 0 && (
              <div className="space-y-2 animate-pulse">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="flex items-center gap-3 p-2 bg-purple-950/20 border border-purple-500/10 rounded-xl">
                    <div className="w-9 h-9 bg-slate-700/50 rounded-lg shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-3 bg-purple-500/30 rounded w-1/2" />
                      <div className="h-2.5 bg-slate-700/30 rounded w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Autoplay Queue Items (Visually distinguished with Purple Accents & Actions) */}
            {isAutoplayEnabled && autoplayQueue.length > 0 && (
              <div className="space-y-2">
                {autoplayQueue.map((song, idx) => (
                  <div
                    key={`${song._id}-autoplay-${idx}`}
                    className="group bg-purple-950/20 hover:bg-purple-950/40 border border-purple-500/30 hover:border-purple-500/50 rounded-xl p-2.5 transition-all flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-4 text-center text-[10px] font-mono text-purple-400/80 shrink-0">
                        {idx + 1}
                      </div>

                      <img
                        src={song.coverImage || fallbackCover}
                        alt={song.title}
                        className="w-9 h-9 rounded-lg object-cover bg-slate-900 shrink-0 border border-purple-500/30"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h5 className="text-xs font-semibold text-slate-200 truncate group-hover:text-purple-200">
                            {song.title}
                          </h5>
                          <span className="px-1.5 py-0.2 text-[8px] font-bold uppercase tracking-wider text-purple-300 bg-purple-500/20 rounded border border-purple-500/30 shrink-0">
                            Autoplay
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{getArtistName(song.artist)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Play this autoplay track immediately */}
                      <button
                        onClick={() => skipToAutoplayTrack(idx)}
                        className="p-1.5 text-purple-300 hover:text-white bg-purple-500/20 hover:bg-purple-600 rounded-lg transition-colors cursor-pointer"
                        title="Play this autoplay track now"
                        aria-label={`Play ${song.title} now`}
                      >
                        <span className="text-[11px] font-bold">▶</span>
                      </button>

                      {/* Remove from autoplay queue */}
                      <button
                        onClick={() => removeAutoplayTrack(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Remove from autoplay queue"
                        aria-label={`Remove ${song.title} from autoplay queue`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 3: Up Next Session Recommendations */}
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                  />
                </svg>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Manual Additions (Session Catalog)
                </h4>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Click +Queue to add</span>
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
                <p className="text-[11px] text-slate-500">Play songs in this session to discover more tracks.</p>
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
                            <span className="px-1.5 py-0.2 text-[9px] font-mono text-indigo-300 bg-indigo-500/20 rounded border border-indigo-500/30 shrink-0">
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
                        className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
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
