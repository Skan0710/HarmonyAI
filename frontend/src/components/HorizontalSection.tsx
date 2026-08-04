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
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
            {title}
          </h2>
          {subtitle && <p className="text-xs sm:text-sm text-slate-400 mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-2">
          {/* Scroll Left/Right Buttons */}
          <div className="hidden sm:flex items-center gap-1">
            <button
              onClick={() => handleScroll('left')}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors"
              aria-label="Scroll left"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => handleScroll('right')}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors"
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
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 pl-2"
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
              className="w-44 sm:w-48 h-64 bg-slate-800/50 border border-slate-700/40 rounded-2xl p-4 animate-pulse shrink-0 flex flex-col justify-between"
            >
              <div className="w-full aspect-square bg-slate-700/50 rounded-xl" />
              <div className="space-y-2">
                <div className="h-4 bg-slate-700/60 rounded w-3/4" />
                <div className="h-3 bg-slate-700/40 rounded w-1/2" />
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
