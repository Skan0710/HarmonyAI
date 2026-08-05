import React, { useEffect, useRef, useState } from 'react';
import { usePlayer } from '../hooks/usePlayer';

export const MiniPlayer: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    queue,
    volume,
    isMuted,
    togglePlay,
    pause,
    stop,
    setCurrentTime,
    setDuration,
    setVolume,
    toggleMute,
    nextSong,
    previousSong,
  } = usePlayer();

  // Reset states when song changes
  useEffect(() => {
    setIsLoadingAudio(true);
    setAudioError(null);
  }, [currentSong?._id]);

  // Sync HTML5 audio element play/pause state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          // Playback interrupted or prevented by browser
          if (err.name !== 'AbortError') {
            setAudioError('Playback failed. Please try again.');
            pause();
          }
        });
      }
    } else {
      audio.pause();
    }
  }, [isPlaying, currentSong, pause]);

  // Sync audio volume & mute state
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
      const audioDuration = audioRef.current.duration;
      if (audioDuration && !isNaN(audioDuration)) {
        setDuration(audioDuration);
      } else if (currentSong.duration) {
        setDuration(currentSong.duration);
      }
    }
    setIsLoadingAudio(false);
  };

  const handleCanPlay = () => {
    setIsLoadingAudio(false);
  };

  const handleWaiting = () => {
    setIsLoadingAudio(true);
  };

  const handlePlaying = () => {
    setIsLoadingAudio(false);
    setAudioError(null);
  };

  const handleError = () => {
    setIsLoadingAudio(false);
    setAudioError('Unable to stream audio resource.');
    pause();
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
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23818cf8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="background:%231e293b;"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 border-t border-indigo-500/30 backdrop-blur-xl px-4 py-3 shadow-2xl shadow-indigo-950/80 transition-all duration-300">
      {/* HTML5 Audio Element connected to database audioUrl */}
      <audio
        ref={audioRef}
        src={currentSong.audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        onWaiting={handleWaiting}
        onPlaying={handlePlaying}
        onError={handleError}
        onEnded={nextSong}
        preload="metadata"
      />

      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-6">
        {/* 1. Song Metadata (Cover, Title, Artist) */}
        <div className="flex items-center gap-3 w-full sm:w-1/4 min-w-0">
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-800 shrink-0 border border-slate-700/60 shadow-md relative">
            <img
              src={currentSong.coverImage || fallbackCover}
              alt={currentSong.title}
              className="w-full h-full object-cover"
            />
            {isLoadingAudio && (
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[1px] flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-bold text-slate-100 truncate hover:text-indigo-300 transition-colors">
              {currentSong.title}
            </h4>
            <p className="text-[11px] font-medium text-indigo-400 truncate mt-0.5">{getArtistName()}</p>
            {audioError && (
              <p className="text-[10px] text-rose-400 truncate mt-0.5 font-medium">{audioError}</p>
            )}
          </div>
        </div>

        {/* 2. Controls & Seek Bar */}
        <div className="flex flex-col items-center gap-1.5 w-full sm:w-2/4">
          <div className="flex items-center gap-4">
            <button
              onClick={previousSong}
              disabled={queue.length <= 1}
              className="text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors p-1"
              aria-label="Previous Song"
              title="Previous Track"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
              </svg>
            </button>

            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/50 transition-all transform active:scale-95"
              aria-label={isPlaying ? 'Pause' : 'Play'}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isLoadingAudio ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isPlaying ? (
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6zm8 0h4v16h-4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 fill-current ml-0.5" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            <button
              onClick={nextSong}
              disabled={queue.length <= 1}
              className="text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors p-1"
              aria-label="Next Song"
              title="Next Track"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
              </svg>
            </button>
          </div>

          {/* Progress Bar & Timestamps */}
          <div className="flex items-center gap-2.5 w-full text-[11px] text-slate-400 font-mono">
            <span className="w-9 text-right shrink-0">{formatTime(currentTime)}</span>
            <div className="relative flex-1 flex items-center">
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 z-10"
              />
              <div
                className="absolute left-0 h-1.5 bg-indigo-500 rounded-lg pointer-events-none"
                style={{ width: `${Math.min(100, Math.max(0, progressPercentage))}%` }}
              />
            </div>
            <span className="w-9 text-left shrink-0">{formatTime(duration)}</span>
          </div>
        </div>

        {/* 3. Volume Control & Close Button */}
        <div className="hidden sm:flex items-center justify-end gap-3 w-1/4">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="text-slate-400 hover:text-slate-200 transition-colors"
              aria-label="Mute / Unmute"
            >
              {isMuted || volume === 0 ? (
                <svg className="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
              className="w-20 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          <button
            onClick={stop}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors font-bold text-xs"
            aria-label="Close Player"
            title="Close Player"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};
