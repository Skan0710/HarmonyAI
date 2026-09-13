import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  ListPlus,
  ListMusic,
  Heart,
  User,
  Disc,
  Info,
  Share2,
} from 'lucide-react';
import { useContextMenuStore } from '../store/useContextMenuStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { useLikedSongsStore } from '../store/useLikedSongsStore';
import { toast } from '../store/useToastStore';

export const SongContextMenu: React.FC = () => {
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

  const { isOpen, x, y, song, closeContextMenu } = useContextMenuStore();
  const playSong = usePlayerStore((state) => state.playSong);
  const playNext = usePlayerStore((state) => state.playNext);
  const addToQueue = usePlayerStore((state) => state.addToQueue);

  const isLiked = useLikedSongsStore((state) => (song ? state.isLiked(song._id) : false));
  const toggleLikeSong = useLikedSongsStore((state) => state.toggleLikeSong);

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeContextMenu();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeContextMenu();
      }
    };

    const handleScroll = () => {
      closeContextMenu();
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen, closeContextMenu]);

  if (!isOpen || !song) return null;

  const getArtistName = (): string => {
    if (!song.artist) return 'Unknown Artist';
    if (typeof song.artist === 'object' && 'name' in song.artist) return song.artist.name;
    return String(song.artist);
  };

  const getArtistId = (): string | null => {
    if (!song.artist) return null;
    if (typeof song.artist === 'object' && '_id' in song.artist) return song.artist._id;
    return null;
  };

  const getAlbumId = (): string | null => {
    if (!song.album) return null;
    if (typeof song.album === 'object' && '_id' in song.album) return song.album._id;
    return null;
  };

  const handlePlayNow = () => {
    playSong(song);
    closeContextMenu();
  };

  const handlePlayNext = () => {
    playNext(song);
    toast.success(`Playing next: ${song.title}`);
    closeContextMenu();
  };

  const handleAddToQueue = () => {
    addToQueue(song);
    toast.success(`Added to queue: ${song.title}`);
    closeContextMenu();
  };

  const handleToggleLike = () => {
    toggleLikeSong(song);
    closeContextMenu();
  };

  const handleGoToArtist = () => {
    const artistId = getArtistId();
    if (artistId) {
      navigate(`/artists/${artistId}`);
    } else {
      navigate(`/library?q=${encodeURIComponent(getArtistName())}`);
    }
    closeContextMenu();
  };

  const handleGoToAlbum = () => {
    const albumId = getAlbumId();
    if (albumId) {
      navigate(`/albums/${albumId}`);
    }
    closeContextMenu();
  };

  const handleViewDetails = () => {
    navigate(`/songs/${song._id}`);
    closeContextMenu();
  };

  const handleCopyLink = async () => {
    try {
      const url = `${window.location.origin}/songs/${song._id}`;
      await navigator.clipboard.writeText(url);
      toast.success('Song link copied to clipboard!');
    } catch {
      toast.error('Failed to copy link');
    }
    closeContextMenu();
  };

  const albumId = getAlbumId();

  return (
    <div
      ref={menuRef}
      style={{ top: `${y}px`, left: `${x}px` }}
      className="fixed z-[100] w-64 bg-surface-1/95 backdrop-blur-xl border border-border-strong rounded-[var(--radius-lg)] shadow-2xl p-1.5 text-xs text-text-primary animate-in fade-in zoom-in-95 duration-100 select-none"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header Info */}
      <div className="flex items-center gap-2.5 p-2 mb-1 border-b border-border-subtle">
        {song.coverImage ? (
          <img
            src={song.coverImage}
            alt={song.title}
            className="w-9 h-9 rounded-[var(--radius-artwork)] object-cover shrink-0 border border-border-subtle"
          />
        ) : (
          <div className="w-9 h-9 rounded-[var(--radius-artwork)] bg-surface-3 flex items-center justify-center text-text-tertiary shrink-0">
            <Disc size={15} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-text-primary text-xs truncate leading-snug">{song.title}</p>
          <p className="text-2xs text-text-tertiary truncate mt-0.5">{getArtistName()}</p>
        </div>
      </div>

      {/* Menu Action Items */}
      <div className="space-y-0.5">
        <button
          type="button"
          onClick={handlePlayNow}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-[var(--radius-sm)] hover:bg-surface-2 text-text-secondary hover:text-text-primary transition-colors text-left cursor-pointer"
        >
          <Play size={14} className="shrink-0 text-accent" />
          <span>Play Now</span>
        </button>

        <button
          type="button"
          onClick={handlePlayNext}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-[var(--radius-sm)] hover:bg-surface-2 text-text-secondary hover:text-text-primary transition-colors text-left cursor-pointer"
        >
          <ListPlus size={14} className="shrink-0 text-gold" />
          <span>Play Next</span>
        </button>

        <button
          type="button"
          onClick={handleAddToQueue}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-[var(--radius-sm)] hover:bg-surface-2 text-text-secondary hover:text-text-primary transition-colors text-left cursor-pointer"
        >
          <ListMusic size={14} className="shrink-0 text-text-tertiary" />
          <span>Add to Queue</span>
        </button>

        <button
          type="button"
          onClick={handleToggleLike}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-[var(--radius-sm)] hover:bg-surface-2 text-text-secondary hover:text-text-primary transition-colors text-left cursor-pointer"
        >
          <Heart
            size={14}
            className={`shrink-0 ${isLiked ? 'text-red-500 fill-red-500' : 'text-text-tertiary'}`}
          />
          <span>{isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}</span>
        </button>

        <div className="my-1 border-t border-border-subtle" />

        <button
          type="button"
          onClick={handleGoToArtist}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-[var(--radius-sm)] hover:bg-surface-2 text-text-secondary hover:text-text-primary transition-colors text-left cursor-pointer"
        >
          <User size={14} className="shrink-0 text-text-tertiary" />
          <span className="truncate">Go to Artist</span>
        </button>

        {albumId && (
          <button
            type="button"
            onClick={handleGoToAlbum}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-[var(--radius-sm)] hover:bg-surface-2 text-text-secondary hover:text-text-primary transition-colors text-left cursor-pointer"
          >
            <Disc size={14} className="shrink-0 text-text-tertiary" />
            <span className="truncate">Go to Album</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleViewDetails}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-[var(--radius-sm)] hover:bg-surface-2 text-text-secondary hover:text-text-primary transition-colors text-left cursor-pointer"
        >
          <Info size={14} className="shrink-0 text-text-tertiary" />
          <span>View Track Details</span>
        </button>

        <button
          type="button"
          onClick={handleCopyLink}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-[var(--radius-sm)] hover:bg-surface-2 text-text-secondary hover:text-text-primary transition-colors text-left cursor-pointer"
        >
          <Share2 size={14} className="shrink-0 text-text-tertiary" />
          <span>Copy Song Link</span>
        </button>
      </div>
    </div>
  );
};
