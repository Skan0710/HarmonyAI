import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Sparkles, X } from 'lucide-react';
import { createPlaylistApi } from '../services/playlistService';
import type { Playlist } from '../types/music';
import { SmoothInput } from './ui/SmoothInput';

interface CreatePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newPlaylist: Playlist) => void;
}

export const CreatePlaylistModal: React.FC<CreatePlaylistModalProps> = ({
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Playlist name is required');
      return;
    }

    setLoading(true);
    setError(null);

    const { playlist, error: err } = await createPlaylistApi({
      name: name.trim(),
      description: description.trim(),
      coverImage: coverImage.trim(),
      visibility,
    });

    if (err || !playlist) {
      setError(err || 'Failed to create playlist');
      setLoading(false);
    } else {
      setLoading(false);
      setName('');
      setDescription('');
      setCoverImage('');
      setVisibility('public');
      onSuccess(playlist);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
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
            className="w-full max-w-md bg-surface-1 rounded-[var(--radius-lg)] p-6 sm:p-8 space-y-6"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border-subtle pb-4">
              <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <Sparkles size={17} className="text-accent" strokeWidth={1.75} />
                Create New Playlist
              </h3>
              <button
                onClick={onClose}
                className="p-1.5 text-text-tertiary hover:text-text-primary rounded-full hover:bg-surface-2 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="p-2.5 bg-danger-wash rounded-[var(--radius-sm)] text-danger text-xs">{error}</div>
            )}

            {/* Form Inputs */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-2xs font-semibold text-text-tertiary uppercase tracking-wider mb-1.5">
                  Playlist Name *
                </label>
                <SmoothInput
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Chill Vibes, Synthwave Favorites..."
                  wrapperClassName="w-full bg-surface-2 rounded-[var(--radius-md)] focus-within:ring-1 focus-within:ring-border-strong transition-shadow"
                  className="w-full px-4 py-2.5 text-text-primary placeholder-text-tertiary text-sm"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-text-tertiary uppercase tracking-wider mb-1.5">
                  Description (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add an optional description for your playlist..."
                  rows={3}
                  className="w-full px-4 py-2.5 bg-surface-2 rounded-[var(--radius-md)] text-text-primary text-sm placeholder-text-tertiary focus:outline-none focus:ring-1 focus:ring-border-strong transition-shadow resize-none"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-text-tertiary uppercase tracking-wider mb-1.5">
                  Cover Image URL (Optional)
                </label>
                <SmoothInput
                  type="url"
                  value={coverImage}
                  onChange={(e) => setCoverImage(e.target.value)}
                  placeholder="https://example.com/cover.jpg"
                  wrapperClassName="w-full bg-surface-2 rounded-[var(--radius-md)] focus-within:ring-1 focus-within:ring-border-strong transition-shadow"
                  className="w-full px-4 py-2.5 text-text-primary placeholder-text-tertiary text-sm"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-text-tertiary uppercase tracking-wider mb-1.5">
                  Visibility
                </label>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-text-secondary">
                    <input
                      type="radio"
                      name="visibility"
                      value="public"
                      checked={visibility === 'public'}
                      onChange={() => setVisibility('public')}
                      className="accent-accent"
                    />
                    <span>Public (Visible to everyone)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-text-secondary">
                    <input
                      type="radio"
                      name="visibility"
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
                  className="px-5 py-2 bg-accent hover:bg-accent-strong disabled:opacity-50 text-text-on-accent text-xs font-semibold rounded-[var(--radius-pill)] transition-colors flex items-center gap-2 cursor-pointer"
                >
                  {loading && <div className="w-3.5 h-3.5 border-2 border-text-on-accent border-t-transparent rounded-full animate-spin" />}
                  <span>Create Playlist</span>
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
