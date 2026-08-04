import React from 'react';
import type { Song } from '../types/music';

interface AudioPlayerProps {
  song: Song | null;
  onClose: () => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ song, onClose }) => {
  if (!song) return null;

  const getArtistName = (): string => {
    if (!song.artist) return 'Unknown Artist';
    if (typeof song.artist === 'object' && 'name' in song.artist) {
      return song.artist.name;
    }
    return String(song.artist);
  };

  const fallbackCover =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23818cf8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="background:%231e293b;"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-2xl bg-slate-900/95 border border-indigo-500/40 backdrop-blur-xl rounded-2xl p-3.5 sm:p-4 shadow-2xl shadow-indigo-950/50 flex items-center justify-between gap-4 animate-in slide-in-from-bottom duration-300">
      {/* Song Metadata */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg overflow-hidden bg-slate-800 shrink-0 border border-slate-700/60 shadow-sm">
          <img
            src={song.coverImage || fallbackCover}
            alt={song.title}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-slate-100 truncate group-hover:text-indigo-300 transition-colors">
            {song.title}
          </h4>
          <p className="text-xs text-indigo-400 truncate mt-0.5">{getArtistName()}</p>
        </div>
      </div>

      {/* HTML5 Audio Controls */}
      <audio
        src={song.audioUrl}
        controls
        autoPlay
        className="h-9 max-w-xs accent-indigo-500 flex-1 min-w-0"
      />

      {/* Close Player Button */}
      <button
        onClick={onClose}
        className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors font-bold text-xs shrink-0"
        aria-label="Close Audio Player"
      >
        ✕
      </button>
    </div>
  );
};
