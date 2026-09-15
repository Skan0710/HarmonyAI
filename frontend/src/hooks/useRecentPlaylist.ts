import { useCallback } from 'react';
import type { Song } from '../types/music';
import { addSongToPlaylistApi, fetchUserPlaylistsApi } from '../services/playlistService';
import { toast } from '../store/useToastStore';

export interface RecentPlaylistInfo {
  id: string;
  name: string;
}

const STORAGE_KEY = 'harmony_recent_playlist';

export const getRecentPlaylist = (): RecentPlaylistInfo | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.id === 'string' && typeof parsed.name === 'string') {
      return parsed;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
};

export const setRecentPlaylist = (info: RecentPlaylistInfo | null) => {
  try {
    if (info) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(info));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    window.dispatchEvent(new CustomEvent('harmony:recent-playlist-changed', { detail: info }));
  } catch {
    // Ignore storage quota errors
  }
};

export const broadcastPlaylistUpdated = (playlistId?: string) => {
  window.dispatchEvent(new CustomEvent('harmony:playlist-updated', { detail: { playlistId } }));
};

export const useRecentPlaylist = () => {
  const addSongWithRecentPlaylist = useCallback(
    async (song: Song, openModalFallback: () => void) => {
      let recent = getRecentPlaylist();

      // If no recent playlist in storage, check if user has playlists and use the most recent one
      if (!recent) {
        try {
          const { playlists } = await fetchUserPlaylistsApi();
          if (playlists && playlists.length > 0) {
            recent = { id: playlists[0]._id, name: playlists[0].name };
            setRecentPlaylist(recent);
          }
        } catch {
          // Ignore and fallback
        }
      }

      if (!recent) {
        openModalFallback();
        return;
      }

      const { error } = await addSongToPlaylistApi(recent.id, song._id);

      if (error) {
        // If playlist doesn't exist anymore or unauthorized, clear recent and open modal
        if (error.toLowerCase().includes('not found') || error.toLowerCase().includes('unauthorized')) {
          setRecentPlaylist(null);
          openModalFallback();
          return;
        }
        toast.error(error || 'Failed to add to playlist');
        return;
      }

      broadcastPlaylistUpdated(recent.id);

      toast.success(`Added to "${recent.name}"`, {
        action: {
          label: 'Change',
          onClick: () => {
            openModalFallback();
          },
        },
      });
    },
    []
  );

  return {
    getRecentPlaylist,
    setRecentPlaylist,
    addSongWithRecentPlaylist,
  };
};
