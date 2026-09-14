import React, { useState } from 'react';
import { Play, Pause, Heart, ListPlus, Check } from 'lucide-react';
import type { Song } from '../types/music';
import { usePlayerStore } from '../store/usePlayerStore';
import { useLikedSongsStore } from '../store/useLikedSongsStore';
import { useContextMenuStore } from '../store/useContextMenuStore';
import { formatTime } from '../utils/formatters';

interface SongRowProps {
  song: Song;
  index: number;
  onPlay?: (song: Song) => void;
}

const fallbackCover =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23d9a15b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="background:%231b1815;"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';

export const SongRow: React.FC<SongRowProps> = ({ song, index, onPlay }) => {
  const [imgError, setImgError] = useState(false);
  const [playedNext, setPlayedNext] = useState(false);

  const activeSong = usePlayerStore((state) => state.currentSong);
  const activeIsPlaying = usePlayerStore((state) => state.isPlaying);
  const playSong = usePlayerStore((state) => state.playSong);
  const playNext = usePlayerStore((state) => state.playNext);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const isLiked = useLikedSongsStore((state) => state.isLiked(song._id));
  const toggleLikeSong = useLikedSongsStore((state) => state.toggleLikeSong);
  const openContextMenu = useContextMenuStore((state) => state.openContextMenu);

  const isCurrent = activeSong?._id === song._id;
  const isCurrentlyPlaying = isCurrent && activeIsPlaying;

  const getArtistName = (): string => {
    if (!song.artist) return 'Unknown Artist';
    if (typeof song.artist === 'object' && 'name' in song.artist) return song.artist.name;
    return String(song.artist);
  };

  // Clicking anywhere on the row plays the song — matches YouTube Music,
  // where the row itself is the play target and "more info" lives behind
  // the right-click/overflow menu (SongContextMenu's "View Track Details"),
  // not behind the row's primary click.
  const activatePlay = () => {
    if (onPlay) {
      onPlay(song);
    } else if (isCurrent) {
      togglePlay();
    } else {
      playSong(song);
    }
  };

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    activatePlay();
  };

  // Only act on Enter/Space when the row itself is focused — a nested
  // control (the play button, like button, etc.) already handles its own
  // keyboard activation, and bubbling would otherwise double-fire both.
  const handleRowKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activatePlay();
    }
  };

  return (
    <div
      onClick={activatePlay}
      onContextMenu={(e) => openContextMenu(e, song)}
      role="button"
      tabIndex={0}
      onKeyDown={handleRowKeyDown}
      aria-label={isCurrentlyPlaying ? `Pause ${song.title}` : `Play ${song.title} by ${getArtistName()}`}
      className="group flex items-center gap-3.5 sm:gap-4 py-3 px-2.5 sm:px-3 -mx-2 sm:-mx-3 rounded-[var(--radius-md)] hover:bg-surface-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {/* Play button / Track number */}
      <button
        type="button"
        onClick={handlePlay}
        aria-label={isCurrentlyPlaying ? `Pause ${song.title}` : `Play ${song.title}`}
        title={isCurrentlyPlaying ? 'Pause' : 'Play'}
        className="relative w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-3 text-text-tertiary hover:text-text-primary transition-all cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-accent"
      >
        {isCurrentlyPlaying ? (
          <>
            <div className="flex items-end justify-center gap-0.5 h-3.5 mx-auto w-fit transition-opacity duration-150 group-hover:opacity-0">
              <span className="w-0.5 bg-accent h-full animate-pulse" />
              <span className="w-0.5 bg-accent h-2/3 animate-pulse [animation-delay:75ms]" />
              <span className="w-0.5 bg-accent h-4/5 animate-pulse [animation-delay:150ms]" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-accent">
              <Pause size={16} fill="currentColor" strokeWidth={0} />
            </div>
          </>
        ) : (
          <>
            <span className="text-xs sm:text-sm font-mono text-text-tertiary font-semibold tabular-nums transition-opacity duration-150 group-hover:opacity-0">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-text-primary hover:text-accent">
              <Play size={16} fill="currentColor" strokeWidth={0} className="ml-0.5" />
            </div>
          </>
        )}
      </button>

      {/* Album Artwork without obstructing overlay */}
      <div className="relative w-12 h-12 rounded-[var(--radius-artwork)] overflow-hidden bg-surface-2 shrink-0 border border-border-subtle/60 shadow-xs">
        <img
          src={imgError || !song.coverImage ? fallbackCover : song.coverImage}
          alt={song.title}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Title & Artist - Increased text sizes */}
      <div className="min-w-0 flex-1 pr-2">
        <h4 className={`text-sm sm:text-base font-semibold truncate leading-snug ${isCurrent ? 'text-accent' : 'text-text-primary'}`}>
          {song.title}
        </h4>
        <p className="text-xs sm:text-sm text-text-secondary truncate mt-0.5 font-normal">
          {getArtistName()}
        </p>
      </div>

      {/* Actions */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          playNext(song);
          setPlayedNext(true);
          setTimeout(() => setPlayedNext(false), 1500);
        }}
        aria-label="Play next"
        title={playedNext ? 'Playing next' : 'Play next'}
        className={`p-2 rounded-[var(--radius-sm)] transition-all cursor-pointer shrink-0 ${
          playedNext
            ? 'opacity-100 text-success'
            : 'text-text-tertiary hover:text-text-primary opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-surface-3'
        }`}
      >
        {playedNext ? <Check size={17} /> : <ListPlus size={17} strokeWidth={1.75} />}
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleLikeSong(song);
        }}
        aria-label={isLiked ? 'Unlike song' : 'Like song'}
        title={isLiked ? 'Unlike song' : 'Like song'}
        className="p-2 text-text-tertiary hover:text-accent opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer shrink-0 hover:bg-surface-3 rounded-[var(--radius-sm)]"
      >
        <Heart
          size={17}
          fill={isLiked ? 'currentColor' : 'none'}
          className={isLiked ? 'text-accent opacity-100' : ''}
          strokeWidth={1.75}
        />
      </button>

      {/* Duration - Increased text size */}
      <span className="text-xs sm:text-sm font-mono text-text-secondary tabular-nums w-11 text-right shrink-0 font-medium">
        {formatTime(song.duration)}
      </span>
    </div>
  );
};
