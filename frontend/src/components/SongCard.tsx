import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Song } from '../types/music';
import { usePlayerStore } from '../store/usePlayerStore';
import { useLikedSongsStore } from '../store/useLikedSongsStore';
import { AddToPlaylistModal } from './AddToPlaylistModal';
import { RecommendationExplanationModal } from './RecommendationExplanationModal';
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
    Boolean((song as any).recommendationScore);

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

  const fallbackCover =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 24 24" fill="none" stroke="%23818cf8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="background:%231e293b;"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';

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

            {/* Action Buttons Header */}
            <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5">
              {/* "Why this song?" Info Button for Recommendations */}
              {hasRecommendationInfo && (
                <button
                  onClick={handleExplanationClick}
                  className="px-2 py-1 text-[10px] font-extrabold rounded-full bg-indigo-600/90 hover:bg-indigo-500 text-white backdrop-blur-md transition-all border border-indigo-400/40 shadow-md flex items-center gap-0.5 hover:scale-105"
                  title="Why this song?"
                  aria-label="Why this song?"
                >
                  <span>💡 Why?</span>
                </button>
              )}

              {/* Add to Playlist Button */}
              <button
                onClick={handlePlaylistClick}
                className="p-1.5 rounded-full bg-slate-900/70 hover:bg-indigo-600/80 backdrop-blur-md transition-all border border-slate-700/50 shadow-md text-slate-300 hover:text-white"
                title="Add to Playlist"
                aria-label="Add to Playlist"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>

              {/* Like / Heart Button */}
              <button
                onClick={handleLikeClick}
                className="p-1.5 rounded-full bg-slate-900/70 hover:bg-slate-900/90 backdrop-blur-md transition-transform transform active:scale-90 border border-slate-700/50 shadow-md"
                title={isLiked ? 'Unlike song' : 'Like song'}
                aria-label={isLiked ? 'Unlike song' : 'Like song'}
              >
                {isLiked ? (
                  <svg className="w-4 h-4 text-rose-500 fill-current animate-in zoom-in-75 duration-200" viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-slate-300 hover:text-rose-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                )}
              </button>
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
            {formatCount(song.playCount)}
          </span>
          <span className="font-mono text-slate-400">{formatTime(song.duration)}</span>
        </div>
      </div>

      {/* Add To Playlist Modal Dialog */}
      <AddToPlaylistModal
        song={song}
        isOpen={isPlaylistModalOpen}
        onClose={() => setIsPlaylistModalOpen(false)}
      />

      {/* Recommendation Explanation Modal Dialog */}
      <RecommendationExplanationModal
        song={song}
        isOpen={isExplanationModalOpen}
        onClose={() => setIsExplanationModalOpen(false)}
      />
    </>
  );
};
