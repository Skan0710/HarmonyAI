import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { Song, Artist, Album } from '../types/music';
import { SongCard } from './SongCard';
import { ArtistCard } from './ArtistCard';
import { AlbumCard } from './AlbumCard';

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
    return () => {
      if (el) {
        el.removeEventListener('scroll', checkScrollState);
      }
      window.removeEventListener('resize', checkScrollState);
    };
  }, [items, loading, checkScrollState]);

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
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
            {title}
          </h2>
          {subtitle && <p className="text-xs sm:text-sm text-slate-400 mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-3">
          {/* Left/Right Navigation Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleScroll('left')}
              disabled={!canScrollLeft}
              className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 hover:text-white border border-slate-700/60 transition-all shadow-sm"
              aria-label="Scroll Carousel Left"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => handleScroll('right')}
              disabled={!canScrollRight}
              className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 hover:text-white border border-slate-700/60 transition-all shadow-sm"
              aria-label="Scroll Carousel Right"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {seeAllLink && (
            <Link
              to={seeAllLink}
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 pl-1"
            >
              See All
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )}
        </div>
      </div>

      {/* Horizontal Scroll Track */}
      <div
        ref={scrollRef}
        className="flex items-stretch gap-4 overflow-x-auto pb-3 scrollbar-none scroll-smooth -mx-1 px-1 touch-pan-x"
      >
        {loading ? (
          Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="w-40 sm:w-44 md:w-48 h-64 bg-slate-800/50 border border-slate-700/40 rounded-2xl p-4 animate-pulse shrink-0 flex flex-col justify-between"
            >
              <div className="w-full aspect-square bg-slate-700/50 rounded-xl" />
              <div className="space-y-2 mt-3">
                <div className="h-4 bg-slate-700/60 rounded w-3/4" />
                <div className="h-3 bg-slate-700/40 rounded w-1/2" />
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
          <div className="w-full py-8 text-center text-xs text-slate-400 bg-slate-800/30 rounded-xl border border-slate-700/40">
            {emptyMessage}
          </div>
        )}
      </div>
    </section>
  );
};
