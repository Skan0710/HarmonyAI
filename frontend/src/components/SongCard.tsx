import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Song } from '../types/music';
import { usePlayerStore } from '../store/usePlayerStore';

interface SongCardProps {
  song: Song;
  onPlay?: (song: Song) => void;
  isPlaying?: boolean;
}

export const SongCard: React.FC<SongCardProps> = ({ song, onPlay, isPlaying }) => {
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);

  const activeSong = usePlayerStore((state) => state.currentSong);
  const activeIsPlaying = usePlayerStore((state) => state.isPlaying);
  const playSong = usePlayerStore((state) => state.playSong);
  const togglePlay = usePlayerStore((state) => state.togglePlay);

  const isCurrentTrackPlaying =
    isPlaying !== undefined
      ? isPlaying
      : activeSong?._id === song._id && activeIsPlaying;

  const getArtistName = (): string => {
    if (!song.artist) return 'Unknown Artist';
    if (typeof song.artist === 'object' && 'name' in song.artist) {
      return song.artist.name;
    }
    return String(song.artist);
  };

  const getAlbumTitle = (): string => {
    if (!song.album) return 'Single';
    if (typeof song.album === 'object' && 'title' in song.album) {
      return song.album.title;
    }
    return String(song.album);
  };

  const getGenreName = (): string => {
    if (!song.genre) return 'Music';
    if (typeof song.genre === 'object' && 'name' in song.genre) {
      return song.genre.name;
    }
    return String(song.genre);
  };

  const formatDuration = (seconds: number): string => {
    if (!seconds || seconds <= 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const formatPlayCount = (count?: number): string => {
    if (!count) return '0';
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
    if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
    return count.toString();
  };

  const fallbackCover =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 24 24" fill="none" stroke="%23818cf8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="background:%231e293b;"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';

  const coverUrl = imgError || !song.coverImage ? fallbackCover : song.coverImage;

  const handleCardClick = () => {
    if (song._id) {
      navigate(`/songs/${song._id}`);
    }
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onPlay) {
      onPlay(song);
    } else {
      if (activeSong?._id === song._id) {
        togglePlay();
      } else {
        playSong(song);
      }
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className={`group relative cursor-pointer bg-slate-800/70 hover:bg-slate-800/90 border border-slate-700/60 hover:border-indigo-500/60 rounded-2xl p-3.5 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/15 flex flex-col justify-between overflow-hidden ${
        isCurrentTrackPlaying ? 'border-indigo-500 ring-2 ring-indigo-500/30 bg-slate-800' : ''
      }`}
    >
      <div>
        <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-slate-900 mb-3 shadow-inner">
          <img
            src={coverUrl}
            alt={song.title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />

          <div className="absolute top-2 left-2 z-10">
            <span className="px-2.5 py-0.5 text-[11px] font-bold tracking-wide bg-slate-900/85 backdrop-blur-md text-indigo-300 rounded-full border border-indigo-500/30 shadow-sm">
              {getGenreName()}
            </span>
          </div>

          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <button
              onClick={handlePlayClick}
              className="w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/50 transform scale-90 group-hover:scale-100 transition-all duration-300"
              aria-label={`Play ${song.title}`}
            >
              {isCurrentTrackPlaying ? (
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6zm8 0h4v16h-4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 fill-current ml-0.5" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <h3 className="font-semibold text-slate-100 text-base leading-snug line-clamp-1 group-hover:text-indigo-300 transition-colors">
            {song.title}
          </h3>
          <p className="text-xs font-medium text-slate-300 line-clamp-1">{getArtistName()}</p>
          <p className="text-[11px] text-slate-400 line-clamp-1">{getAlbumTitle()}</p>
        </div>
      </div>

      <div className="mt-3 pt-2.5 border-t border-slate-700/40 flex items-center justify-between text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {formatPlayCount(song.playCount)}
        </span>
        <span className="font-mono text-slate-400">{formatDuration(song.duration)}</span>
      </div>
    </div>
  );
};
