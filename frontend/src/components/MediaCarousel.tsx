import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import type { Song, Artist, Album } from '../types/music';
import { SongCard } from './SongCard';
import { ArtistCard } from './ArtistCard';
import { AlbumCard } from './AlbumCard';
import { trackRecommendationBulkImpressions } from '../services/recommendationTrackingService';

export type CarouselItemType = 'song' | 'album' | 'artist';

export interface MediaCarouselProps {
  title: string;
  subtitle?: string;
  seeAllLink?: string;
  type: CarouselItemType;
  items: (Song | Album | Artist)[];
  loading?: boolean;
  onPlaySong?: (song: Song) => void;
  currentPlayingSongId?: string;
  emptyMessage?: string;
}

export const MediaCarousel: React.FC<MediaCarouselProps> = ({
  title,
  subtitle,
  seeAllLink,
  type,
  items,
  loading = false,
  onPlaySong,
  currentPlayingSongId,
  emptyMessage = 'No items found in this section.',
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check scroll position to update navigation button state
  const checkScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 5);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5);
  }, []);

  useEffect(() => {
    checkScrollState();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScrollState, { passive: true });
      window.addEventListener('resize', checkScrollState);
    }

    // Trigger non-blocking recommendation bulk impression tracking when recommended song items render
    if (type === 'song' && !loading && items && items.length > 0) {
      const recSongs = (items as Song[]).filter(
        (s) =>
          Boolean((s as any).componentScores) ||
          Boolean((s as any).hybridScore) ||
          Boolean((s as any).recommendationScore)
      );
      if (recSongs.length > 0) {
        const songIds = recSongs.map((s) => s._id).filter(Boolean);
        const source = ((recSongs[0] as any).sources && (recSongs[0] as any).sources[0]) || 'hybrid';
        trackRecommendationBulkImpressions(songIds, source);
      }
    }

    return () => {
      if (el) {
        el.removeEventListener('scroll', checkScrollState);
      }
      window.removeEventListener('resize', checkScrollState);
    };
  }, [items, loading, type, checkScrollState]);

  const handleScroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;

    const scrollAmount = direction === 'left' ? -el.clientWidth * 0.75 : el.clientWidth * 0.75;
    el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  const renderCardItem = (item: Song | Album | Artist) => {
    if (type === 'song') {
      const song = item as Song;
      return (
        <SongCard
          song={song}
          onPlay={onPlaySong}
          isPlaying={currentPlayingSongId === song._id}
        />
      );
    }

    if (type === 'artist') {
      return <ArtistCard artist={item as Artist} />;
    }

    if (type === 'album') {
      return <AlbumCard album={item as Album} />;
    }

    return null;
  };

  return (
    <section className="space-y-3.5">
      {/* Header Row */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-text-primary tracking-tight font-body">
            {title}
          </h2>
          {subtitle && <p className="text-xs sm:text-sm text-text-tertiary mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-1">
            <button
              onClick={() => handleScroll('left')}
              disabled={!canScrollLeft}
              className="p-1.5 rounded-full disabled:opacity-25 disabled:cursor-not-allowed text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors cursor-pointer"
              aria-label="Scroll Carousel Left"
            >
              <ChevronLeft size={16} strokeWidth={1.75} />
            </button>
            <button
              onClick={() => handleScroll('right')}
              disabled={!canScrollRight}
              className="p-1.5 rounded-full disabled:opacity-25 disabled:cursor-not-allowed text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors cursor-pointer"
              aria-label="Scroll Carousel Right"
            >
              <ChevronRight size={16} strokeWidth={1.75} />
            </button>
          </div>

          {seeAllLink && (
            <Link
              to={seeAllLink}
              className="text-xs font-medium text-text-secondary hover:text-accent transition-colors flex items-center gap-1"
            >
              See all
              <ArrowRight size={13} strokeWidth={1.75} />
            </Link>
          )}
        </div>
      </div>

      {/* Horizontal Scroll Track */}
      <div
        ref={scrollRef}
        className="flex items-stretch gap-3 overflow-x-auto pb-3 scrollbar-none scroll-smooth -mx-1 px-1 touch-pan-x"
      >
        {loading ? (
          Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="w-40 sm:w-44 md:w-48 h-64 bg-surface-1 rounded-[var(--radius-md)] p-3 animate-pulse shrink-0 flex flex-col justify-between"
            >
              <div className="w-full aspect-square bg-surface-2 rounded-[var(--radius-artwork)]" />
              <div className="space-y-2 mt-3">
                <div className="h-3 bg-surface-2 rounded w-3/4" />
                <div className="h-2.5 bg-surface-2 rounded w-1/2" />
              </div>
            </div>
          ))
        ) : items && items.length > 0 ? (
          items.map((item) => (
            <div key={(item as any)._id || Math.random()} className="w-40 sm:w-44 md:w-48 shrink-0 flex flex-col">
              {renderCardItem(item)}
            </div>
          ))
        ) : (
          <div className="w-full py-8 text-center text-xs text-text-tertiary bg-surface-1 rounded-[var(--radius-md)]">
            {emptyMessage}
          </div>
        )}
      </div>
    </section>
  );
};
