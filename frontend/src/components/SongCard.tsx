import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, Plus, Heart, Sparkles, AudioLines } from 'lucide-react';
import type { Song } from '../types/music';
import { usePlayerStore } from '../store/usePlayerStore';
import { useLikedSongsStore } from '../store/useLikedSongsStore';
import { AddToPlaylistModal } from './AddToPlaylistModal';
import { WhyThisSongModal } from './RecommendationExplanationModal';
import { trackRecommendationInteraction } from '../services/recommendationTrackingService';
import { formatTime, formatCount } from '../utils/formatters';

interface SongCardProps {
  song: Song;
  onPlay?: (song: Song) => void;
  isPlaying?: boolean;
}

export const SongCard: React.FC<SongCardProps> = ({ song, onPlay, isPlaying }) => {
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [isExplanationModalOpen, setIsExplanationModalOpen] = useState(false);

  const activeSong = usePlayerStore((state) => state.currentSong);
  const activeIsPlaying = usePlayerStore((state) => state.isPlaying);
  const playSong = usePlayerStore((state) => state.playSong);
  const togglePlay = usePlayerStore((state) => state.togglePlay);

  const isLiked = useLikedSongsStore((state) => state.isLiked(song._id));
  const toggleLikeSong = useLikedSongsStore((state) => state.toggleLikeSong);

  const hasRecommendationInfo =
    Boolean((song as any).componentScores) ||
    Boolean((song as any).explanation) ||
    Boolean((song as any).hybridScore) ||
    Boolean((song as any).recommendationScore) ||
    Boolean((song as any).sources) ||
    Boolean((song as any).matchReason);

  const recommendationSource = ((song as any).sources && (song as any).sources[0]) || 'hybrid';

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

  const isObjectId = (value: string): boolean => /^[a-f0-9]{24}$/i.test(value);

  const getAlbumTitle = (): string => {
    if (!song.album) return 'Single';
    if (typeof song.album === 'object' && 'title' in song.album) {
      return song.album.title;
    }
    const value = String(song.album);
    return isObjectId(value) ? 'Single' : value;
  };

  const getGenreName = (): string => {
    if (!song.genre) return 'Music';
    if (typeof song.genre === 'object' && 'name' in song.genre) {
      return song.genre.name;
    }
    const value = String(song.genre);
    return isObjectId(value) ? 'Music' : value;
  };

  const fallbackCover =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 24 24" fill="none" stroke="%23d9a15b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="background:%231b1815;"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';

  const coverUrl = imgError || !song.coverImage ? fallbackCover : song.coverImage;

  const handleCardClick = () => {
    if (hasRecommendationInfo && song._id) {
      trackRecommendationInteraction(song._id, 'click', recommendationSource);
    }
    if (song._id) {
      navigate(`/songs/${song._id}`);
    }
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasRecommendationInfo && song._id) {
      trackRecommendationInteraction(song._id, 'play', recommendationSource);
    }
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

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasRecommendationInfo && song._id && !isLiked) {
      trackRecommendationInteraction(song._id, 'like', recommendationSource);
    }
    toggleLikeSong(song);
  };

  const handlePlaylistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPlaylistModalOpen(true);
  };

  const handleExplanationClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExplanationModalOpen(true);
  };

  return (
    <>
      <div
        onClick={handleCardClick}
        className={`group relative cursor-pointer bg-surface-1 hover:bg-surface-2 rounded-[var(--radius-md)] p-3 transition-colors duration-[var(--duration-base)] flex flex-col justify-between overflow-hidden ${
          isCurrentTrackPlaying ? 'ring-1 ring-accent/50 bg-surface-2' : ''
        }`}
      >
        <div>
          <div className="relative aspect-square w-full rounded-[var(--radius-artwork)] overflow-hidden bg-surface-2 mb-3">
            <img
              src={coverUrl}
              alt={song.title}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />

            <div className="absolute top-2 left-2 z-10">
              <span className="block px-2 py-0.5 text-2xs font-medium tracking-wide bg-surface-0/80 backdrop-blur-md text-text-secondary rounded-[var(--radius-sharp)] truncate max-w-[64px]">
                {getGenreName()}
              </span>
            </div>

            <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5">
                {hasRecommendationInfo && (
                  <button
                    onClick={handleExplanationClick}
                    className="px-2 py-1 text-2xs font-semibold rounded-[var(--radius-pill)] bg-gold/90 hover:bg-gold-strong text-text-on-accent backdrop-blur-md transition-colors flex items-center gap-1 cursor-pointer"
                    title="Why this song?"
                    aria-label="Why this song?"
                  >
                    <Sparkles size={11} />
                    Why?
                  </button>
                )}

                <button
                  onClick={handlePlaylistClick}
                  className="p-1.5 rounded-full bg-surface-0/70 hover:bg-surface-0 backdrop-blur-md transition-colors text-text-secondary hover:text-text-primary cursor-pointer"
                  title="Add to Playlist"
                  aria-label="Add to Playlist"
                >
                  <Plus size={15} strokeWidth={1.75} />
                </button>

                <button
                  onClick={handleLikeClick}
                  className="p-1.5 rounded-full bg-surface-0/70 hover:bg-surface-0 backdrop-blur-md transition-transform active:scale-90 cursor-pointer"
                  title={isLiked ? 'Unlike song' : 'Like song'}
                  aria-label={isLiked ? 'Unlike song' : 'Like song'}
                >
                  <Heart
                    size={15}
                    strokeWidth={1.75}
                    className={isLiked ? 'text-accent' : 'text-text-secondary hover:text-accent transition-colors'}
                    fill={isLiked ? 'currentColor' : 'none'}
                  />
                </button>
            </div>

            <div className="absolute inset-0 bg-surface-0/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
              <button
                onClick={handlePlayClick}
                className="w-11 h-11 rounded-full bg-accent hover:bg-accent-strong text-text-on-accent flex items-center justify-center transform scale-90 group-hover:scale-100 transition-all duration-300 cursor-pointer"
                aria-label={`Play ${song.title}`}
              >
                {isCurrentTrackPlaying ? (
                  <Pause size={18} fill="currentColor" strokeWidth={0} />
                ) : (
                  <Play size={18} fill="currentColor" strokeWidth={0} className="ml-0.5" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <h3 className="font-semibold text-text-primary text-sm leading-snug line-clamp-1 group-hover:text-accent transition-colors">
              {song.title}
            </h3>
            <p className="text-xs font-medium text-text-secondary line-clamp-1">{getArtistName()}</p>
            <p className="text-2xs text-text-tertiary line-clamp-1">{getAlbumTitle()}</p>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-border-subtle flex items-center justify-between text-2xs text-text-tertiary">
          <span className="flex items-center gap-1">
            <AudioLines size={12} strokeWidth={1.75} />
            {formatCount(song.playCount)}
          </span>
          <span className="font-mono tabular-nums">{formatTime(song.duration)}</span>
        </div>
      </div>

      {/* Add To Playlist Modal Dialog */}
      <AddToPlaylistModal
        song={song}
        isOpen={isPlaylistModalOpen}
        onClose={() => setIsPlaylistModalOpen(false)}
      />

      {/* Recommendation Explanation Modal Dialog */}
      <WhyThisSongModal
        song={song}
        isOpen={isExplanationModalOpen}
        onClose={() => setIsExplanationModalOpen(false)}
      />
    </>
  );
};
