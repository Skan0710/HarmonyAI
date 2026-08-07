import React, { useEffect, useState } from 'react';
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

  if (!isOpen || !song) return null;

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
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23818cf8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="background:%231e293b;"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 relative animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span className="text-indigo-400">📁</span>
                <span>Add to Playlist</span>
              </h3>
              <p className="text-xs text-slate-400 truncate max-w-[220px]">
                "{song.title}"
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 text-sm font-bold p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Toast Action Feedback */}
          {actionMessage && (
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-semibold text-center animate-in fade-in">
              ✓ {actionMessage}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-medium">
              {error}
            </div>
          )}

          {/* Create New Playlist Action Button */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="w-full py-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 font-bold text-xs rounded-2xl transition-all flex items-center justify-center gap-2"
          >
            <span className="text-sm">+</span>
            <span>Create New Playlist</span>
          </button>

          {/* Playlists List */}
          <div className="space-y-1.5 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 pr-1">
            {loading ? (
              <div className="space-y-2 py-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-12 bg-slate-800/60 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : playlists.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No playlists found. Click above to create one!
              </div>
            ) : (
              playlists.map((playlist) => {
                const added = isSongInPlaylist(playlist);
                return (
                  <div
                    key={playlist._id}
                    onClick={() => handleTogglePlaylist(playlist)}
                    className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border ${
                      added
                        ? 'bg-indigo-950/40 border-indigo-500/40'
                        : 'bg-slate-800/40 hover:bg-slate-800 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={playlist.coverImage || fallbackCover}
                        alt={playlist.name}
                        className="w-9 h-9 rounded-lg object-cover bg-slate-800 shrink-0 border border-slate-700/60"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-100 truncate group-hover:text-indigo-300">
                          {playlist.name}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {playlist.songs ? playlist.songs.length : 0} tracks
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 pl-2">
                      {added ? (
                        <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-md">
                          ✓
                        </span>
                      ) : (
                        <span className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 text-slate-400 group-hover:text-white flex items-center justify-center text-xs font-bold">
                          +
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Close Button */}
          <div className="pt-2 border-t border-slate-800 text-right">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>

      {/* Embedded Create Playlist Modal */}
      <CreatePlaylistModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handlePlaylistCreated}
      />
    </>
  );
};
