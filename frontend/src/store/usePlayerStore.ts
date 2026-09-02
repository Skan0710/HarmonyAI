import { create } from 'zustand';
import type { Song } from '../types/music';
import { recordSongPlay } from '../services/songService';
import { recordPlaybackApi } from '../services/historyService';
import { trackRecommendationInteraction } from '../services/recommendationTrackingService';
import { fetchSmartAutoplayApi } from '../services/recommendationService';

export type RepeatMode = 'off' | 'all' | 'one';

const getInitialVolume = (): number => {
  try {
    const saved = sessionStorage.getItem('harmony_volume');
    if (saved !== null) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        return parsed;
      }
    }
  } catch {}
  return 0.8;
};

const getInitialAutoplay = (): boolean => {
  try {
    const saved = sessionStorage.getItem('harmony_autoplay');
    if (saved !== null) {
      return saved === 'true';
    }
  } catch {}
  return true;
};

const notifyTrackPlay = (songId?: string) => {
  if (!songId) return;
  recordSongPlay(songId).catch(() => {});
  recordPlaybackApi(songId).catch(() => {});
};

interface PlayerState {
  // State variables
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  queue: Song[];
  queueIndex: number;
  volume: number; // 0 to 1
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: RepeatMode;
  isQueueOpen: boolean;
  isAutoplayEnabled: boolean;
  isAutoplayLoading: boolean;
  lastAutoplaySeedKey: string | null;
  autoplayQueue: Song[]; // Adaptive upcoming Smart Autoplay buffer
  recentPlayedSongIds: string[]; // History buffer to prevent repeat selections
  currentListeningContext: string | null;

  // Actions / Functions
  playSong: (song: Song, queue?: Song[]) => void;
  togglePlay: () => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  toggleRepeatMode: () => void;
  toggleAutoplay: () => void;
  setAutoplayEnabled: (enabled: boolean) => void;
  setListeningContext: (context: string | null) => void;
  addToQueue: (song: Song) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  setQueue: (queue: Song[], startIndex?: number) => void;
  playQueueIndex: (index: number) => void;
  nextSong: () => void;
  previousSong: () => void;
  handleSongEnd: () => void;
  replenishAutoplayQueue: (force?: boolean) => Promise<boolean>;
  triggerSmartAutoplay: () => Promise<boolean>;
  toggleQueueOpen: () => void;
  setQueueOpen: (isOpen: boolean) => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentSong: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  queue: [],
  queueIndex: -1,
  volume: getInitialVolume(),
  isMuted: false,
  isShuffle: false,
  repeatMode: 'off',
  isQueueOpen: false,
  isAutoplayEnabled: getInitialAutoplay(),
  isAutoplayLoading: false,
  lastAutoplaySeedKey: null,
  autoplayQueue: [],
  recentPlayedSongIds: [],
  currentListeningContext: null,

  playSong: (song, queue) => {
    const currentQueue = queue && queue.length > 0 ? queue : get().queue.length > 0 ? get().queue : [song];
    const index = currentQueue.findIndex((s) => s._id === song._id);

    const prevRecent = get().recentPlayedSongIds.filter((id) => id !== song._id);
    const updatedRecent = [song._id, ...prevRecent].slice(0, 20);

    set({
      currentSong: song,
      isPlaying: true,
      currentTime: 0,
      queue: currentQueue,
      queueIndex: index >= 0 ? index : 0,
      lastAutoplaySeedKey: null,
      autoplayQueue: [], // Reset autoplay buffer on explicit song play
      recentPlayedSongIds: updatedRecent,
    });

    notifyTrackPlay(song._id);

    // If autoplay is enabled, prefetch upcoming autoplay queue in background
    if (get().isAutoplayEnabled) {
      setTimeout(() => {
        get().replenishAutoplayQueue().catch(() => {});
      }, 500);
    }
  },

  togglePlay: () => {
    const { currentSong, isPlaying } = get();
    if (!currentSong) return;
    set({ isPlaying: !isPlaying });
  },

  play: () => {
    const { currentSong } = get();
    if (currentSong) {
      set({ isPlaying: true });
    }
  },

  pause: () => {
    set({ isPlaying: false });
  },

  stop: () => {
    set({
      currentSong: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      autoplayQueue: [],
    });
  },

  setCurrentTime: (time) => set({ currentTime: time }),

  setDuration: (duration) => set({ duration }),

  setVolume: (volume) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    try {
      sessionStorage.setItem('harmony_volume', String(clampedVolume));
    } catch {}

