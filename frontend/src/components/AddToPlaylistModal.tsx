import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ListMusic, X, Plus, Check } from 'lucide-react';
import type { Playlist, Song } from '../types/music';
import {
  fetchUserPlaylistsApi,
  addSongToPlaylistApi,
  removeSongFromPlaylistApi,
} from '../services/playlistService';
import { CreatePlaylistModal } from './CreatePlaylistModal';

interface AddToPlaylistModalProps {
  song: Song | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  song,
  isOpen,
  onClose,
}) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);

  const loadPlaylists = async () => {
    setLoading(true);
    setError(null);
    const { playlists: data, error: err } = await fetchUserPlaylistsApi();

    if (err) {
      setError(err);
    } else if (data) {
      setPlaylists(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadPlaylists();
      setActionMessage(null);
    }
  }, [isOpen]);

  if (!song) return null;

  const isSongInPlaylist = (playlist: Playlist): boolean => {
    if (!playlist.songs) return false;
    return playlist.songs.some((s: any) => {
      const songId = typeof s === 'object' ? s._id : s;
      return songId === song._id;
    });
  };

  const handleTogglePlaylist = async (playlist: Playlist) => {
    const inPlaylist = isSongInPlaylist(playlist);

    if (inPlaylist) {
      const { playlist: updated, error: err } = await removeSongFromPlaylistApi(playlist._id, song._id);
      if (err) {
        setError(err);
      } else if (updated) {
        setPlaylists((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
        setActionMessage(`Removed from "${playlist.name}"`);
        setTimeout(() => setActionMessage(null), 2500);
      }
    } else {
      const { playlist: updated, error: err } = await addSongToPlaylistApi(playlist._id, song._id);
      if (err) {
        setError(err);
      } else if (updated) {
        setPlaylists((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
        setActionMessage(`Added to "${playlist.name}"`);
        setTimeout(() => setActionMessage(null), 2500);
      }
    }
  };

  const handlePlaylistCreated = (newPlaylist: Playlist) => {
    setPlaylists((prev) => [newPlaylist, ...prev]);
    // Automatically add song to the newly created playlist
    handleTogglePlaylist(newPlaylist);
  };

  const fallbackCover =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23d9a15b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="background:%231b1815;"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';

  return (
    <>
      <AnimatePresence>
        {isOpen && song && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 bg-black/70"
            onClick={onClose}
          >
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-surface-1 rounded-[var(--radius-lg)] p-5 sm:p-6 space-y-5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
                    <ListMusic size={16} className="text-accent" strokeWidth={1.75} />
                    Add to playlist
                  </h3>
                  <p className="text-xs text-text-tertiary truncate max-w-[220px] mt-0.5">"{song.title}"</p>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 text-text-tertiary hover:text-text-primary rounded-full hover:bg-surface-2 transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {actionMessage && (
                <div className="p-2.5 bg-success/10 rounded-[var(--radius-sm)] text-success text-xs font-medium text-center">
                  {actionMessage}
                </div>
              )}

              {error && (
                <div className="p-2.5 bg-danger-wash rounded-[var(--radius-sm)] text-danger text-xs">{error}</div>
              )}

              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="w-full py-2.5 bg-accent-wash hover:bg-accent-wash-strong text-accent font-medium text-xs rounded-[var(--radius-md)] transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus size={14} />
                Create new playlist
              </button>

              <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                {loading ? (
                  <div className="space-y-2 py-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-12 bg-surface-2 rounded-[var(--radius-md)] animate-pulse" />
                    ))}
                  </div>
                ) : playlists.length === 0 ? (
                  <div className="py-6 text-center text-xs text-text-tertiary">
                    No playlists yet. Create one above.
                  </div>
                ) : (
                  playlists.map((playlist) => {
                    const added = isSongInPlaylist(playlist);
                    return (
                      <div
                        key={playlist._id}
                        onClick={() => handleTogglePlaylist(playlist)}
                        className={`group flex items-center justify-between p-2.5 rounded-[var(--radius-sm)] cursor-pointer transition-colors ${
                          added ? 'bg-accent-wash' : 'hover:bg-surface-2'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={playlist.coverImage || fallbackCover}
                            alt={playlist.name}
                            className="w-9 h-9 rounded-[var(--radius-artwork)] object-cover bg-surface-2 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className={`text-xs font-medium truncate ${added ? 'text-accent' : 'text-text-primary'}`}>
                              {playlist.name}
                            </p>
                            <p className="text-2xs text-text-tertiary font-mono">
                              {playlist.songs ? playlist.songs.length : 0} tracks
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 pl-2">
                          {added ? (
                            <span className="w-6 h-6 rounded-full bg-accent text-text-on-accent flex items-center justify-center">
                              <Check size={12} strokeWidth={2.5} />
                            </span>
                          ) : (
                            <span className="w-6 h-6 rounded-full bg-surface-3 text-text-tertiary group-hover:text-text-primary flex items-center justify-center">
                              <Plus size={12} strokeWidth={2} />
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="pt-2 border-t border-border-subtle text-right">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-surface-2 hover:bg-surface-3 text-text-secondary text-xs font-semibold rounded-[var(--radius-pill)] transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <CreatePlaylistModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handlePlaylistCreated}
      />
    </>
  );
};
