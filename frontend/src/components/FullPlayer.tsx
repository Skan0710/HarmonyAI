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
} from 'lucide-react';
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
    togglePlay,
    setCurrentTime,
    setVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeatMode,
    nextSong,
    previousSong,
    toggleQueueOpen,
  } = usePlayer();

  const isLiked = useLikedSongsStore((state) => (currentSong ? state.isLiked(currentSong._id) : false));
  const toggleLikeSong = useLikedSongsStore((state) => state.toggleLikeSong);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
    setCurrentTime(parseFloat(e.target.value));
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
                  onClick={onClose}
                  className="p-2 text-text-secondary hover:text-text-primary rounded-full hover:bg-surface-2 transition-colors cursor-pointer"
                  aria-label="Minimize player"
                >
                  <ChevronDown size={22} />
                </button>
                <span className="text-2xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                  Now Playing
                </span>
                <IconButton
                  size="md"
                  variant={isLiked ? 'active' : 'default'}
                  onClick={() => toggleLikeSong(currentSong)}
                  aria-label={isLiked ? 'Unlike song' : 'Like song'}
                >
                  <Heart size={17} fill={isLiked ? 'currentColor' : 'none'} strokeWidth={1.75} />
                </IconButton>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center min-h-0 gap-8 max-w-md mx-auto w-full">
                <div className="w-full max-w-[min(70vw,320px)] sm:max-w-sm aspect-square rounded-[var(--radius-lg)] overflow-hidden shadow-[var(--shadow-lg)] shrink">
                  <img
                    src={cover}
                    alt={currentSong.title}
                    onError={() => setImgError(true)}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="text-center w-full">
                  <h1 className="font-display text-xl sm:text-2xl text-text-primary line-clamp-2 leading-snug">{currentSong.title}</h1>
                  <p className="text-sm text-text-tertiary mt-1.5 truncate">{getArtistName()}</p>
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
                      className="w-full h-1 bg-surface-2 rounded-full appearance-none cursor-pointer accent-[var(--accent)] relative z-10"
                    />
                    <div
                      className="absolute left-0 h-1 bg-accent rounded-full pointer-events-none"
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
                    <SkipBack fill="currentColor" strokeWidth={0} />
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
                    <SkipForward fill="currentColor" strokeWidth={0} />
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
                <div className="flex items-center gap-2">
                  <button onClick={toggleMute} className="text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer" aria-label="Mute">
                    {isMuted || volume === 0 ? <VolumeX size={16} className="text-danger" /> : <Volume2 size={16} />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-20 h-1 bg-surface-2 rounded-full appearance-none cursor-pointer accent-[var(--accent)]"
                  />
                </div>
                <button
                  onClick={toggleQueueOpen}
                  className="flex items-center gap-1.5 text-xs font-medium text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer"
                >
                  <ListMusic size={15} />
                  Queue · {queue.length}
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
