import React, { useEffect, useState } from 'react';
import type { Playlist } from '../types/music';
import { fetchUserPlaylistsApi, deletePlaylistApi } from '../services/playlistService';
import { PlaylistCard } from '../components/PlaylistCard';
import { CreatePlaylistModal } from '../components/CreatePlaylistModal';
import { Breadcrumbs } from '../components/Breadcrumbs';

export const PlaylistsPage: React.FC = () => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

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
    loadPlaylists();
  }, []);

  const handlePlaylistCreated = (newPlaylist: Playlist) => {
    setPlaylists((prev) => [newPlaylist, ...prev]);
  };

  const handleDeletePlaylist = async (playlistId: string) => {
    if (!window.confirm('Are you sure you want to delete this playlist?')) return;

    const { success, error: err } = await deletePlaylistApi(playlistId);

    if (success) {
      setPlaylists((prev) => prev.filter((p) => p._id !== playlistId));
    } else {
      alert(err || 'Failed to delete playlist');
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Breadcrumbs Navigation */}
      <Breadcrumbs items={[{ label: 'Playlists' }]} />

      {/* Header Banner & Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight flex items-center gap-3">
            <span className="p-2 bg-indigo-600/20 text-indigo-400 rounded-2xl border border-indigo-500/30 text-2xl">
              📁
            </span>
            <span>Your Playlists</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Create, manage, and listen to your custom playlist collections.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm rounded-2xl transition-all shadow-lg shadow-indigo-600/40 hover:scale-105 active:scale-95 flex items-center gap-2 self-start sm:self-center shrink-0"
        >
          <span className="text-base font-bold">+</span>
          <span>Create Playlist</span>
        </button>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-64 bg-slate-800/60 rounded-2xl" />
          ))}
        </div>
      )}

      {/* Error Message */}
      {error && !loading && (
        <div className="p-6 bg-slate-800/60 border border-rose-500/30 rounded-2xl text-center max-w-lg mx-auto">
          <p className="text-rose-400 font-medium text-sm">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && playlists.length === 0 && (
        <div className="py-16 text-center max-w-md mx-auto space-y-4">
          <div className="w-20 h-20 rounded-full bg-slate-800/80 border border-slate-700/60 text-indigo-400 flex items-center justify-center mx-auto shadow-lg">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-slate-200">No Playlists Created Yet</h3>
          <p className="text-slate-400 text-xs">
            Create your first playlist to organize your favorite tracks and build custom mixes.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all"
          >
            Create Playlist Now
          </button>
        </div>
      )}

      {/* Playlists Grid */}
      {!loading && !error && playlists.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          {playlists.map((playlist) => (
            <PlaylistCard
              key={playlist._id}
              playlist={playlist}
              onDelete={handleDeletePlaylist}
            />
          ))}
        </div>
      )}

      {/* Create Playlist Modal Dialog */}
      <CreatePlaylistModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handlePlaylistCreated}
      />
    </div>
  );
};
