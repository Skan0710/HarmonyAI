import React, { useEffect, useState } from 'react';
import { ListMusic, Plus } from 'lucide-react';
import type { Playlist } from '../types/music';
import { fetchUserPlaylistsApi, deletePlaylistApi } from '../services/playlistService';
import { PlaylistCard } from '../components/PlaylistCard';
import { CreatePlaylistModal } from '../components/CreatePlaylistModal';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { Button } from '../components/ui/Button';

export const PlaylistsPage: React.FC = () => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [deletingPlaylistId, setDeletingPlaylistId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

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

  const handleConfirmDelete = async () => {
    if (!deletingPlaylistId) return;
    setDeleting(true);

    const { success, error: err } = await deletePlaylistApi(deletingPlaylistId);
    setDeleting(false);

    if (success) {
      setPlaylists((prev) => prev.filter((p) => p._id !== deletingPlaylistId));
      setDeletingPlaylistId(null);
    } else {
      alert(err || 'Failed to delete playlist');
    }
  };

  const targetPlaylist = playlists.find((p) => p._id === deletingPlaylistId);

  return (
    <div className="pb-16">
      <section className="border-b border-border-subtle px-5 sm:px-8 lg:px-12 pt-10 pb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-text-tertiary uppercase tracking-[0.14em]">Your library</p>
          <h1 className="font-display text-2xl sm:text-3xl text-text-primary leading-snug mt-3">Playlists</h1>
        </div>

        <Button onClick={() => setIsCreateModalOpen(true)} className="self-start sm:self-center shrink-0">
          <Plus size={15} />
          Create playlist
        </Button>
      </section>

      <div className="px-5 sm:px-8 lg:px-12 pt-8">
        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-56 bg-surface-1 rounded-[var(--radius-md)]" />
            ))}
          </div>
        )}

        {error && !loading && (
          <div className="p-6 bg-danger-wash rounded-[var(--radius-md)] text-center max-w-lg space-y-3">
            <p className="text-danger text-sm">{error}</p>
            <button
              onClick={loadPlaylists}
              className="px-4 py-2 bg-danger text-text-on-accent text-xs font-semibold rounded-[var(--radius-pill)] transition-opacity hover:opacity-90 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && playlists.length === 0 && (
          <div className="py-16 text-center max-w-md mx-auto space-y-3">
            <ListMusic size={28} className="text-text-tertiary mx-auto" strokeWidth={1.5} />
            <h3 className="font-display text-lg text-text-primary">No playlists yet</h3>
            <p className="text-text-tertiary text-sm">
              Create your first playlist to organize favorites and build custom mixes.
            </p>
            <Button onClick={() => setIsCreateModalOpen(true)} className="mt-2">
              Create playlist
            </Button>
          </div>
        )}

        {!loading && !error && playlists.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
            {playlists.map((playlist) => (
              <PlaylistCard
                key={playlist._id}
                playlist={playlist}
                onDelete={(id) => setDeletingPlaylistId(id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Playlist Modal Dialog */}
      <CreatePlaylistModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handlePlaylistCreated}
      />

      {/* Confirm Delete Modal Dialog */}
      <ConfirmDeleteModal
        isOpen={Boolean(deletingPlaylistId)}
        title={`Delete "${targetPlaylist?.name || 'Playlist'}"?`}
        message="Are you sure you want to delete this playlist? This action cannot be undone."
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingPlaylistId(null)}
      />
    </div>
  );
};
