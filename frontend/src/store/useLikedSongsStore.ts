import { create } from 'zustand';
import type { Song } from '../types/music';
import { fetchLikedSongsApi, likeSongApi, unlikeSongApi } from '../services/userService';

interface LikedSongsState {
  likedSongIds: string[];
  likedSongs: Song[];
  loading: boolean;

  fetchLikedSongs: () => Promise<void>;
  toggleLikeSong: (song: Song) => Promise<void>;
  isLiked: (songId: string) => boolean;
}

export const useLikedSongsStore = create<LikedSongsState>((set, get) => ({
  likedSongIds: [],
  likedSongs: [],
  loading: false,

  fetchLikedSongs: async () => {
    set({ loading: true });
    const { songs, error } = await fetchLikedSongsApi();

    if (!error && songs) {
      const ids = songs.map((s) => s._id);
      set({
        likedSongs: songs,
        likedSongIds: ids,
        loading: false,
      });
    } else {
      set({ loading: false });
    }
  },

  toggleLikeSong: async (song: Song) => {
    const { likedSongIds, likedSongs } = get();
    const songId = song._id;
    const currentlyLiked = likedSongIds.includes(songId);

    // Optimistic UI update
    if (currentlyLiked) {
      set({
        likedSongIds: likedSongIds.filter((id) => id !== songId),
        likedSongs: likedSongs.filter((s) => s._id !== songId),
      });

      const { likedSongs: updatedIds, error } = await unlikeSongApi(songId);
      if (error && updatedIds === null) {
        // Rollback on error
        set({ likedSongIds, likedSongs });
      }
    } else {
      set({
        likedSongIds: [...likedSongIds, songId],
        likedSongs: [...likedSongs, song],
      });

      const { likedSongs: updatedIds, error } = await likeSongApi(songId);
      if (error && updatedIds === null) {
        // Rollback on error
        set({ likedSongIds, likedSongs });
      }
    }
  },

  isLiked: (songId: string) => {
    return get().likedSongIds.includes(songId);
  },
}));
