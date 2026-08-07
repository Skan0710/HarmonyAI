import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 24 24" fill="none" stroke="%23818cf8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="background:%231e293b;"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';

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
      className="group relative cursor-pointer bg-slate-800/70 hover:bg-slate-800/90 border border-slate-700/60 hover:border-indigo-500/60 rounded-2xl p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/15 flex flex-col justify-between overflow-hidden"
    >
      <div>
        {/* Cover Artwork Container */}
        <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-slate-900 mb-3 shadow-inner">
          <img
            src={coverUrl}
            alt={playlist.name}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />

          {/* Visibility Badge */}
          <div className="absolute top-2 left-2 z-10">
            <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-slate-900/85 backdrop-blur-md text-indigo-300 rounded-full border border-indigo-500/30">
              {playlist.visibility || 'public'}
            </span>
          </div>

          {/* Delete Action Button */}
          {onDelete && (
            <button
              onClick={handleDeleteClick}
              className="absolute top-2 right-2 z-20 p-1.5 rounded-full bg-slate-900/70 hover:bg-rose-950/90 text-slate-400 hover:text-rose-300 border border-slate-700/50 opacity-0 group-hover:opacity-100 transition-all duration-200"
              title="Delete Playlist"
              aria-label="Delete Playlist"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}

          {/* Hover Play Button */}
          {songCount > 0 && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
              <button
                onClick={handlePlayClick}
                className="w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/50 transform scale-90 group-hover:scale-100 transition-all duration-300"
                aria-label={`Play ${playlist.name}`}
              >
                <svg className="w-5 h-5 fill-current ml-0.5" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Playlist Info */}
        <div className="space-y-1">
          <h3 className="font-bold text-slate-100 text-base leading-snug line-clamp-1 group-hover:text-indigo-300 transition-colors">
            {playlist.name}
          </h3>
          <p className="text-xs text-slate-400 line-clamp-2 min-h-[2rem]">
            {playlist.description || 'Custom playlist'}
          </p>
        </div>
      </div>

      {/* Footer Stats */}
      <div className="mt-4 pt-2.5 border-t border-slate-700/40 flex items-center justify-between text-xs text-slate-400">
        <span className="font-mono text-indigo-400 font-semibold">
          {songCount} {songCount === 1 ? 'song' : 'songs'}
        </span>
        <span className="text-[11px] text-slate-500">
          Playlist
        </span>
      </div>
    </div>
  );
};
