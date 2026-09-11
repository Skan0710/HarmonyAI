import React, { useRef } from 'react';
import { Link } from 'react-router-dom';

interface HorizontalSectionProps {
  title: string;
  subtitle?: string;
  seeAllLink?: string;
  children: React.ReactNode;
  loading?: boolean;
}

export const HorizontalSection: React.FC<HorizontalSectionProps> = ({
  title,
  subtitle,
  seeAllLink,
  children,
  loading = false,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -340 : 340;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <section className="space-y-3.5">
      {/* Header Row */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight flex items-center gap-2 font-display">
            {title}
          </h2>
          {subtitle && <p className="text-xs sm:text-sm text-text-tertiary mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-2">
          {/* Scroll Left/Right Buttons */}
          <div className="hidden sm:flex items-center gap-1">
            <button
              onClick={() => handleScroll('left')}
              className="p-1.5 rounded-[var(--radius-sm)] bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-text-primary border border-border-default transition-colors cursor-pointer"
              aria-label="Scroll left"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => handleScroll('right')}
              className="p-1.5 rounded-[var(--radius-sm)] bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-text-primary border border-border-default transition-colors cursor-pointer"
              aria-label="Scroll right"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {seeAllLink && (
            <Link
              to={seeAllLink}
              className="text-xs font-semibold text-accent hover:text-accent-strong transition-colors flex items-center gap-1 pl-2"
            >
              See All
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )}
        </div>
      </div>

      {/* Scrollable Container */}
      <div
        ref={scrollContainerRef}
        className="flex items-stretch gap-4 overflow-x-auto pb-3 scrollbar-none scroll-smooth -mx-1 px-1"
      >
        {loading ? (
          Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="w-44 sm:w-48 h-64 bg-surface-1 border border-border-subtle rounded-[var(--radius-lg)] p-4 animate-pulse shrink-0 flex flex-col justify-between"
            >
              <div className="w-full aspect-square bg-surface-2 rounded-[var(--radius-artwork)]" />
              <div className="space-y-2">
                <div className="h-4 bg-surface-2 rounded w-3/4" />
                <div className="h-3 bg-surface-2 rounded w-1/2" />
              </div>
            </div>
          ))
        ) : (
          children
        )}
      </div>
    </section>
  );
};
