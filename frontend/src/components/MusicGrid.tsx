import React from 'react';
import type { Song } from '../types/music';
import { SongCard } from './SongCard';

interface MusicGridProps {
  songs: Song[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onPlaySong?: (song: Song) => void;
  currentSongId?: string;
  emptyMessage?: string;
}

export const MusicGrid: React.FC<MusicGridProps> = ({
  songs,
  loading = false,
  error = null,
  onRetry,
  onPlaySong,
  currentSongId,
  emptyMessage = 'No songs available in the library right now.',
}) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
        {Array.from({ length: 10 }).map((_, index) => (
          <div
            key={index}
            className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3.5 animate-pulse flex flex-col justify-between"
          >
            <div>
              <div className="w-full aspect-square bg-slate-700/60 rounded-lg mb-3" />
              <div className="h-4 bg-slate-700/70 rounded w-3/4 mb-2" />
              <div className="h-3 bg-slate-700/50 rounded w-1/2 mb-1" />
              <div className="h-3 bg-slate-700/40 rounded w-2/3" />
            </div>
            <div className="mt-4 pt-2 border-t border-slate-700/40 flex justify-between">
              <div className="h-3 bg-slate-700/50 rounded w-1/4" />
              <div className="h-3 bg-slate-700/50 rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-8 p-8 bg-slate-800/50 border border-rose-500/30 rounded-2xl text-center flex flex-col items-center justify-center max-w-lg mx-auto backdrop-blur-md">
        <div className="w-14 h-14 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mb-4">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-slate-100 mb-1">Failed to Load Music</h3>
        <p className="text-sm text-slate-400 mb-5">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-lg transition-colors shadow-lg shadow-indigo-600/30 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Try Again
          </button>
        )}
      </div>
    );
  }

  if (!songs || songs.length === 0) {
    return (
      <div className="my-12 p-10 bg-slate-800/40 border border-slate-700/50 rounded-2xl text-center flex flex-col items-center justify-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-full bg-slate-700/50 text-slate-400 flex items-center justify-center mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-slate-200 mb-1">No Songs Found</h3>
        <p className="text-sm text-slate-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
      {songs.map((song) => (
        <SongCard
          key={song._id}
          song={song}
          onPlay={onPlaySong}
          isPlaying={currentSongId === song._id}
        />
      ))}
    </div>
  );
};
