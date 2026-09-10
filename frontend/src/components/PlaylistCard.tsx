import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Trash2 } from 'lucide-react';
import type { Playlist } from '../types/music';
import { usePlayerStore } from '../store/usePlayerStore';

interface PlaylistCardProps {
  playlist: Playlist;
  onDelete?: (id: string) => void;
}

export const PlaylistCard: React.FC<PlaylistCardProps> = ({ playlist, onDelete }) => {
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);
  const playSong = usePlayerStore((state) => state.playSong);

  const songCount = playlist.songs ? playlist.songs.length : 0;

  const fallbackCover =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 24 24" fill="none" stroke="%23d9a15b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="background:%231b1815;"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';

  const coverUrl = imgError || !playlist.coverImage ? fallbackCover : playlist.coverImage;

  const handleCardClick = () => {
    navigate(`/playlists/${playlist._id}`);
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (playlist.songs && playlist.songs.length > 0) {
      playSong(playlist.songs[0], playlist.songs);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete && playlist._id) {
      onDelete(playlist._id);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className="group relative cursor-pointer bg-surface-1 hover:bg-surface-2 rounded-[var(--radius-md)] p-3 transition-colors duration-[var(--duration-base)] flex flex-col justify-between overflow-hidden"
    >
      <div>
        <div className="relative aspect-square w-full rounded-[var(--radius-artwork)] overflow-hidden bg-surface-2 mb-3">
          <img
            src={coverUrl}
            alt={playlist.name}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />

          <div className="absolute top-2 left-2 z-10">
            <span className="px-2 py-0.5 text-2xs font-medium tracking-wide bg-surface-0/80 backdrop-blur-md text-text-secondary rounded-[var(--radius-sharp)] capitalize">
              {playlist.visibility || 'public'}
            </span>
          </div>

          {onDelete && (
            <button
              onClick={handleDeleteClick}
              className="absolute top-2 right-2 z-20 p-1.5 rounded-full bg-surface-0/70 hover:bg-surface-0 text-text-secondary hover:text-danger opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer"
              title="Delete Playlist"
              aria-label="Delete Playlist"
            >
              <Trash2 size={13} strokeWidth={1.75} />
            </button>
          )}

          {songCount > 0 && (
            <div className="absolute inset-0 bg-surface-0/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
              <button
                onClick={handlePlayClick}
                className="w-11 h-11 rounded-full bg-accent hover:bg-accent-strong text-text-on-accent flex items-center justify-center transform scale-90 group-hover:scale-100 transition-all duration-300 cursor-pointer"
                aria-label={`Play ${playlist.name}`}
              >
                <Play size={18} fill="currentColor" strokeWidth={0} className="ml-0.5" />
              </button>
            </div>
          )}
        </div>

        <div className="space-y-1">
          <h3 className="font-semibold text-text-primary text-sm leading-snug line-clamp-1 group-hover:text-accent transition-colors">
            {playlist.name}
          </h3>
          <p className="text-xs text-text-tertiary line-clamp-2 min-h-[2rem]">
            {playlist.description || 'Custom playlist'}
          </p>
        </div>
      </div>

      <div className="mt-3 pt-2.5 border-t border-border-subtle text-2xs text-text-tertiary font-mono">
        {songCount} {songCount === 1 ? 'song' : 'songs'}
      </div>
    </div>
  );
};
