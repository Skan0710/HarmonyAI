import React from 'react';
import { AlertTriangle, ListMusic, RefreshCw } from 'lucide-react';
import type { Song } from '../types/music';
import { SongCard } from './SongCard';
import { usePlayerStore } from '../store/usePlayerStore';

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
  const playSong = usePlayerStore((state) => state.playSong);

  const handlePlay = (song: Song) => {
    if (onPlaySong) {
      onPlaySong(song);
    } else {
      playSong(song, songs);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="bg-surface-1 rounded-[var(--radius-md)] p-3 animate-pulse flex flex-col justify-between">
            <div>
              <div className="w-full aspect-square bg-surface-2 rounded-[var(--radius-artwork)] mb-3" />
              <div className="h-3 bg-surface-2 rounded w-3/4 mb-2" />
              <div className="h-2.5 bg-surface-2 rounded w-1/2 mb-1" />
              <div className="h-2.5 bg-surface-2 rounded w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-8 p-8 bg-surface-1 rounded-[var(--radius-lg)] text-center flex flex-col items-center justify-center max-w-lg mx-auto">
        <AlertTriangle size={26} className="text-danger mb-4" strokeWidth={1.5} />
        <h3 className="text-base font-semibold text-text-primary mb-1">Failed to load music</h3>
        <p className="text-sm text-text-tertiary mb-5">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-5 py-2.5 bg-accent hover:bg-accent-strong text-text-on-accent font-medium text-sm rounded-[var(--radius-pill)] transition-colors flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw size={15} />
            Try again
          </button>
        )}
      </div>
    );
  }

  if (!songs || songs.length === 0) {
    return (
      <div className="my-12 p-10 bg-surface-1 rounded-[var(--radius-lg)] text-center flex flex-col items-center justify-center max-w-md mx-auto">
        <ListMusic size={28} className="text-text-tertiary mb-4" strokeWidth={1.5} />
        <h3 className="text-base font-semibold text-text-primary mb-1">No songs found</h3>
        <p className="text-sm text-text-tertiary">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
      {songs.map((song) => (
        <SongCard
          key={song._id}
          song={song}
          onPlay={() => handlePlay(song)}
          isPlaying={currentSongId === song._id}
        />
      ))}
    </div>
  );
};
