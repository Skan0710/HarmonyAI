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
            className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-text-primary rounded-[var(--radius-pill)] text-xs font-medium transition-colors cursor-pointer"
          >
            {term}
          </button>
        ))}
      </div>
    </div>
  );
};
