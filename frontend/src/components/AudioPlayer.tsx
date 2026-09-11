import React, { useEffect, useRef } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';

export const AudioPlayer: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentSong = usePlayerStore((state) => state.currentSong);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const currentTime = usePlayerStore((state) => state.currentTime);
  const duration = usePlayerStore((state) => state.duration);
  const volume = usePlayerStore((state) => state.volume);
  const isMuted = usePlayerStore((state) => state.isMuted);
  const queue = usePlayerStore((state) => state.queue);

  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const stop = usePlayerStore((state) => state.stop);
  const setCurrentTime = usePlayerStore((state) => state.setCurrentTime);
  const setDuration = usePlayerStore((state) => state.setDuration);
  const setVolume = usePlayerStore((state) => state.setVolume);
  const toggleMute = usePlayerStore((state) => state.toggleMute);
  const nextSong = usePlayerStore((state) => state.nextSong);
  const previousSong = usePlayerStore((state) => state.previousSong);

  // Synchronize audio element play/pause state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Auto-play was prevented by browser policy
        });
      }
    } else {
      audio.pause();
    }
  }, [isPlaying, currentSong]);

  // Synchronize volume & mute
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  if (!currentSong) return null;

  const getArtistName = (): string => {
    if (!currentSong.artist) return 'Unknown Artist';
    if (typeof currentSong.artist === 'object' && 'name' in currentSong.artist) {
      return currentSong.artist.name;
    }
    return String(currentSong.artist);
  };

  const formatTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds) || seconds <= 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || currentSong.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
  };

  const fallbackCover =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23d9a15b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="background:%231b1815;"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-3xl bg-surface-1/95 border border-border-default backdrop-blur-xl rounded-[var(--radius-lg)] p-3.5 sm:p-4 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 animate-in slide-in-from-bottom duration-300">
      <audio
        ref={audioRef}
        src={currentSong.audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={nextSong}
      />

      {/* 1. Track Info Column */}
      <div className="flex items-center gap-3 w-full sm:w-1/3 min-w-0">
        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-[var(--radius-artwork)] overflow-hidden bg-surface-2 shrink-0 border border-border-default shadow-md">
          <img
            src={currentSong.coverImage || fallbackCover}
            alt={currentSong.title}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="min-w-0">
          <h4 className="text-xs sm:text-sm font-bold text-text-primary truncate">
            {currentSong.title}
          </h4>
          <p className="text-[11px] text-accent truncate mt-0.5">{getArtistName()}</p>
        </div>
      </div>

      {/* 2. Controls & Seek Bar Column */}
      <div className="flex flex-col items-center gap-1.5 w-full sm:w-1/3">
        {/* Buttons (Prev, Play/Pause, Next) */}
        <div className="flex items-center gap-3">
          <button
            onClick={previousSong}
            disabled={queue.length <= 1}
            className="text-text-tertiary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors p-1 cursor-pointer"
            aria-label="Previous Track"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>

          <button
            onClick={togglePlay}
            className="w-9 h-9 rounded-full bg-accent hover:bg-accent-strong text-text-on-accent flex items-center justify-center shadow-lg transition-all transform active:scale-95 cursor-pointer"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6zm8 0h4v16h-4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <button
            onClick={nextSong}
            disabled={queue.length <= 1}
            className="text-text-tertiary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors p-1 cursor-pointer"
            aria-label="Next Track"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>
        </div>

        {/* Seek Slider Bar */}
        <div className="flex items-center gap-2 w-full text-[10px] text-text-tertiary font-mono">
          <span>{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1 bg-surface-2 rounded-[var(--radius-pill)] appearance-none cursor-pointer accent-accent"
          />
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* 3. Volume & Close Column */}
      <div className="hidden sm:flex items-center justify-end gap-3 w-1/3">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className="text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
            aria-label="Mute / Unmute"
          >
            {isMuted || volume === 0 ? (
              <svg className="w-4 h-4 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            )}
          </button>

          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-16 h-1 bg-surface-2 rounded-[var(--radius-pill)] appearance-none cursor-pointer accent-accent"
          />
        </div>

        <button
          onClick={stop}
          className="text-text-tertiary hover:text-text-primary p-1.5 rounded-[var(--radius-sm)] hover:bg-surface-2 transition-colors font-bold text-xs cursor-pointer"
          aria-label="Close Audio Player"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
