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
  addToQueue: (song: Song) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  setQueue: (queue: Song[], startIndex?: number) => void;
  playQueueIndex: (index: number) => void;
  nextSong: () => void;
  previousSong: () => void;
  handleSongEnd: () => void;
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

  playSong: (song, queue) => {
    const currentQueue = queue && queue.length > 0 ? queue : get().queue.length > 0 ? get().queue : [song];
    const index = currentQueue.findIndex((s) => s._id === song._id);

    set({
      currentSong: song,
      isPlaying: true,
      currentTime: 0,
      queue: currentQueue,
      queueIndex: index >= 0 ? index : 0,
      lastAutoplaySeedKey: null,
    });

    notifyTrackPlay(song._id);
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
  },

  setAutoplayEnabled: (enabled) => {
    try {
      sessionStorage.setItem('harmony_autoplay', String(enabled));
    } catch {}
    set({ isAutoplayEnabled: enabled });
  },

  addToQueue: (song) => {
    const { queue } = get();
    if (queue.length === 0) {
      get().playSong(song, [song]);
      return;
    }
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
    });

    notifyTrackPlay(song?._id);
  },

  playQueueIndex: (index) => {
    const { queue } = get();
    if (index < 0 || index >= queue.length) return;

    const targetSong = queue[index];
    set({
      queueIndex: index,
      currentSong: targetSong,
      isPlaying: true,
      currentTime: 0,
    });

    notifyTrackPlay(targetSong?._id);
  },

  triggerSmartAutoplay: async (): Promise<boolean> => {
    const { currentSong, queue, isAutoplayLoading, lastAutoplaySeedKey, isAutoplayEnabled } = get();

    // When autoplay is disabled by user, do not generate new songs
    if (!isAutoplayEnabled || !currentSong || isAutoplayLoading) {
      return false;
    }

    const stateKey = `${currentSong._id}_${queue.length}`;
    if (lastAutoplaySeedKey === stateKey) {
      return false;
    }

    set({ isAutoplayLoading: true, lastAutoplaySeedKey: stateKey });

    try {
      const lastArtistId =
        typeof currentSong.artist === 'object' && currentSong.artist && '_id' in currentSong.artist
          ? String(currentSong.artist._id)
          : String(currentSong.artist || '');

      const excludeQueueIds = queue.map((s) => s._id);

      const { songs } = await fetchSmartAutoplayApi({
        limit: 5,
        lastPlayedArtistId: lastArtistId,
        excludeQueue: excludeQueueIds,
      });

      if (songs && songs.length > 0) {
        const currentQueue = get().queue;
        const currentIdx = get().queueIndex;

        // Automatically append recommendations to the queue without overwriting manually queued tracks
        const updatedQueue = [...currentQueue, ...songs];
        const nextIdx = currentIdx + 1;
        const nextSongItem = updatedQueue[nextIdx];

        set({
          queue: updatedQueue,
          queueIndex: nextIdx,
          currentSong: nextSongItem,
          isPlaying: true,
          currentTime: 0,
          isAutoplayLoading: false,
        });

        notifyTrackPlay(nextSongItem?._id);
        return true;
      }
    } catch (err) {
      // Handled gracefully below
    }

    set({ isAutoplayLoading: false });
    return false;
  },

  nextSong: async () => {
    const { queue, queueIndex, currentSong, currentTime, duration, isShuffle, repeatMode, isAutoplayEnabled } = get();
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

    if (isShuffle && queue.length > 1) {
      let nextIdx: number;
      do {
        nextIdx = Math.floor(Math.random() * queue.length);
      } while (nextIdx === queueIndex);

      const nextSongItem = queue[nextIdx];
      if (nextSongItem) {
        set({
          queueIndex: nextIdx,
          currentSong: nextSongItem,
          isPlaying: true,
          currentTime: 0,
        });
        notifyTrackPlay(nextSongItem._id);
      }
      return;
    }

    if (queueIndex + 1 < queue.length) {
      const nextIdx = queueIndex + 1;
      const nextSongItem = queue[nextIdx];
      if (nextSongItem) {
        set({
          queueIndex: nextIdx,
          currentSong: nextSongItem,
          isPlaying: true,
          currentTime: 0,
        });
        notifyTrackPlay(nextSongItem._id);
      }
    } else if (repeatMode === 'all') {
      const nextSongItem = queue[0];
      if (nextSongItem) {
        set({
          queueIndex: 0,
          currentSong: nextSongItem,
          isPlaying: true,
          currentTime: 0,
        });
        notifyTrackPlay(nextSongItem._id);
      }
    } else if (isAutoplayEnabled) {
      // Reached end of queue: Attempt Smart Autoplay
      const autoplayStarted = await get().triggerSmartAutoplay();
      if (!autoplayStarted) {
        set({ isPlaying: false, currentTime: 0 });
      }
    } else {
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
      set({
        queueIndex: prevIdx,
        currentSong: prevSongItem,
        isPlaying: true,
        currentTime: 0,
      });

      notifyTrackPlay(prevSongItem._id);
    }
  },

  handleSongEnd: async () => {
    const { repeatMode, queue, queueIndex, isAutoplayEnabled } = get();

    if (repeatMode === 'one') {
      set({ currentTime: 0, isPlaying: true });
      return;
    }

    if (repeatMode === 'all') {
      get().nextSong();
      return;
    }

    if (queueIndex + 1 < queue.length) {
      get().nextSong();
    } else if (isAutoplayEnabled) {
      // Current queue reached its end: Trigger Smart Autoplay
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
