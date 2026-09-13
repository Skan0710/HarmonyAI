import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronDown,
  Shuffle,
  SkipBack,
  Play,
  Pause,
  SkipForward,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  ListMusic,
  Sparkles,
  Heart,
  Music,
  Film,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../hooks/usePlayer';
import { useLikedSongsStore } from '../store/useLikedSongsStore';
import { formatTime } from '../utils/formatters';
import { IconButton } from './ui/IconButton';
import { WhyThisSongModal } from './RecommendationExplanationModal';

interface FullPlayerProps {
  isOpen: boolean;
  onClose: () => void;
}

const fallbackCover =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 24 24" fill="none" stroke="%23d9a15b" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="background:%231b1815;"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';

export const FullPlayer: React.FC<FullPlayerProps> = ({ isOpen, onClose }) => {
  const [whyOpen, setWhyOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const navigate = useNavigate();

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
    seekTo,
    setVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeatMode,
    nextSong,
    previousSong,
    toggleQueueOpen,
    setQueueOpen,
    mediaMode,
    setMediaMode,
    setVideoSlotRect,
    youtubeVideoId,
  } = usePlayer();

  const hasVideo = Boolean(youtubeVideoId || currentSong?.youtubeVideoId);

  const isLiked = useLikedSongsStore((state) => (currentSong ? state.isLiked(currentSong._id) : false));
  const toggleLikeSong = useLikedSongsStore((state) => state.toggleLikeSong);

  const handleClose = () => {
    setQueueOpen(false);
    onClose();
  };

  const getArtistId = (): string | null => {
    if (!currentSong?.artist) return null;
    if (typeof currentSong.artist === 'object' && '_id' in currentSong.artist) {
      return (currentSong.artist as { _id: string })._id;
    }
    if (typeof currentSong.artist === 'object' && 'id' in currentSong.artist) {
      return (currentSong.artist as { id: string }).id;
    }
    return typeof currentSong.artist === 'string' ? currentSong.artist : null;
  };

  const handleArtistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const artistId = getArtistId();
    handleClose();
    if (artistId) {
      navigate(`/artists/${artistId}`);
    }
  };

  useEffect(() => {
    if (!isOpen || mediaMode !== 'video' || !hasVideo) {
      setVideoSlotRect(null);
      return;
    }

    const updateRect = () => {
      const el = document.getElementById('fullplayer-video-slot');
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          setVideoSlotRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        }
      }
    };

    const raf = requestAnimationFrame(() => {
      updateRect();
    });

    const el = document.getElementById('fullplayer-video-slot');
    let ro: ResizeObserver | null = null;
    if (el) {
      ro = new ResizeObserver(updateRect);
      ro.observe(el);
    }
    window.addEventListener('resize', updateRect);

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('resize', updateRect);
      setVideoSlotRect(null);
    };
  }, [isOpen, mediaMode, hasVideo, setVideoSlotRect]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isQueueOpen) {
          setQueueOpen(false);
        } else {
          handleClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isQueueOpen, onClose]);

  useEffect(() => {
    setImgError(false);
  }, [currentSong?._id]);

  if (!currentSong) return null;

  const getArtistName = (): string => {
    if (!currentSong.artist) return 'Unknown Artist';
    if (typeof currentSong.artist === 'object' && 'name' in currentSong.artist) return currentSong.artist.name;
    return String(currentSong.artist);
  };

  const hasRecommendationInfo =
    Boolean((currentSong as any).componentScores) ||
    Boolean((currentSong as any).hybridScore) ||
    Boolean((currentSong as any).sources);

  const cover = imgError || !currentSong.coverImage ? fallbackCover : currentSong.coverImage;
  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    seekTo(newTime);
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[var(--z-modal)] bg-surface-0 overflow-hidden"
          >
            <div className="absolute inset-0 overflow-hidden">
              <img src={cover} alt="" className="w-full h-full object-cover scale-110 blur-3xl opacity-25" aria-hidden="true" />
              <div className="absolute inset-0 bg-surface-0/75" />
            </div>

            <div className="relative h-full flex flex-col px-6 sm:px-10 py-6">
              <div className="flex items-center justify-between shrink-0">
                <button
                  onClick={handleClose}
                  className="p-2 text-text-secondary hover:text-text-primary rounded-full hover:bg-surface-2 transition-colors cursor-pointer"
                  aria-label="Minimize player"
                >
                  <ChevronDown size={22} />
                </button>
                <span className="text-2xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                  Now Playing
                </span>
                <div className="w-9 h-9" aria-hidden="true" />
              </div>

              <div className="flex-1 flex flex-col items-center justify-center min-h-0 gap-6 max-w-md mx-auto w-full">
                {/* Song / Video View Mode Toggle Pill */}
                <div className="flex items-center p-1 bg-surface-2/90 backdrop-blur rounded-full border border-border-subtle shrink-0">
                  <button
                    type="button"
                    onClick={() => setMediaMode('song')}
                    className={`flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                      mediaMode === 'song'
                        ? 'bg-surface-3 text-text-primary shadow-sm font-semibold'
                        : 'text-text-tertiary hover:text-text-secondary'
                    }`}
                  >
                    <Music size={13} strokeWidth={2} />
                    <span>Song</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (hasVideo) setMediaMode('video');
                    }}
                    disabled={!hasVideo}
                    className={`flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-medium transition-all ${
                      !hasVideo
                        ? 'opacity-40 cursor-not-allowed text-text-tertiary'
                        : mediaMode === 'video'
                        ? 'bg-surface-3 text-text-primary shadow-sm font-semibold cursor-pointer'
                        : 'text-text-tertiary hover:text-text-secondary cursor-pointer'
                    }`}
                    title={hasVideo ? 'Watch Video' : 'No video available for this track'}
                  >
                    <Film size={13} strokeWidth={2} />
                    <span>Video</span>
                  </button>
                </div>

                {/* Media Container: Square Cover Art or 16:9 Video Slot */}
                {mediaMode === 'video' && hasVideo ? (
                  <div
                    id="fullplayer-video-slot"
                    className="w-full max-w-[min(88vw,380px)] sm:max-w-md aspect-video rounded-[var(--radius-lg)] overflow-hidden bg-black shadow-[var(--shadow-lg)] shrink"
                  />
                ) : (
                  <div className="w-full max-w-[min(70vw,320px)] sm:max-w-sm aspect-square rounded-[var(--radius-lg)] overflow-hidden shadow-[var(--shadow-lg)] shrink">
                    <img
                      src={cover}
                      alt={currentSong.title}
                      onError={() => setImgError(true)}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between w-full gap-3 px-1">
                  <div className="min-w-0 text-left flex-1">
                    <h1 className="font-display text-xl sm:text-2xl text-text-primary line-clamp-2 leading-snug">
                      {currentSong.title}
                    </h1>
                    <p
                      onClick={handleArtistClick}
                      className="text-sm text-text-tertiary hover:text-text-primary hover:underline cursor-pointer mt-1 truncate transition-colors inline-block"
                      title={`Go to ${getArtistName()}'s page`}
                    >
                      {getArtistName()}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleLikeSong(currentSong)}
                    className={`p-3 rounded-full hover:bg-surface-2 transition-all cursor-pointer shrink-0 flex items-center justify-center ${
                      isLiked ? 'text-accent' : 'text-text-tertiary hover:text-text-primary'
                    }`}
                    aria-label={isLiked ? 'Unlike song' : 'Like song'}
                    title={isLiked ? 'Unlike song' : 'Like song'}
                  >
                    <Heart
                      size={26}
                      fill={isLiked ? 'currentColor' : 'none'}
                      strokeWidth={2}
                      className={`transition-transform duration-200 active:scale-125 ${isLiked ? 'scale-110' : ''}`}
                    />
                  </button>
                </div>

                <div className="w-full space-y-2">
                  <div className="relative flex items-center group">
                    <input
                      type="range"
                      min={0}
                      max={duration || 100}
                      step={0.1}
                      value={currentTime}
                      onChange={handleSeek}
                      className="w-full h-1.5 bg-white/20 hover:bg-white/30 rounded-full appearance-none cursor-pointer accent-[var(--accent)] relative z-10 transition-colors"
                    />
                    <div
                      className="absolute left-0 h-1.5 bg-accent rounded-full pointer-events-none"
                      style={{ width: `${Math.min(100, Math.max(0, progressPercentage))}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-2xs font-mono text-text-tertiary tabular-nums">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <IconButton
                    size="md"
                    variant={isShuffle ? 'active' : 'default'}
                    onClick={toggleShuffle}
                    aria-label="Toggle shuffle"
                  >
                    <Shuffle strokeWidth={1.75} />
                  </IconButton>
                  <IconButton size="md" onClick={previousSong} disabled={queue.length <= 1} aria-label="Previous song">
                    <SkipBack size={20} fill="currentColor" strokeWidth={2} />
                  </IconButton>
                  <motion.button
                    whileTap={{ scale: 0.94 }}
                    onClick={togglePlay}
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                    className="w-16 h-16 rounded-full bg-accent hover:bg-accent-strong text-text-on-accent flex items-center justify-center transition-colors cursor-pointer"
                  >
                    {isPlaying ? (
                      <Pause size={26} fill="currentColor" strokeWidth={0} />
                    ) : (
                      <Play size={26} fill="currentColor" strokeWidth={0} className="ml-1" />
                    )}
                  </motion.button>
                  <IconButton size="md" onClick={nextSong} aria-label="Next song">
                    <SkipForward size={20} fill="currentColor" strokeWidth={2} />
                  </IconButton>
                  <IconButton
                    size="md"
                    variant={repeatMode !== 'off' ? 'active' : 'default'}
                    onClick={toggleRepeatMode}
                    aria-label="Toggle repeat"
                  >
                    {repeatMode === 'one' ? <Repeat1 strokeWidth={1.75} /> : <Repeat strokeWidth={1.75} />}
                  </IconButton>
                </div>

                {hasRecommendationInfo && (
                  <button
                    onClick={() => setWhyOpen(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-gold hover:text-gold-strong transition-colors cursor-pointer"
                  >
                    <Sparkles size={13} />
                    Why you're hearing this
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between shrink-0 max-w-md mx-auto w-full">
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={toggleMute}
                    className="text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
                    aria-label={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
                  >
                    {isMuted || volume === 0 ? <VolumeX size={17} className="text-danger" /> : <Volume2 size={17} />}
                  </button>
                  <div className="relative flex items-center w-24 sm:w-28 group">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={isMuted ? 0 : volume}
                      onChange={(e) => setVolume(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-white/20 hover:bg-white/30 rounded-full appearance-none cursor-pointer accent-[var(--accent)] relative z-10 transition-colors"
                    />
                    <div
                      className="absolute left-0 h-1.5 bg-accent rounded-full pointer-events-none transition-all"
                      style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
                    />
                  </div>
                </div>
                <button
                  onClick={toggleQueueOpen}
                  className={`flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer px-2.5 py-1.5 rounded-full ${
                    isQueueOpen
                      ? 'text-accent bg-accent-wash'
                      : 'text-text-tertiary hover:text-text-primary hover:bg-surface-2'
                  }`}
                  aria-label="Toggle playback queue"
                >
                  <ListMusic size={16} strokeWidth={2} />
                  <span>Queue · {queue.length}</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <WhyThisSongModal song={currentSong} isOpen={whyOpen} onClose={() => setWhyOpen(false)} />
    </>
  );
};
