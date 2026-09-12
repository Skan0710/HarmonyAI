import React, { useEffect, useRef, useState } from 'react';
import {
  Shuffle,
  SkipBack,
  Play,
  Pause,
  SkipForward,
  Repeat,
  Repeat1,
  Zap,
  ListMusic,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { usePlayer } from '../hooks/usePlayer';
import { usePlayerKeyboardShortcuts } from '../hooks/usePlayerKeyboardShortcuts';
import { formatTime } from '../utils/formatters';
import { IconButton } from './ui/IconButton';
import { YoutubePlayerEngine, type PlaybackEngineHandle } from './YoutubePlayerEngine';
import { fetchYoutubeVideoIdApi } from '../services/songService';

interface MiniPlayerProps {
  onExpand?: () => void;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({ onExpand }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const youtubeEngineRef = useRef<PlaybackEngineHandle | null>(null);

  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  // undefined = not resolved yet, null = confirmed no YouTube match (fall back
  // to the placeholder audioUrl), string = resolved YouTube video ID.
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null | undefined>(undefined);

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
    isAutoplayEnabled,
    isAutoplayLoading,
    autoplayQueue,
    togglePlay,
    pause,
    stop,
    setCurrentTime,
    setDuration,
    setVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeatMode,
    toggleAutoplay,
    nextSong,
    previousSong,
    handleSongEnd,
    toggleQueueOpen,
  } = usePlayer();

  useEffect(() => {
    setIsLoadingAudio(true);
    setAudioError(null);

    if (currentSong?.youtubeVideoId) {
      setYoutubeVideoId(currentSong.youtubeVideoId);
      return;
    }

    setYoutubeVideoId(undefined);
    if (!currentSong?._id) return;

    let cancelled = false;
    fetchYoutubeVideoIdApi(currentSong._id)
      .then((videoId) => {
        if (!cancelled) setYoutubeVideoId(videoId);
      })
      .catch(() => {
        if (!cancelled) setYoutubeVideoId(null);
      });

    return () => {
      cancelled = true;
    };
  }, [currentSong?._id, currentSong?.youtubeVideoId]);

  const usingYoutubeEngine = Boolean(youtubeVideoId);

  // Native <audio> engine — only active for the placeholder-audio fallback
  // path (no YouTube match resolved for this track).
  useEffect(() => {
    if (usingYoutubeEngine) return;
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
  }, [isPlaying, currentSong, pause, usingYoutubeEngine]);

  useEffect(() => {
    if (usingYoutubeEngine) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = isMuted ? 0 : volume;
  }, [volume, isMuted, usingYoutubeEngine]);

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

  const handleCanPlay = () => setIsLoadingAudio(false);
  const handleWaiting = () => setIsLoadingAudio(true);
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
    if (usingYoutubeEngine) {
      youtubeEngineRef.current?.seekTo(newTime);
    } else if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value));
  };

  const fallbackCover =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23d9a15b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="background:%231b1815;"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[var(--z-player)] bg-surface-1/95 border-t border-border-subtle backdrop-blur-xl px-3 py-2.5 sm:px-5 sm:py-3">
      {!usingYoutubeEngine && (
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
      )}

      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-6">
        {/* Metadata */}
        <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-1/4 min-w-0">
          <button
            onClick={onExpand}
            className="flex items-center gap-3 min-w-0 cursor-pointer text-left"
            aria-label="Expand player"
          >
            <div className="w-11 h-11 rounded-[var(--radius-artwork)] overflow-hidden bg-surface-2 shrink-0 relative">
              {usingYoutubeEngine ? (
                <YoutubePlayerEngine
                  ref={youtubeEngineRef}
                  videoId={youtubeVideoId as string}
                  isPlaying={isPlaying}
                  volume={volume}
                  isMuted={isMuted}
                  onTimeUpdate={handleTimeUpdate}
                  onDuration={(seconds) => setDuration(seconds || currentSong.duration || 0)}
                  onEnded={handleSongEnd}
                  onReady={handleCanPlay}
                  onError={handleError}
                />
              ) : (
                <img src={currentSong.coverImage || fallbackCover} alt={currentSong.title} className="w-full h-full object-cover" />
              )}
              {isLoadingAudio && (
                <div className="absolute inset-0 bg-surface-0/70 flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-text-primary truncate">{currentSong.title}</h4>
              <p className="text-xs text-text-tertiary truncate mt-0.5">{getArtistName()}</p>
              {audioError && <p className="text-[10px] text-danger truncate mt-0.5 font-medium">{audioError}</p>}
            </div>
          </button>

          <button onClick={stop} className="sm:hidden text-text-tertiary hover:text-text-primary p-1" aria-label="Close Player">
            <X size={16} />
          </button>
        </div>

        {/* Controls & seek */}
        <div className="flex flex-col items-center gap-1.5 w-full sm:w-2/4">
          <div className="flex items-center gap-1 sm:gap-2">
            <IconButton
              size="sm"
              variant={isShuffle ? 'active' : 'default'}
              onClick={toggleShuffle}
              aria-label="Toggle Shuffle"
              title={isShuffle ? 'Shuffle Enabled' : 'Enable Shuffle'}
            >
              <Shuffle strokeWidth={1.75} />
            </IconButton>

            <IconButton
              size="sm"
              onClick={previousSong}
              disabled={queue.length <= 1}
              aria-label="Previous Song (Left Arrow)"
              title="Previous Track (Left Arrow)"
            >
              <SkipBack strokeWidth={1.75} fill="currentColor" />
            </IconButton>

            <IconButton
              size="lg"
              variant="accent"
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isLoadingAudio ? (
                <div className="w-4 h-4 border-2 border-text-on-accent border-t-transparent rounded-full animate-spin" />
              ) : isPlaying ? (
                <Pause fill="currentColor" strokeWidth={0} />
              ) : (
                <Play fill="currentColor" strokeWidth={0} className="ml-0.5" />
              )}
            </IconButton>

            <IconButton
              size="sm"
              onClick={nextSong}
              disabled={queue.length <= 1 && !isAutoplayEnabled}
              aria-label="Next Song (Right Arrow)"
              title="Next Track (Right Arrow)"
            >
              <SkipForward strokeWidth={1.75} fill="currentColor" />
            </IconButton>

            <IconButton
              size="sm"
              variant={repeatMode !== 'off' ? 'active' : 'default'}
              onClick={toggleRepeatMode}
              aria-label="Toggle Repeat Mode"
              title={repeatMode === 'one' ? 'Repeat One (Active)' : repeatMode === 'all' ? 'Repeat All (Active)' : 'Enable Repeat'}
            >
              {repeatMode === 'one' ? <Repeat1 strokeWidth={1.75} /> : <Repeat strokeWidth={1.75} />}
            </IconButton>

            <button
              onClick={toggleAutoplay}
              className={`ml-1 hidden md:flex items-center gap-1.5 h-7 px-2.5 rounded-[var(--radius-pill)] border text-[10px] font-semibold uppercase tracking-wide transition-colors cursor-pointer ${
                isAutoplayEnabled
                  ? 'text-gold border-gold-wash bg-gold-wash'
                  : 'text-text-tertiary border-border-subtle hover:text-text-secondary'
              }`}
              title={isAutoplayEnabled ? `Smart Autoplay: ON (${autoplayQueue.length} buffered)` : 'Smart Autoplay: OFF'}
            >
              <Zap size={12} className={isAutoplayLoading ? 'animate-spin' : ''} />
              {isAutoplayEnabled ? `Autoplay · ${autoplayQueue.length}` : 'Autoplay Off'}
            </button>
          </div>

          <div className="flex items-center gap-2.5 w-full text-2xs text-text-tertiary font-mono tabular-nums">
            <span className="w-9 text-right shrink-0">{formatTime(currentTime)}</span>
            <div className="relative flex-1 flex items-center group">
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1 bg-surface-2 rounded-full appearance-none cursor-pointer accent-[var(--accent)] relative z-10"
              />
              <div
                className="absolute left-0 h-1 bg-accent rounded-full pointer-events-none"
                style={{ width: `${Math.min(100, Math.max(0, progressPercentage))}%` }}
              />
            </div>
            <span className="w-9 text-left shrink-0">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Queue & volume */}
        <div className="hidden sm:flex items-center justify-end gap-2 w-1/4">
          <button
            onClick={toggleQueueOpen}
            className={`relative h-8 px-2.5 rounded-[var(--radius-sm)] border transition-colors flex items-center gap-1.5 cursor-pointer ${
              isQueueOpen ? 'bg-accent-wash text-accent border-accent-wash-strong' : 'text-text-tertiary border-border-subtle hover:text-text-secondary'
            }`}
            title="Toggle Playback Queue"
            aria-label="Toggle Playback Queue"
          >
            <ListMusic size={15} strokeWidth={1.75} />
            <span className="text-2xs font-mono">{queue.length}</span>
          </button>

          <div className="flex items-center gap-2">
            <button onClick={toggleMute} className="text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer" aria-label="Mute / Unmute">
              {isMuted || volume === 0 ? <VolumeX size={16} className="text-danger" /> : <Volume2 size={16} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-20 h-1 bg-surface-2 rounded-full appearance-none cursor-pointer accent-[var(--accent)]"
            />
          </div>

          <button onClick={stop} className="text-text-tertiary hover:text-text-primary p-1.5 transition-colors cursor-pointer" aria-label="Close Player" title="Close Player">
            <X size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};
