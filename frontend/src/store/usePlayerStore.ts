import { create } from 'zustand';
import type { Song } from '../types/music';
import { recordSongPlay } from '../services/songService';

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
  addToQueue: (song: Song) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  setQueue: (queue: Song[], startIndex?: number) => void;
  playQueueIndex: (index: number) => void;
  nextSong: () => void;
  previousSong: () => void;
  handleSongEnd: () => void;
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

  playSong: (song, queue) => {
    const currentQueue = queue && queue.length > 0 ? queue : get().queue.length > 0 ? get().queue : [song];
    const index = currentQueue.findIndex((s) => s._id === song._id);

    set({
      currentSong: song,
      isPlaying: true,
      currentTime: 0,
      queue: currentQueue,
      queueIndex: index >= 0 ? index : 0,
    });

    if (song._id) {
      recordSongPlay(song._id).catch(() => {});
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
      if (nextSong?._id) {
        recordSongPlay(nextSong._id).catch(() => {});
      }
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
    });

    if (song?._id) {
      recordSongPlay(song._id).catch(() => {});
    }
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

    if (targetSong?._id) {
      recordSongPlay(targetSong._id).catch(() => {});
    }
  },

  nextSong: () => {
    const { queue, queueIndex, isShuffle } = get();
    if (queue.length === 0) return;

    let nextIdx: number;

    if (isShuffle && queue.length > 1) {
      // Pick random index excluding current index
      do {
        nextIdx = Math.floor(Math.random() * queue.length);
      } while (nextIdx === queueIndex);
    } else {
      nextIdx = (queueIndex + 1) % queue.length;
    }

    const nextSongItem = queue[nextIdx];

    if (nextSongItem) {
      set({
        queueIndex: nextIdx,
        currentSong: nextSongItem,
        isPlaying: true,
        currentTime: 0,
      });

      if (nextSongItem._id) {
        recordSongPlay(nextSongItem._id).catch(() => {});
      }
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

      if (prevSongItem._id) {
        recordSongPlay(prevSongItem._id).catch(() => {});
      }
    }
  },

  handleSongEnd: () => {
    const { repeatMode, queue, queueIndex } = get();

    if (repeatMode === 'one') {
      // Replay current song from start
      set({ currentTime: 0, isPlaying: true });
      return;
    }

    if (repeatMode === 'all') {
      get().nextSong();
      return;
    }

    // repeatMode === 'off'
    if (queueIndex + 1 < queue.length) {
      get().nextSong();
    } else {
      // Reached end of queue -> stop playback
      set({ isPlaying: false, currentTime: 0 });
    }
  },

  toggleQueueOpen: () => set((state) => ({ isQueueOpen: !state.isQueueOpen })),
  setQueueOpen: (isOpen) => set({ isQueueOpen: isOpen }),
}));
