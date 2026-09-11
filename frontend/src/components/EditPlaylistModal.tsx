import React, { useState, useEffect } from 'react';
import { updatePlaylistApi } from '../services/playlistService';
import type { Playlist } from '../types/music';

interface EditPlaylistModalProps {
  playlist: Playlist | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedPlaylist: Playlist) => void;
}

export const EditPlaylistModal: React.FC<EditPlaylistModalProps> = ({
  playlist,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (playlist) {
      setName(playlist.name || '');
      setDescription(playlist.description || '');
      setCoverImage(playlist.coverImage || '');
      setVisibility(playlist.visibility || 'public');
    }
  }, [playlist]);

  if (!isOpen || !playlist) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Playlist name is required');
      return;
    }

    setLoading(true);
    setError(null);

    const { playlist: updated, error: err } = await updatePlaylistApi(playlist._id, {
      name: name.trim(),
      description: description.trim(),
      coverImage: coverImage.trim(),
      visibility,
    });

    if (err || !updated) {
      setError(err || 'Failed to update playlist');
      setLoading(false);
    } else {
      setLoading(false);
      onSuccess(updated);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-surface-1 border border-border-default rounded-[var(--radius-lg)] p-6 sm:p-8 shadow-2xl space-y-6 relative animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle pb-4">
          <h3 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <span>✏️</span>
            <span>Edit Playlist Details</span>
          </h3>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary text-sm font-bold p-1 rounded-[var(--radius-sm)] hover:bg-surface-2 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 bg-danger-wash border border-danger/30 rounded-[var(--radius-md)] text-danger text-xs font-medium">
            {error}
          </div>
        )}

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">
              Playlist Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Playlist name..."
              className="w-full px-4 py-2.5 bg-surface-2 border border-border-default rounded-[var(--radius-md)] text-text-primary text-sm placeholder-text-tertiary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your playlist..."
              rows={3}
              className="w-full px-4 py-2.5 bg-surface-2 border border-border-default rounded-[var(--radius-md)] text-text-primary text-sm placeholder-text-tertiary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">
              Cover Image URL
            </label>
            <input
              type="url"
              value={coverImage}
              onChange={(e) => setCoverImage(e.target.value)}
              placeholder="https://example.com/cover.jpg"
              className="w-full px-4 py-2.5 bg-surface-2 border border-border-default rounded-[var(--radius-md)] text-text-primary text-sm placeholder-text-tertiary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">
              Visibility Settings
            </label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-text-secondary">
                <input
                  type="radio"
                  name="edit-visibility"
                  value="public"
                  checked={visibility === 'public'}
                  onChange={() => setVisibility('public')}
                  className="accent-accent"
                />
                <span>Public (Visible to all)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-text-secondary">
                <input
                  type="radio"
                  name="edit-visibility"
                  value="private"
                  checked={visibility === 'private'}
                  onChange={() => setVisibility('private')}
                  className="accent-accent"
                />
                <span>Private (Only you)</span>
              </label>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-surface-2 hover:bg-surface-3 text-text-secondary text-xs font-semibold rounded-[var(--radius-pill)] transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-accent hover:bg-accent-strong disabled:opacity-50 text-text-on-accent text-xs font-bold rounded-[var(--radius-pill)] transition-all shadow-lg flex items-center gap-2 cursor-pointer"
            >
              {loading && <div className="w-3.5 h-3.5 border-2 border-text-on-accent border-t-transparent rounded-full animate-spin" />}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