    set({
      volume: clampedVolume,
      isMuted: clampedVolume === 0,
    });
  },

  toggleMute: () => {
    set((state) => ({ isMuted: !state.isMuted }));
  },

  toggleShuffle: () => {
    set((state) => ({ isShuffle: !state.isShuffle }));
  },

  toggleRepeatMode: () => {
    const current = get().repeatMode;
    const next: RepeatMode = current === 'off' ? 'all' : current === 'all' ? 'one' : 'off';
    set({ repeatMode: next });
  },

  toggleAutoplay: () => {
    const nextState = !get().isAutoplayEnabled;
    try {
      sessionStorage.setItem('harmony_autoplay', String(nextState));
    } catch {}
    set({ isAutoplayEnabled: nextState });

    if (nextState && get().currentSong && get().autoplayQueue.length === 0) {
      get().replenishAutoplayQueue().catch(() => {});
    }
  },

  setAutoplayEnabled: (enabled) => {
    try {
      sessionStorage.setItem('harmony_autoplay', String(enabled));
    } catch {}
    set({ isAutoplayEnabled: enabled });

    if (enabled && get().currentSong && get().autoplayQueue.length === 0) {
      get().replenishAutoplayQueue().catch(() => {});
    }
  },

  setListeningContext: (context) => {
    set({ currentListeningContext: context });
    // Replenish autoplay queue with new context if active
    if (get().isAutoplayEnabled && get().currentSong) {
      get().replenishAutoplayQueue(true).catch(() => {});
    }
  },

  addToQueue: (song) => {
    const { queue } = get();
    if (queue.length === 0) {
      get().playSong(song, [song]);
      return;
    }

    // Manual tracks appended to active queue always take priority over future autoplay
    set({ queue: [...queue, song] });
  },

  removeFromQueue: (index) => {
    const { queue, queueIndex } = get();
    if (index < 0 || index >= queue.length) return;

    const newQueue = queue.filter((_, i) => i !== index);

    if (newQueue.length === 0) {
      set({
        queue: [],
        queueIndex: -1,
        currentSong: null,
        isPlaying: false,
        currentTime: 0,
        lastAutoplaySeedKey: null,
        autoplayQueue: [],
      });
      return;
    }

    let newQueueIndex = queueIndex;
    if (index < queueIndex) {
      newQueueIndex = queueIndex - 1;
    } else if (index === queueIndex) {
      newQueueIndex = index < newQueue.length ? index : newQueue.length - 1;
      const nextSong = newQueue[newQueueIndex];
      set({
        currentSong: nextSong,
        currentTime: 0,
      });
      notifyTrackPlay(nextSong?._id);
    }

    set({
      queue: newQueue,
      queueIndex: newQueueIndex,
    });
  },

  clearQueue: () => {
    set({
      queue: [],
      queueIndex: -1,
      currentSong: null,
      isPlaying: false,
      currentTime: 0,
      lastAutoplaySeedKey: null,
      autoplayQueue: [],
    });
  },

  setQueue: (queue, startIndex = 0) => {
    const validIndex = Math.max(0, Math.min(startIndex, queue.length - 1));
    const song = queue[validIndex] || null;

    set({
      queue,
      queueIndex: validIndex,
      currentSong: song,
      isPlaying: !!song,
      currentTime: 0,
      lastAutoplaySeedKey: null,
      autoplayQueue: [],
    });

    notifyTrackPlay(song?._id);

    if (get().isAutoplayEnabled) {
      get().replenishAutoplayQueue().catch(() => {});
    }
  },

  playQueueIndex: (index) => {
    const { queue } = get();
    if (index < 0 || index >= queue.length) return;

    const targetSong = queue[index];
    const prevRecent = get().recentPlayedSongIds.filter((id) => id !== targetSong._id);
    const updatedRecent = [targetSong._id, ...prevRecent].slice(0, 20);

    set({
      queueIndex: index,
      currentSong: targetSong,
      isPlaying: true,
      currentTime: 0,
      recentPlayedSongIds: updatedRecent,
    });

    notifyTrackPlay(targetSong?._id);
  },

  /**
   * Replenishes the Smart Autoplay buffer when empty or near exhaustion (< 3 tracks)
   */
  replenishAutoplayQueue: async (force = false): Promise<boolean> => {
    const {
      currentSong,
      queue,
      autoplayQueue,
      isAutoplayEnabled,
      isAutoplayLoading,
      recentPlayedSongIds,
      currentListeningContext,
    } = get();

    if (!isAutoplayEnabled || !currentSong || isAutoplayLoading) {
      return false;
    }

    // If buffer is already healthy and not forced, skip fetch
    if (!force && autoplayQueue.length >= 3) {
      return true;
    }

    set({ isAutoplayLoading: true });

    try {
      const lastArtistId =
        typeof currentSong.artist === 'object' && currentSong.artist && '_id' in currentSong.artist
          ? String(currentSong.artist._id)
          : String(currentSong.artist || '');

      // Exclude current track, all active queue tracks, recent plays, and existing autoplay buffer tracks
      const excludedIds = Array.from(
        new Set([
          currentSong._id,
          ...queue.map((s) => s._id),
          ...autoplayQueue.map((s) => s._id),
          ...recentPlayedSongIds,
        ])
      );

      const response = await fetchSmartAutoplayApi({
        currentTrackId: currentSong._id,
        context: currentListeningContext || undefined,
        queueSize: 6,
        lastPlayedArtistId: lastArtistId,
        excludeQueue: excludedIds,
      });

      if (response.songs && response.songs.length > 0) {
        // Filter out any songs already played or in queue to guarantee no repeat
        const currentExcluded = new Set([
          get().currentSong?._id,
          ...get().queue.map((s) => s._id),
          ...get().autoplayQueue.map((s) => s._id),
          ...get().recentPlayedSongIds,
        ]);

        const freshSongs = response.songs.filter((s) => s && s._id && !currentExcluded.has(s._id));

        if (freshSongs.length > 0) {
          const mergedBuffer = force ? freshSongs : [...get().autoplayQueue, ...freshSongs];
          set({
            autoplayQueue: mergedBuffer,
            isAutoplayLoading: false,
          });
          return true;
        }
      }
    } catch {
      // Graceful error handling: keep existing queue intact
    }

    set({ isAutoplayLoading: false });
    return false;
  },

  /**
   * Selects the next song from the Smart Autoplay queue when the current queue completes
   */
  triggerSmartAutoplay: async (): Promise<boolean> => {
    const {
      currentSong,
      queue,
      queueIndex,
      isAutoplayEnabled,
      autoplayQueue,
      recentPlayedSongIds,
    } = get();

    if (!isAutoplayEnabled || !currentSong) {
      return false;
    }

    // 1. If autoplay buffer is empty or near exhaustion, attempt replenishment
    if (autoplayQueue.length <= 1) {
      await get().replenishAutoplayQueue(true);
    }

    const currentBuffer = [...get().autoplayQueue];
    const excludedIds = new Set([
      currentSong._id,
      ...recentPlayedSongIds.slice(0, 8),
    ]);

    // Find the next eligible track from the autoplay queue
    let eligibleIndex = currentBuffer.findIndex((s) => s && s._id && !excludedIds.has(s._id));
    if (eligibleIndex === -1 && currentBuffer.length > 0) {
      eligibleIndex = 0; // Fallback to first available if all were in recent buffer
    }

    if (eligibleIndex !== -1) {
      const nextSongItem = currentBuffer[eligibleIndex];
      const remainingBuffer = currentBuffer.filter((_, idx) => idx !== eligibleIndex);

      const updatedQueue = [...queue, nextSongItem];
      const nextIdx = queueIndex + 1;

      const prevRecent = get().recentPlayedSongIds.filter((id) => id !== nextSongItem._id);
      const updatedRecent = [nextSongItem._id, ...prevRecent].slice(0, 20);

      set({
        queue: updatedQueue,
        queueIndex: nextIdx,
        currentSong: nextSongItem,
        autoplayQueue: remainingBuffer,
        recentPlayedSongIds: updatedRecent,
        isPlaying: true,
        currentTime: 0,
      });

      notifyTrackPlay(nextSongItem._id);

      // Replenish buffer in the background if it's now near exhaustion
      if (remainingBuffer.length <= 2) {
        setTimeout(() => {
          get().replenishAutoplayQueue().catch(() => {});
        }, 500);
      }

      return true;
    }

    return false;
  },

  nextSong: async () => {
    const {
      queue,
      queueIndex,
      currentSong,
      currentTime,
      duration,
      isShuffle,
      repeatMode,
      isAutoplayEnabled,
    } = get();

    if (queue.length === 0) return;

    // Track skip action if skipped early (< 50% played) on a recommended track
    if (currentSong && currentSong._id && duration > 0 && currentTime / duration < 0.5) {
      const hasRec =
        Boolean((currentSong as any).componentScores) ||
        Boolean((currentSong as any).hybridScore) ||
        Boolean((currentSong as any).recommendationScore);
      if (hasRec) {
        const source = ((currentSong as any).sources && (currentSong as any).sources[0]) || 'hybrid';
        trackRecommendationInteraction(currentSong._id, 'skip', source);
      }
    }

    // 1. Shuffle Mode: Pick a random remaining track
    if (isShuffle && queue.length > 1) {
      let nextIdx: number;
      do {
        nextIdx = Math.floor(Math.random() * queue.length);
      } while (nextIdx === queueIndex);

      const nextSongItem = queue[nextIdx];
      if (nextSongItem) {
        const prevRecent = get().recentPlayedSongIds.filter((id) => id !== nextSongItem._id);
        set({
          queueIndex: nextIdx,
          currentSong: nextSongItem,
          isPlaying: true,
          currentTime: 0,
          recentPlayedSongIds: [nextSongItem._id, ...prevRecent].slice(0, 20),
        });
        notifyTrackPlay(nextSongItem._id);
      }
      return;
    }

    // 2. Normal Queue: Manually added queue tracks ALWAYS take priority over autoplay
    if (queueIndex + 1 < queue.length) {
      const nextIdx = queueIndex + 1;
      const nextSongItem = queue[nextIdx];
      if (nextSongItem) {
        const prevRecent = get().recentPlayedSongIds.filter((id) => id !== nextSongItem._id);
        set({
          queueIndex: nextIdx,
          currentSong: nextSongItem,
          isPlaying: true,
          currentTime: 0,
          recentPlayedSongIds: [nextSongItem._id, ...prevRecent].slice(0, 20),
        });
        notifyTrackPlay(nextSongItem._id);

        // If approaching the end of the manual queue, prefetch autoplay tracks
        if (isAutoplayEnabled && queue.length - nextIdx <= 2) {
          get().replenishAutoplayQueue().catch(() => {});
        }
      }
    } else if (repeatMode === 'all') {
      // 3. Repeat All: Loop back to start of queue
      const nextSongItem = queue[0];
      if (nextSongItem) {
        const prevRecent = get().recentPlayedSongIds.filter((id) => id !== nextSongItem._id);
        set({
          queueIndex: 0,
          currentSong: nextSongItem,
          isPlaying: true,
          currentTime: 0,
          recentPlayedSongIds: [nextSongItem._id, ...prevRecent].slice(0, 20),
        });
        notifyTrackPlay(nextSongItem._id);
      }
    } else if (isAutoplayEnabled) {
      // 4. Reached end of queue: Automatically select next track from Smart Autoplay
      const autoplayStarted = await get().triggerSmartAutoplay();
      if (!autoplayStarted) {
        set({ isPlaying: false, currentTime: 0 });
      }
    } else {
      // 5. Autoplay off: Stop playback cleanly
      set({ isPlaying: false, currentTime: 0 });
    }
  },

  previousSong: () => {
    const { queue, queueIndex, currentTime, isShuffle } = get();
    if (queue.length === 0) return;

    if (currentTime > 3) {
      set({ currentTime: 0 });
      return;
    }

    let prevIdx: number;

    if (isShuffle && queue.length > 1) {
      do {
        prevIdx = Math.floor(Math.random() * queue.length);
      } while (prevIdx === queueIndex);
    } else {
      prevIdx = queueIndex - 1 < 0 ? queue.length - 1 : queueIndex - 1;
    }

    const prevSongItem = queue[prevIdx];

    if (prevSongItem) {
      const prevRecent = get().recentPlayedSongIds.filter((id) => id !== prevSongItem._id);
      set({
        queueIndex: prevIdx,
        currentSong: prevSongItem,
        isPlaying: true,
        currentTime: 0,
        recentPlayedSongIds: [prevSongItem._id, ...prevRecent].slice(0, 20),
      });

      notifyTrackPlay(prevSongItem._id);
    }
  },

  handleSongEnd: async () => {
    const { repeatMode, queue, queueIndex, isAutoplayEnabled } = get();

    // 1. Repeat One: Replay current track
    if (repeatMode === 'one') {
      set({ currentTime: 0, isPlaying: true });
      return;
    }

    // 2. Repeat All at end of queue
    if (repeatMode === 'all' && queueIndex + 1 >= queue.length) {
      get().nextSong();
      return;
    }

    // 3. Normal Queue priority: Manually added queue tracks play first
    if (queueIndex + 1 < queue.length) {
      get().nextSong();
    } else if (isAutoplayEnabled) {
      // 4. Reached end of manual queue: Automatically select next track from Smart Autoplay queue
      const autoplayStarted = await get().triggerSmartAutoplay();
      if (!autoplayStarted) {
        set({ isPlaying: false, currentTime: 0 });
      }
    } else {
      set({ isPlaying: false, currentTime: 0 });
    }
  },

  toggleQueueOpen: () => set((state) => ({ isQueueOpen: !state.isQueueOpen })),
  setQueueOpen: (isOpen) => set({ isQueueOpen: isOpen }),
}));
