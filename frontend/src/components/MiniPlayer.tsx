import React, { useEffect, useRef, useState } from 'react';
import { usePlayer } from '../hooks/usePlayer';
import { usePlayerKeyboardShortcuts } from '../hooks/usePlayerKeyboardShortcuts';
import { formatTime } from '../utils/formatters';

export const MiniPlayer: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Enable global keyboard shortcuts (Space = Play/Pause, Left = Prev, Right = Next)
  usePlayerKeyboardShortcuts();

  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    queue,
    volume,
    isMuted,
    isShuffle,
    repeatMode,
    isQueueOpen,
    togglePlay,
    pause,
    stop,
    setCurrentTime,
    setDuration,
    setVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeatMode,
    nextSong,
    previousSong,
    handleSongEnd,
    toggleQueueOpen,
  } = usePlayer();

  // Reset loading & error states when active song changes
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
          if (err.name !== 'AbortError') {
            setAudioError('Playback failed.');
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
    setAudioError('Stream unavailable');
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
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 border-t border-indigo-500/30 backdrop-blur-xl px-3 py-2.5 sm:px-4 sm:py-3 shadow-2xl shadow-indigo-950/80 transition-all duration-300">
      {/* HTML5 Audio Element */}
      <audio
        ref={audioRef}
        src={currentSong.audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        onWaiting={handleWaiting}
        onPlaying={handlePlaying}
        onError={handleError}
        onEnded={handleSongEnd}
        preload="metadata"
      />

      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-6">
        {/* 1. Song Metadata (Cover, Title, Artist, Loading Spinner) */}
        <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-1/4 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl overflow-hidden bg-slate-800 shrink-0 border border-slate-700/60 shadow-md relative">
              <img
                src={currentSong.coverImage || fallbackCover}
                alt={currentSong.title}
                className="w-full h-full object-cover"
              />
              {isLoadingAudio && (
                <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-[1px] flex items-center justify-center">
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

          {/* Mobile Quick Action Close Button */}
          <button
            onClick={stop}
            className="sm:hidden text-slate-400 hover:text-slate-200 p-1 text-xs font-bold"
            aria-label="Close Player"
          >
            ✕
          </button>
        </div>

        {/* 2. Controls & Seek Bar */}
        <div className="flex flex-col items-center gap-1.5 w-full sm:w-2/4">
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Shuffle Button */}
            <button
              onClick={toggleShuffle}
              className={`p-1.5 rounded-lg transition-colors relative ${
                isShuffle
                  ? 'text-indigo-400 bg-indigo-500/20 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={isShuffle ? 'Shuffle Enabled' : 'Enable Shuffle'}
              aria-label="Toggle Shuffle"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h2m8 0h2a2 2 0 012 2v8a2 2 0 01-2 2h-2m-4-4l4-4m0 0l-4-4m4 4H4m16 4l-4 4m0 0l4 4m-4-4H8" />
              </svg>
            </button>

            {/* Previous Track */}
            <button
              onClick={previousSong}
              disabled={queue.length <= 1}
              className="text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors p-1"
              aria-label="Previous Song (Left Arrow)"
              title="Previous Track (Left Arrow)"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
              </svg>
            </button>

            {/* Play / Pause Main Button */}
            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/50 transition-all transform active:scale-95"
              aria-label={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
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

            {/* Next Track */}
            <button
              onClick={nextSong}
              disabled={queue.length <= 1}
              className="text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors p-1"
              aria-label="Next Song (Right Arrow)"
              title="Next Track (Right Arrow)"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
              </svg>
            </button>

            {/* Repeat Mode Button */}
            <button
              onClick={toggleRepeatMode}
              className={`p-1.5 rounded-lg transition-colors relative flex items-center gap-0.5 ${
                repeatMode !== 'off'
                  ? 'text-indigo-400 bg-indigo-500/20 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={
                repeatMode === 'one'
                  ? 'Repeat One (Active)'
                  : repeatMode === 'all'
                  ? 'Repeat All (Active)'
                  : 'Enable Repeat'
              }
              aria-label="Toggle Repeat Mode"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {repeatMode === 'one' && (
                <span className="text-[9px] font-extrabold leading-none -ml-1 text-indigo-300">1</span>
              )}
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

        {/* 3. Queue Drawer Button, Volume Control & Desktop Close */}
        <div className="hidden sm:flex items-center justify-end gap-3 w-1/4">
          <button
            onClick={toggleQueueOpen}
            className={`relative p-2 rounded-xl border transition-all flex items-center gap-1.5 ${
              isQueueOpen
                ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border-slate-700/60 hover:bg-slate-700/60'
            }`}
            title="Toggle Playback Queue"
            aria-label="Toggle Playback Queue"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h10M4 18h10" />
            </svg>
            <span className="text-[11px] font-bold text-indigo-300 px-1.5 py-0.2 rounded-full bg-indigo-500/20 border border-indigo-500/30">
              {queue.length}
            </span>
          </button>

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
