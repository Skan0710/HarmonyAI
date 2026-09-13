import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
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

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onPlay) {
      onPlay(song);
    } else if (isCurrent) {
      togglePlay();
    } else {
      playSong(song);
    }
  };

  return (
    <div
      onClick={() => song._id && navigate(`/songs/${song._id}`)}
      onContextMenu={(e) => openContextMenu(e, song)}
      className="group flex items-center gap-3.5 py-2.5 px-2 -mx-2 rounded-[var(--radius-sm)] hover:bg-surface-2 transition-colors cursor-pointer"
    >
      <span className="w-5 text-center text-2xs font-mono text-text-tertiary shrink-0 tabular-nums">
        {isCurrentlyPlaying ? (
          <div className="flex items-end justify-center gap-0.5 h-3 mx-auto w-fit">
            <span className="w-0.5 bg-accent h-full animate-pulse" />
            <span className="w-0.5 bg-accent h-2/3 animate-pulse [animation-delay:75ms]" />
            <span className="w-0.5 bg-accent h-4/5 animate-pulse [animation-delay:150ms]" />
          </div>
        ) : (
          String(index + 1).padStart(2, '0')
        )}
      </span>

      <div className="relative w-10 h-10 rounded-[var(--radius-artwork)] overflow-hidden bg-surface-2 shrink-0">
        <img
          src={imgError || !song.coverImage ? fallbackCover : song.coverImage}
          alt={song.title}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
        <button
          onClick={handlePlay}
          aria-label={isCurrentlyPlaying ? `Pause ${song.title}` : `Play ${song.title}`}
          className="absolute inset-0 bg-surface-0/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-text-primary transition-opacity cursor-pointer"
        >
          {isCurrentlyPlaying ? <Pause size={14} fill="currentColor" strokeWidth={0} /> : <Play size={14} fill="currentColor" strokeWidth={0} />}
        </button>
      </div>

      <div className="min-w-0 flex-1">
        <h4 className={`text-sm font-medium truncate ${isCurrent ? 'text-accent' : 'text-text-primary'}`}>{song.title}</h4>
        <p className="text-xs text-text-tertiary truncate mt-0.5">{getArtistName()}</p>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          playNext(song);
          setPlayedNext(true);
          setTimeout(() => setPlayedNext(false), 1500);
        }}
        aria-label="Play next"
        title={playedNext ? 'Playing next' : 'Play next'}
        className={`p-1.5 rounded-[var(--radius-sm)] transition-all cursor-pointer shrink-0 ${
          playedNext
            ? 'opacity-100 text-success'
            : 'text-text-tertiary hover:text-text-primary opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
        }`}
      >
        {playedNext ? <Check size={14} /> : <ListPlus size={14} strokeWidth={1.75} />}
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleLikeSong(song);
        }}
        aria-label={isLiked ? 'Unlike song' : 'Like song'}
        className="p-1.5 text-text-tertiary hover:text-accent opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer shrink-0"
      >
        <Heart size={14} fill={isLiked ? 'currentColor' : 'none'} className={isLiked ? 'text-accent opacity-100' : ''} strokeWidth={1.75} />
      </button>

      <span className="text-2xs font-mono text-text-tertiary tabular-nums w-9 text-right shrink-0">
        {formatTime(song.duration)}
      </span>
    </div>
  );
};
