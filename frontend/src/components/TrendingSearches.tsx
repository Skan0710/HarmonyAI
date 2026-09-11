import React from 'react';
import { Flame } from 'lucide-react';

interface TrendingSearchesProps {
  onSelectTrending: (query: string) => void;
}

const TRENDING_TOPICS = [
  'Synthwave',
  'Midnight Echoes',
  'Acoustic Sessions',
  'Summer Vibe',
  'Rock Anthems',
  'Chill Beats',
  'Pop Hits',
  'Lo-Fi Chill',
];

export const TrendingSearches: React.FC<TrendingSearchesProps> = ({ onSelectTrending }) => {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-text-primary font-body flex items-center gap-2">
        <Flame size={16} className="text-accent" strokeWidth={1.75} />
        Trending searches
      </h3>

      <div className="flex flex-wrap gap-1.5">
        {TRENDING_TOPICS.map((term) => (
          <button
            key={term}
            onClick={() => onSelectTrending(term)}
            className="px-4 py-2.5 bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-text-primary rounded-[var(--radius-pill)] text-sm font-medium transition-all duration-[var(--duration-fast)] hover:-translate-y-0.5 hover:shadow-[0_6px_16px_-4px_rgba(0,0,0,0.45)] active:translate-y-0 active:scale-95 cursor-pointer"
          >
            {term}
          </button>
        ))}
      </div>
    </div>
  );
};
