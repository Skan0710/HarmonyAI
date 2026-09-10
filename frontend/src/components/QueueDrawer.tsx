import React, { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Zap, RefreshCw, ListMusic, Play, Trash2, Plus, Check } from 'lucide-react';
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

  const handleAddRecToQueue = (e: React.MouseEvent, item: SessionItemResponse) => {
    e.stopPropagation();
    if (!item.song) return;
    addToQueue(item.song);
    setAddedRecIds((prev) => new Set(prev).add(item.song._id));
  };

  const getArtistName = (artist: any): string => {
    if (!artist) return 'Unknown Artist';
    if (typeof artist === 'object' && 'name' in artist) return artist.name;
    return String(artist);
  };

  const formatDuration = (seconds: number): string => {
    if (!seconds || seconds <= 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const fallbackCover =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23d9a15b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="background:%231b1815;"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';

  return (
    <AnimatePresence>
      {isQueueOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setQueueOpen(false)}
            className="fixed inset-0 z-[var(--z-drawer)] bg-black/60"
          />

          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-0 right-0 bottom-0 z-[var(--z-drawer)] w-full sm:w-96 bg-surface-1 border-l border-border-subtle shadow-[var(--shadow-lg)] flex flex-col"
          >
            <div className="p-5 border-b border-border-subtle flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <ListMusic size={18} className="text-accent" strokeWidth={1.75} />
                <div>
                  <h3 className="font-semibold text-text-primary text-sm">Playback Queue</h3>
                  <p className="text-2xs text-text-tertiary mt-0.5">
                    {queue.length} queued · {autoplayQueue.length} autoplay upcoming
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {queue.length > 0 && (
                  <button
                    onClick={clearQueue}
                    className="text-2xs text-danger font-medium px-2 py-1 rounded-[var(--radius-sm)] hover:bg-danger-wash transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={() => setQueueOpen(false)}
                  className="p-1.5 rounded-[var(--radius-sm)] text-text-tertiary hover:text-text-primary hover:bg-surface-2 transition-colors cursor-pointer"
                  aria-label="Close Queue Drawer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Smart Autoplay */}
              <div
                className={`rounded-[var(--radius-md)] border p-3.5 space-y-2.5 ${
                  isAutoplayEnabled ? 'bg-gold-wash border-gold/30' : 'bg-surface-2 border-border-subtle'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center ${
                        isAutoplayEnabled ? 'bg-gold/20 text-gold' : 'bg-surface-3 text-text-tertiary'
                      }`}
                    >
                      <Zap size={14} className={isAutoplayLoading ? 'animate-spin' : ''} />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                        Smart Autoplay
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-sm uppercase ${isAutoplayEnabled ? 'bg-gold/20 text-gold' : 'bg-surface-3 text-text-tertiary'}`}>
                          {isAutoplayEnabled ? 'On' : 'Off'}
                        </span>
                      </h4>
                      <p className="text-2xs text-text-tertiary mt-0.5">
                        {isAutoplayEnabled ? `${autoplayQueue.length} tracks buffered` : 'Stops when queue ends'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={toggleAutoplay}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${isAutoplayEnabled ? 'bg-gold' : 'bg-surface-3'}`}
                    aria-label="Toggle Smart Autoplay"
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 mt-0.5 transform rounded-full bg-surface-0 transition-transform ${isAutoplayEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                {autoplayError && isAutoplayEnabled && (
                  <div className="flex items-center justify-between p-2 rounded-[var(--radius-sm)] bg-danger-wash text-2xs text-danger">
                    <span className="truncate">{autoplayError}</span>
                    <button onClick={() => replenishAutoplayQueue(true)} className="px-2 py-0.5 ml-2 font-semibold rounded-sm hover:bg-black/10 cursor-pointer">
                      Retry
                    </button>
                  </div>
                )}
              </div>

              {/* Active Queue */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-2xs font-semibold uppercase tracking-wide text-text-tertiary">Active Queue</h4>
                  <span className="text-2xs font-mono text-text-tertiary">
                    {queue.length > 0 ? `${queueIndex + 1} of ${queue.length}` : '0 songs'}
                  </span>
                </div>

                {queue.length === 0 ? (
                  <div className="bg-surface-2 rounded-[var(--radius-md)] p-6 text-center space-y-1">
                    <p className="text-xs font-medium text-text-secondary">Queue is empty</p>
                    <p className="text-2xs text-text-tertiary">Play tracks or let Smart Autoplay take over.</p>
                  </div>
                ) : (
                  queue.map((song, idx) => {
                    const isCurrent = idx === queueIndex || currentSong?._id === song._id;
                    return (
                      <div
                        key={`${song._id}-${idx}`}
                        onClick={() => playQueueIndex(idx)}
                        className={`group relative cursor-pointer rounded-[var(--radius-sm)] p-2.5 transition-colors flex items-center justify-between gap-3 ${
                          isCurrent ? 'bg-accent-wash' : 'hover:bg-surface-2'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-5 text-center text-2xs font-mono text-text-tertiary shrink-0">
                            {isCurrent ? (
                              isPlaying ? (
                                <div className="flex items-end justify-center gap-0.5 h-3">
                                  <span className="w-1 bg-accent h-full animate-pulse" />
                                  <span className="w-1 bg-accent h-2/3 animate-pulse [animation-delay:75ms]" />
                                  <span className="w-1 bg-accent h-4/5 animate-pulse [animation-delay:150ms]" />
                                </div>
                              ) : (
                                <Play size={11} className="text-accent mx-auto" fill="currentColor" />
                              )
                            ) : (
                              <span>{idx + 1}</span>
                            )}
                          </div>
                          <div className="w-10 h-10 rounded-[var(--radius-artwork)] overflow-hidden bg-surface-2 shrink-0">
                            <img src={song.coverImage || fallbackCover} alt={song.title} className="w-full h-full object-cover" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className={`text-xs font-medium truncate ${isCurrent ? 'text-accent' : 'text-text-primary'}`}>{song.title}</h4>
                            <p className="text-2xs text-text-tertiary truncate mt-0.5">{getArtistName(song.artist)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-2xs font-mono text-text-tertiary">{formatDuration(song.duration)}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFromQueue(idx);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-text-tertiary hover:text-danger transition-opacity cursor-pointer"
                            aria-label="Remove from queue"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Autoplay upcoming */}
              <div className="space-y-3 pt-4 border-t border-border-subtle">
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-2xs font-semibold uppercase tracking-wide text-gold flex items-center gap-1.5">
                    <Zap size={12} className={isAutoplayLoading ? 'animate-spin' : ''} />
                    Upcoming Autoplay
                  </h4>
                  {isAutoplayEnabled && (
                    <div className="flex items-center gap-1.5">
                      {autoplayQueue.length > 0 && (
                        <button
                          onClick={() => skipToAutoplayTrack(0)}
                          className="text-2xs text-gold hover:text-gold-strong font-medium px-2 py-0.5 rounded-sm bg-gold-wash transition-colors cursor-pointer"
                        >
                          Skip to next
                        </button>
                      )}
                      <button
                        onClick={() => replenishAutoplayQueue(true)}
                        disabled={isAutoplayLoading}
                        className="p-1 text-text-tertiary hover:text-gold transition-colors cursor-pointer disabled:opacity-40"
                        aria-label="Refresh Autoplay Queue"
                      >
                        <RefreshCw size={13} className={isAutoplayLoading ? 'animate-spin' : ''} />
                      </button>
                    </div>
                  )}
                </div>

                {!isAutoplayEnabled && (
                  <div className="bg-surface-2 rounded-[var(--radius-md)] p-4 text-center space-y-2">
                    <p className="text-xs font-medium text-text-secondary">Smart Autoplay is off</p>
                    <p className="text-2xs text-text-tertiary leading-relaxed">
                      Enable it to automatically queue harmonious next tracks.
                    </p>
                    <button
                      onClick={() => setAutoplayEnabled(true)}
                      className="px-3 py-1.5 rounded-[var(--radius-pill)] bg-gold text-text-on-accent text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Enable Smart Autoplay
                    </button>
                  </div>
                )}

                {isAutoplayEnabled && isAutoplayLoading && autoplayQueue.length === 0 && (
                  <div className="space-y-2 animate-pulse">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className="flex items-center gap-3 p-2 bg-surface-2 rounded-[var(--radius-sm)]">
                        <div className="w-9 h-9 bg-surface-3 rounded-[var(--radius-artwork)] shrink-0" />
                        <div className="space-y-1.5 flex-1">
                          <div className="h-3 bg-surface-3 rounded w-1/2" />
                          <div className="h-2.5 bg-surface-3 rounded w-1/3" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {isAutoplayEnabled && autoplayQueue.length > 0 && (
                  <div className="space-y-2">
                    {autoplayQueue.map((song, idx) => (
                      <div key={`${song._id}-autoplay-${idx}`} className="group bg-gold-wash hover:bg-gold/20 rounded-[var(--radius-sm)] p-2.5 transition-colors flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className="w-4 text-center text-2xs font-mono text-gold/80 shrink-0">{idx + 1}</span>
                          <img src={song.coverImage || fallbackCover} alt={song.title} className="w-9 h-9 rounded-[var(--radius-artwork)] object-cover bg-surface-2 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <h5 className="text-xs font-medium text-text-primary truncate">{song.title}</h5>
                            <p className="text-2xs text-text-tertiary truncate mt-0.5">{getArtistName(song.artist)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => skipToAutoplayTrack(idx)}
                            className="p-1.5 text-gold hover:text-text-on-accent hover:bg-gold rounded-[var(--radius-sm)] transition-colors cursor-pointer"
                            aria-label={`Play ${song.title} now`}
                          >
                            <Play size={13} fill="currentColor" />
                          </button>
                          <button
                            onClick={() => removeAutoplayTrack(idx)}
                            className="p-1.5 text-text-tertiary hover:text-danger transition-colors cursor-pointer"
                            aria-label={`Remove ${song.title} from autoplay queue`}
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Session recommendations */}
              <div className="space-y-3 pt-4 border-t border-border-subtle">
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-2xs font-semibold uppercase tracking-wide text-text-tertiary">Add to Queue</h4>
                </div>

                {loadingRecs && (
                  <div className="space-y-2 animate-pulse">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className="flex items-center gap-3 p-2 bg-surface-2 rounded-[var(--radius-sm)]">
                        <div className="w-9 h-9 bg-surface-3 rounded-[var(--radius-artwork)] shrink-0" />
                        <div className="space-y-1.5 flex-1">
                          <div className="h-3 bg-surface-3 rounded w-1/2" />
                          <div className="h-2.5 bg-surface-3 rounded w-1/3" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!loadingRecs && sessionRecs.length === 0 && (
                  <div className="bg-surface-2 rounded-[var(--radius-md)] p-4 text-center space-y-1">
                    <p className="text-xs text-text-secondary font-medium">No session recommendations yet</p>
                    <p className="text-2xs text-text-tertiary">Play a few songs to surface more picks here.</p>
                  </div>
                )}

                {!loadingRecs && sessionRecs.length > 0 && (
                  <div className="space-y-2">
                    {sessionRecs.map((item, i) => {
                      const song = item.song;
                      if (!song) return null;
                      const isAdded = addedRecIds.has(song._id);
                      const matchPercent = Math.round((item.sessionScore || 0.8) * 100);
                      return (
                        <div key={song._id || i} className="group bg-surface-2 hover:bg-surface-3 rounded-[var(--radius-sm)] p-2.5 transition-colors flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <img src={song.coverImage || fallbackCover} alt={song.title} className="w-9 h-9 rounded-[var(--radius-artwork)] object-cover bg-surface-3 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <h5 className="text-xs font-medium text-text-primary truncate">{song.title}</h5>
                                <span className="text-2xs font-mono text-accent shrink-0">{matchPercent}%</span>
                              </div>
                              <p className="text-2xs text-text-tertiary truncate mt-0.5">{getArtistName(song.artist)}</p>
                            </div>
                          </div>
                          <button
                            onClick={(e) => handleAddRecToQueue(e, item)}
                            disabled={isAdded}
                            className={`p-1.5 rounded-[var(--radius-sm)] transition-colors shrink-0 cursor-pointer ${
                              isAdded ? 'text-success' : 'text-text-tertiary hover:text-accent hover:bg-accent-wash'
                            }`}
                            aria-label={isAdded ? 'Added to queue' : 'Add to queue'}
                          >
                            {isAdded ? <Check size={14} /> : <Plus size={14} />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};
