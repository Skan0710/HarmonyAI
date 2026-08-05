import { create } from 'zustand';
import type { Song } from '../types/music';
import { recordSongPlay } from '../services/songService';

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
  addToQueue: (song: Song) => void;
  setQueue: (queue: Song[], startIndex?: number) => void;
  nextSong: () => void;
  previousSong: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentSong: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  queue: [],
  queueIndex: -1,
  volume: 0.8,
  isMuted: false,

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
    set({
      volume: clampedVolume,
      isMuted: clampedVolume === 0,
    });
  },

  toggleMute: () => {
    set((state) => ({ isMuted: !state.isMuted }));
  },

  addToQueue: (song) => {
    set((state) => ({
      queue: [...state.queue, song],
    }));
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

  nextSong: () => {
    const { queue, queueIndex } = get();
    if (queue.length === 0) return;

    const nextIdx = (queueIndex + 1) % queue.length;
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
    const { queue, queueIndex, currentTime } = get();
    if (queue.length === 0) return;

    // If more than 3 seconds into song, restart current track
    if (currentTime > 3) {
      set({ currentTime: 0 });
      return;
    }

    const prevIdx = queueIndex - 1 < 0 ? queue.length - 1 : queueIndex - 1;
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
}));
