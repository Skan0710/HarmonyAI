import { create } from 'zustand';
import type { Song } from '../types/music';
import { fetchLikedSongsApi, likeSongApi, unlikeSongApi } from '../services/userService';
import { toast } from './useToastStore';

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
      toast.info('Removed from Liked Songs');

      const { likedSongs: updatedIds, error } = await unlikeSongApi(songId);
      if (error && updatedIds === null) {
        // Rollback on error
        set({ likedSongIds, likedSongs });
        toast.error('Failed to update liked songs');
      } else if (updatedIds) {
        set({ likedSongIds: updatedIds });
      }
    } else {
      set({
        likedSongIds: [...likedSongIds, songId],
        likedSongs: [song, ...likedSongs.filter((s) => s._id !== songId)],
      });
      toast.success('Added to Liked Songs!');

      const { likedSongs: updatedIds, error } = await likeSongApi(songId);
      if (error && updatedIds === null) {
        // Rollback on error
        set({ likedSongIds, likedSongs });
        toast.error('Failed to add to liked songs');
      } else if (updatedIds) {
        set({ likedSongIds: updatedIds });
      }
    }
  },

  isLiked: (songId: string) => {
    return get().likedSongIds.includes(songId);
  },
}));
